import { describe, expect, it } from "vitest";
import { type, label, models, agentConfigurationDoc } from "./index.js";

describe("claude-local adapter metadata", () => {
  it("exports correct adapter type", () => {
    expect(type).toBe("claude_local");
  });

  it("exports a human-readable label", () => {
    expect(label).toBeTruthy();
    expect(typeof label).toBe("string");
  });

  it("exports a non-empty models array", () => {
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });

  it("each model has an id and label", () => {
    for (const model of models) {
      expect(typeof model.id).toBe("string");
      expect(model.id.length).toBeGreaterThan(0);
      expect(typeof model.label).toBe("string");
      expect(model.label.length).toBeGreaterThan(0);
    }
  });

  it("all model ids contain 'claude'", () => {
    for (const model of models) {
      expect(model.id).toContain("claude");
    }
  });

  it("exports an agent configuration doc string", () => {
    expect(typeof agentConfigurationDoc).toBe("string");
    expect(agentConfigurationDoc.length).toBeGreaterThan(0);
    expect(agentConfigurationDoc).toContain("claude_local");
  });
});
