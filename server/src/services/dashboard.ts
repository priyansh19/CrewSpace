import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@crewspaceai/db";
import { agents, approvals, companies, costEvents, heartbeatRuns, issues } from "@crewspaceai/db";
import { notFound } from "../errors.js";
import { budgetService } from "./budgets.js";

export function dashboardService(db: Db) {
  const budgets = budgetService(db);
  return {
    summary: async (companyId: string, _projectId?: string) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const agentRows = await db
        .select({ status: agents.status, count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .groupBy(agents.status);

      const taskRows = await db
        .select({ status: issues.status, count: sql<number>`count(*)` })
        .from(issues)
        .where(eq(issues.companyId, companyId))
        .groupBy(issues.status);

      const pendingApprovals = await db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(and(eq(approvals.companyId, companyId), eq(approvals.status, "pending")))
        .then((rows) => Number(rows[0]?.count ?? 0));

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [{ monthSpend }] = await db
        .select({
          monthSpend: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, monthStart),
          ),
        );

      // Today's total spend
      const [{ todaySpend }] = await db
        .select({
          todaySpend: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, todayStart),
          ),
        );

      // Per-agent burn today
      const agentBurnRows = await db
        .select({
          agentId: costEvents.agentId,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          runsToday: sql<number>`count(distinct ${costEvents.heartbeatRunId})::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, todayStart),
            isNotNull(costEvents.agentId),
          ),
        )
        .groupBy(costEvents.agentId)
        .orderBy(desc(sql`sum(${costEvents.costCents})`))
        .limit(10);

      // Per-agent run outcome counts today (succeeded/failed)
      const runOutcomeRows = await db
        .select({
          agentId: heartbeatRuns.agentId,
          succeeded: sql<number>`count(*) filter (where ${heartbeatRuns.status} = 'succeeded')::int`,
          failed: sql<number>`count(*) filter (where ${heartbeatRuns.status} = 'failed')::int`,
        })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.companyId, companyId),
            gte(heartbeatRuns.startedAt, todayStart),
          ),
        )
        .groupBy(heartbeatRuns.agentId);
      const runOutcomeMap = new Map(
        runOutcomeRows.map((r) => [r.agentId, { succeeded: Number(r.succeeded), failed: Number(r.failed) }]),
      );

      // Token usage today
      const [tokenRow] = await db
        .select({
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::bigint`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::bigint`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::bigint`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, todayStart),
          ),
        );

      // Fetch agent names + statuses for burn entries
      const burnAgentIds = agentBurnRows.map((r) => r.agentId).filter(Boolean) as string[];
      const burnAgents = burnAgentIds.length > 0
        ? await db
            .select({ id: agents.id, name: agents.name, status: agents.status })
            .from(agents)
            .where(eq(agents.companyId, companyId))
        : [];
      const burnAgentMap = new Map(burnAgents.map((a) => [a.id, { name: a.name, status: a.status }]));

      // Tasks completed today
      const [{ todayDone }] = await db
        .select({ todayDone: sql<number>`count(*)::int` })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            eq(issues.status, "done"),
            gte(issues.completedAt, todayStart),
          ),
        );

      // Recent completed tasks (last 24h)
      const recentCompletedRows = await db
        .select({
          id: issues.id,
          title: issues.title,
          completedAt: issues.completedAt,
          assigneeAgentId: issues.assigneeAgentId,
        })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            eq(issues.status, "done"),
            gte(issues.completedAt, yesterday),
          ),
        )
        .orderBy(desc(issues.completedAt))
        .limit(10);

      // Fetch assignee names
      const assigneeIds = recentCompletedRows
        .map((r) => r.assigneeAgentId)
        .filter(Boolean) as string[];
      const assigneeAgents = assigneeIds.length > 0
        ? await db
            .select({ id: agents.id, name: agents.name })
            .from(agents)
            .where(eq(agents.companyId, companyId))
        : [];
      const assigneeMap = new Map(assigneeAgents.map((a) => [a.id, a.name]));

      // Pending approvals list
      const pendingApprovalRows = await db
        .select({
          id: approvals.id,
          type: approvals.type,
          requestedByAgentId: approvals.requestedByAgentId,
          payload: approvals.payload,
          createdAt: approvals.createdAt,
        })
        .from(approvals)
        .where(and(eq(approvals.companyId, companyId), eq(approvals.status, "pending")))
        .orderBy(desc(approvals.createdAt))
        .limit(20);

      const approvalAgentIds = pendingApprovalRows
        .map((r) => r.requestedByAgentId)
        .filter(Boolean) as string[];
      const approvalAgents = approvalAgentIds.length > 0
        ? await db
            .select({ id: agents.id, name: agents.name })
            .from(agents)
            .where(eq(agents.companyId, companyId))
        : [];
      const approvalAgentMap = new Map(approvalAgents.map((a) => [a.id, a.name]));

      const agentCounts: Record<string, number> = {
        active: 0, running: 0, paused: 0, error: 0,
      };
      for (const row of agentRows) {
        const count = Number(row.count);
        const bucket = row.status === "idle" ? "active" : row.status;
        agentCounts[bucket] = (agentCounts[bucket] ?? 0) + count;
      }

      const taskCounts: Record<string, number> = {
        open: 0, inProgress: 0, blocked: 0, done: 0,
      };
      for (const row of taskRows) {
        const count = Number(row.count);
        if (row.status === "in_progress") taskCounts.inProgress += count;
        if (row.status === "blocked") taskCounts.blocked += count;
        if (row.status === "done") taskCounts.done += count;
        if (row.status !== "done" && row.status !== "cancelled") taskCounts.open += count;
      }

      const monthSpendCents = Number(monthSpend);
      const utilization = company.budgetMonthlyCents > 0
        ? (monthSpendCents / company.budgetMonthlyCents) * 100
        : 0;
      const budgetOverview = await budgets.overview(companyId);

      return {
        companyId,
        agents: {
          active: agentCounts.active,
          running: agentCounts.running,
          paused: agentCounts.paused,
          error: agentCounts.error,
        },
        tasks: {
          ...taskCounts,
          todayCompleted: Number(todayDone ?? 0),
        },
        costs: {
          monthSpendCents,
          monthBudgetCents: company.budgetMonthlyCents,
          monthUtilizationPercent: Number(utilization.toFixed(2)),
          todaySpendCents: Number(todaySpend ?? 0),
          tokensToday: {
            inputTokens: Number(tokenRow?.inputTokens ?? 0),
            outputTokens: Number(tokenRow?.outputTokens ?? 0),
            cachedInputTokens: Number(tokenRow?.cachedInputTokens ?? 0),
          },
        },
        pendingApprovals,
        pendingApprovalsList: pendingApprovalRows.map((r) => ({
          id: r.id,
          type: r.type,
          requestedByAgentId: r.requestedByAgentId ?? null,
          requestedByAgentName: r.requestedByAgentId
            ? (approvalAgentMap.get(r.requestedByAgentId) ?? null)
            : null,
          payload: (r.payload ?? {}) as Record<string, unknown>,
          createdAt: r.createdAt.toISOString(),
        })),
        budgets: {
          activeIncidents: budgetOverview.activeIncidents.length,
          pendingApprovals: budgetOverview.pendingApprovalCount,
          pausedAgents: budgetOverview.pausedAgentCount,
          pausedProjects: budgetOverview.pausedProjectCount,
        },
        agentBurnToday: agentBurnRows
          .filter((r) => r.agentId != null)
          .map((r) => {
            const agentInfo = burnAgentMap.get(r.agentId!);
            const outcomes = runOutcomeMap.get(r.agentId!) ?? { succeeded: 0, failed: 0 };
            return {
              agentId: r.agentId!,
              agentName: agentInfo?.name ?? "Unknown",
              costCents: Number(r.costCents),
              runsToday: Number(r.runsToday),
              succeededToday: outcomes.succeeded,
              failedToday: outcomes.failed,
              status: agentInfo?.status ?? "idle",
            };
          }),
        recentCompleted: recentCompletedRows.map((r) => ({
          id: r.id,
          title: r.title,
          completedAt: r.completedAt?.toISOString() ?? new Date().toISOString(),
          assigneeAgentId: r.assigneeAgentId ?? null,
          assigneeAgentName: r.assigneeAgentId
            ? (assigneeMap.get(r.assigneeAgentId) ?? null)
            : null,
        })),
      };
    },
  };
}
