import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { terminalRoutes } from "../routes/terminal.js";
import { errorHandler } from "../middleware/index.js";

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockSelectChain = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
};

mockSelectChain.from.mockReturnValue(mockSelectChain);
mockSelectChain.where.mockReturnValue(mockSelectChain);
mockSelectChain.orderBy.mockReturnValue(mockSelectChain);
mockSelectChain.limit.mockResolvedValue([]);

const mockInsertChain = {
  values: vi.fn().mockResolvedValue(undefined),
};

function makeMockDb() {
  return {
    select: vi.fn(() => mockSelectChain),
    insert: vi.fn(() => mockInsertChain),
  };
}

// ── App factory ───────────────────────────────────────────────────────────────

function createApp(actor: Record<string, unknown>, db = makeMockDb()) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", terminalRoutes(db as any));
  app.use(errorHandler);
  return { app, db };
}

const boardActor = {
  type: "board",
  userId: "user-1",
  source: "local_implicit",
  isInstanceAdmin: true,
};

const agentActor = {
  type: "agent",
  agentId: "agent-1",
  companyId: "company-1",
  runId: "run-1",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /terminal/cwd", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a cwd string for board actors", async () => {
    const { app } = createApp(boardActor);
    const res = await request(app).get("/api/terminal/cwd");

    expect(res.status).toBe(200);
    expect(typeof res.body.cwd).toBe("string");
    expect(res.body.cwd.length).toBeGreaterThan(0);
  });

  it("rejects agent actors with 403", async () => {
    const { app } = createApp(agentActor);
    const res = await request(app).get("/api/terminal/cwd");

    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const { app } = createApp({ type: "none", source: "none" });
    const res = await request(app).get("/api/terminal/cwd");

    expect(res.status).toBe(401);
  });
});

describe("GET /terminal/history", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when no history exists", async () => {
    mockSelectChain.limit.mockResolvedValueOnce([]);
    const { app } = createApp(boardActor);
    const res = await request(app).get("/api/terminal/history");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns history entries in chronological order", async () => {
    const entries = [
      {
        id: "a1",
        actorId: "user-1",
        command: "ls -la",
        stdout: "file1\nfile2",
        stderr: "",
        exitCode: 0,
        cwd: "/app",
        executedAt: new Date("2024-01-01T10:00:00Z"),
      },
      {
        id: "a2",
        actorId: "user-1",
        command: "pwd",
        stdout: "/app",
        stderr: "",
        exitCode: 0,
        cwd: "/app",
        executedAt: new Date("2024-01-01T10:01:00Z"),
      },
    ];
    // Route reverses the results (fetched DESC, reversed to ASC)
    mockSelectChain.limit.mockResolvedValueOnce([...entries].reverse());

    const { app } = createApp(boardActor);
    const res = await request(app).get("/api/terminal/history");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].command).toBe("ls -la");
    expect(res.body[1].command).toBe("pwd");
  });

  it("rejects agent actors with 403", async () => {
    const { app } = createApp(agentActor);
    const res = await request(app).get("/api/terminal/history");

    expect(res.status).toBe(403);
  });
});

describe("POST /terminal/exec", () => {
  beforeEach(() => vi.clearAllMocks());

  it("executes a real command and returns stdout", async () => {
    const { app, db } = createApp(boardActor);
    const res = await request(app)
      .post("/api/terminal/exec")
      .send({ command: 'echo "crewspace terminal test"', cwd: "/tmp" });

    expect(res.status).toBe(200);
    expect(res.body.stdout).toContain("crewspace terminal test");
    expect(res.body.stderr).toBe("");
    expect(res.body.exitCode).toBe(0);
    expect(typeof res.body.cwd).toBe("string");
    // History should have been saved
    expect(db.insert).toHaveBeenCalled();
  });

  it("captures stderr and non-zero exit code for failing commands", async () => {
    const { app } = createApp(boardActor);
    const res = await request(app)
      .post("/api/terminal/exec")
      .send({ command: "cat /nonexistent-file-xyz", cwd: "/tmp" });

    expect(res.status).toBe(200);
    expect(res.body.stderr).toBeTruthy();
    expect(res.body.exitCode).not.toBe(0);
  });

  it("tracks cwd changes after cd commands", async () => {
    const { app } = createApp(boardActor);
    const res = await request(app)
      .post("/api/terminal/exec")
      .send({ command: "cd /tmp && pwd", cwd: "/app" });

    expect(res.status).toBe(200);
    expect(res.body.cwd).toBe("/tmp");
  });

  it("handles commands with no output gracefully", async () => {
    const { app } = createApp(boardActor);
    const res = await request(app)
      .post("/api/terminal/exec")
      .send({ command: "true", cwd: "/tmp" });

    expect(res.status).toBe(200);
    expect(res.body.exitCode).toBe(0);
    expect(res.body.stdout).toBe("");
  });

  it("rejects missing command field with 400", async () => {
    const { app } = createApp(boardActor);
    const res = await request(app)
      .post("/api/terminal/exec")
      .send({ cwd: "/tmp" });

    expect(res.status).toBe(400);
  });

  it("rejects missing cwd field with 400", async () => {
    const { app } = createApp(boardActor);
    const res = await request(app)
      .post("/api/terminal/exec")
      .send({ command: "echo hi" });

    expect(res.status).toBe(400);
  });

  it("rejects agent actors with 403", async () => {
    const { app } = createApp(agentActor);
    const res = await request(app)
      .post("/api/terminal/exec")
      .send({ command: "echo hi", cwd: "/tmp" });

    expect(res.status).toBe(403);
  });

  it("saves executed command to history in db", async () => {
    const db = makeMockDb();
    const { app } = createApp(boardActor, db);

    await request(app)
      .post("/api/terminal/exec")
      .send({ command: 'echo "saved"', cwd: "/tmp" });

    // Give the non-blocking insert time to be called
    await new Promise((r) => setTimeout(r, 100));

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(mockInsertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'echo "saved"',
        actorId: "user-1",
      }),
    );
  });
});
