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
  listAccessibleRepos,
  isPatMode,
  generateStateToken,
  resolveGithubConfig,
} from "../services/github-integration.js";
import {
  exchangeManifestCode,
  storeManifestResult,
  readManifestResult,
  clearManifestResult,
  storeInstallationResult,
  readInstallationResult,
  clearInstallationResult,
  generateManifestState,
  manifestToStatus,
  storeTempState,
  validateTempState,
} from "../services/github-manifest.js";

// ── HTML pages ──────────────────────────────────────────────────────

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

const MANIFEST_SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head><title>GitHub App Created</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0e0c;color:#faf9f5;">
  <div style="text-align:center;max-width:420px;padding:24px;">
    <div style="font-size:48px;margin-bottom:16px;">✅</div>
    <h2 style="margin:0 0 8px;color:#faf9f5;">GitHub App Created</h2>
    <p style="color:#a09d96;margin:0 0 16px;">Your CrewSpace GitHub App has been created successfully. You can close this window and return to the desktop app.</p>
    <p style="color:#5db872;font-size:14px;margin:0;">The app has automatically received your credentials.</p>
  </div>
  <script>setTimeout(() => window.close(), 3000);</script>
</body>
</html>`;

const MANIFEST_ERROR_HTML = (message: string) => `<!DOCTYPE html>
<html>
<head><title>GitHub App Error</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0e0c;color:#faf9f5;">
  <div style="text-align:center;max-width:420px;padding:24px;">
    <div style="font-size:48px;margin-bottom:16px;">❌</div>
    <h2 style="margin:0 0 8px;color:#faf9f5;">Something went wrong</h2>
    <p style="color:#a09d96;margin:0;">${message}</p>
  </div>
  <script>setTimeout(() => window.close(), 5000);</script>
