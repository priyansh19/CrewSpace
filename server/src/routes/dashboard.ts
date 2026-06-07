import { Router } from "express";
import type { Db } from "@crewspaceai/db";
import { dashboardService } from "../services/dashboard.js";
import { assertCompanyAccess } from "./authz.js";

export function dashboardRoutes(db: Db) {
  const router = Router();
  const svc = dashboardService(db);

  router.get("/companies/:companyId/dashboard", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const projectId = req.query.projectId as string | undefined;
    const summary = await svc.summary(companyId, projectId);
    res.json(summary);
  });

  return router;
}
