import { describe, expect, it } from "vitest";
import {
  createIssueWorkProductSchema,
  issueWorkProductReviewStateSchema,
  issueWorkProductStatusSchema,
  issueWorkProductTypeSchema,
  updateIssueWorkProductSchema,
} from "./work-product.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("issueWorkProductTypeSchema", () => {
  it("accepts all valid types", () => {
    for (const type of ["preview_url", "runtime_service", "pull_request", "branch", "commit", "artifact", "document"] as const) {
      expect(issueWorkProductTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it("rejects invalid type", () => {
    expect(issueWorkProductTypeSchema.safeParse("image").success).toBe(false);
  });
});

describe("issueWorkProductStatusSchema", () => {
  it("accepts active status", () => {
    expect(issueWorkProductStatusSchema.safeParse("active").success).toBe(true);
  });

  it("accepts merged status", () => {
    expect(issueWorkProductStatusSchema.safeParse("merged").success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(issueWorkProductStatusSchema.safeParse("deleted").success).toBe(false);
  });
});

describe("issueWorkProductReviewStateSchema", () => {
  it("accepts all valid review states", () => {
    for (const state of ["none", "needs_board_review", "approved", "changes_requested"] as const) {
      expect(issueWorkProductReviewStateSchema.safeParse(state).success).toBe(true);
    }
  });

  it("rejects invalid review state", () => {
    expect(issueWorkProductReviewStateSchema.safeParse("rejected").success).toBe(false);
  });
});

describe("createIssueWorkProductSchema", () => {
  it("accepts a valid work product", () => {
    const result = createIssueWorkProductSchema.safeParse({
      type: "pull_request",
      provider: "github",
      title: "Add feature X",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
      expect(result.data.reviewState).toBe("none");
      expect(result.data.isPrimary).toBe(false);
      expect(result.data.healthStatus).toBe("unknown");
    }
  });

  it("rejects empty provider", () => {
    expect(createIssueWorkProductSchema.safeParse({ type: "branch", provider: "", title: "T" }).success).toBe(false);
  });

  it("rejects empty title", () => {
    expect(createIssueWorkProductSchema.safeParse({ type: "branch", provider: "git", title: "" }).success).toBe(false);
  });

  it("rejects invalid URL for url field", () => {
    expect(createIssueWorkProductSchema.safeParse({ type: "branch", provider: "git", title: "T", url: "not-a-url" }).success).toBe(false);
  });

  it("accepts valid URL", () => {
    expect(createIssueWorkProductSchema.safeParse({ type: "pull_request", provider: "github", title: "T", url: "https://github.com/pr/1" }).success).toBe(true);
  });

  it("accepts valid projectId UUID", () => {
    expect(createIssueWorkProductSchema.safeParse({ type: "branch", provider: "git", title: "T", projectId: VALID_UUID }).success).toBe(true);
  });

  it("rejects non-UUID projectId", () => {
    expect(createIssueWorkProductSchema.safeParse({ type: "branch", provider: "git", title: "T", projectId: "bad" }).success).toBe(false);
  });
});

describe("updateIssueWorkProductSchema", () => {
  it("accepts empty update", () => {
    expect(updateIssueWorkProductSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial update with just status", () => {
    expect(updateIssueWorkProductSchema.safeParse({ status: "merged" }).success).toBe(true);
  });
});
