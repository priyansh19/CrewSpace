import { describe, expect, it } from "vitest";
import { createGoalSchema, updateGoalSchema } from "./goal.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("createGoalSchema", () => {
  it("accepts a minimal valid goal", () => {
    const result = createGoalSchema.safeParse({ title: "Q4 Launch" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.level).toBe("task");
      expect(result.data.status).toBe("planned");
    }
  });

  it("rejects empty title", () => {
    expect(createGoalSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("accepts all valid levels", () => {
    for (const level of ["task", "milestone", "objective", "strategy"] as const) {
      expect(createGoalSchema.safeParse({ title: "G", level }).success).toBe(true);
    }
  });

  it("rejects invalid level", () => {
    expect(createGoalSchema.safeParse({ title: "G", level: "epic" }).success).toBe(false);
  });

  it("accepts all valid statuses", () => {
    for (const status of ["planned", "active", "completed", "cancelled"] as const) {
      expect(createGoalSchema.safeParse({ title: "G", status }).success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    expect(createGoalSchema.safeParse({ title: "G", status: "deleted" }).success).toBe(false);
  });

  it("accepts valid parentId UUID", () => {
    expect(createGoalSchema.safeParse({ title: "G", parentId: VALID_UUID }).success).toBe(true);
  });

  it("rejects non-UUID parentId", () => {
    expect(createGoalSchema.safeParse({ title: "G", parentId: "not-a-uuid" }).success).toBe(false);
  });

  it("accepts null ownerAgentId", () => {
    expect(createGoalSchema.safeParse({ title: "G", ownerAgentId: null }).success).toBe(true);
  });
});

describe("updateGoalSchema", () => {
  it("accepts empty update (all fields optional)", () => {
    expect(updateGoalSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial update with just title", () => {
    expect(updateGoalSchema.safeParse({ title: "New Title" }).success).toBe(true);
  });

  it("accepts partial update with just status", () => {
    expect(updateGoalSchema.safeParse({ status: "active" }).success).toBe(true);
  });

  it("rejects invalid status in partial update", () => {
    expect(updateGoalSchema.safeParse({ status: "unknown" }).success).toBe(false);
  });
});
