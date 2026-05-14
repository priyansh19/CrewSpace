import { Router } from "express";
import type { Db } from "@crewspaceai/db";
import { featureProposalService } from "../services/feature-proposals.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function featureProposalRoutes(db: Db) {
  const router = Router();
  const svc = featureProposalService(db);

  router.get("/companies/:companyId/feature-proposals", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const status = req.query.status as string | undefined;
    const proposals = await svc.list(companyId, status);
    res.json(proposals);
  });

  router.post("/companies/:companyId/feature-proposals", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const { title, description, category, priority, proposedByAgentId } = req.body as {
      title: string;
      description: string;
      category?: string;
      priority?: string;
      proposedByAgentId?: string;
    };
    if (!title || !description) {
      res.status(400).json({ error: "title and description are required" });
      return;
    }
    const proposal = await svc.create(companyId, {
      title,
      description,
      category: category ?? "other",
      priority: priority ?? "normal",
      proposedByAgentId: proposedByAgentId ?? null,
    });
    res.status(201).json(proposal);
  });

  router.patch("/companies/:companyId/feature-proposals/:proposalId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const proposalId = req.params.proposalId as string;
    assertCompanyAccess(req, companyId);

    const existing = await svc.getById(proposalId);
    if (!existing) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }
    if (existing.companyId !== companyId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { status } = req.body as { status: "accepted" | "rejected" };
    const actor = getActorInfo(req);
    const reviewedByUserId = actor.actorId ?? "unknown";

    if (status === "accepted") {
      const result = await svc.accept(proposalId, reviewedByUserId);
      res.json(result);
    } else if (status === "rejected") {
      const updated = await svc.reject(proposalId, reviewedByUserId);
      res.json(updated);
    } else {
      res.status(400).json({ error: "status must be 'accepted' or 'rejected'" });
    }
  });

  return router;
}
