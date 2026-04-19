import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sprintRoutes } from "../routes/sprints.js";
import { errorHandler } from "../middleware/index.js";

const companyId = "11111111-1111-4111-8111-111111111111";
const sprintId = "22222222-2222-4222-8222-222222222222";
const issueId = "33333333-3333-4333-8333-333333333333";

const sprint = {
  id: sprintId,
  companyId,
  name: "Sprint 1",
  goal: "Ship the feature",
  status: "active",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-01-14"),
  createdByUserId: "user-1",
  createdByAgentId: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue([sprint]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([sprint]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  then: vi.fn(),
}));

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", sprintRoutes(mockDb as any));
  app.use(errorHandler);
  return app;
}

const boardActor = {
  type: "board",
  userId: "user-1",
  source: "local_implicit",
  companyIds: [companyId],
};

describe("GET /api/companies/:companyId/sprints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.orderBy.mockResolvedValue([sprint]);
  });

  it("returns list of sprints", async () => {
    const app = createApp(boardActor);
    const res = await request(app).get(`/api/companies/${companyId}/sprints`);
    expect(res.status).toBe(200);
  });

  it("returns 401 for unauthenticated actor", async () => {
    const app = createApp({ type: "none" });
    const res = await request(app).get(`/api/companies/${companyId}/sprints`);
    expect(res.status).toBe(401);
  });

  it("returns 403 when board user lacks company access", async () => {
    const app = createApp({ type: "board", userId: "u", source: "session", companyIds: [] });
    const res = await request(app).get(`/api/companies/${companyId}/sprints`);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/companies/:companyId/sprints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([sprint]);
  });

  it("creates a sprint with valid name", async () => {
    const app = createApp(boardActor);
    const res = await request(app)
      .post(`/api/companies/${companyId}/sprints`)
      .send({ name: "Sprint 1", goal: "Ship it" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Sprint 1");
  });

  it("returns 400 when name is missing", async () => {
    const app = createApp(boardActor);
    const res = await request(app)
      .post(`/api/companies/${companyId}/sprints`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("name is required");
  });

  it("returns 400 when name is blank whitespace", async () => {
    const app = createApp(boardActor);
    const res = await request(app)
      .post(`/api/companies/${companyId}/sprints`)
      .send({ name: "   " });
    expect(res.status).toBe(400);
  });

  it("returns 403 for agent in a different company", async () => {
    const app = createApp({ type: "agent", agentId: "a1", companyId: "other-company" });
    const res = await request(app)
      .post(`/api/companies/${companyId}/sprints`)
      .send({ name: "Sprint" });
    expect(res.status).toBe(403);
  });
});
