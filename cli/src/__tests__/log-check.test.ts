import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("node:fs");
vi.mock("../utils/path-resolver.js", () => ({
  resolveRuntimeLikePath: vi.fn((p: string) => `/resolved${p}`),
}));

import fs from "node:fs";
import { logCheck } from "../checks/log-check.js";

const mockFs = vi.mocked(fs);

const baseConfig = {
  logging: { mode: "file" as const, logDir: "~/.crewspace/logs" },
} as any;

afterEach(() => {
  vi.clearAllMocks();
});

describe("logCheck", () => {
  it("creates the directory if it does not exist and returns pass when writable", () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false);
    mockFs.mkdirSync = vi.fn();
    mockFs.accessSync = vi.fn();

    const result = logCheck(baseConfig);
    expect(mockFs.mkdirSync).toHaveBeenCalled();
    expect(result.status).toBe("pass");
    expect(result.name).toBe("Log directory");
    expect(result.message).toContain("writable");
  });

  it("returns pass when directory exists and is writable", () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.mkdirSync = vi.fn();
    mockFs.accessSync = vi.fn();

    const result = logCheck(baseConfig);
    expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    expect(result.status).toBe("pass");
  });

  it("returns fail when directory is not writable", () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.mkdirSync = vi.fn();
    mockFs.accessSync = vi.fn().mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    const result = logCheck(baseConfig);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("not writable");
    expect(result.repairHint).toContain("file permissions");
    expect(result.canRepair).toBe(false);
  });
});
