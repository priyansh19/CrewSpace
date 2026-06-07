import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";

export interface KimiAuthInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
  /** User identifier extracted from the access token JWT payload */
  userId?: string;
}

function getKimiHomeDir(): string {
  return process.env.KIMI_HOME || path.join(os.homedir(), ".kimi");
}

/** Read Kimi native auth credentials from ~/.kimi/credentials/kimi-code.json */
export async function readKimiAuthInfo(kimiHome?: string): Promise<KimiAuthInfo | null> {
  const home = kimiHome || getKimiHomeDir();
  const authPath = path.join(home, "credentials", "kimi-code.json");

  try {
    const raw = await readFile(authPath, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;

    if (
      typeof data.access_token !== "string" ||
      typeof data.refresh_token !== "string" ||
      typeof data.expires_at !== "number"
    ) {
      return null;
    }

    // Extract user_id from JWT payload (second segment)
    let userId: string | undefined;
    try {
      const segments = data.access_token.split(".");
      if (segments.length >= 2) {
        const payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf-8")) as Record<string, unknown>;
        if (typeof payload.sub === "string") userId = payload.sub;
        else if (typeof payload.user_id === "string") userId = payload.user_id;
      }
    } catch {
      // Ignore JWT parse errors
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      scope: typeof data.scope === "string" ? data.scope : "kimi-code",
      tokenType: typeof data.token_type === "string" ? data.token_type : "Bearer",
      userId,
    };
  } catch {
    return null;
  }
}

/** Check if the stored access token is still valid (with 60s buffer). */
export function isKimiAuthValid(auth: KimiAuthInfo): boolean {
  return Date.now() / 1000 < auth.expiresAt - 60;
}

/**
 * Refresh Kimi native credentials by running `kimi login --json`.
 * The device authorization flow silently re-uses the stored refresh token,
 * so no browser interaction is needed when a valid refresh token exists.
 * Writes the new access token back to ~/.kimi/credentials/kimi-code.json.
 *
 * @param command   Path to the kimi binary (default "kimi")
 * @param timeoutMs How long to wait for refresh before giving up (default 30s)
 */
export async function refreshKimiCredentials(
  command = "kimi",
  timeoutMs = 30_000,
): Promise<{ success: boolean; errorMessage?: string }> {
  return new Promise((resolve) => {
    // Run WITHOUT KIMI_SHARE_DIR so the refreshed token is written back to
    // the default ~/.kimi/credentials/ location that all agents share.
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === "string" && key !== "KIMI_SHARE_DIR") {
        env[key] = value;
      }
    }

    const child = spawn(command, ["login", "--json"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      child.kill();
      resolve({ success: false, errorMessage: "kimi login timed out" });
    }, timeoutMs);

    let succeeded = false;
    let lastError = "";

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed) as Record<string, unknown>;
          if (event.type === "success") succeeded = true;
          if (event.type === "error" && typeof event.message === "string") {
            lastError = event.message;
          }
        } catch {
          // non-JSON lines are informational
        }
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (succeeded || code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, errorMessage: lastError || `kimi login exited with code ${code}` });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, errorMessage: err.message });
    });
  });
}
