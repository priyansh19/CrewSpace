import { describe, expect, it } from "vitest";
import {
  ADAPTER_SESSION_MANAGEMENT,
  LEGACY_SESSIONED_ADAPTER_TYPES,
  getAdapterSessionManagement,
  hasSessionCompactionThresholds,
  readSessionCompactionOverride,
  resolveSessionCompactionPolicy,
} from "./session-compaction.js";

describe("LEGACY_SESSIONED_ADAPTER_TYPES", () => {
  it("includes claude_local", () => expect(LEGACY_SESSIONED_ADAPTER_TYPES.has("claude_local")).toBe(true));
  it("includes codex_local", () => expect(LEGACY_SESSIONED_ADAPTER_TYPES.has("codex_local")).toBe(true));
  it("includes gemini_local", () => expect(LEGACY_SESSIONED_ADAPTER_TYPES.has("gemini_local")).toBe(true));
  it("does not include unknown adapter", () => expect(LEGACY_SESSIONED_ADAPTER_TYPES.has("unknown_adapter")).toBe(false));
});

describe("getAdapterSessionManagement", () => {
  it("returns management config for claude_local", () => {
    const result = getAdapterSessionManagement("claude_local");
    expect(result).not.toBeNull();
    expect(result?.supportsSessionResume).toBe(true);
    expect(result?.nativeContextManagement).toBe("confirmed");
  });

  it("returns management config for cursor", () => {
    const result = getAdapterSessionManagement("cursor");
    expect(result?.nativeContextManagement).toBe("unknown");
  });

  it("returns null for null input", () => {
    expect(getAdapterSessionManagement(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(getAdapterSessionManagement(undefined)).toBeNull();
  });

  it("returns null for unknown adapter type", () => {
    expect(getAdapterSessionManagement("nonexistent_adapter")).toBeNull();
  });
});

describe("readSessionCompactionOverride", () => {
  it("returns empty object when runtimeConfig is null", () => {
    expect(readSessionCompactionOverride(null)).toEqual({});
  });

  it("returns empty object when runtimeConfig has no compaction config", () => {
    expect(readSessionCompactionOverride({})).toEqual({});
  });

  it("reads enabled flag from heartbeat.sessionCompaction", () => {
    const result = readSessionCompactionOverride({
      heartbeat: { sessionCompaction: { enabled: false } },
    });
    expect(result.enabled).toBe(false);
  });

  it("reads enabled=true string", () => {
    const result = readSessionCompactionOverride({
      heartbeat: { sessionCompaction: { enabled: "true" } },
    });
    expect(result.enabled).toBe(true);
  });

  it("reads maxSessionRuns as number", () => {
    const result = readSessionCompactionOverride({
      heartbeat: { sessionCompaction: { maxSessionRuns: 50 } },
    });
    expect(result.maxSessionRuns).toBe(50);
  });

  it("reads maxSessionRuns from string", () => {
    const result = readSessionCompactionOverride({
      heartbeat: { sessionCompaction: { maxSessionRuns: "100" } },
    });
    expect(result.maxSessionRuns).toBe(100);
  });

  it("reads maxRawInputTokens", () => {
    const result = readSessionCompactionOverride({
      heartbeat: { sessionCompaction: { maxRawInputTokens: 500_000 } },
    });
    expect(result.maxRawInputTokens).toBe(500_000);
  });

  it("reads from legacy sessionRotation key", () => {
    const result = readSessionCompactionOverride({
      heartbeat: { sessionRotation: { enabled: false, maxSessionRuns: 10 } },
    });
    expect(result.enabled).toBe(false);
    expect(result.maxSessionRuns).toBe(10);
  });

  it("reads from top-level sessionCompaction key", () => {
    const result = readSessionCompactionOverride({
      sessionCompaction: { maxSessionAgeHours: 24 },
    });
    expect(result.maxSessionAgeHours).toBe(24);
  });

  it("clamps negative numbers to 0", () => {
    const result = readSessionCompactionOverride({
      heartbeat: { sessionCompaction: { maxSessionRuns: -5 } },
    });
    expect(result.maxSessionRuns).toBe(0);
  });

  it("ignores invalid boolean values", () => {
    const result = readSessionCompactionOverride({
      heartbeat: { sessionCompaction: { enabled: "maybe" } },
    });
    expect(result.enabled).toBeUndefined();
  });
});

describe("resolveSessionCompactionPolicy", () => {
  it("uses adapter default for claude_local (adapter_managed: all zeros)", () => {
    const result = resolveSessionCompactionPolicy("claude_local", {});
    expect(result.source).toBe("adapter_default");
    expect(result.policy.maxSessionRuns).toBe(0);
    expect(result.policy.maxRawInputTokens).toBe(0);
    expect(result.adapterSessionManagement?.nativeContextManagement).toBe("confirmed");
  });

  it("uses adapter default for cursor (standard thresholds)", () => {
    const result = resolveSessionCompactionPolicy("cursor", {});
    expect(result.source).toBe("adapter_default");
    expect(result.policy.maxSessionRuns).toBe(200);
  });

  it("marks source as legacy_fallback for unknown adapter", () => {
    const result = resolveSessionCompactionPolicy("unknown_adapter", {});
    expect(result.source).toBe("legacy_fallback");
    expect(result.policy.enabled).toBe(false);
  });

  it("marks source as legacy_fallback for null adapter", () => {
    const result = resolveSessionCompactionPolicy(null, {});
    expect(result.source).toBe("legacy_fallback");
  });

  it("marks source as agent_override when runtimeConfig has override", () => {
    const result = resolveSessionCompactionPolicy("claude_local", {
      heartbeat: { sessionCompaction: { maxSessionRuns: 50 } },
    });
    expect(result.source).toBe("agent_override");
    expect(result.policy.maxSessionRuns).toBe(50);
    expect(result.explicitOverride.maxSessionRuns).toBe(50);
  });

  it("merges override with adapter defaults", () => {
    const result = resolveSessionCompactionPolicy("cursor", {
      heartbeat: { sessionCompaction: { maxSessionRuns: 75 } },
    });
    expect(result.policy.maxSessionRuns).toBe(75);
    expect(result.policy.maxRawInputTokens).toBe(2_000_000);
  });

  it("enabled=true for legacy adapter types with no management config", () => {
    const result = resolveSessionCompactionPolicy("gemini_local", {});
    expect(result.policy.enabled).toBe(true);
  });
});

describe("hasSessionCompactionThresholds", () => {
  it("returns true when maxSessionRuns > 0", () => {
    expect(hasSessionCompactionThresholds({ maxSessionRuns: 1, maxRawInputTokens: 0, maxSessionAgeHours: 0 })).toBe(true);
  });

  it("returns true when maxRawInputTokens > 0", () => {
    expect(hasSessionCompactionThresholds({ maxSessionRuns: 0, maxRawInputTokens: 1000, maxSessionAgeHours: 0 })).toBe(true);
  });

  it("returns true when maxSessionAgeHours > 0", () => {
    expect(hasSessionCompactionThresholds({ maxSessionRuns: 0, maxRawInputTokens: 0, maxSessionAgeHours: 1 })).toBe(true);
  });

  it("returns false when all thresholds are 0 (adapter-managed)", () => {
    expect(hasSessionCompactionThresholds({ maxSessionRuns: 0, maxRawInputTokens: 0, maxSessionAgeHours: 0 })).toBe(false);
  });
});
