import { describe, expect, it } from "vitest";
import { DEFAULT_CODEX_LOCAL_MODEL, models, normalizeCodexModel } from "./index.js";

describe("Codex model selection", () => {
  it.each([undefined, null, 42, {}, "", " \t\n", "default", "DEFAULT", "  DeFaUlT  "])(
    "uses the CLI default for %j",
    (value) => {
      expect(normalizeCodexModel(value)).toBe("");
    },
  );

  it("trims explicit model IDs without changing their case or restricting custom models", () => {
    expect(normalizeCodexModel("  Custom-Model-v2 \n")).toBe("Custom-Model-v2");
  });

  it("keeps the CLI default separate from the explicit model choices", () => {
    expect(DEFAULT_CODEX_LOCAL_MODEL).toBe("");
    expect(models.map(({ id }) => id)).toEqual([
      "gpt-6.1-sol",
      "gpt-6-astra",
      "gpt-6-sol",
      "gpt-6-luna",
    ]);
  });
});
