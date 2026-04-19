import { describe, expect, it, vi, afterEach } from "vitest";
import { portCheck } from "../checks/port-check.js";

vi.mock("../utils/net.js", () => ({
  checkPort: vi.fn(),
}));

import { checkPort } from "../utils/net.js";

const mockCheckPort = vi.mocked(checkPort);

const baseConfig = {
  $meta: { version: 1 as const, updatedAt: "2024-01-01T00:00:00Z", source: "onboard" as const },
  server: {
    deploymentMode: "local_trusted" as const,
    exposure: "private" as const,
    host: "127.0.0.1",
    port: 3100,
    allowedHostnames: [],
    serveUi: true,
  },
  database: {
    mode: "embedded-postgres" as const,
    embeddedPostgresDataDir: "~/.crewspace/db",
    embeddedPostgresPort: 54329,
    backup: { enabled: true, intervalMinutes: 60, retentionDays: 30, dir: "~/.crewspace/backups" },
  },
  logging: { mode: "file" as const, logDir: "~/.crewspace/logs" },
} as any;

afterEach(() => {
  vi.clearAllMocks();
});

describe("portCheck", () => {
  it("returns pass when port is available", async () => {
    mockCheckPort.mockResolvedValue({ available: true });
    const result = await portCheck(baseConfig);
    expect(result.status).toBe("pass");
    expect(result.name).toBe("Server port");
    expect(result.message).toContain("3100");
    expect(result.message).toContain("available");
  });

  it("returns warn when port is in use", async () => {
    mockCheckPort.mockResolvedValue({ available: false, error: "Port 3100 is already in use" });
    const result = await portCheck(baseConfig);
    expect(result.status).toBe("warn");
    expect(result.message).toBe("Port 3100 is already in use");
    expect(result.canRepair).toBe(false);
    expect(result.repairHint).toContain("lsof");
  });

  it("returns warn with generic message when port unavailable without error detail", async () => {
    mockCheckPort.mockResolvedValue({ available: false });
    const result = await portCheck(baseConfig);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("3100");
  });

  it("uses port from config", async () => {
    mockCheckPort.mockResolvedValue({ available: true });
    await portCheck({ ...baseConfig, server: { ...baseConfig.server, port: 8080 } });
    expect(mockCheckPort).toHaveBeenCalledWith(8080);
  });
});
