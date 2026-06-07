import { describe, expect, it } from "vitest";
import {
  agentMineInboxQuerySchema,
  agentPermissionsSchema,
  createAgentKeySchema,
  createAgentSchema,
  resetAgentSessionSchema,
  testAdapterEnvironmentSchema,
  updateAgentInstructionsBundleSchema,
  updateAgentPermissionsSchema,
  updateAgentSchema,
  upsertAgentInstructionsFileSchema,
  wakeAgentSchema,
} from "./agent.js";

describe("createAgentSchema", () => {
  it("accepts a minimal valid agent", () => {
    const result = createAgentSchema.safeParse({ name: "My Agent" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("general");
      expect(result.data.adapterType).toBe("process");
    }
  });

  it("rejects empty name", () => {
    expect(createAgentSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects invalid role", () => {
    expect(createAgentSchema.safeParse({ name: "A", role: "ceo" }).success).toBe(false);
  });

  it("rejects negative budget", () => {
    expect(createAgentSchema.safeParse({ name: "A", budgetMonthlyCents: -1 }).success).toBe(false);
  });

  it("accepts valid adapterConfig with env secret_ref binding", () => {
    const result = createAgentSchema.safeParse({
      name: "Agent",
      adapterConfig: {
        env: { MY_KEY: { type: "secret_ref", secretId: "550e8400-e29b-41d4-a716-446655440000" } },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects adapterConfig.env with invalid binding type", () => {
    const result = createAgentSchema.safeParse({
      name: "Agent",
      adapterConfig: { env: { MY_KEY: { type: "invalid_type" } } },
    });
    expect(result.success).toBe(false);
  });

  it("accepts string env binding (backward compat)", () => {
    const result = createAgentSchema.safeParse({
      name: "Agent",
      adapterConfig: { env: { MY_KEY: "plainvalue" } },
    });
    expect(result.success).toBe(true);
  });
});

describe("updateAgentSchema", () => {
  it("accepts empty update (all fields optional)", () => {
    expect(updateAgentSchema.safeParse({}).success).toBe(true);
  });

  it("accepts status update", () => {
    expect(updateAgentSchema.safeParse({ status: "active" }).success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(updateAgentSchema.safeParse({ status: "dead" }).success).toBe(false);
  });

  it("accepts replaceAdapterConfig flag", () => {
    expect(updateAgentSchema.safeParse({ replaceAdapterConfig: true }).success).toBe(true);
  });
});

describe("agentPermissionsSchema", () => {
  it("defaults canCreateAgents to false", () => {
    const result = agentPermissionsSchema.parse({});
    expect(result.canCreateAgents).toBe(false);
  });

  it("accepts canCreateAgents=true", () => {
    expect(agentPermissionsSchema.parse({ canCreateAgents: true }).canCreateAgents).toBe(true);
  });
});

describe("wakeAgentSchema", () => {
  it("defaults source to on_demand", () => {
    const result = wakeAgentSchema.parse({});
    expect(result.source).toBe("on_demand");
    expect(result.forceFreshSession).toBe(false);
  });

  it("accepts null forceFreshSession (preprocessed to undefined→default)", () => {
    const result = wakeAgentSchema.parse({ forceFreshSession: null });
    expect(result.forceFreshSession).toBe(false);
  });

  it("rejects invalid source", () => {
    expect(wakeAgentSchema.safeParse({ source: "unknown" }).success).toBe(false);
  });
});

describe("updateAgentInstructionsBundleSchema", () => {
  it("accepts empty update", () => {
    expect(updateAgentInstructionsBundleSchema.safeParse({}).success).toBe(true);
  });

  it("rejects empty rootPath (must be min 1 if provided)", () => {
    expect(updateAgentInstructionsBundleSchema.safeParse({ rootPath: "" }).success).toBe(false);
  });

  it("accepts null rootPath", () => {
    expect(updateAgentInstructionsBundleSchema.safeParse({ rootPath: null }).success).toBe(true);
  });
});

describe("upsertAgentInstructionsFileSchema", () => {
  it("accepts valid path and content", () => {
    const result = upsertAgentInstructionsFileSchema.safeParse({ path: "AGENT.md", content: "# Prompt" });
    expect(result.success).toBe(true);
  });

  it("rejects empty path", () => {
    expect(upsertAgentInstructionsFileSchema.safeParse({ path: "", content: "x" }).success).toBe(false);
  });
});

describe("createAgentKeySchema", () => {
  it("defaults name to default", () => {
    expect(createAgentKeySchema.parse({}).name).toBe("default");
  });

  it("rejects empty name", () => {
    expect(createAgentKeySchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("agentMineInboxQuerySchema", () => {
  it("accepts valid userId", () => {
    const result = agentMineInboxQuerySchema.safeParse({ userId: "user-123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty userId", () => {
    expect(agentMineInboxQuerySchema.safeParse({ userId: "" }).success).toBe(false);
  });

  it("rejects whitespace-only userId", () => {
    expect(agentMineInboxQuerySchema.safeParse({ userId: "   " }).success).toBe(false);
  });
});

describe("updateAgentPermissionsSchema", () => {
  it("accepts valid permissions", () => {
    const result = updateAgentPermissionsSchema.safeParse({ canCreateAgents: true, canAssignTasks: false });
    expect(result.success).toBe(true);
  });

  it("rejects missing canAssignTasks", () => {
    expect(updateAgentPermissionsSchema.safeParse({ canCreateAgents: true }).success).toBe(false);
  });
});

describe("resetAgentSessionSchema", () => {
  it("accepts taskKey", () => {
    expect(resetAgentSessionSchema.safeParse({ taskKey: "task-abc" }).success).toBe(true);
  });

  it("accepts empty object", () => {
    expect(resetAgentSessionSchema.safeParse({}).success).toBe(true);
  });
});

describe("testAdapterEnvironmentSchema", () => {
  it("accepts empty config", () => {
    expect(testAdapterEnvironmentSchema.safeParse({}).success).toBe(true);
  });
});
