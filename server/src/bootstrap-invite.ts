import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "@crewspaceai/db";
import { instanceUserRoles, invites } from "@crewspaceai/db";
import { logger } from "./middleware/logger.js";

let _activeBootstrapToken: string | null = null;

export function getActiveBootstrapToken(): string | null {
  return _activeBootstrapToken;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function ensureBootstrapInvite(db: Db, publicBaseUrl: string): Promise<void> {
  const adminCount = await db
    .select({ count: count() })
    .from(instanceUserRoles)
    .where(eq(instanceUserRoles.role, "instance_admin"))
    .then((rows) => Number(rows[0]?.count ?? 0));

  if (adminCount > 0) {
    return;
  }

  // Revoke any stale active bootstrap invites so we issue exactly one
  const now = new Date();
  await db
    .update(invites)
    .set({ revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(invites.inviteType, "bootstrap_ceo"),
        isNull(invites.revokedAt),
        isNull(invites.acceptedAt),
        gt(invites.expiresAt, now),
      ),
    );

  const token = `pcp_bootstrap_${randomBytes(24).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

  await db.insert(invites).values({
    inviteType: "bootstrap_ceo",
    tokenHash: hashToken(token),
    allowedJoinTypes: "human",
    expiresAt,
    invitedByUserId: "system",
  });

  _activeBootstrapToken = token;

  const inviteUrl = `${publicBaseUrl}/invite/${token}`;
  logger.info({ inviteUrl }, "Auto-created bootstrap admin invite");
  console.log(`\n  Bootstrap admin invite: ${inviteUrl}\n`);
}
