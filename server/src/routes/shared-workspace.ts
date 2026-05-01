import { Router } from "express";
import multer from "multer";
import { eq, and, isNull } from "drizzle-orm";
import type { Db } from "@crewspaceai/db";
import { sharedWorkspaceFiles, sharedWorkspacePermissions } from "@crewspaceai/db";
import { sharedWorkspaceService } from "../services/shared-workspace.js";
import { assertCompanyAccess } from "./authz.js";

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

export function sharedWorkspaceRoutes(db: Db, sharedWorkspaceDir: string) {
  const router = Router();

  router.get("/companies/:companyId/shared-workspace/files", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;

    const where = projectId
      ? and(eq(sharedWorkspaceFiles.companyId, companyId), eq(sharedWorkspaceFiles.projectId, projectId))
      : and(eq(sharedWorkspaceFiles.companyId, companyId));

    const files = await db.query.sharedWorkspaceFiles.findMany({
      where,
      orderBy: (f, { desc }) => [desc(f.createdAt)],
    });

    res.json(files);
  });

  router.post(
    "/companies/:companyId/shared-workspace/files",
    multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } }).single("file"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
      const filename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storedPath = projectId ? `${projectId}/${filename}` : filename;

      const svc = sharedWorkspaceService(`${sharedWorkspaceDir}/${companyId}`);
      await svc.write(storedPath, req.file.buffer);

      const [record] = await db
        .insert(sharedWorkspaceFiles)
        .values({
          companyId,
          projectId,
          filename,
          storedPath,
          sizeBytes: req.file.size,
        })
        .returning();

      res.status(201).json(record);
    },
  );

  router.get("/companies/:companyId/shared-workspace/files/:fileId/download", async (req, res) => {
    const companyId = req.params.companyId;
    assertCompanyAccess(req, companyId);
    const fileId = req.params.fileId;

    const file = await db.query.sharedWorkspaceFiles.findFirst({
      where: and(eq(sharedWorkspaceFiles.id, fileId), eq(sharedWorkspaceFiles.companyId, companyId)),
    });

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const svc = sharedWorkspaceService(`${sharedWorkspaceDir}/${companyId}`);
    const { buffer, name } = await svc.read(file.storedPath);
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(buffer);
  });

  router.delete("/companies/:companyId/shared-workspace/files/:fileId", async (req, res) => {
    const companyId = req.params.companyId;
    assertCompanyAccess(req, companyId);
    const fileId = req.params.fileId;

    const file = await db.query.sharedWorkspaceFiles.findFirst({
      where: and(eq(sharedWorkspaceFiles.id, fileId), eq(sharedWorkspaceFiles.companyId, companyId)),
    });

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const svc = sharedWorkspaceService(`${sharedWorkspaceDir}/${companyId}`);
    await svc.remove(file.storedPath);
    await db.delete(sharedWorkspaceFiles).where(eq(sharedWorkspaceFiles.id, fileId));

    res.status(204).end();
  });

  // Permissions
  router.get("/companies/:companyId/shared-workspace/permissions", async (req, res) => {
    const companyId = req.params.companyId;
    assertCompanyAccess(req, companyId);
    const projectId = req.query.projectId as string;

    if (!projectId) {
      res.status(400).json({ error: "projectId is required" });
      return;
    }

    const perms = await db.query.sharedWorkspacePermissions.findMany({
      where: eq(sharedWorkspacePermissions.projectId, projectId),
    });

    res.json(perms);
  });

  router.post("/companies/:companyId/shared-workspace/permissions", async (req, res) => {
    const companyId = req.params.companyId;
    assertCompanyAccess(req, companyId);
    const { projectId, agentId, canRead, canWrite } = req.body;

    if (!projectId || !agentId) {
      res.status(400).json({ error: "projectId and agentId are required" });
      return;
    }

    const [perm] = await db
      .insert(sharedWorkspacePermissions)
      .values({ projectId, agentId, canRead: canRead ?? true, canWrite: canWrite ?? false })
      .onConflictDoUpdate({
        target: [sharedWorkspacePermissions.projectId, sharedWorkspacePermissions.agentId],
        set: { canRead: canRead ?? true, canWrite: canWrite ?? false },
      })
      .returning();

    res.json(perm);
  });

  router.delete("/companies/:companyId/shared-workspace/permissions/:permId", async (req, res) => {
    const companyId = req.params.companyId;
    assertCompanyAccess(req, companyId);
    await db.delete(sharedWorkspacePermissions).where(eq(sharedWorkspacePermissions.id, req.params.permId));
    res.status(204).end();
  });

  return router;
}
