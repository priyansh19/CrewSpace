import { describe, expect, it } from "vitest";
import {
  createCompanySchema,
  updateCompanyBrandingSchema,
  updateCompanySchema,
} from "./company.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("createCompanySchema", () => {
  it("accepts a valid company", () => {
    const result = createCompanySchema.safeParse({ name: "Acme Corp" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.budgetMonthlyCents).toBe(0);
    }
  });

  it("rejects empty name", () => {
    expect(createCompanySchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects negative budget", () => {
    expect(createCompanySchema.safeParse({ name: "X", budgetMonthlyCents: -100 }).success).toBe(false);
  });

  it("accepts zero budget", () => {
    expect(createCompanySchema.safeParse({ name: "X", budgetMonthlyCents: 0 }).success).toBe(true);
  });

  it("accepts optional description", () => {
    expect(createCompanySchema.safeParse({ name: "X", description: "A great company" }).success).toBe(true);
  });
});

describe("updateCompanySchema", () => {
  it("accepts empty update", () => {
    expect(updateCompanySchema.safeParse({}).success).toBe(true);
  });

  it("accepts valid status", () => {
    expect(updateCompanySchema.safeParse({ status: "active" }).success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(updateCompanySchema.safeParse({ status: "deleted" }).success).toBe(false);
  });

  it("accepts valid 6-digit hex brandColor", () => {
    expect(updateCompanySchema.safeParse({ brandColor: "#3366aa" }).success).toBe(true);
  });

  it("rejects invalid brandColor (3-digit)", () => {
    expect(updateCompanySchema.safeParse({ brandColor: "#abc" }).success).toBe(false);
  });

  it("rejects brandColor without hash", () => {
    expect(updateCompanySchema.safeParse({ brandColor: "3366aa" }).success).toBe(false);
  });

  it("accepts null brandColor", () => {
    expect(updateCompanySchema.safeParse({ brandColor: null }).success).toBe(true);
  });

  it("accepts valid logoAssetId UUID", () => {
    expect(updateCompanySchema.safeParse({ logoAssetId: VALID_UUID }).success).toBe(true);
  });

  it("accepts null logoAssetId", () => {
    expect(updateCompanySchema.safeParse({ logoAssetId: null }).success).toBe(true);
  });

  it("accepts requireBoardApprovalForNewAgents flag", () => {
    expect(updateCompanySchema.safeParse({ requireBoardApprovalForNewAgents: true }).success).toBe(true);
  });
});

describe("updateCompanyBrandingSchema", () => {
  it("accepts update with just name", () => {
    expect(updateCompanyBrandingSchema.safeParse({ name: "New Name" }).success).toBe(true);
  });

  it("accepts update with just brandColor", () => {
    expect(updateCompanyBrandingSchema.safeParse({ brandColor: "#ffffff" }).success).toBe(true);
  });

  it("accepts update with just logoAssetId null", () => {
    expect(updateCompanyBrandingSchema.safeParse({ logoAssetId: null }).success).toBe(true);
  });

  it("rejects empty object (at least one field required)", () => {
    expect(updateCompanyBrandingSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    expect(updateCompanyBrandingSchema.safeParse({ unknownField: "x", name: "N" }).success).toBe(false);
  });

  it("accepts update with description null", () => {
    expect(updateCompanyBrandingSchema.safeParse({ description: null }).success).toBe(true);
  });
});
