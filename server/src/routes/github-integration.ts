import { Router } from "express";
import { eq, and, gt } from "drizzle-orm";
import type { Db } from "@crewspaceai/db";
import { projectGithubRepos, projectRepoPermissions, githubOAuthStates } from "@crewspaceai/db";
import { assertCompanyAccess } from "./authz.js";
import type { GithubAppConfig } from "../services/github-integration.js";
import {
  verifyRepoAccess,
  getRepoBranches,
  listInstallationRepos,
  generateStateToken,
} from "../services/github-integration.js";

const CALLBACK_HTML = `<!DOCTYPE html>
<html>
<head><title>GitHub Connected</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#faf9f5;">
  <div style="text-align:center;">
    <div style="font-size:48px;margin-bottom:16px;">✅</div>
    <h2 style="margin:0 0 8px;color:#141413;">GitHub Connected</h2>
    <p style="color:#8e8b82;margin:0;">This window will close automatically...</p>
  </div>
  <script>
    const params = new URLSearchParams(location.search);
    const installationId = params.get('installation_id');
    const state = params.get('state');
    const setupAction = params.get('setup_action');
    const error = params.get('error');
    
    if (window.opener) {
      window.opener.postMessage({
        type: 'github-callback',
        installationId,
        state,
        setupAction,
        error
      }, '*');
    }
    
    setTimeout(() => window.close(), 2000);
  </script>
</body>
</html>`;

