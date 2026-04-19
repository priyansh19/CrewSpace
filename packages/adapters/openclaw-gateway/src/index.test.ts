import { describe, expect, it } from "vitest";
import { type, label, models, agentConfigurationDoc } from "./index.js";

describe("openclaw-gateway adapter metadata", () => {
  it("exports correct adapter type", () => {
    expect(type).toBe("openclaw_gateway");
  });

  it("exports a human-readable label", () => {
    expect(label).toBe("OpenClaw Gateway");
    expect(typeof label).toBe("string");
  });

  it("exports models (may be empty for gateway adapter)", () => {
    expect(Array.isArray(models)).toBe(true);
  });

  it("each model entry (if any) has id and label", () => {
    for (const model of models) {
      expect(typeof model.id).toBe("string");
      expect(typeof model.label).toBe("string");
    }
  });

  it("exports an agent configuration doc string", () => {
    expect(typeof agentConfigurationDoc).toBe("string");
    expect(agentConfigurationDoc.length).toBeGreaterThan(0);
    expect(agentConfigurationDoc).toContain("openclaw_gateway");
  });

  it("configuration doc mentions required url field", () => {
    expect(agentConfigurationDoc).toContain("url");
  });
});
