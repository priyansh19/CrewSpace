import { describe, expect, it } from "vitest";
import {
  acceptInviteSchema,
  boardCliAuthAccessLevelSchema,
  claimJoinRequestApiKeySchema,
  createCliAuthChallengeSchema,
  createCompanyInviteSchema,
  createOpenClawInvitePromptSchema,
  listJoinRequestsQuerySchema,
  resolveCliAuthChallengeSchema,
  updateMemberPermissionsSchema,
  updateUserCompanyAccessSchema,
} from "./access.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("createCompanyInviteSchema", () => {
  it("applies default allowedJoinTypes=both", () => {
    const result = createCompanyInviteSchema.parse({});
    expect(result.allowedJoinTypes).toBe("both");
  });

  it("accepts agent_only join type", () => {
    expect(createCompanyInviteSchema.safeParse({ allowedJoinTypes: "agent_only" }).success).toBe(true);
  });

  it("rejects invalid joinType", () => {
    expect(createCompanyInviteSchema.safeParse({ allowedJoinTypes: "admin_only" }).success).toBe(false);
  });

  it("accepts agentMessage up to 4000 chars", () => {
    expect(createCompanyInviteSchema.safeParse({ agentMessage: "a".repeat(4000) }).success).toBe(true);
  });

  it("rejects agentMessage over 4000 chars", () => {
    expect(createCompanyInviteSchema.safeParse({ agentMessage: "a".repeat(4001) }).success).toBe(false);
  });
});

describe("acceptInviteSchema", () => {
  it("accepts a valid agent join request", () => {
    const result = acceptInviteSchema.safeParse({ requestType: "agent" });
    expect(result.success).toBe(true);
  });

  it("rejects missing requestType", () => {
    expect(acceptInviteSchema.safeParse({}).success).toBe(false);
  });

  it("rejects invalid requestType", () => {
    expect(acceptInviteSchema.safeParse({ requestType: "superadmin" }).success).toBe(false);
  });

  it("rejects agentName longer than 120 chars", () => {
    expect(acceptInviteSchema.safeParse({ requestType: "agent", agentName: "x".repeat(121) }).success).toBe(false);
  });

  it("rejects capabilities longer than 4000 chars", () => {
    expect(acceptInviteSchema.safeParse({ requestType: "agent", capabilities: "x".repeat(4001) }).success).toBe(false);
  });
});

describe("claimJoinRequestApiKeySchema", () => {
  it("accepts a valid claim secret (16 chars)", () => {
    expect(claimJoinRequestApiKeySchema.safeParse({ claimSecret: "a".repeat(16) }).success).toBe(true);
  });

  it("rejects claim secret shorter than 16 chars", () => {
    expect(claimJoinRequestApiKeySchema.safeParse({ claimSecret: "a".repeat(15) }).success).toBe(false);
  });

  it("rejects claim secret longer than 256 chars", () => {
    expect(claimJoinRequestApiKeySchema.safeParse({ claimSecret: "a".repeat(257) }).success).toBe(false);
  });
});

describe("boardCliAuthAccessLevelSchema", () => {
  it("accepts board", () => {
    expect(boardCliAuthAccessLevelSchema.safeParse("board").success).toBe(true);
  });

  it("accepts instance_admin_required", () => {
    expect(boardCliAuthAccessLevelSchema.safeParse("instance_admin_required").success).toBe(true);
  });

  it("rejects invalid level", () => {
    expect(boardCliAuthAccessLevelSchema.safeParse("superadmin").success).toBe(false);
  });
});

describe("createCliAuthChallengeSchema", () => {
  it("accepts a valid challenge", () => {
    const result = createCliAuthChallengeSchema.safeParse({ command: "crewspaceai run" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requestedAccess).toBe("board");
    }
  });

  it("rejects empty command", () => {
    expect(createCliAuthChallengeSchema.safeParse({ command: "" }).success).toBe(false);
  });

  it("rejects command over 240 chars", () => {
    expect(createCliAuthChallengeSchema.safeParse({ command: "x".repeat(241) }).success).toBe(false);
  });

  it("accepts requestedCompanyId UUID", () => {
    expect(createCliAuthChallengeSchema.safeParse({ command: "cmd", requestedCompanyId: VALID_UUID }).success).toBe(true);
  });

  it("rejects non-UUID requestedCompanyId", () => {
    expect(createCliAuthChallengeSchema.safeParse({ command: "cmd", requestedCompanyId: "bad" }).success).toBe(false);
  });
});

describe("resolveCliAuthChallengeSchema", () => {
  it("accepts a valid token (16 chars)", () => {
    expect(resolveCliAuthChallengeSchema.safeParse({ token: "a".repeat(16) }).success).toBe(true);
  });

  it("rejects token shorter than 16 chars", () => {
    expect(resolveCliAuthChallengeSchema.safeParse({ token: "short" }).success).toBe(false);
  });

  it("rejects token longer than 256 chars", () => {
    expect(resolveCliAuthChallengeSchema.safeParse({ token: "a".repeat(257) }).success).toBe(false);
  });
});

describe("updateMemberPermissionsSchema", () => {
  it("accepts empty grants array", () => {
    expect(updateMemberPermissionsSchema.safeParse({ grants: [] }).success).toBe(true);
  });

  it("accepts a valid grant", () => {
    const result = updateMemberPermissionsSchema.safeParse({
      grants: [{ permissionKey: "manage_agents" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid permissionKey", () => {
    expect(updateMemberPermissionsSchema.safeParse({ grants: [{ permissionKey: "do_everything" }] }).success).toBe(false);
  });

  it("rejects missing grants field", () => {
    expect(updateMemberPermissionsSchema.safeParse({}).success).toBe(false);
  });
});

describe("updateUserCompanyAccessSchema", () => {
  it("defaults to empty companyIds array", () => {
    const result = updateUserCompanyAccessSchema.parse({});
    expect(result.companyIds).toEqual([]);
  });

  it("accepts array of UUIDs", () => {
    expect(updateUserCompanyAccessSchema.safeParse({ companyIds: [VALID_UUID] }).success).toBe(true);
  });

  it("rejects non-UUID in companyIds", () => {
    expect(updateUserCompanyAccessSchema.safeParse({ companyIds: ["not-a-uuid"] }).success).toBe(false);
  });
});

describe("listJoinRequestsQuerySchema", () => {
  it("accepts empty query", () => {
    expect(listJoinRequestsQuerySchema.safeParse({}).success).toBe(true);
  });

  it("accepts valid status filter", () => {
    expect(listJoinRequestsQuerySchema.safeParse({ status: "pending" }).success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(listJoinRequestsQuerySchema.safeParse({ status: "unknown" }).success).toBe(false);
  });
});

describe("createOpenClawInvitePromptSchema", () => {
  it("accepts empty", () => {
    expect(createOpenClawInvitePromptSchema.safeParse({}).success).toBe(true);
  });

  it("accepts agentMessage", () => {
    expect(createOpenClawInvitePromptSchema.safeParse({ agentMessage: "Hello!" }).success).toBe(true);
  });

  it("rejects agentMessage over 4000 chars", () => {
    expect(createOpenClawInvitePromptSchema.safeParse({ agentMessage: "x".repeat(4001) }).success).toBe(false);
  });
});
