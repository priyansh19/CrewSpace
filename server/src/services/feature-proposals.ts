import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@crewspaceai/db";
import { featureProposals, issues } from "@crewspaceai/db";

export function featureProposalService(db: Db) {
  return {
    list: (companyId: string, status?: string) =>
      db
        .select()
        .from(featureProposals)
        .where(
          status
            ? and(eq(featureProposals.companyId, companyId), eq(featureProposals.status, status))
            : eq(featureProposals.companyId, companyId),
        )
        .orderBy(desc(featureProposals.createdAt)),

    getById: (id: string) =>
      db
        .select()
        .from(featureProposals)
        .where(eq(featureProposals.id, id))
        .then((rows) => rows[0] ?? null),

    create: (companyId: string, data: Omit<typeof featureProposals.$inferInsert, "companyId" | "id" | "createdAt">) =>
      db
        .insert(featureProposals)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]),

    accept: async (id: string, reviewedByUserId: string) => {
      const proposal = await db
        .select()
        .from(featureProposals)
        .where(eq(featureProposals.id, id))
        .then((rows) => rows[0] ?? null);

      if (!proposal) return null;

      const [issue] = await db
        .insert(issues)
        .values({
          companyId: proposal.companyId,
          title: proposal.title,
          description: proposal.description,
          status: "backlog",
          priority: proposal.priority === "high" ? "high" : proposal.priority === "low" ? "low" : "medium",
        })
        .returning();

      const [updated] = await db
        .update(featureProposals)
        .set({
          status: "accepted",
          createdIssueId: issue.id,
          reviewedByUserId,
          reviewedAt: new Date(),
        })
        .where(eq(featureProposals.id, id))
        .returning();

      return { proposal: updated, issue };
    },

    reject: async (id: string, reviewedByUserId: string) => {
      const [updated] = await db
        .update(featureProposals)
        .set({
          status: "rejected",
          reviewedByUserId,
          reviewedAt: new Date(),
        })
        .where(eq(featureProposals.id, id))
        .returning();
      return updated ?? null;
    },
  };
}
