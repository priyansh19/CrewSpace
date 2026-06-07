import { Router } from "express";
import type { Db } from "@crewspaceai/db";
import { agentMemoriesService } from "../services/agentMemories.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function agentMemoryRoutes(db: Db) {
  const router = Router();
  const svc = agentMemoriesService(db);

  // GET graph data (memories + links) for a company
  router.get("/companies/:companyId/memories/graph", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const graph = await svc.listGraph(companyId);
    res.json(graph);
  });

  // POST create a new memory
  router.post("/companies/:companyId/memories", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const memory = await svc.create(companyId, {
      ...req.body,
      createdByUserId: actor.actorType === "user" ? actor.actorId : undefined,
      createdByAgentId: actor.actorType === "agent" ? actor.actorId : undefined,
    });
    res.status(201).json(memory);
  });

  // PATCH update a memory
  router.patch("/memories/:id", async (req, res) => {
    const { id } = req.params;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const actor = getActorInfo(req);
    const memory = await svc.update(id, {
      ...req.body,
      updatedByUserId: actor.actorType === "user" ? actor.actorId : undefined,
      updatedByAgentId: actor.actorType === "agent" ? actor.actorId : undefined,
    });
    res.json(memory);
  });

  // DELETE a memory
  router.delete("/memories/:id", async (req, res) => {
    const { id } = req.params;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    await svc.remove(id);
    res.status(204).end();
  });

  // POST create a link between two memories
  router.post("/companies/:companyId/memories/links", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const link = await svc.createLink(companyId, {
      ...req.body,
      createdByUserId: actor.actorType === "user" ? actor.actorId : undefined,
      createdByAgentId: actor.actorType === "agent" ? actor.actorId : undefined,
    });
    if (!link) {
      res.status(409).json({ error: "Link already exists" });
      return;
    }
    res.status(201).json(link);
  });

  // DELETE a link
  router.delete("/memories/links/:linkId", async (req, res) => {
    const { linkId } = req.params;
    await svc.removeLink(linkId);
    res.status(204).end();
  });

  // POST save a task solution to agent's memory
  router.post("/companies/:companyId/task-solutions", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const { agentId, taskTitle, approach, outcome } = req.body;

    if (!agentId || !taskTitle || !approach) {
      res.status(400).json({ error: "Missing required fields: agentId, taskTitle, approach" });
      return;
    }

    try {
      const memory = await svc.create(companyId, {
        title: `Task: ${taskTitle.slice(0, 80)}`,
        content: approach,
        memoryType: "task",
        agentIds: [agentId],
        createdByAgentId: agentId,
        metadata: {
          isTaskSolution: true,
          outcome: outcome || "Completed",
          savedAt: new Date().toISOString(),
        },
      });

      res.status(201).json(memory);
    } catch (e) {
      console.error("Failed to save task solution:", e);
      res.status(500).json({ error: "Failed to save task solution" });
    }
  });

  // GET find similar past task solutions
  router.get(
    "/companies/:companyId/agents/:agentId/similar-tasks",
    async (req, res) => {
      const { companyId, agentId } = req.params;
      const { query } = req.query;

      assertCompanyAccess(req, companyId);

      if (!query || typeof query !== "string") {
        res.status(400).json({ error: "Missing query parameter" });
        return;
      }

      try {
        const { memories } = await svc.listGraph(companyId);

        // Find task memories for this agent
        const agentTaskMemories = memories.filter(
          (m) =>
            m.agents.some((a) => a.agentId === agentId && a.isOwner) &&
            (m.memoryType === "task" || m.metadata?.isTaskSolution),
        );

        // Simple keyword matching
        const keywords = new Set(
          query
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3),
        );

        const scored = agentTaskMemories
          .map((memory) => {
            const text = `${memory.title} ${memory.content}`.toLowerCase();
            let score = 0;
            for (const keyword of keywords) {
              if (text.includes(keyword)) score++;
            }
            return { memory, score };
          })
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((item) => item.memory);

        res.json(scored);
      } catch (e) {
        console.error("Failed to find similar tasks:", e);
        res.status(500).json({ error: "Failed to search tasks" });
      }
    },
  );

  return router;
}
