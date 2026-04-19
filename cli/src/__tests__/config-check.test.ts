import { describe, expect, it, vi, afterEach } from "vitest";
import { configCheck } from "../checks/config-check.js";

vi.mock("../config/store.js", () => ({
  resolveConfigPath: vi.fn((configPath?: string) => configPath ?? "/default/.crewspace/config.json"),
  configExists: vi.fn(),
  readConfig: vi.fn(),
}));

import { configExists, readConfig, resolveConfigPath } from "../config/store.js";

const mockConfigExists = vi.mocked(configExists);
const mockReadConfig = vi.mocked(readConfig);
const mockResolveConfigPath = vi.mocked(resolveConfigPath);

afterEach(() => {
  vi.clearAllMocks();
});

describe("configCheck", () => {
  it("returns fail when config file does not exist", () => {
    mockConfigExists.mockReturnValue(false);
    mockResolveConfigPath.mockReturnValue("/home/user/.crewspace/config.json");

    const result = configCheck();
    expect(result.status).toBe("fail");
    expect(result.name).toBe("Config file");
    expect(result.message).toContain("/home/user/.crewspace/config.json");
    expect(result.repairHint).toContain("crewspaceai onboard");
  });

  it("returns pass when config file exists and is valid", () => {
    mockConfigExists.mockReturnValue(true);
    mockResolveConfigPath.mockReturnValue("/home/user/.crewspace/config.json");
    mockReadConfig.mockReturnValue({} as any);

    const result = configCheck();
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Valid config");
  });

  it("returns fail when config file exists but is invalid", () => {
    mockConfigExists.mockReturnValue(true);
    mockResolveConfigPath.mockReturnValue("/home/user/.crewspace/config.json");
    mockReadConfig.mockImplementation(() => {
      throw new Error("Invalid JSON: Unexpected token");
    });

    const result = configCheck();
    expect(result.status).toBe("fail");
    expect(result.message).toContain("Invalid config");
    expect(result.message).toContain("Invalid JSON");
    expect(result.repairHint).toContain("crewspaceai configure");
  });

  it("handles non-Error thrown from readConfig", () => {
    mockConfigExists.mockReturnValue(true);
    mockResolveConfigPath.mockReturnValue("/path/config.json");
    mockReadConfig.mockImplementation(() => {
      throw "string error";
    });

    const result = configCheck();
    expect(result.status).toBe("fail");
    expect(result.message).toContain("string error");
  });

  it("passes configPath to resolveConfigPath and configExists", () => {
    mockConfigExists.mockReturnValue(false);
    mockResolveConfigPath.mockReturnValue("/custom/path/config.json");

    configCheck("/custom/path/config.json");
    expect(mockConfigExists).toHaveBeenCalledWith("/custom/path/config.json");
  });
});
