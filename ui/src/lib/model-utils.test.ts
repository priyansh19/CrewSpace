import { describe, expect, it } from "vitest";
import {
  extractModelName,
  extractProviderId,
  extractProviderIdWithFallback,
} from "./model-utils.js";

describe("extractProviderId", () => {
  it("extracts provider from model id with slash", () => {
    expect(extractProviderId("anthropic/claude-3-5-sonnet")).toBe("anthropic");
  });

  it("returns null for model id without slash", () => {
    expect(extractProviderId("gpt-4")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractProviderId("")).toBeNull();
  });

  it("handles openrouter-style ids", () => {
    expect(extractProviderId("openrouter/auto")).toBe("openrouter");
  });

  it("handles multiple slashes (uses first segment)", () => {
    expect(extractProviderId("provider/sub/model")).toBe("provider");
  });

  it("handles leading whitespace in model id", () => {
    expect(extractProviderId("  anthropic/claude")).toBe("anthropic");
  });

  it("returns null when provider segment is empty", () => {
    expect(extractProviderId("/model-name")).toBeNull();
  });
});

describe("extractProviderIdWithFallback", () => {
  it("returns provider for valid model id", () => {
    expect(extractProviderIdWithFallback("anthropic/claude-3-5-sonnet")).toBe("anthropic");
  });

  it("returns default fallback 'other' for model without slash", () => {
    expect(extractProviderIdWithFallback("gpt-4")).toBe("other");
  });

  it("returns custom fallback when no slash present", () => {
    expect(extractProviderIdWithFallback("gpt-4", "openai")).toBe("openai");
  });
});

describe("extractModelName", () => {
  it("extracts model name after slash", () => {
    expect(extractModelName("anthropic/claude-3-5-sonnet")).toBe("claude-3-5-sonnet");
  });

  it("returns full string when no slash present", () => {
    expect(extractModelName("gpt-4")).toBe("gpt-4");
  });

  it("handles multiple slashes (returns after first)", () => {
    expect(extractModelName("provider/sub/model")).toBe("sub/model");
  });

  it("returns trimmed value for model without slash", () => {
    expect(extractModelName("  claude  ")).toBe("claude");
  });

  it("returns empty string for empty model id after slash", () => {
    expect(extractModelName("provider/")).toBe("");
  });
});
