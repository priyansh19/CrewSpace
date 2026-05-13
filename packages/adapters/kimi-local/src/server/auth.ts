import { readFile } from "node:fs/promises";
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
