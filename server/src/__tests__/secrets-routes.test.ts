import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { secretRoutes } from "../routes/secrets.js";
import { errorHandler } from "../middleware/index.js";

const companyId = "11111111-1111-4111-8111-111111111111";
const secretId = "22222222-2222-4222-8222-222222222222";

const secret = {
  id: secretId,
  companyId,
  name: "MY_API_KEY",
  provider: "local_encrypted",
  description: "Test secret",
  externalRef: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const mockSecretService = vi.hoisted(() => ({
  listProviders: vi.fn(),
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  rotate: vi.fn(),
  delete: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  secretService: () => mockSecretService,
  logActivity: mockLogActivity,
}));

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", secretRoutes({} as any));
  app.use(errorHandler);
  return app;
}

const boardActor = {
  type: "board",
  userId: "user-1",
  source: "local_implicit",
  companyIds: [companyId],
};

const agentActor = {
  type: "agent",
  agentId: "agent-1",
  companyId,
};

describe("GET /api/companies/:companyId/secret-providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSecretService.listProviders.mockReturnValue(["local_encrypted"]);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("returns provider list for board actor", async () => {
    const app = createApp(boardActor);
    const res = await request(app).get(`/api/companies/${companyId}/secret-providers`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("local_encrypted");
  });

  it("returns 403 for agent actor (board required)", async () => {
    const app = createApp(agentActor);
    const res = await request(app).get(`/api/companies/${companyId}/secret-providers`);
    expect(res.status).toBe(403);
  });

  it("returns 401 for unauthenticated actor", async () => {
    const app = createApp({ type: "none" });
    const res = await request(app).get(`/api/companies/${companyId}/secret-providers`);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/companies/:companyId/secrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSecretService.list.mockResolvedValue([secret]);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("returns list of secrets for board actor", async () => {
    const app = createApp(boardActor);
    const res = await request(app).get(`/api/companies/${companyId}/secrets`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("MY_API_KEY");
  });

  it("returns 403 for agent actor", async () => {
    const app = createApp(agentActor);
    const res = await request(app).get(`/api/companies/${companyId}/secrets`);
    expect(res.status).toBe(403);
  });

  it("returns 403 when board user lacks company access", async () => {
    const app = createApp({ type: "board", userId: "u", source: "session", companyIds: [] });
    const res = await request(app).get(`/api/companies/${companyId}/secrets`);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/companies/:companyId/secrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSecretService.create.mockResolvedValue(secret);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("creates a secret and returns 201", async () => {
    const app = createApp(boardActor);
    const res = await request(app)
      .post(`/api/companies/${companyId}/secrets`)
      .send({ name: "MY_API_KEY", value: "s3cr3t" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(secretId);
    expect(mockLogActivity).toHaveBeenCalledOnce();
  });

  it("returns 400 for empty name", async () => {
    const app = createApp(boardActor);
    const res = await request(app)
      .post(`/api/companies/${companyId}/secrets`)
      .send({ name: "", value: "s3cr3t" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty value", async () => {
    const app = createApp(boardActor);
    const res = await request(app)
      .post(`/api/companies/${companyId}/secrets`)
      .send({ name: "KEY", value: "" });
    expect(res.status).toBe(400);
  });

  it("returns 403 for agent actor", async () => {
    const app = createApp(agentActor);
    const res = await request(app)
      .post(`/api/companies/${companyId}/secrets`)
      .send({ name: "KEY", value: "val" });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/secrets/:id/rotate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSecretService.getById.mockResolvedValue(secret);
    mockSecretService.rotate.mockResolvedValue({ ...secret, updatedAt: new Date() });
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("rotates a secret", async () => {
    const app = createApp(boardActor);
    const res = await request(app)
      .post(`/api/secrets/${secretId}/rotate`)
      .send({ value: "new-secret-value" });
    expect(res.status).toBe(200);
    expect(mockSecretService.rotate).toHaveBeenCalled();
  });

  it("returns 404 when secret not found", async () => {
    mockSecretService.getById.mockResolvedValue(null);
    const app = createApp(boardActor);
    const res = await request(app)
      .post(`/api/secrets/${secretId}/rotate`)
      .send({ value: "new-value" });
    expect(res.status).toBe(404);
  });

  it("returns 403 for agent actor (board required)", async () => {
    const app = createApp(agentActor);
    const res = await request(app)
      .post(`/api/secrets/${secretId}/rotate`)
      .send({ value: "new-value" });
    expect(res.status).toBe(403);
  });

  it("returns 400 when value is empty", async () => {
    const app = createApp(boardActor);
    const res = await request(app)
      .post(`/api/secrets/${secretId}/rotate`)
      .send({ value: "" });
    expect(res.status).toBe(400);
  });
});
