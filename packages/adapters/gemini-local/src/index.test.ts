import { describe, expect, it } from "vitest";
import { type, label, models, DEFAULT_GEMINI_LOCAL_MODEL, agentConfigurationDoc } from "./index.js";

describe("gemini-local adapter metadata", () => {
  it("exports correct adapter type", () => {
    expect(type).toBe("gemini_local");
  });

  it("exports a human-readable label", () => {
    expect(label).toBe("Gemini CLI (local)");
  });

  it("exports DEFAULT_GEMINI_LOCAL_MODEL", () => {
    expect(typeof DEFAULT_GEMINI_LOCAL_MODEL).toBe("string");
    expect(DEFAULT_GEMINI_LOCAL_MODEL.length).toBeGreaterThan(0);
  });

  it("exports a non-empty models array", () => {
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });

  it("each model has id and label", () => {
    for (const model of models) {
      expect(typeof model.id).toBe("string");
      expect(model.id.length).toBeGreaterThan(0);
      expect(typeof model.label).toBe("string");
    }
  });

  it("DEFAULT_GEMINI_LOCAL_MODEL is in the models list", () => {
    expect(models.some((m) => m.id === DEFAULT_GEMINI_LOCAL_MODEL)).toBe(true);
  });

  it("exports an agent configuration doc string", () => {
    expect(typeof agentConfigurationDoc).toBe("string");
    expect(agentConfigurationDoc).toContain("gemini_local");
  });
});
