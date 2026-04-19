import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  agentRouteRef,
  agentUrl,
  billingTypeDisplayName,
  financeDirectionDisplayName,
  financeEventKindDisplayName,
  formatCents,
  formatTokens,
  issueUrl,
  projectRouteRef,
  projectUrl,
  providerDisplayName,
  quotaSourceDisplayName,
  relativeTime,
  visibleRunCostUsd,
} from "./utils.js";

describe("formatCents", () => {
  it("formats zero cents as $0.00", () => {
    expect(formatCents(0)).toBe("$0.00");
  });

  it("formats 100 cents as $1.00", () => {
    expect(formatCents(100)).toBe("$1.00");
  });

  it("formats 1500 cents as $15.00", () => {
    expect(formatCents(1500)).toBe("$15.00");
  });

  it("formats fractional cents", () => {
    expect(formatCents(99)).toBe("$0.99");
  });
});

describe("formatTokens", () => {
  it("formats small numbers as plain string", () => {
    expect(formatTokens(500)).toBe("500");
  });

  it("formats thousands with k suffix", () => {
    expect(formatTokens(1500)).toBe("1.5k");
  });

  it("formats millions with M suffix", () => {
    expect(formatTokens(2_000_000)).toBe("2.0M");
  });

  it("formats exactly 1000 as 1.0k", () => {
    expect(formatTokens(1000)).toBe("1.0k");
  });
});

describe("providerDisplayName", () => {
  it("maps known providers", () => {
    expect(providerDisplayName("anthropic")).toBe("Anthropic");
    expect(providerDisplayName("openai")).toBe("OpenAI");
    expect(providerDisplayName("openrouter")).toBe("OpenRouter");
    expect(providerDisplayName("google")).toBe("Google");
    expect(providerDisplayName("cursor")).toBe("Cursor");
  });

  it("is case-insensitive", () => {
    expect(providerDisplayName("ANTHROPIC")).toBe("Anthropic");
    expect(providerDisplayName("OpenAI")).toBe("OpenAI");
  });

  it("returns original string for unknown provider", () => {
    expect(providerDisplayName("my-provider")).toBe("my-provider");
  });
});

describe("quotaSourceDisplayName", () => {
  it("maps known sources", () => {
    expect(quotaSourceDisplayName("anthropic-oauth")).toBe("Anthropic OAuth");
    expect(quotaSourceDisplayName("claude-cli")).toBe("Claude CLI");
    expect(quotaSourceDisplayName("codex-rpc")).toBe("Codex app server");
  });

  it("returns original string for unknown source", () => {
    expect(quotaSourceDisplayName("unknown-source")).toBe("unknown-source");
  });
});

describe("billingTypeDisplayName", () => {
  it("returns display name for each billing type", () => {
    expect(billingTypeDisplayName("metered_api")).toBe("Metered API");
    expect(billingTypeDisplayName("subscription_included")).toBe("Subscription");
    expect(billingTypeDisplayName("subscription_overage")).toBe("Subscription overage");
    expect(billingTypeDisplayName("credits")).toBe("Credits");
    expect(billingTypeDisplayName("unknown")).toBe("Unknown");
  });
});

describe("visibleRunCostUsd", () => {
  it("returns 0 for subscription_included billing type", () => {
    expect(visibleRunCostUsd({ billingType: "subscription_included", costUsd: 5.0 })).toBe(0);
  });

  it("returns costUsd for metered billing", () => {
    expect(visibleRunCostUsd({ billingType: "metered_api", costUsd: 2.5 })).toBe(2.5);
  });

  it("returns 0 when usage is null", () => {
    expect(visibleRunCostUsd(null)).toBe(0);
  });

  it("reads cost_usd field as fallback", () => {
    expect(visibleRunCostUsd({ cost_usd: 1.5 })).toBe(1.5);
  });

  it("reads total_cost_usd field as fallback", () => {
    expect(visibleRunCostUsd({ total_cost_usd: 3.0 })).toBe(3.0);
  });

  it("reads cost from result when usage cost is 0", () => {
    expect(visibleRunCostUsd({ costUsd: 0 }, { costUsd: 2.0 })).toBe(2.0);
  });
});

describe("issueUrl", () => {
  it("uses identifier when available", () => {
    expect(issueUrl({ id: "uuid-123", identifier: "PROJ-42" })).toBe("/issues/PROJ-42");
  });

  it("falls back to id when identifier is null", () => {
    expect(issueUrl({ id: "uuid-123", identifier: null })).toBe("/issues/uuid-123");
  });

  it("falls back to id when identifier is undefined", () => {
    expect(issueUrl({ id: "uuid-123" })).toBe("/issues/uuid-123");
  });
});

describe("agentRouteRef", () => {
  it("uses urlKey when available", () => {
    expect(agentRouteRef({ id: "uuid", urlKey: "my-agent", name: "My Agent" })).toBe("my-agent");
  });

  it("derives from name when urlKey is null", () => {
    expect(agentRouteRef({ id: "uuid", urlKey: null, name: "My Agent" })).toBe("my-agent");
  });
});

describe("agentUrl", () => {
  it("returns agent URL with urlKey", () => {
    expect(agentUrl({ id: "uuid", urlKey: "my-agent" })).toBe("/agents/my-agent");
  });

  it("returns agent URL derived from name", () => {
    expect(agentUrl({ id: "uuid", urlKey: null, name: "Super Agent" })).toBe("/agents/super-agent");
  });
});

describe("projectRouteRef", () => {
  it("uses urlKey when available", () => {
    expect(projectRouteRef({ id: "uuid", urlKey: "my-project", name: "My Project" })).toBe("my-project");
  });

  it("derives from name for pure ASCII", () => {
    expect(projectRouteRef({ id: "uuid", urlKey: null, name: "My Project" })).toBe("my-project");
  });
});

describe("projectUrl", () => {
  it("returns project URL", () => {
    expect(projectUrl({ id: "uuid", urlKey: "proj", name: "Proj" })).toBe("/projects/proj");
  });
});

describe("financeDirectionDisplayName", () => {
  it("returns Credit for credit", () => {
    expect(financeDirectionDisplayName("credit")).toBe("Credit");
  });

  it("returns Debit for debit", () => {
    expect(financeDirectionDisplayName("debit")).toBe("Debit");
  });
});

describe("relativeTime", () => {
  const NOW = new Date("2026-04-19T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for very recent dates", () => {
    expect(relativeTime(new Date(NOW.getTime() - 30000))).toBe("just now");
  });

  it("returns minutes for recent dates", () => {
    expect(relativeTime(new Date(NOW.getTime() - 5 * 60 * 1000))).toBe("5m ago");
  });

  it("returns hours for hour-old dates", () => {
    expect(relativeTime(new Date(NOW.getTime() - 3 * 60 * 60 * 1000))).toBe("3h ago");
  });

  it("returns days for day-old dates", () => {
    expect(relativeTime(new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000))).toBe("5d ago");
  });
});
