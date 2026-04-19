import { describe, expect, it } from "vitest";
import { deriveAgentUrlKey, isUuidLike, normalizeAgentUrlKey } from "./agent-url-key.js";

describe("isUuidLike", () => {
  it("returns true for a valid v4 UUID", () => {
    expect(isUuidLike("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("returns true for a valid v1 UUID", () => {
    expect(isUuidLike("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
  });

  it("returns true for a UUID with surrounding whitespace", () => {
    expect(isUuidLike("  550e8400-e29b-41d4-a716-446655440000  ")).toBe(true);
  });

  it("returns true for uppercase UUID", () => {
    expect(isUuidLike("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("returns false for a plain string", () => {
    expect(isUuidLike("not-a-uuid")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isUuidLike(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isUuidLike(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isUuidLike("")).toBe(false);
  });

  it("returns false for UUID without dashes", () => {
    expect(isUuidLike("550e8400e29b41d4a716446655440000")).toBe(false);
  });

  it("returns false for a UUID with invalid version digit (0)", () => {
    expect(isUuidLike("550e8400-e29b-01d4-a716-446655440000")).toBe(false);
  });

  it("returns false for a UUID with invalid variant bits", () => {
    expect(isUuidLike("550e8400-e29b-41d4-0716-446655440000")).toBe(false);
  });
});

describe("normalizeAgentUrlKey", () => {
  it("lowercases an ASCII name", () => {
    expect(normalizeAgentUrlKey("MyAgent")).toBe("myagent");
  });

  it("replaces spaces with dashes", () => {
    expect(normalizeAgentUrlKey("my agent")).toBe("my-agent");
  });

  it("collapses multiple special characters to one dash", () => {
    expect(normalizeAgentUrlKey("my--agent!!name")).toBe("my-agent-name");
  });

  it("trims leading and trailing dashes", () => {
    expect(normalizeAgentUrlKey("--my-agent--")).toBe("my-agent");
  });

  it("trims leading and trailing whitespace before normalizing", () => {
    expect(normalizeAgentUrlKey("  hello world  ")).toBe("hello-world");
  });

  it("returns null for null input", () => {
    expect(normalizeAgentUrlKey(null)).toBe(null);
  });

  it("returns null for undefined input", () => {
    expect(normalizeAgentUrlKey(undefined)).toBe(null);
  });

  it("returns null for empty string", () => {
    expect(normalizeAgentUrlKey("")).toBe(null);
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizeAgentUrlKey("   ")).toBe(null);
  });

  it("returns null for string that normalizes to empty (all special chars)", () => {
    expect(normalizeAgentUrlKey("!!!")).toBe(null);
  });

  it("preserves digits", () => {
    expect(normalizeAgentUrlKey("Agent007")).toBe("agent007");
  });

  it("replaces underscores with dashes", () => {
    expect(normalizeAgentUrlKey("my_agent_name")).toBe("my-agent-name");
  });
});

describe("deriveAgentUrlKey", () => {
  it("uses normalized name when name is valid", () => {
    expect(deriveAgentUrlKey("My Agent")).toBe("my-agent");
  });

  it("falls back to fallback when name is null", () => {
    expect(deriveAgentUrlKey(null, "fallback-agent")).toBe("fallback-agent");
  });

  it("falls back to fallback when name is undefined", () => {
    expect(deriveAgentUrlKey(undefined, "fallback-agent")).toBe("fallback-agent");
  });

  it("falls back to fallback when name normalizes to null", () => {
    expect(deriveAgentUrlKey("!!!", "fallback")).toBe("fallback");
  });

  it("returns 'agent' when both name and fallback are null", () => {
    expect(deriveAgentUrlKey(null, null)).toBe("agent");
  });

  it("returns 'agent' when both name and fallback are undefined", () => {
    expect(deriveAgentUrlKey(undefined, undefined)).toBe("agent");
  });

  it("returns 'agent' when both name and fallback normalize to null", () => {
    expect(deriveAgentUrlKey("!", "!")).toBe("agent");
  });

  it("prefers name over fallback when both are provided", () => {
    expect(deriveAgentUrlKey("Primary", "Secondary")).toBe("primary");
  });
});
