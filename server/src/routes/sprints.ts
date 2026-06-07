import { Router } from "express";
import { eq, and, inArray, desc } from "drizzle-orm";
import type { Db } from "@crewspaceai/db";
import { sprints, sprintIssues, issues, agents } from "@crewspaceai/db";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function sprintRoutes(db: Db) {
  const router = Router();

  // ── List sprints ───────────────────────────────────────────────────────────
  router.get("/companies/:companyId/sprints", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const rows = await db
      .select()
      .from(sprints)
      .where(eq(sprints.companyId, companyId))
      .orderBy(desc(sprints.createdAt));

    res.json(rows);
  });

  // ── Create sprint ──────────────────────────────────────────────────────────
  router.post("/companies/:companyId/sprints", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);

    const { name, goal, status, startDate, endDate } = req.body as {
      name: string;
      goal?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const [sprint] = await db
      .insert(sprints)
      .values({
        companyId,
        name: name.trim(),
        goal: goal ?? null,
        status: status ?? "upcoming",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        createdByUserId: actor.actorType === "user" ? actor.actorId : null,
        createdByAgentId: actor.agentId ?? null,
      })
      .returning();

    res.status(201).json(sprint);
  });

  // ── Get sprint ─────────────────────────────────────────────────────────────
  router.get("/sprints/:id", async (req, res) => {
    const id = req.params.id as string;
    const [sprint] = await db.select().from(sprints).where(eq(sprints.id, id));
    if (!sprint) { res.status(404).json({ error: "Sprint not found" }); return; }
    assertCompanyAccess(req, sprint.companyId);
    res.json(sprint);
  });

  // ── Update sprint ──────────────────────────────────────────────────────────
  router.patch("/sprints/:id", async (req, res) => {
    const id = req.params.id as string;
    const [existing] = await db.select().from(sprints).where(eq(sprints.id, id));
    if (!existing) { res.status(404).json({ error: "Sprint not found" }); return; }
    assertCompanyAccess(req, existing.companyId);

    const { name, goal, status, startDate, endDate } = req.body as {
      name?: string;
      goal?: string | null;
      status?: string;
      startDate?: string | null;
      endDate?: string | null;
    };

    const updates: Partial<typeof sprints.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (name !== undefined) updates.name = name.trim();
    if (goal !== undefined) updates.goal = goal;
    if (status !== undefined) updates.status = status;
    if (startDate !== undefined) updates.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updates.endDate = endDate ? new Date(endDate) : null;

    const [sprint] = await db
      .update(sprints)
      .set(updates)
      .where(eq(sprints.id, id))
      .returning();

    res.json(sprint);
  });

  // ── Delete sprint ──────────────────────────────────────────────────────────
  router.delete("/sprints/:id", async (req, res) => {
    const id = req.params.id as string;
    const [existing] = await db.select().from(sprints).where(eq(sprints.id, id));
    if (!existing) { res.status(404).json({ error: "Sprint not found" }); return; }
    assertCompanyAccess(req, existing.companyId);

    await db.delete(sprints).where(eq(sprints.id, id));
    res.json({ ok: true });
  });

  // ── List sprint issues ─────────────────────────────────────────────────────
  router.get("/sprints/:id/issues", async (req, res) => {
    const sprintId = req.params.id as string;
    const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId));
    if (!sprint) { res.status(404).json({ error: "Sprint not found" }); return; }
    assertCompanyAccess(req, sprint.companyId);

    const links = await db
      .select()
      .from(sprintIssues)
      .where(eq(sprintIssues.sprintId, sprintId));

    if (links.length === 0) { res.json([]); return; }

    const issueIds = links.map((l) => l.issueId);
    const issueRows = await db
      .select()
      .from(issues)
      .where(inArray(issues.id, issueIds));

    res.json(issueRows);
  });

  // ── Add issue to sprint ────────────────────────────────────────────────────
  router.post("/sprints/:id/issues", async (req, res) => {
    const sprintId = req.params.id as string;
    const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId));
    if (!sprint) { res.status(404).json({ error: "Sprint not found" }); return; }
    assertCompanyAccess(req, sprint.companyId);

    const { issueId } = req.body as { issueId: string };
    if (!issueId) { res.status(400).json({ error: "issueId is required" }); return; }

    await db
      .insert(sprintIssues)
      .values({ sprintId, issueId, companyId: sprint.companyId })
      .onConflictDoNothing();

    res.status(201).json({ ok: true });
  });

  // ── Remove issue from sprint ───────────────────────────────────────────────
  router.delete("/sprints/:id/issues/:issueId", async (req, res) => {
    const sprintId = req.params.id as string;
    const issueId = req.params.issueId as string;
    const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId));
    if (!sprint) { res.status(404).json({ error: "Sprint not found" }); return; }
    assertCompanyAccess(req, sprint.companyId);

    await db
      .delete(sprintIssues)
      .where(and(eq(sprintIssues.sprintId, sprintId), eq(sprintIssues.issueId, issueId)));

    res.json({ ok: true });
  });

  // ── Sprint burndown data ───────────────────────────────────────────────────
  router.get("/sprints/:id/burndown", async (req, res) => {
    const sprintId = req.params.id as string;
    const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId));
    if (!sprint) { res.status(404).json({ error: "Sprint not found" }); return; }
    assertCompanyAccess(req, sprint.companyId);

    const links = await db
      .select()
      .from(sprintIssues)
      .where(eq(sprintIssues.sprintId, sprintId));

    if (links.length === 0) {
      res.json({ points: [], totalIssues: 0 });
      return;
    }

    const issueIds = links.map((l) => l.issueId);
    const issueRows = await db
      .select({
        id: issues.id,
        status: issues.status,
        completedAt: issues.completedAt,
        cancelledAt: issues.cancelledAt,
        assigneeAgentId: issues.assigneeAgentId,
        createdAt: issues.createdAt,
        priority: issues.priority,
      })
      .from(issues)
      .where(inArray(issues.id, issueIds));

    const totalIssues = issueRows.length;

    // Build day-by-day burndown using sprint date range
    const startMs = sprint.startDate
      ? new Date(sprint.startDate).getTime()
      : Math.min(...issueRows.map((i) => new Date(i.createdAt).getTime()));
    const endMs = sprint.endDate
      ? new Date(sprint.endDate).getTime()
      : Date.now();
    const todayMs = Math.min(endMs, Date.now());

    const days: { date: string; remaining: number; completed: number; ideal: number }[] = [];
    const totalDays = Math.max(1, Math.ceil((endMs - startMs) / 86_400_000));
    let d = startMs;

    while (d <= todayMs + 86_400_000) {
      const dayEnd = d + 86_400_000;
      const completed = issueRows.filter((i) => {
        const doneAt = i.completedAt ?? i.cancelledAt;
        return doneAt && new Date(doneAt).getTime() <= dayEnd;
      }).length;
      const remaining = totalIssues - completed;
      const elapsed = Math.ceil((d - startMs) / 86_400_000);
      const ideal = Math.max(0, totalIssues - Math.round(totalIssues * (elapsed / totalDays)));

      days.push({
        date: new Date(d).toISOString().slice(0, 10),
        remaining,
        completed,
        ideal,
      });
      d += 86_400_000;
    }

    // Per-agent breakdown
    const agentIds = [...new Set(issueRows.map((i) => i.assigneeAgentId).filter(Boolean) as string[])];
    let agentBreakdown: { agentId: string; agentName: string; total: number; done: number; inProgress: number; todo: number }[] = [];

    if (agentIds.length > 0) {
      const agentRows = await db
        .select({ id: agents.id, name: agents.name })
        .from(agents)
        .where(inArray(agents.id, agentIds));

      const agentNameMap = new Map(agentRows.map((a) => [a.id, a.name]));
      agentBreakdown = agentIds.map((agentId) => {
        const agentIssues = issueRows.filter((i) => i.assigneeAgentId === agentId);
        return {
          agentId,
          agentName: agentNameMap.get(agentId) ?? "Unknown",
          total: agentIssues.length,
          done: agentIssues.filter((i) => i.status === "done" || i.status === "cancelled").length,
          inProgress: agentIssues.filter((i) => i.status === "in_progress" || i.status === "in_review").length,
          todo: agentIssues.filter((i) => i.status === "todo" || i.status === "backlog" || i.status === "blocked").length,
        };
      });
    }

    // Summary counts
    const statusCounts = issueRows.reduce<Record<string, number>>((acc, i) => {
      acc[i.status] = (acc[i.status] ?? 0) + 1;
      return acc;
    }, {});

    res.json({
      sprintId,
      totalIssues,
      statusCounts,
      points: days,
      agentBreakdown,
    });
  });

  // ── Sprint summary ─────────────────────────────────────────────────────────
  router.get("/sprints/:id/summary", async (req, res) => {
    const sprintId = req.params.id as string;
    const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId));
    if (!sprint) { res.status(404).json({ error: "Sprint not found" }); return; }
    assertCompanyAccess(req, sprint.companyId);

    const links = await db.select().from(sprintIssues).where(eq(sprintIssues.sprintId, sprintId));
    if (links.length === 0) {
      res.json({ sprint, totalIssues: 0, done: 0, inProgress: 0, todo: 0, completionPct: 0, agentBreakdown: [] });
      return;
    }

    const issueIds = links.map((l) => l.issueId);
    const issueRows = await db
      .select({ id: issues.id, status: issues.status, priority: issues.priority, assigneeAgentId: issues.assigneeAgentId })
      .from(issues)
      .where(inArray(issues.id, issueIds));

    const done = issueRows.filter((i) => i.status === "done" || i.status === "cancelled").length;
    const inProgress = issueRows.filter((i) => i.status === "in_progress" || i.status === "in_review").length;
    const todo = issueRows.filter((i) => i.status === "todo" || i.status === "backlog" || i.status === "blocked").length;
    const completionPct = issueRows.length > 0 ? Math.round((done / issueRows.length) * 100) : 0;

    const agentIds = [...new Set(issueRows.map((i) => i.assigneeAgentId).filter(Boolean) as string[])];
    let agentBreakdown: { agentId: string; agentName: string; total: number; done: number }[] = [];

    if (agentIds.length > 0) {
      const agentRows = await db
        .select({ id: agents.id, name: agents.name })
        .from(agents)
        .where(inArray(agents.id, agentIds));
      const agentNameMap = new Map(agentRows.map((a) => [a.id, a.name]));
      agentBreakdown = agentIds.map((agentId) => ({
        agentId,
        agentName: agentNameMap.get(agentId) ?? "Unknown",
        total: issueRows.filter((i) => i.assigneeAgentId === agentId).length,
        done: issueRows.filter((i) => i.assigneeAgentId === agentId && (i.status === "done" || i.status === "cancelled")).length,
      }));
    }

    res.json({ sprint, totalIssues: issueRows.length, done, inProgress, todo, completionPct, agentBreakdown });
  });

  return router;
}
