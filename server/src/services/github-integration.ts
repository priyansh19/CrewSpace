import { createSign, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "@crewspaceai/db";
import { projectGithubRepos } from "@crewspaceai/db";
import { readManifestResult } from "./github-manifest.js";

export interface GithubAppConfig {
  /** GitHub App mode */
  appId?: string;
  privateKey?: string;
  clientId?: string;
  clientSecret?: string;
  slug?: string;
  /** Personal Access Token mode (alternative to GitHub App) */
  pat?: string;
}

export function isPatMode(config: GithubAppConfig): boolean {
  return !!config.pat;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Generate a GitHub App JWT signed with RS256. */
export async function generateAppJwt(config: GithubAppConfig): Promise<string> {
  if (!config.appId || !config.privateKey) {
    throw new Error("GitHub App ID and Private Key are required for JWT generation");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iat: now - 60,
      exp: now + 600,
      iss: config.appId,
    }),
  );
  const signingInput = `${header}.${payload}`;

  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(config.privateKey, "base64");
  const signatureUrlSafe = signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${signingInput}.${signatureUrlSafe}`;
}

/** Get an auth token for GitHub API calls. Uses PAT if available, otherwise installation token. */
export async function getAuthToken(
  config: GithubAppConfig,
  installationId?: number,
): Promise<string> {
  if (config.pat) {
    return config.pat;
  }
  if (!installationId) {
    throw new Error("Installation ID is required when not using PAT mode");
  }
  return getInstallationToken(config, installationId);
}

export async function getInstallationToken(
  config: GithubAppConfig,
  installationId: number,
): Promise<string> {
  const jwt = await generateAppJwt(config);
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CrewSpace",
      },
    },
  );
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json() as { token: string };
  return data.token;
}

export interface GithubRepoSummary {
  fullName: string;
  defaultBranch: string;
}

/** List repos accessible to the auth token (PAT or installation). */
export async function listAccessibleRepos(
  config: GithubAppConfig,
  installationId?: number,
): Promise<GithubRepoSummary[]> {
  if (config.pat) {
    // PAT mode: list user's accessible repos
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&sort=updated`,
      {
        headers: {
          Authorization: `token ${config.pat}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "CrewSpace",
        },
      },
    );
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data = await res.json() as Array<{ full_name: string; default_branch: string }>;
    return data.map((r) => ({
      fullName: r.full_name,
      defaultBranch: r.default_branch,
    }));
  }

  // GitHub App mode: list installation repos
  if (!installationId) {
    throw new Error("Installation ID is required for GitHub App mode");
  }
  const jwt = await generateAppJwt(config);
  const res = await fetch(
    `https://api.github.com/installations/${installationId}/repositories?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CrewSpace",
      },
    },
  );
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json() as { repositories: Array<{ full_name: string; default_branch: string }> };
  return data.repositories.map((r) => ({
    fullName: r.full_name,
    defaultBranch: r.default_branch,
  }));
}

/** Legacy alias for GitHub App mode. */
export async function listInstallationRepos(
  config: GithubAppConfig,
  installationId: number,
): Promise<GithubRepoSummary[]> {
  return listAccessibleRepos(config, installationId);
}

export async function verifyRepoAccess(
  config: GithubAppConfig,
  installationId: number,
  owner: string,
  repo: string,
): Promise<boolean> {
  try {
    const token = await getAuthToken(config, installationId || undefined);
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CrewSpace",
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getRepoBranches(
  config: GithubAppConfig,
  installationId: number,
  owner: string,
  repo: string,
): Promise<string[]> {
  const token = await getAuthToken(config, installationId || undefined);
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CrewSpace",
      },
    },
  );
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json() as Array<{ name: string }>;
  return data.map((b) => b.name);
}

export function generateStateToken(): string {
  return randomBytes(32).toString("hex");
}

// ── Pull requests ─────────────────────────────────────────────────────────────

interface GithubPrRaw {
  number: number;
  title: string;
  html_url: string;
  draft: boolean;
  mergeable_state: string;
  updated_at: string;
  merged_at: string | null;
  head: { ref: string };
  base: { ref: string };
  user: { login: string; avatar_url: string };
  labels: Array<{ name: string }>;
  body: string | null;
}

export interface PullRequestEntry {
  number: number;
  title: string;
  url: string;
  author: string;
  authorAvatar: string;
  state: "ready" | "open" | "draft" | "merged";
  updatedAt: string;
  labels: string[];
  referencedPrNumbers: number[];
  headRef: string;
  baseRef: string;
  repoOwner: string;
  repoName: string;
}

