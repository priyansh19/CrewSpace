import { Router } from "express";
import type { Db } from "@crewspaceai/db";
import { chatSessionsService } from "../services/chatSessions.js";
import { assertCompanyAccess } from "./authz.js";

export function chatSessionRoutes(db: Db) {
  const router = Router();
  const svc = chatSessionsService(db);

  router.get("/companies/:companyId/chat-sessions", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const sessions = await svc.list(companyId);
    res.json(sessions);
  });

  router.post("/companies/:companyId/chat-sessions", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const { primaryAgentId, participantIds = [], name } = req.body as {
      primaryAgentId: string;
      participantIds?: string[];
      name?: string;
    };
    if (!primaryAgentId) {
      res.status(400).json({ error: "primaryAgentId is required" });
      return;
    }
    const session = await svc.create(companyId, { primaryAgentId, participantIds, name });
    res.status(201).json(session);
  });

  router.get("/chat-sessions/:id", async (req, res) => {
    const { id } = req.params;
    const session = await svc.getWithMessages(id);
    if (!session) {
      res.status(404).json({ error: "Chat session not found" });
      return;
    }
    assertCompanyAccess(req, session.companyId);
    res.json(session);
  });

  router.patch("/chat-sessions/:id", async (req, res) => {
    const { id } = req.params;
    const existing = await svc.getWithMessages(id);
    if (!existing) {
      res.status(404).json({ error: "Chat session not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const { name } = req.body as { name: string };
    const session = await svc.rename(id, name ?? "");
    res.json(session);
  });

  router.delete("/chat-sessions/:id", async (req, res) => {
    const { id } = req.params;
    const existing = await svc.getWithMessages(id);
    if (!existing) {
      res.status(404).json({ error: "Chat session not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    await svc.remove(id);
    res.status(204).end();
  });

  router.post("/chat-sessions/:id/messages", async (req, res) => {
    const { id } = req.params;
    const existing = await svc.getWithMessages(id);
    if (!existing) {
      res.status(404).json({ error: "Chat session not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const { role, content, agentId } = req.body as { role: string; content: string; agentId?: string };
    if (!role || !content) {
      res.status(400).json({ error: "role and content are required" });
      return;
    }
    const message = await svc.appendMessage(id, { role, content, agentId });
    res.status(201).json(message);
  });

  return router;
}
