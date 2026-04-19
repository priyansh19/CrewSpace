import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentMemoryRoutes } from "../routes/agent-memories.js";
import { errorHandler } from "../middleware/index.js";

const companyId = "11111111-1111-4111-8111-111111111111";
const memoryId = "22222222-2222-4222-8222-222222222222";

const memory = {
  id: memoryId,
  companyId,
  agentId: "agent-1",
  content: "User prefers TypeScript",
  tags: ["preferences"],
  embedding: null,
  createdByUserId: null,
  createdByAgentId: "agent-1",
  updatedByUserId: null,
  updatedByAgentId: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const graph = { memories: [memory], links: [] };

const mockAgentMemoriesService = vi.hoisted(() => ({
  listGraph: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../services/agentMemories.js", () => ({
  agentMemoriesService: () => mockAgentMemoriesService,
}));

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", agentMemoryRoutes({} as any));
  app.use(errorHandler);
  return app;
}

const boardActor = {
  type: "board",
  userId: "user-1",
  source: "local_implicit",
  companyIds: [companyId],
};

const agentActor = { type: "agent", agentId: "agent-1", companyId };

describe("GET /api/companies/:companyId/memories/graph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentMemoriesService.listGraph.mockResolvedValue(graph);
  });

  it("returns memory graph for authorized actor", async () => {
    const app = createApp(boardActor);
    const res = await request(app).get(`/api/companies/${companyId}/memories/graph`);
    expect(res.status).toBe(200);
    expect(res.body.memories).toHaveLength(1);
    expect(mockAgentMemoriesService.listGraph).toHaveBeenCalledWith(companyId);
  });

  it("returns 401 for unauthenticated actor", async () => {
    const app = createApp({ type: "none" });
    const res = await request(app).get(`/api/companies/${companyId}/memories/graph`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for agent in different company", async () => {
    const app = createApp({ type: "agent", agentId: "a1", companyId: "other" });
    const res = await request(app).get(`/api/companies/${companyId}/memories/graph`);
    expect(res.status).toBe(403);
  });

  it("allows agent in same company", async () => {
    const app = createApp(agentActor);
    const res = await request(app).get(`/api/companies/${companyId}/memories/graph`);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/companies/:companyId/memories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentMemoriesService.create.mockResolvedValue(memory);
  });

  it("creates a memory and returns 201", async () => {
    const app = createApp(agentActor);
    const res = await request(app)
      .post(`/api/companies/${companyId}/memories`)
      .send({ content: "User prefers TypeScript", tags: ["preferences"] });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(memoryId);
  });

  it("returns 403 for agent in different company", async () => {
    const app = createApp({ type: "agent", agentId: "a1", companyId: "other" });
    const res = await request(app)
      .post(`/api/companies/${companyId}/memories`)
      .send({ content: "test" });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/memories/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentMemoriesService.getById.mockResolvedValue(memory);
    mockAgentMemoriesService.update.mockResolvedValue({ ...memory, content: "Updated content" });
  });

  it("updates a memory", async () => {
    const app = createApp(boardActor);
    const res = await request(app)
      .patch(`/api/memories/${memoryId}`)
      .send({ content: "Updated content" });
    expect(res.status).toBe(200);
  });

  it("returns 404 when memory not found", async () => {
    mockAgentMemoriesService.getById.mockResolvedValue(null);
    const app = createApp(boardActor);
    const res = await request(app).patch(`/api/memories/${memoryId}`).send({ content: "x" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Memory not found");
  });
});

describe("DELETE /api/memories/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentMemoriesService.getById.mockResolvedValue(memory);
    mockAgentMemoriesService.remove.mockResolvedValue(undefined);
  });

  it("deletes a memory and returns 204", async () => {
    const app = createApp(boardActor);
    const res = await request(app).delete(`/api/memories/${memoryId}`);
    expect(res.status).toBe(204);
    expect(mockAgentMemoriesService.remove).toHaveBeenCalledWith(memoryId);
  });

  it("returns 404 when memory not found", async () => {
    mockAgentMemoriesService.getById.mockResolvedValue(null);
    const app = createApp(boardActor);
    const res = await request(app).delete(`/api/memories/${memoryId}`);
    expect(res.status).toBe(404);
  });
});