export function githubIntegrationRoutes(db: Db, config?: GithubAppConfig) {
  const router = Router();

  if (!config) {
    router.use("/companies/:companyId/projects/:projectId/github", (_req, res) => {
      res.status(503).json({ error: "GitHub integration is not configured" });
    });
    router.use("/github", (_req, res) => {
      res.status(503).json({ error: "GitHub integration is not configured" });
    });
    return router;
  }

  // ── OAuth Initiation ──
  router.get("/github/install", async (req, res) => {
    const companyId = req.query.companyId as string;
    const projectId = req.query.projectId as string;

    if (!companyId || !projectId) {
      res.status(400).json({ error: "companyId and projectId are required" });
      return;
    }

    const state = generateStateToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await db.insert(githubOAuthStates).values({
      state,
      companyId,
      projectId,
      expiresAt,
    });

    const baseUrl = process.env.GITHUB_CALLBACK_URL || `http://localhost:3100`;
    const redirectUri = `${baseUrl}/api/github/callback`;

    const githubUrl = new URL(`https://github.com/apps/${config.slug}/installations/new`);
    githubUrl.searchParams.set("state", state);
    githubUrl.searchParams.set("redirect_uri", redirectUri);

    res.redirect(githubUrl.toString());
  });

  // ── OAuth Callback ──
  router.get("/github/callback", async (req, res) => {
    const state = req.query.state as string;
    const installationId = req.query.installation_id as string | undefined;
    const setupAction = req.query.setup_action as string | undefined;
    const error = req.query.error as string | undefined;

    if (error) {
      res.status(400).send(`<h1>GitHub Error</h1><p>${error}</p><script>setTimeout(()=>window.close(),3000)</script>`);
      return;
    }

    // Validate state
    const stateRecord = await db.query.githubOAuthStates.findFirst({
      where: and(
        eq(githubOAuthStates.state, state),
        gt(githubOAuthStates.expiresAt, new Date()),
      ),
    });

    if (!stateRecord) {
      res.status(400).send("<h1>Invalid or expired state</h1><script>setTimeout(()=>window.close(),3000)</script>");
      return;
    }

    // Clean up state
    await db.delete(githubOAuthStates).where(eq(githubOAuthStates.state, state));

    if (!installationId) {
      res.status(400).send("<h1>No installation ID received from GitHub</h1><script>setTimeout(()=>window.close(),3000)</script>");
      return;
    }

    // Try to fetch repos to include in the callback message
    let repos: Array<{ fullName: string; defaultBranch: string }> = [];
    try {
      repos = await listInstallationRepos(config, parseInt(installationId, 10));
    } catch {
      // Repos will be fetched later by the frontend
    }

    // Build callback HTML with repos embedded
    const html = `<!DOCTYPE html>
<html>
<head><title>GitHub Connected</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#faf9f5;">
  <div style="text-align:center;">
    <div style="font-size:48px;margin-bottom:16px;">✅</div>
    <h2 style="margin:0 0 8px;color:#141413;">GitHub Connected</h2>
    <p style="color:#8e8b82;margin:0;">This window will close automatically...</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: 'github-callback',
        installationId: '${installationId}',
        state: '${state}',
        setupAction: '${setupAction || ""}',
        repos: ${JSON.stringify(repos)}
      }, '*');
    }
    setTimeout(() => window.close(), 2000);
  </script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  });

  // ── Project-scoped API ──

  // Get connected repo
  router.get("/companies/:companyId/projects/:projectId/github/repo", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    const repo = await db.query.projectGithubRepos.findFirst({
      where: eq(projectGithubRepos.projectId, req.params.projectId),
    });
    if (!repo) {
      res.status(404).json({ error: "No GitHub repo connected" });
      return;
    }
    res.json(repo);
  });

  // Connect a repo (now accepts repoFullName instead of separate owner/name)
  router.post("/companies/:companyId/projects/:projectId/github/repo", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    const { installationId, repoFullName, defaultBranch = "main" } = req.body;

    if (!installationId || !repoFullName) {
      res.status(400).json({ error: "installationId and repoFullName are required" });
      return;
    }

    const [owner, repoName] = repoFullName.split("/");
    if (!owner || !repoName) {
      res.status(400).json({ error: "repoFullName must be in format 'owner/repo'" });
      return;
    }

    // Verify access
    const hasAccess = await verifyRepoAccess(config, installationId, owner, repoName);
    if (!hasAccess) {
      res.status(403).json({ error: "Cannot access repository" });
      return;
    }

    // Delete existing
    await db.delete(projectGithubRepos).where(eq(projectGithubRepos.projectId, req.params.projectId));

    const [repo] = await db
      .insert(projectGithubRepos)
      .values({
        projectId: req.params.projectId,
        companyId: req.params.companyId,
        installationId,
        repoOwner: owner,
        repoName,
        defaultBranch,
      })
      .returning();

    res.json(repo);
  });

  // Disconnect repo
  router.delete("/companies/:companyId/projects/:projectId/github/repo", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    await db.delete(projectGithubRepos).where(eq(projectGithubRepos.projectId, req.params.projectId));
    await db.delete(projectRepoPermissions).where(eq(projectRepoPermissions.projectId, req.params.projectId));
    res.status(204).end();
  });

  // List repos for an installation
  router.get("/companies/:companyId/projects/:projectId/github/repos", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    const repo = await db.query.projectGithubRepos.findFirst({
      where: eq(projectGithubRepos.projectId, req.params.projectId),
    });

    if (!repo) {
      res.status(404).json({ error: "No GitHub repo connected" });
      return;
    }

    try {
      const repos = await listInstallationRepos(config, repo.installationId);
      res.json(repos);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list repos" });
    }
  });

  // Get branches
  router.get("/companies/:companyId/projects/:projectId/github/branches", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    const repo = await db.query.projectGithubRepos.findFirst({
      where: eq(projectGithubRepos.projectId, req.params.projectId),
    });
    if (!repo) {
      res.status(404).json({ error: "No GitHub repo connected" });
      return;
    }
    const branches = await getRepoBranches(config, repo.installationId, repo.repoOwner, repo.repoName);
    res.json(branches);
  });

  // List agent permissions
  router.get("/companies/:companyId/projects/:projectId/github/agents", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    const perms = await db.query.projectRepoPermissions.findMany({
      where: eq(projectRepoPermissions.projectId, req.params.projectId),
    });
    res.json(perms);
  });

  // Update agent permission
  router.post("/companies/:companyId/projects/:projectId/github/agents", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    const { agentId, canRead, canPush, canCreateBranch } = req.body;

    if (!agentId) {
      res.status(400).json({ error: "agentId is required" });
      return;
    }

    const [perm] = await db
      .insert(projectRepoPermissions)
      .values({
        projectId: req.params.projectId,
        agentId,
        canRead: canRead ?? true,
        canPush: canPush ?? false,
        canCreateBranch: canCreateBranch ?? false,
      })
      .onConflictDoUpdate({
        target: [projectRepoPermissions.projectId, projectRepoPermissions.agentId],
        set: {
          canRead: canRead ?? true,
          canPush: canPush ?? false,
          canCreateBranch: canCreateBranch ?? false,
        },
      })
      .returning();

    res.json(perm);
  });

  // Revoke agent permission
  router.delete("/companies/:companyId/projects/:projectId/github/agents/:agentId", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    await db
      .delete(projectRepoPermissions)
      .where(
        and(
          eq(projectRepoPermissions.projectId, req.params.projectId),
          eq(projectRepoPermissions.agentId, req.params.agentId),
        ),
      );
    res.status(204).end();
  });

  return router;
}
