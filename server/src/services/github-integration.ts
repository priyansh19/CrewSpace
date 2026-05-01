import { createSign, randomBytes } from "node:crypto";

export interface GithubAppConfig {
  appId: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  slug: string;
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

export async function listInstallationRepos(
  config: GithubAppConfig,
  installationId: number,
): Promise<GithubRepoSummary[]> {
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

export async function verifyRepoAccess(
  config: GithubAppConfig,
  installationId: number,
  owner: string,
  repo: string,
): Promise<boolean> {
  try {
    const token = await getInstallationToken(config, installationId);
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
  const token = await getInstallationToken(config, installationId);
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
