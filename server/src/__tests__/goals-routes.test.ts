import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { goalRoutes } from "../routes/goals.js";
import { errorHandler } from "../middleware/index.js";

const companyId = "11111111-1111-4111-8111-111111111111";
const goalId = "22222222-2222-4222-8222-222222222222";
const parentId = "33333333-3333-4333-8333-333333333333";

const goal = {
  id: goalId,
  companyId,
  title: "Ship v2",
  description: null,
  level: "milestone",
  status: "planned",
  parentId: null,
  ownerAgentId: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const mockGoalService = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  goalService: () => mockGoalService,
  logActivity: mockLogActivity,
}));

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", goalRoutes({} as any));
  app.use(errorHandler);
  return app;
}

const boardActor = {
  type: "board",
  userId: "user-1",
  source: "local_implicit",
  companyIds: [companyId],
};

describe("GET /api/companies/:companyId/goals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoalService.list.mockResolvedValue([goal]);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("returns list of goals", async () => {
    const app = createApp(boardActor);
    const res = await request(app).get(`/api/companies/${companyId}/goals`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(goalId);
  });

  it("returns 401 for unauthenticated actor", async () => {
    const app = createApp({ type: "none" });
    const res = await request(app).get(`/api/companies/${companyId}/goals`);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/goals/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoalService.getById.mockResolvedValue(goal);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("returns goal by id", async () => {
    const app = createApp(boardActor);
    const res = await request(app).get(`/api/goals/${goalId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(goalId);
  });

  it("returns 404 when goal does not exist", async () => {
    mockGoalService.getById.mockResolvedValue(null);
    const app = createApp(boardActor);
    const res = await request(app).get(`/api/goals/${goalId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Goal not found");
  });

  it("returns 403 when actor has no company access", async () => {
    const app = createApp({ type: "board", userId: "u", source: "session", companyIds: [] });
    const res = await request(app).get(`/api/goals/${goalId}`);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/companies/:companyId/goals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoalService.create.mockResolvedValue(goal);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("creates a goal and returns 201", async () => {
    const app = createApp(boardActor);
    const res = await request(app)
      .post(`/api/companies/${companyId}/goals`)
      .send({ title: "Ship v2" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(goalId);
    expect(mockLogActivity).toHaveBeenCalledOnce();
  });

  it("returns 400 when title is missing", async () => {
    const app = createApp(boardActor);
    const res = await request(app)
      .post(`/api/companies/${companyId}/goals`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 401 for unauthenticated actor", async () => {
    const app = createApp({ type: "none" });
    const res = await request(app)
      .post(`/api/companies/${companyId}/goals`)
      .send({ title: "Goal" });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/goals/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoalService.getById.mockResolvedValue(goal);
    mockGoalService.update.mockResolvedValue({ ...goal, status: "active" });
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("updates a goal", async () => {
    const app = createApp(boardActor);
    const res = await request(app)
      .patch(`/api/goals/${goalId}`)
      .send({ status: "active" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("active");
  });

  it("returns 404 when goal not found", async () => {
    mockGoalService.getById.mockResolvedValue(null);
    const app = createApp(boardActor);
    const res = await request(app).patch(`/api/goals/${goalId}`).send({ status: "active" });
    expect(res.status).toBe(404);
  });

  it("returns 404 when update returns null", async () => {
    mockGoalService.update.mockResolvedValue(null);
    const app = createApp(boardActor);
    const res = await request(app).patch(`/api/goals/${goalId}`).send({ status: "active" });
    expect(res.status).toBe(404);
  });
});
