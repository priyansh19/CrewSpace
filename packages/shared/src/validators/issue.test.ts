import { describe, expect, it } from "vitest";
import {
  checkoutIssueSchema,
  createIssueLabelSchema,
  createIssueSchema,
  issueAssigneeAdapterOverridesSchema,
  issueExecutionWorkspaceSettingsSchema,
  updateIssueSchema,
} from "./issue.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("createIssueSchema", () => {
  it("accepts minimal valid issue", () => {
    const result = createIssueSchema.safeParse({ title: "Fix bug" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("backlog");
      expect(result.data.priority).toBe("medium");
    }
  });

  it("rejects empty title", () => {
    expect(createIssueSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("rejects invalid status", () => {
    expect(createIssueSchema.safeParse({ title: "T", status: "deleted" }).success).toBe(false);
  });

  it("rejects invalid priority", () => {
    expect(createIssueSchema.safeParse({ title: "T", priority: "emergency" }).success).toBe(false);
  });

  it("accepts valid projectId UUID", () => {
    const result = createIssueSchema.safeParse({ title: "T", projectId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID projectId", () => {
    expect(createIssueSchema.safeParse({ title: "T", projectId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects negative requestDepth", () => {
    expect(createIssueSchema.safeParse({ title: "T", requestDepth: -1 }).success).toBe(false);
  });

  it("accepts valid executionWorkspacePreference", () => {
    const result = createIssueSchema.safeParse({
      title: "T",
      executionWorkspacePreference: "isolated_workspace",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid executionWorkspacePreference", () => {
    expect(createIssueSchema.safeParse({ title: "T", executionWorkspacePreference: "wrong" }).success).toBe(false);
  });

  it("accepts labelIds as array of UUIDs", () => {
    const result = createIssueSchema.safeParse({ title: "T", labelIds: [VALID_UUID] });
    expect(result.success).toBe(true);
  });

  it("rejects labelIds with non-UUID entries", () => {
    expect(createIssueSchema.safeParse({ title: "T", labelIds: ["not-a-uuid"] }).success).toBe(false);
  });
});

describe("updateIssueSchema", () => {
  it("accepts empty update", () => {
    expect(updateIssueSchema.safeParse({}).success).toBe(true);
  });

  it("accepts reopen flag", () => {
    expect(updateIssueSchema.safeParse({ reopen: true }).success).toBe(true);
  });

  it("accepts comment", () => {
    expect(updateIssueSchema.safeParse({ comment: "looks good" }).success).toBe(true);
  });

  it("rejects empty comment", () => {
    expect(updateIssueSchema.safeParse({ comment: "" }).success).toBe(false);
  });

  it("accepts valid datetime for hiddenAt", () => {
    expect(updateIssueSchema.safeParse({ hiddenAt: "2024-01-01T00:00:00Z" }).success).toBe(true);
  });

  it("accepts null hiddenAt", () => {
    expect(updateIssueSchema.safeParse({ hiddenAt: null }).success).toBe(true);
  });
});

describe("createIssueLabelSchema", () => {
  it("accepts valid label", () => {
    const result = createIssueLabelSchema.safeParse({ name: "bug", color: "#ff0000" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createIssueLabelSchema.safeParse({ name: "", color: "#ff0000" }).success).toBe(false);
  });

  it("rejects name longer than 48 chars", () => {
    expect(createIssueLabelSchema.safeParse({ name: "x".repeat(49), color: "#ff0000" }).success).toBe(false);
  });

  it("rejects invalid color format (3-digit hex)", () => {
    expect(createIssueLabelSchema.safeParse({ name: "bug", color: "#f00" }).success).toBe(false);
  });

  it("rejects color without hash prefix", () => {
    expect(createIssueLabelSchema.safeParse({ name: "bug", color: "ff0000" }).success).toBe(false);
  });

  it("accepts uppercase hex color", () => {
    expect(createIssueLabelSchema.safeParse({ name: "bug", color: "#FF0000" }).success).toBe(true);
  });
});

describe("checkoutIssueSchema", () => {
  it("accepts valid checkout", () => {
    const result = checkoutIssueSchema.safeParse({
      agentId: VALID_UUID,
      expectedStatuses: ["backlog"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID agentId", () => {
    expect(checkoutIssueSchema.safeParse({ agentId: "bad", expectedStatuses: ["backlog"] }).success).toBe(false);
  });

  it("rejects empty expectedStatuses array", () => {
    expect(checkoutIssueSchema.safeParse({ agentId: VALID_UUID, expectedStatuses: [] }).success).toBe(false);
  });

  it("rejects invalid status in expectedStatuses", () => {
    expect(checkoutIssueSchema.safeParse({ agentId: VALID_UUID, expectedStatuses: ["invalid"] }).success).toBe(false);
  });
});

describe("issueExecutionWorkspaceSettingsSchema", () => {
  it("accepts empty object", () => {
    expect(issueExecutionWorkspaceSettingsSchema.safeParse({}).success).toBe(true);
  });

  it("accepts valid mode", () => {
    expect(issueExecutionWorkspaceSettingsSchema.safeParse({ mode: "isolated_workspace" }).success).toBe(true);
  });

  it("rejects unknown keys (strict)", () => {
    expect(issueExecutionWorkspaceSettingsSchema.safeParse({ unknownField: true }).success).toBe(false);
  });
});

describe("issueAssigneeAdapterOverridesSchema", () => {
  it("accepts empty object", () => {
    expect(issueAssigneeAdapterOverridesSchema.safeParse({}).success).toBe(true);
  });

  it("accepts useProjectWorkspace flag", () => {
    expect(issueAssigneeAdapterOverridesSchema.safeParse({ useProjectWorkspace: true }).success).toBe(true);
  });
});
