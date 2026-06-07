/**
 * GitHub App Manifest Flow — temporary credential storage
 *
 * During desktop onboarding, GitHub App credentials are exchanged via
 * the manifest callback and stored temporarily until the desktop app
 * polls for them. Uses simple JSON file storage (no DB company yet).
 */

import { writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const TEMP_DIR = process.env.CREWSPACE_HOME
  ? join(process.env.CREWSPACE_HOME, "instances", "default", "data", "temp")
  : join(process.cwd(), "temp");

const MANIFEST_FILE = join(TEMP_DIR, "github-manifest-result.json");
const INSTALLATION_FILE = join(TEMP_DIR, "github-installation-result.json");
const STATE_FILE = join(TEMP_DIR, "github-oauth-states.json");
const TEMP_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year — credentials are long-lived, not truly ephemeral

function ensureDir() {
  mkdirSync(TEMP_DIR, { recursive: true });
}

export interface ManifestResult {
  id: number;
  slug: string;
  name: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  pem: string;
  htmlUrl: string;
  createdAt: number;
}

/** Minimal status returned to the desktop during polling. */
export interface ManifestStatus {
  ready: true;
  appId: string;
  slug: string;
  name: string;
  clientId: string;
  clientSecret: string;
  pem: string;
  htmlUrl: string;
}

export interface InstallationResult {
  installationId: number;
  state: string;
  setupAction: string;
  createdAt: number;
}

function isExpired(data: { createdAt: number }): boolean {
  return Date.now() - data.createdAt > TEMP_TTL_MS;
}

export function storeManifestResult(result: Omit<ManifestResult, "createdAt">): void {
  ensureDir();
  const payload: ManifestResult = { ...result, createdAt: Date.now() };
  writeFileSync(MANIFEST_FILE, JSON.stringify(payload, null, 2), "utf-8");
}

export function readManifestResult(): ManifestResult | null {
  if (!existsSync(MANIFEST_FILE)) return null;
  try {
    const data = JSON.parse(readFileSync(MANIFEST_FILE, "utf-8")) as ManifestResult;
    if (isExpired(data)) {
      unlinkSync(MANIFEST_FILE);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearManifestResult(): void {
  try {
    if (existsSync(MANIFEST_FILE)) unlinkSync(MANIFEST_FILE);
  } catch {
    /* ignore */
  }
}

export function storeInstallationResult(result: Omit<InstallationResult, "createdAt">): void {
  ensureDir();
  const payload: InstallationResult = { ...result, createdAt: Date.now() };
  writeFileSync(INSTALLATION_FILE, JSON.stringify(payload, null, 2), "utf-8");
}

export function readInstallationResult(): InstallationResult | null {
  if (!existsSync(INSTALLATION_FILE)) return null;
  try {
    const data = JSON.parse(readFileSync(INSTALLATION_FILE, "utf-8")) as InstallationResult;
    if (isExpired(data)) {
      unlinkSync(INSTALLATION_FILE);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearInstallationResult(): void {
  try {
    if (existsSync(INSTALLATION_FILE)) unlinkSync(INSTALLATION_FILE);
  } catch {
    /* ignore */
  }
}

// ── Temporary OAuth state storage (for onboarding without company/project) ──

interface TempState {
  state: string;
  expiresAt: number;
}

function readTempStates(): TempState[] {
  if (!existsSync(STATE_FILE)) return [];
  try {
    const data = JSON.parse(readFileSync(STATE_FILE, "utf-8")) as { states: TempState[] };
    // Filter expired
    const now = Date.now();
    return (data.states || []).filter((s) => s.expiresAt > now);
  } catch {
    return [];
  }
}

function writeTempStates(states: TempState[]): void {
  ensureDir();
  writeFileSync(STATE_FILE, JSON.stringify({ states }, null, 2), "utf-8");
}

export function storeTempState(state: string, ttlMinutes = 10): void {
  const states = readTempStates().filter((s) => s.state !== state);
  states.push({ state, expiresAt: Date.now() + ttlMinutes * 60 * 1000 });
  writeTempStates(states);
}

export function validateTempState(state: string): boolean {
  const states = readTempStates();
  const valid = states.some((s) => s.state === state);
  if (valid) {
    // One-time use: remove it
    writeTempStates(states.filter((s) => s.state !== state));
  }
  return valid;
}

/** Generate a manifest state token for CSRF protection. */
export function generateManifestState(): string {
  return randomBytes(32).toString("hex");
}

/** Return a minimal status-safe copy of manifest result (for polling). */
export function manifestToStatus(result: ManifestResult): Record<string, string> {
  return {
    appId: String(result.id),
    slug: result.slug,
    name: result.name,
    clientId: result.clientId,
    clientSecret: result.clientSecret,
    pem: result.pem,
    htmlUrl: result.htmlUrl,
  };
}

/** Exchange a manifest code for full app credentials. */
export async function exchangeManifestCode(
  code: string,
): Promise<ManifestResult | null> {
  const res = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "CrewSpace",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub manifest exchange failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as Record<string, unknown>;

  // Validate required fields
  if (
    typeof data.id !== "number" ||
    typeof data.slug !== "string" ||
    typeof data.pem !== "string" ||
    typeof data.client_id !== "string" ||
    typeof data.client_secret !== "string"
  ) {
    throw new Error("GitHub manifest response missing required fields");
  }

  return {
    id: data.id,
    slug: data.slug,
    name: typeof data.name === "string" ? data.name : data.slug,
    clientId: data.client_id,
    clientSecret: data.client_secret,
    webhookSecret: typeof data.webhook_secret === "string" ? data.webhook_secret : "",
    pem: data.pem,
    htmlUrl: typeof data.html_url === "string" ? data.html_url : `https://github.com/apps/${data.slug}`,
    createdAt: Date.now(),
  };
}
