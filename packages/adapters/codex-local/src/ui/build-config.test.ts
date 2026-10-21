import type { CreateConfigValues } from "@crewspaceai/adapter-utils";
import { describe, expect, it } from "vitest";
import { buildCodexLocalConfig } from "./build-config.js";

function createValues(model: string): CreateConfigValues {
  return {
    adapterType: "codex_local",
    cwd: "",
    promptTemplate: "",
    model,
    thinkingEffort: "",
    chrome: false,
    dangerouslySkipPermissions: false,
    search: false,
    dangerouslyBypassSandbox: false,
    command: "",
    args: "",
    extraArgs: "",
    envVars: "",
    envBindings: {},
    url: "",
    bootstrapPrompt: "",
    maxTurnsPerRun: 0,
    heartbeatEnabled: false,
    intervalSec: 0,
  };
}

describe("buildCodexLocalConfig", () => {
  it.each(["", " \t\n", "default", "DEFAULT", "  DeFaUlT  "])(
    "preserves CLI model selection for %j",
    (model) => {
      expect(buildCodexLocalConfig(createValues(model)).model).toBe("");
    },
  );

  it("persists a trimmed explicit model override", () => {
    expect(buildCodexLocalConfig(createValues("  gpt-6.1-sol  ")).model).toBe("gpt-6.1-sol");
  });
});
