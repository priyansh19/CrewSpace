import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dashboardRoutes } from "../routes/dashboard.js";
import { errorHandler } from "../middleware/index.js";

const companyId = "11111111-1111-4111-8111-111111111111";

const dashboardSummary = {
  agents: { total: 5, active: 3, idle: 1, error: 1 },
  issues: { open: 10, inProgress: 3, done: 45 },
  costs: { monthBudgetCents: 100000, monthSpentCents: 42000, monthUtilizationPercent: 42 },
};

const mockDashboardService = vi.hoisted(() => ({
  summary: vi.fn(),
}));

vi.mock("../services/dashboard.js", () => ({
  dashboardService: () => mockDashboardService,
}));

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", dashboardRoutes({} as any));
  app.use(errorHandler);
  return app;
}

const boardActor = {
  type: "board",
  userId: "user-1",
  source: "local_implicit",
  companyIds: [companyId],
};

describe("GET /api/companies/:companyId/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboardService.summary.mockResolvedValue(dashboardSummary);
  });

  it("returns dashboard summary for authorized board actor", async () => {
    const app = createApp(boardActor);
    const res = await request(app).get(`/api/companies/${companyId}/dashboard`);
    expect(res.status).toBe(200);
    expect(res.body.agents.total).toBe(5);
    expect(res.body.costs.monthUtilizationPercent).toBe(42);
    expect(mockDashboardService.summary).toHaveBeenCalledWith(companyId);
  });

  it("returns 401 for unauthenticated actor", async () => {
    const app = createApp({ type: "none" });
    const res = await request(app).get(`/api/companies/${companyId}/dashboard`);
    expect(res.status).toBe(401);
  });

  it("returns 403 when board user lacks company access", async () => {
    const app = createApp({
      type: "board",
      userId: "other-user",
      source: "session",
      companyIds: ["different-company-id"],
    });
    const res = await request(app).get(`/api/companies/${companyId}/dashboard`);
    expect(res.status).toBe(403);
  });

  it("returns 403 for agent in a different company", async () => {
    const app = createApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "other-company-id",
    });
    const res = await request(app).get(`/api/companies/${companyId}/dashboard`);
    expect(res.status).toBe(403);
  });

  it("allows agent in the same company", async () => {
    const app = createApp({ type: "agent", agentId: "agent-1", companyId });
    const res = await request(app).get(`/api/companies/${companyId}/dashboard`);
    expect(res.status).toBe(200);
  });
});
