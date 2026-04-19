/**
 * Unit tests for authz.ts helper functions:
 * assertBoard, assertInstanceAdmin, assertCompanyAccess, getActorInfo
 */
import { describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  assertBoard,
  assertInstanceAdmin,
  assertCompanyAccess,
  getActorInfo,
} from "../routes/authz.js";

function makeReq(actor: unknown): Request {
  return { actor } as unknown as Request;
}

describe("assertBoard", () => {
  it("allows board actors", () => {
    const req = makeReq({ type: "board", userId: "u1", companyIds: [], source: "session", isInstanceAdmin: false });
    expect(() => assertBoard(req)).not.toThrow();
  });

  it("throws 403 for agent actors", () => {
    const req = makeReq({ type: "agent", agentId: "a1", companyId: "c1" });
    expect(() => assertBoard(req)).toThrow();
  });

  it("throws 403 for none actors", () => {
    const req = makeReq({ type: "none" });
    expect(() => assertBoard(req)).toThrow();
  });
});

describe("assertInstanceAdmin", () => {
  it("allows local_implicit board actors", () => {
    const req = makeReq({ type: "board", userId: "u1", companyIds: [], source: "local_implicit", isInstanceAdmin: false });
    expect(() => assertInstanceAdmin(req)).not.toThrow();
  });

  it("allows isInstanceAdmin board actors", () => {
    const req = makeReq({ type: "board", userId: "u1", companyIds: [], source: "session", isInstanceAdmin: true });
    expect(() => assertInstanceAdmin(req)).not.toThrow();
  });

  it("throws 403 for regular board user without instance admin", () => {
    const req = makeReq({ type: "board", userId: "u1", companyIds: [], source: "session", isInstanceAdmin: false });
    expect(() => assertInstanceAdmin(req)).toThrow();
  });

  it("throws 403 for agent actors", () => {
    const req = makeReq({ type: "agent", agentId: "a1", companyId: "c1" });
    expect(() => assertInstanceAdmin(req)).toThrow();
  });
});

describe("assertCompanyAccess", () => {
  it("throws 401 for none actors", () => {
    const req = makeReq({ type: "none" });
    expect(() => assertCompanyAccess(req, "company-1")).toThrow();
  });

  it("allows agents in their own company", () => {
    const req = makeReq({ type: "agent", agentId: "a1", companyId: "company-1" });
    expect(() => assertCompanyAccess(req, "company-1")).not.toThrow();
  });

  it("throws 403 for agents accessing another company", () => {
    const req = makeReq({ type: "agent", agentId: "a1", companyId: "company-1" });
    expect(() => assertCompanyAccess(req, "company-2")).toThrow();
  });

  it("allows local_implicit board to access any company", () => {
    const req = makeReq({ type: "board", userId: "u1", companyIds: [], source: "local_implicit", isInstanceAdmin: false });
    expect(() => assertCompanyAccess(req, "any-company")).not.toThrow();
  });

  it("allows instance admin board to access any company", () => {
    const req = makeReq({ type: "board", userId: "u1", companyIds: ["c1"], source: "session", isInstanceAdmin: true });
    expect(() => assertCompanyAccess(req, "other-company")).not.toThrow();
  });

  it("allows session board to access a company in their list", () => {
    const req = makeReq({ type: "board", userId: "u1", companyIds: ["company-1", "company-2"], source: "session", isInstanceAdmin: false });
    expect(() => assertCompanyAccess(req, "company-1")).not.toThrow();
  });

  it("throws 403 for session board accessing a company not in their list", () => {
    const req = makeReq({ type: "board", userId: "u1", companyIds: ["company-1"], source: "session", isInstanceAdmin: false });
    expect(() => assertCompanyAccess(req, "company-3")).toThrow();
  });
});

describe("getActorInfo", () => {
  it("throws 401 for none actors", () => {
    const req = makeReq({ type: "none" });
    expect(() => getActorInfo(req)).toThrow();
  });

  it("returns agent info for agent actors", () => {
    const req = makeReq({ type: "agent", agentId: "a1", companyId: "c1", runId: "r1" });
    const info = getActorInfo(req);
    expect(info).toMatchObject({ actorType: "agent", actorId: "a1", agentId: "a1", runId: "r1" });
  });

  it("returns user info for board actors", () => {
    const req = makeReq({ type: "board", userId: "u1", companyIds: ["c1"], source: "session", isInstanceAdmin: false });
    const info = getActorInfo(req);
    expect(info).toMatchObject({ actorType: "user", actorId: "u1", agentId: null });
  });

  it("falls back to 'board' when userId missing", () => {
    const req = makeReq({ type: "board", companyIds: ["c1"], source: "local_implicit", isInstanceAdmin: false });
    const info = getActorInfo(req);
    expect(info.actorId).toBe("board");
  });
});
