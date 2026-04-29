import { Router } from "express";
import multer from "multer";
import type { Db } from "@crewspaceai/db";
import { sharedWorkspaceService } from "../services/shared-workspace.js";
import { assertCompanyAccess } from "./authz.js";

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

export function sharedWorkspaceRoutes(_db: Db, sharedWorkspaceDir: string) {
  const router = Router();
  const svc = sharedWorkspaceService(sharedWorkspaceDir);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } });

  router.get("/companies/:companyId/shared-workspace/files", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    const files = await svc.list();
    res.json(files);
  });

  router.post(
    "/companies/:companyId/shared-workspace/files",
    upload.single("file"),
    async (req, res) => {
      const companyId = req.params["companyId"] as string;
      assertCompanyAccess(req, companyId);
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }
      const filename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      await svc.write(filename, req.file.buffer);
      res.status(201).json({ name: filename, sizeBytes: req.file.size });
    },
  );

  router.get("/companies/:companyId/shared-workspace/files/:filename", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    const { buffer, name } = await svc.read(req.params.filename);
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(buffer);
  });

  router.delete("/companies/:companyId/shared-workspace/files/:filename", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    await svc.remove(req.params.filename);
    res.status(204).end();
  });

  return router;
}
