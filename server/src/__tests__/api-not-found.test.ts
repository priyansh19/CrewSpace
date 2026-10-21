import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createServer, type ViteDevServer } from "vite";
import { apiNotFound } from "../middleware/api-not-found.js";

describe("API fallback with Vite renderer modules", () => {
  let uiRoot: string;
  let vite: ViteDevServer;
  let app: express.Express;

  beforeAll(async () => {
    uiRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crewspace-api-modules-"));
    await fs.mkdir(path.join(uiRoot, "api"));
    await fs.writeFile(path.join(uiRoot, "api/client.ts"), "export const answer: number = 42;\n");
    await fs.writeFile(path.join(uiRoot, "api/health.ts"), "export const source = 'renderer';\n");
    await fs.writeFile(path.join(uiRoot, "outside.ts"), "export const outside = true;\n");
    await fs.mkdir(path.join(uiRoot, "api/directory.ts"));
    vite = await createServer({
      configFile: false,
      root: uiRoot,
      appType: "custom",
      server: { middlewareMode: true, hmr: false },
      optimizeDeps: { noDiscovery: true, include: [] },
      logLevel: "silent",
    });
    app = express();
    app.get(["/api/health", "/api/health.ts"], (_req, res) => {
      res.json({ status: "ok" });
    });
    app.use("/api", apiNotFound(path.join(uiRoot, "api")));
    app.use(vite.middlewares);
    app.get(/.*/, (_req, res) => {
      res.type("html").send("<html>Renderer fallback</html>");
    });
  });

  afterAll(async () => {
    await vite?.close();
    if (uiRoot) await fs.rm(uiRoot, { recursive: true, force: true });
  });

  it.each(["/api/client.ts", "/api/client.ts?t=123", "/api/client.ts?import"])(
    "serves transformed JavaScript for %s",
    async (url) => {
      const res = await request(app).get(url);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("javascript");
      expect(res.text).toContain("export const answer = 42;");
      expect(res.text).not.toContain(": number");
    },
  );

  it("supports HEAD requests for renderer modules", async () => {
    const res = await request(app).head("/api/client.ts");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("javascript");
  });

  it.each(["/api/health", "/api/health.ts?t=123"])(
    "keeps real API routes ahead of renderer modules: %s",
    async (url) => {
      const res = await request(app).get(url);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    },
  );

  it.each([
    "/api/missing",
    "/api/missing.ts",
    "/api/missing.ts?t=123",
    "/api/missing.json",
    "/api/missing?file=client.ts",
    "/api/missing?file=client.ts&t=123",
    "/api/client.ts/extra",
    "/api/directory.ts",
    "/api/%2e%2e%2foutside.ts",
    "/api/%E0%A4%A.ts",
  ])("keeps the JSON 404 for %s", async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body).toEqual({ error: "API route not found" });
  });

  it("does not pass mutation requests to Vite", async () => {
    const res = await request(app).post("/api/client.ts");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "API route not found" });
  });

  it("keeps the JSON 404 outside Vite development mode", async () => {
    const productionApp = express();
    productionApp.use("/api", apiNotFound());
    productionApp.use(express.static(uiRoot));
    productionApp.get(/.*/, (_req, res) => {
      res.type("html").send("<html>Production fallback</html>");
    });
    const res = await request(productionApp).get("/api/client.ts?t=123");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "API route not found" });
  });

  it("preserves the HTML fallback for page routes", async () => {
    const res = await request(app).get("/dashboard");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
  });
});