</body>
</html>`;

export function githubIntegrationRoutes(db: Db, config?: GithubAppConfig) {
  const router = Router();

  // ═══════════════════════════════════════════════════════════════════
  //  Routes that work WITHOUT pre-existing GitHub App config
  //  (used during desktop onboarding manifest flow)
  // ═══════════════════════════════════════════════════════════════════

  // ── Generate manifest for GitHub App creation ──
  router.get("/github/manifest", async (_req, res) => {
    const baseUrl = process.env.GITHUB_CALLBACK_URL || `http://localhost:${process.env.PORT || 3150}`;
    const hostname = process.env.HOSTNAME || "crewspace-desktop";
    const state = generateManifestState();

    const manifest = {
      name: `CrewSpace-${hostname}`,
      url: baseUrl,
      hook_attributes: {
        url: `${baseUrl}/api/github/webhooks`,
      },
      redirect_url: `${baseUrl}/api/github/manifest-callback`,
      callback_urls: [`${baseUrl}/api/github/callback`],
      setup_url: `${baseUrl}/api/github/setup`,
      setup_on_update: true,
      description: "CrewSpace AI agent company control plane — repository integration, issue delegation, and PR automation",
      public: false,
      default_permissions: {
        contents: "write",
        issues: "write",
        pull_requests: "write",
        metadata: "read",
      },
      default_events: ["push", "pull_request", "issues"],
    };

    const manifestJson = JSON.stringify(manifest);
    const manifestBase64 = Buffer.from(manifestJson).toString("base64");
    const manifestUrl = `https://github.com/settings/apps/new?manifest=${encodeURIComponent(manifestBase64)}`;

    res.json({
      manifestUrl,
      state,
      manifest,
    });
  });

  // ── Manifest callback from GitHub ──
  // GitHub redirects here after the user creates the app.
  router.get("/github/manifest-callback", async (req, res) => {
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;
    const errorDescription = req.query.error_description as string | undefined;

    if (error) {
      console.error("[github-manifest] GitHub returned error:", error, errorDescription);
      res.setHeader("Content-Type", "text/html");
      res.status(400).send(MANIFEST_ERROR_HTML(errorDescription || error));
      return;
    }

    if (!code) {
      res.setHeader("Content-Type", "text/html");
      res.status(400).send(MANIFEST_ERROR_HTML("No authorization code received from GitHub."));
      return;
    }

    try {
      const result = await exchangeManifestCode(code);
      if (!result) {
        res.setHeader("Content-Type", "text/html");
        res.status(500).send(MANIFEST_ERROR_HTML("Failed to exchange manifest code for app credentials."));
        return;
      }

      storeManifestResult(result);
      console.log(`[github-manifest] App created: ${result.slug} (id=${result.id})`);

      res.setHeader("Content-Type", "text/html");
      res.send(MANIFEST_SUCCESS_HTML);
    } catch (err) {
      console.error("[github-manifest] Exchange failed:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      res.setHeader("Content-Type", "text/html");
      res.status(500).send(MANIFEST_ERROR_HTML(message));
    }
  });

  // ── Poll for manifest result (desktop onboarding) ──
  router.get("/github/manifest-status", async (_req, res) => {
    const result = readManifestResult();
    if (!result) {
      res.json({ ready: false });
      return;
    }
    res.json({
      ready: true,
      ...manifestToStatus(result),
    });
  });

  // ── Clear manifest result ──
  router.post("/github/manifest-clear", async (_req, res) => {
    clearManifestResult();
    res.json({ ok: true });
  });

  // ── Installation initiation ──
  // Redirects to the GitHub App installation page.
  // Works dynamically using stored manifest result if no static config.
  router.get("/github/install", async (req, res) => {
    const companyId = req.query.companyId as string | undefined;
    const projectId = req.query.projectId as string | undefined;

    // Determine slug: from static config, from stored manifest, or error
    let slug = config?.slug;
    if (!slug) {
      const manifest = readManifestResult();
      if (manifest) {
        slug = manifest.slug;
      }
    }

    if (!slug) {
      res.status(400).json({ error: "No GitHub App configured. Create an app first via the manifest flow." });
      return;
    }

    const state = generateStateToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Use DB states when company/project exist (web UI), temp file otherwise (onboarding)
    if (companyId && projectId) {
      await db.insert(githubOAuthStates).values({
        state,
        companyId,
        projectId,
        expiresAt,
      });
    } else {
      storeTempState(state, 10);
    }

    const baseUrl = process.env.GITHUB_CALLBACK_URL || `http://localhost:${process.env.PORT || 3150}`;
    const redirectUri = `${baseUrl}/api/github/callback`;

    const githubUrl = new URL(`https://github.com/apps/${slug}/installations/new`);
    githubUrl.searchParams.set("state", state);
    githubUrl.searchParams.set("redirect_uri", redirectUri);

    res.redirect(githubUrl.toString());
  });

  // ── Installation callback from GitHub ──
  router.get("/github/callback", async (req, res) => {
    const state = req.query.state as string;
    const installationId = req.query.installation_id as string | undefined;
    const setupAction = req.query.setup_action as string | undefined;
    const error = req.query.error as string | undefined;

    if (error) {
      res.status(400).send(`<h1>GitHub Error</h1><p>${error}</p><script>setTimeout(()=>window.close(),3000)</script>`);
      return;
    }

    // Validate state: try DB first (web UI), then temp file (onboarding)
    let stateValid = false;

    const stateRecord = await db.query.githubOAuthStates.findFirst({
      where: and(
        eq(githubOAuthStates.state, state),
        gt(githubOAuthStates.expiresAt, new Date()),
      ),
    });

    if (stateRecord) {
      stateValid = true;
      // Clean up DB state
      await db.delete(githubOAuthStates).where(eq(githubOAuthStates.state, state));
    } else if (validateTempState(state)) {
      stateValid = true;
    }

    if (!stateValid) {
      res.status(400).send("<h1>Invalid or expired state</h1><script>setTimeout(()=>window.close(),3000)</script>");
      return;
    }

    if (!installationId) {
      res.status(400).send("<h1>No installation ID received from GitHub</h1><script>setTimeout(()=>window.close(),3000)</script>");
      return;
    }

    // Store installation result for desktop polling
    storeInstallationResult({
      installationId: parseInt(installationId, 10),
      state,
      setupAction: setupAction || "install",
    });

    // Try to fetch repos to include in the callback message
    let repos: Array<{ fullName: string; defaultBranch: string }> = [];
    const resolvedConfig = resolveGithubConfig(config);
    if (resolvedConfig) {
      try {
        repos = await listInstallationRepos(resolvedConfig, parseInt(installationId, 10));
      } catch {
        // Repos will be fetched later
      }
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

  // ── Poll for installation result (desktop onboarding) ──
  router.get("/github/installation-status", async (_req, res) => {
    const result = readInstallationResult();
    if (!result) {
      res.json({ ready: false });
      return;
    }
    res.json({
      ready: true,
      installationId: result.installationId,
      setupAction: result.setupAction,
    });
  });

  // ── Clear installation result ──
  router.post("/github/installation-clear", async (_req, res) => {
    clearInstallationResult();
    res.json({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Routes that REQUIRE pre-existing GitHub App config
  //  Config is resolved dynamically from env vars or manifest temp file
  // ═══════════════════════════════════════════════════════════════════

  // ── Project-scoped API ──

  // Get connected repo
  router.get("/companies/:companyId/projects/:projectId/github/repo", async (req, res) => {
    const cfg = resolveGithubConfig(config);
    if (!cfg) {
      res.status(503).json({ error: "GitHub integration is not configured" });
      return;
    }
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
    const cfg = resolveGithubConfig(config);
    if (!cfg) {
      res.status(503).json({ error: "GitHub integration is not configured" });
      return;
    }
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
    const hasAccess = await verifyRepoAccess(cfg, installationId, owner, repoName);
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
    const cfg = resolveGithubConfig(config);
    if (!cfg) {
      res.status(503).json({ error: "GitHub integration is not configured" });
      return;
    }
    assertCompanyAccess(req, req.params.companyId);
    await db.delete(projectGithubRepos).where(eq(projectGithubRepos.projectId, req.params.projectId));
    await db.delete(projectRepoPermissions).where(eq(projectRepoPermissions.projectId, req.params.projectId));
    res.status(204).end();
  });

  // List accessible repos
  router.get("/companies/:companyId/projects/:projectId/github/repos", async (req, res) => {
    const cfg = resolveGithubConfig(config);
    if (!cfg) {
      res.status(503).json({ error: "GitHub integration is not configured" });
      return;
    }
    assertCompanyAccess(req, req.params.companyId);
    const repo = await db.query.projectGithubRepos.findFirst({
      where: eq(projectGithubRepos.projectId, req.params.projectId),
    });

    if (!repo) {
      res.status(404).json({ error: "No GitHub repo connected" });
      return;
    }

    try {
      const repos = await listAccessibleRepos(cfg, repo.installationId || undefined);
      res.json(repos);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list repos" });
    }
  });

  // Get branches
  router.get("/companies/:companyId/projects/:projectId/github/branches", async (req, res) => {
    const cfg = resolveGithubConfig(config);
    if (!cfg) {
      res.status(503).json({ error: "GitHub integration is not configured" });
      return;
    }
    assertCompanyAccess(req, req.params.companyId);
    const repo = await db.query.projectGithubRepos.findFirst({
      where: eq(projectGithubRepos.projectId, req.params.projectId),
    });
    if (!repo) {
      res.status(404).json({ error: "No GitHub repo connected" });
      return;
    }
    const branches = await getRepoBranches(cfg, repo.installationId, repo.repoOwner, repo.repoName);
    res.json(branches);
  });

  // List agent permissions
  router.get("/companies/:companyId/projects/:projectId/github/agents", async (req, res) => {
    const cfg = resolveGithubConfig(config);
    if (!cfg) {
      res.status(503).json({ error: "GitHub integration is not configured" });
      return;
    }
    assertCompanyAccess(req, req.params.companyId);
    const perms = await db.query.projectRepoPermissions.findMany({
      where: eq(projectRepoPermissions.projectId, req.params.projectId),
    });
    res.json(perms);
  });

  // Update agent permission
  router.post("/companies/:companyId/projects/:projectId/github/agents", async (req, res) => {
    const cfg = resolveGithubConfig(config);
    if (!cfg) {
      res.status(503).json({ error: "GitHub integration is not configured" });
      return;
    }
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
    const cfg = resolveGithubConfig(config);
    if (!cfg) {
      res.status(503).json({ error: "GitHub integration is not configured" });
      return;
    }
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
