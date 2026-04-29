import { promises as fs } from "node:fs";
import path from "node:path";
import { badRequest, notFound } from "../errors.js";

function resolveWithin(baseDir: string, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").trim();
  if (!normalized || normalized.startsWith("/")) throw badRequest("Invalid path");
  const parts = normalized.split("/").filter((p) => p.length > 0);
  if (parts.length === 0 || parts.some((p) => p === "." || p === "..")) throw badRequest("Invalid path");
  const resolved = path.resolve(baseDir, ...parts);
  const base = path.resolve(baseDir);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) throw badRequest("Invalid path");
  return resolved;
}

export type WorkspaceFile = {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt: Date;
};

export function sharedWorkspaceService(baseDir: string) {
  return {
    async list(): Promise<WorkspaceFile[]> {
      await fs.mkdir(baseDir, { recursive: true });
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      const files: WorkspaceFile[] = [];
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const stat = await fs.stat(path.join(baseDir, entry.name));
        files.push({ name: entry.name, path: entry.name, sizeBytes: stat.size, modifiedAt: stat.mtime });
      }
      return files.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
    },

    async write(relativePath: string, buffer: Buffer): Promise<void> {
      const target = resolveWithin(baseDir, relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      const tmp = `${target}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await fs.writeFile(tmp, buffer);
      await fs.rename(tmp, target);
    },

    async read(relativePath: string): Promise<{ buffer: Buffer; name: string }> {
      const target = resolveWithin(baseDir, relativePath);
      const stat = await fs.stat(target).catch(() => null);
      if (!stat || !stat.isFile()) throw notFound("File not found");
      const buffer = await fs.readFile(target);
      return { buffer, name: path.basename(target) };
    },

    async remove(relativePath: string): Promise<void> {
      const target = resolveWithin(baseDir, relativePath);
      await fs.unlink(target).catch(() => {});
    },
  };
}
