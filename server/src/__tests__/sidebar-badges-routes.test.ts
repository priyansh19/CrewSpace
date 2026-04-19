import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sidebarBadgeRoutes } from "../routes/sidebar-badges.js";
import { errorHandler } from "../middleware/index.js";

const companyId = "11111111-1111-4111-8111-111111111111";

const badges = {
  inbox: 5,
  approvals: 2,
  failedRuns: 1,
  joinRequests: 0,
};

const dashboardSummary = {
  agents: { total: 4, active: 3, idle: 0, error: 1 },
  costs: { monthBudgetCents: 10000, monthSpentCents: 9000, monthUtilizationPercent: 90 },
};

const mockSidebarBadgeService = vi.hoisted(() => ({ get: vi.fn() }));
const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
}));
const mockDashboardService = vi.hoisted(() => ({ summary: vi.fn() }));

vi.mock("../services/sidebar-badges.js", () => ({
  sidebarBadgeService: () => mockSidebarBadgeService,
}));
vi.mock("../services/access.js", () => ({
  accessService: () => mockAccessService,
}));
vi.mock("../services/dashboard.js", () => ({
  dashboardService: () => mockDashboardService,
}));

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  then: vi.fn().mockResolvedValue([{ count: "0" }]),
}));

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", sidebarBadgeRoutes(mockDb as any));
  app.use(errorHandler);
  return app;
}

describe("GET /api/companies/:companyId/sidebar-badges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSidebarBadgeService.get.mockResolvedValue({ ...badges });
    mockDashboardService.summary.mockResolvedValue(dashboardSummary);
    mockAccessService.canUser.mockResolvedValue(false);
    mockAccessService.hasPermission.mockResolvedValue(false);
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.then.mockResolvedValue([{ count: "0" }]);
  });

  it("returns sidebar badges for local_implicit board actor", async () => {
    const app = createApp({ type: "board", userId: "u1", source: "local_implicit", companyIds: [companyId] });
    const res = await request(app).get(`/api/companies/${companyId}/sidebar-badges`);
    expect(res.status).toBe(200);
    expect(mockSidebarBadgeService.get).toHaveBeenCalled();
  });

  it("returns 401 for unauthenticated actor", async () => {
    const app = createApp({ type: "none" });
    const res = await request(app).get(`/api/companies/${companyId}/sidebar-badges`);
    expect(res.status).toBe(401);
  });

  it("returns 403 when board user lacks company access", async () => {
    const app = createApp({ type: "board", userId: "u", source: "session", companyIds: [] });
    const res = await request(app).get(`/api/companies/${companyId}/sidebar-badges`);
    expect(res.status).toBe(403);
  });

  it("returns 403 for agent in different company", async () => {
    const app = createApp({ type: "agent", agentId: "a1", companyId: "other" });
    const res = await request(app).get(`/api/companies/${companyId}/sidebar-badges`);
    expect(res.status).toBe(403);
  });

  it("allows agent in same company to get badges", async () => {
    mockAccessService.hasPermission.mockResolvedValue(false);
    const app = createApp({ type: "agent", agentId: "a1", companyId });
    const res = await request(app).get(`/api/companies/${companyId}/sidebar-badges`);
    expect(res.status).toBe(200);
  });
});
