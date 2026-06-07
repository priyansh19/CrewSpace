import { describe, expect, it } from "vitest";
import { resolveBudgetIncidentSchema, upsertBudgetPolicySchema } from "./budget.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("upsertBudgetPolicySchema", () => {
  it("accepts a valid budget policy", () => {
    const result = upsertBudgetPolicySchema.safeParse({
      scopeType: "company",
      scopeId: VALID_UUID,
      amount: 10000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metric).toBe("billed_cents");
      expect(result.data.windowKind).toBe("calendar_month_utc");
      expect(result.data.warnPercent).toBe(80);
      expect(result.data.hardStopEnabled).toBe(true);
    }
  });

  it("rejects non-UUID scopeId", () => {
    expect(upsertBudgetPolicySchema.safeParse({ scopeType: "company", scopeId: "bad", amount: 100 }).success).toBe(false);
  });

  it("rejects negative amount", () => {
    expect(upsertBudgetPolicySchema.safeParse({ scopeType: "company", scopeId: VALID_UUID, amount: -1 }).success).toBe(false);
  });

  it("accepts zero amount", () => {
    expect(upsertBudgetPolicySchema.safeParse({ scopeType: "company", scopeId: VALID_UUID, amount: 0 }).success).toBe(true);
  });

  it("rejects warnPercent below 1", () => {
    expect(upsertBudgetPolicySchema.safeParse({ scopeType: "company", scopeId: VALID_UUID, amount: 100, warnPercent: 0 }).success).toBe(false);
  });

  it("rejects warnPercent above 99", () => {
    expect(upsertBudgetPolicySchema.safeParse({ scopeType: "company", scopeId: VALID_UUID, amount: 100, warnPercent: 100 }).success).toBe(false);
  });

  it("accepts warnPercent at boundaries (1 and 99)", () => {
    expect(upsertBudgetPolicySchema.safeParse({ scopeType: "company", scopeId: VALID_UUID, amount: 100, warnPercent: 1 }).success).toBe(true);
    expect(upsertBudgetPolicySchema.safeParse({ scopeType: "company", scopeId: VALID_UUID, amount: 100, warnPercent: 99 }).success).toBe(true);
  });

  it("rejects invalid scopeType", () => {
    expect(upsertBudgetPolicySchema.safeParse({ scopeType: "team", scopeId: VALID_UUID, amount: 100 }).success).toBe(false);
  });

  it("rejects invalid metric", () => {
    expect(upsertBudgetPolicySchema.safeParse({ scopeType: "company", scopeId: VALID_UUID, amount: 100, metric: "tokens" }).success).toBe(false);
  });
});

describe("resolveBudgetIncidentSchema", () => {
  it("accepts pause action without amount", () => {
    const result = resolveBudgetIncidentSchema.safeParse({ action: "pause" });
    expect(result.success).toBe(true);
  });

  it("accepts raise_budget_and_resume with amount", () => {
    const result = resolveBudgetIncidentSchema.safeParse({ action: "raise_budget_and_resume", amount: 5000 });
    expect(result.success).toBe(true);
  });

  it("rejects raise_budget_and_resume without amount", () => {
    const result = resolveBudgetIncidentSchema.safeParse({ action: "raise_budget_and_resume" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("amount"))).toBe(true);
    }
  });

  it("rejects invalid action", () => {
    expect(resolveBudgetIncidentSchema.safeParse({ action: "delete" }).success).toBe(false);
  });

  it("accepts optional decisionNote", () => {
    expect(resolveBudgetIncidentSchema.safeParse({ action: "pause", decisionNote: "Budget exceeded" }).success).toBe(true);
  });

  it("rejects negative amount", () => {
    expect(resolveBudgetIncidentSchema.safeParse({ action: "raise_budget_and_resume", amount: -1 }).success).toBe(false);
  });
});
