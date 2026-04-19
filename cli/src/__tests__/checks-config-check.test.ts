import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configCheck } from "../checks/config-check.js";
import { writeConfig } from "../config/store.js";
import type { CrewSpaceConfig } from "../config/schema.js";

const ORIGINAL_ENV = { ...process.env };

function makeConfig(overrides: Partial<CrewSpaceConfig> = {}): CrewSpaceConfig {
  return {
    $meta: {
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      source: "configure",
    },
    database: {
      mode: "embedded-postgres",
      embeddedPostgresDataDir: "/tmp/db",
      embeddedPostgresPort: 54329,
      backup: {
        enabled: true,
        intervalMinutes: 60,
        retentionDays: 30,
        dir: "/tmp/backups",
      },
    },
    logging: { mode: "file", logDir: "/tmp/logs" },
    server: {
      deploymentMode: "local_trusted",
      exposure: "private",
      host: "127.0.0.1",
      port: 3100,
      allowedHostnames: [],
      serveUi: true,
    },
    auth: { baseUrlMode: "auto", disableSignUp: false },
    storage: {
      provider: "local_disk",
      localDisk: { baseDir: "/tmp/storage" },
      s3: { bucket: "b", region: "us-east-1", prefix: "", forcePathStyle: false },
    },
    secrets: {
      provider: "local_encrypted",
      strictMode: false,
      localEncrypted: { keyFilePath: "/tmp/secrets/master.key" },
    },
    ...overrides,
  } as CrewSpaceConfig;
}

describe("configCheck", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CREWSPACE_CONFIG;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("passes when a valid config file exists", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crewspace-config-check-"));
    const configPath = path.join(dir, "config.json");
    writeConfig(makeConfig(), configPath);

    const result = configCheck(configPath);

    expect(result.name).toBe("Config file");
    expect(result.status).toBe("pass");
    expect(result.message).toContain(configPath);
  });

  it("fails when the config file does not exist", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crewspace-config-check-"));
    const configPath = path.join(dir, "missing.json");

    const result = configCheck(configPath);

    expect(result.name).toBe("Config file");
    expect(result.status).toBe("fail");
    expect(result.message).toContain("not found");
    expect(result.canRepair).toBe(false);
  });

  it("fails when the config file contains invalid JSON", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crewspace-config-check-"));
    const configPath = path.join(dir, "config.json");
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, "{ not valid json");

    const result = configCheck(configPath);

    expect(result.name).toBe("Config file");
    expect(result.status).toBe("fail");
    expect(result.message).toMatch(/Invalid config/i);
  });

  it("fails when the config file is valid JSON but fails schema validation", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crewspace-config-check-"));
    const configPath = path.join(dir, "config.json");
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ $meta: { version: 1 } }));

    const result = configCheck(configPath);

    expect(result.name).toBe("Config file");
    expect(result.status).toBe("fail");
  });
});
