import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { sharedWorkspaceService } from "../services/shared-workspace.js";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

describe("sharedWorkspaceService", () => {
  let baseDir: string;
  let svc: ReturnType<typeof sharedWorkspaceService>;

  beforeEach(async () => {
    baseDir = path.join(tmpdir(), `crewspace-sw-test-${randomUUID()}`);
    await fs.mkdir(baseDir, { recursive: true });
    svc = sharedWorkspaceService(baseDir);
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it("lists files in the base directory", async () => {
    await fs.writeFile(path.join(baseDir, "file1.txt"), "hello");
    await fs.writeFile(path.join(baseDir, "file2.txt"), "world");

    const files = await svc.list();
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.name).sort()).toEqual(["file1.txt", "file2.txt"]);
  });

  it("lists files in a project subdirectory", async () => {
    const projectDir = path.join(baseDir, "project-1");
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, "readme.md"), "# README");

    const files = await svc.list("project-1");
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("readme.md");
    expect(files[0].path).toBe("project-1/readme.md");
  });

  it("writes a file to a relative path", async () => {
    await svc.write("project-a/data.json", Buffer.from('{"key":"value"}'));

    const content = await fs.readFile(path.join(baseDir, "project-a", "data.json"), "utf8");
    expect(content).toBe('{"key":"value"}');
  });

  it("reads a previously written file", async () => {
    await svc.write("notes.txt", Buffer.from("hello world"));

    const { buffer, name } = await svc.read("notes.txt");
    expect(buffer.toString()).toBe("hello world");
    expect(name).toBe("notes.txt");
  });

  it("throws notFound when reading a non-existent file", async () => {
    await expect(svc.read("missing.txt")).rejects.toThrow("File not found");
  });

  it("removes a file", async () => {
    await svc.write("to-delete.txt", Buffer.from("bye"));
    await svc.remove("to-delete.txt");

    const stat = await fs.stat(path.join(baseDir, "to-delete.txt")).catch(() => null);
    expect(stat).toBeNull();
  });

  it("silently succeeds when removing a non-existent file", async () => {
    await expect(svc.remove("never-existed.txt")).resolves.toBeUndefined();
  });

  it("rejects path traversal attempts", async () => {
    await expect(svc.write("../outside.txt", Buffer.from("bad"))).rejects.toThrow("Invalid path");
    await expect(svc.read("../outside.txt")).rejects.toThrow("Invalid path");
    await expect(svc.remove("../outside.txt")).rejects.toThrow("Invalid path");
  });

  it("rejects absolute paths", async () => {
    await expect(svc.write("/etc/passwd", Buffer.from("bad"))).rejects.toThrow("Invalid path");
  });

  it("returns correct file sizes and modification dates", async () => {
    const before = new Date();
    await svc.write("sized.txt", Buffer.from("12345"));
    const after = new Date();

    const files = await svc.list();
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("sized.txt");
    expect(files[0].sizeBytes).toBe(5);
    expect(files[0].modifiedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    // Allow 5ms tolerance for filesystem timestamp granularity
    expect(files[0].modifiedAt.getTime()).toBeLessThanOrEqual(after.getTime() + 5);
  });
});
