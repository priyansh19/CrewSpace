import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AdapterExecutionContext } from "@crewspaceai/adapter-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRunChildProcess } = vi.hoisted(() => ({
  mockRunChildProcess: vi.fn(),
}));

vi.mock("@crewspaceai/adapter-utils/server-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@crewspaceai/adapter-utils/server-utils")>();
  return {
    ...actual,
    ensureAbsoluteDirectory: vi.fn().mockResolvedValue(undefined),
    ensureCommandResolvable: vi.fn().mockResolvedValue(undefined),
    resolveCommandForLogs: vi.fn().mockResolvedValue("codex"),
    readCrewSpaceRuntimeSkillEntries: vi.fn().mockResolvedValue([]),
    runChildProcess: mockRunChildProcess,
  };
});

import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

const modelCases = [
  { label: "missing", value: undefined, expected: "" },
  { label: "null", value: null, expected: "" },
  { label: "empty", value: "", expected: "" },
  { label: "whitespace", value: " \t\n", expected: "" },
  { label: "default", value: "default", expected: "" },
  { label: "mixed-case padded default", value: "  DeFaUlT  ", expected: "" },
  { label: "explicit", value: "gpt-6.1-sol", expected: "gpt-6.1-sol" },
  { label: "padded custom", value: "  Custom-Model-v2  ", expected: "Custom-Model-v2" },
];

describe("Codex model subprocess arguments", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "crewspace-codex-model-test-"));
    mockRunChildProcess.mockReset();
    mockRunChildProcess.mockResolvedValue({
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "hello" } }),
      stderr: "",
      pid: null,
      startedAt: null,
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function config(model: unknown): Record<string, unknown> {
    return {
      ...(model === undefined ? {} : { model }),
      cwd: tempDir,
      // Keep the execution home and auth checks isolated from host credentials.
      env: { CODEX_HOME: tempDir, OPENAI_API_KEY: "test-only-key" },
    };
  }

  function executionContext(model: unknown, sessionId: string | null = null): AdapterExecutionContext {
    return {
      runId: "model-argument-test",
      agent: {
        id: "test-agent",
        companyId: "test-company",
        name: "Test agent",
        adapterType: "codex_local",
        adapterConfig: {},
      },
      runtime: { sessionId, sessionParams: null, sessionDisplayId: null, taskKey: null },
      config: config(model),
      context: {},
      onLog: async () => {},
    };
  }

  function expectArgs(expectedModel: string, tail = ["-"]) {
    expect(mockRunChildProcess).toHaveBeenCalledTimes(1);
    expect(mockRunChildProcess.mock.calls[0][2]).toEqual([
      "exec",
      "--json",
      ...(expectedModel ? ["--model", expectedModel] : []),
      ...tail,
    ]);
  }

  it.each(modelCases)("uses the correct probe arguments for $label model", async ({ value, expected }) => {
    const result = await testEnvironment({
      companyId: "test-company",
      adapterType: "codex_local",
      config: config(value),
    });

    expect(result.status).toBe("pass");
    expectArgs(expected);
  });

  it.each(modelCases)("uses the correct execution arguments for $label model", async ({ value, expected }) => {
    const result = await execute(executionContext(value));

    expect(result.exitCode).toBe(0);
    expect(result.model).toBe(expected);
    expectArgs(expected);
  });

  it("preserves CLI model selection when resuming a session", async () => {
    await execute(executionContext("  DEFAULT  ", "existing-session"));

    expectArgs("", ["resume", "existing-session", "-"]);
  });
});