function extractPrRefs(body: string): number[] {
  const matches = body.matchAll(/#(\d+)/g);
  return [...new Set([...matches].map((m) => parseInt(m[1], 10)))];
}

async function fetchPrPage(
  owner: string,
  name: string,
  token: string,
  state: "open" | "closed",
): Promise<GithubPrRaw[]> {
  const resp = await fetch(
    `https://api.github.com/repos/${owner}/${name}/pulls?state=${state}&per_page=${state === "closed" ? 100 : 30}&sort=updated&direction=desc`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "CrewSpace",
      },
    },
  );
  if (!resp.ok) throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);
  return resp.json() as Promise<GithubPrRaw[]>;
}

function mapPr(pr: GithubPrRaw, repoOwner: string, repoName: string, forceMerged = false): PullRequestEntry {
  const merged = forceMerged || pr.merged_at != null;
  return {
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    author: pr.user.login,
    authorAvatar: pr.user.avatar_url,
    state: merged ? "merged" : pr.draft ? "draft" : pr.mergeable_state === "clean" ? "ready" : "open",
    updatedAt: pr.updated_at,
    labels: pr.labels.map((l) => l.name),
    referencedPrNumbers: extractPrRefs(pr.body ?? ""),
    headRef: pr.head.ref,
    baseRef: pr.base.ref,
    repoOwner,
    repoName,
  };
}

export async function listOpenPullRequests(
  db: Db,
  companyId: string,
  projectId: string,
  config?: GithubAppConfig,
): Promise<PullRequestEntry[]> {
  const cfg = resolveGithubConfig(config);

  const repo = await db.query.projectGithubRepos.findFirst({
    where: and(
      eq(projectGithubRepos.companyId, companyId),
      eq(projectGithubRepos.projectId, projectId),
    ),
  });
  if (!repo) {
    const err = new Error("No GitHub repo connected to this project");
    (err as Error & { code: string }).code = "NO_REPO";
    throw err;
  }

  if (!cfg) {
    const err = new Error("GitHub integration is not configured");
    (err as Error & { code: string }).code = "NO_CONFIG";
    throw err;
  }

  const token = await getAuthToken(cfg, repo.installationId || undefined);
  const { repoOwner, repoName } = repo;

  const [openPrs, closedPrs] = await Promise.all([
    fetchPrPage(repoOwner, repoName, token, "open"),
    fetchPrPage(repoOwner, repoName, token, "closed"),
  ]);

  const mergedPrs = closedPrs.filter((pr) => pr.merged_at != null);

  const all = [
    ...openPrs.map((pr) => mapPr(pr, repoOwner, repoName)),
    ...mergedPrs.map((pr) => mapPr(pr, repoOwner, repoName, true)),
  ];

  all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return all;
}

export async function mergePullRequest(
  db: Db,
  companyId: string,
  projectId: string,
  prNumber: number,
  config?: GithubAppConfig,
): Promise<{ merged: boolean; message: string }> {
  const cfg = resolveGithubConfig(config);
  if (!cfg) throw new Error("GitHub not configured");

  const repo = await db.query.projectGithubRepos.findFirst({
    where: and(
      eq(projectGithubRepos.companyId, companyId),
      eq(projectGithubRepos.projectId, projectId),
    ),
  });
  if (!repo) throw new Error("No GitHub repo connected to this project");

  const token = await getAuthToken(cfg, repo.installationId || undefined);
  const resp = await fetch(
    `https://api.github.com/repos/${repo.repoOwner}/${repo.repoName}/pulls/${prNumber}/merge`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "CrewSpace",
      },
      body: JSON.stringify({ merge_method: "merge" }),
    },
  );
  if (!resp.ok) {
    const body = await resp.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? `GitHub API error: ${resp.status}`);
  }
  const data = await resp.json() as { merged: boolean; message: string };
  return data;
}

/** Resolve a usable GitHub config from explicit config or manifest temp file. */
export function resolveGithubConfig(config?: GithubAppConfig): GithubAppConfig | undefined {
  if (config?.pat || config?.appId) return config;
  const manifest = readManifestResult();
  if (manifest) {
    return {
      appId: String(manifest.id),
      privateKey: manifest.pem,
      clientId: manifest.clientId,
      clientSecret: manifest.clientSecret,
      slug: manifest.slug,
    };
  }
  return config;
}
