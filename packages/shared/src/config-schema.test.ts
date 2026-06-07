import { describe, expect, it } from "vitest";
import { crewspaceConfigSchema, databaseBackupConfigSchema, serverConfigSchema, authConfigSchema, storageConfigSchema } from "./config-schema.js";

const validConfig = {
  $meta: { version: 1 as const, updatedAt: "2024-01-01T00:00:00Z", source: "onboard" as const },
  database: {
    mode: "embedded-postgres" as const,
    embeddedPostgresDataDir: "~/.crewspace/instances/default/db",
    embeddedPostgresPort: 54329,
    backup: {
      enabled: true,
      intervalMinutes: 60,
      retentionDays: 30,
      dir: "~/.crewspace/instances/default/data/backups",
    },
  },
  logging: { mode: "file" as const, logDir: "~/.crewspace/instances/default/logs" },
  server: {
    deploymentMode: "local_trusted" as const,
    exposure: "private" as const,
    host: "127.0.0.1",
    port: 3100,
    allowedHostnames: [],
    serveUi: true,
  },
};

describe("databaseBackupConfigSchema", () => {
  it("accepts valid backup config", () => {
    const result = databaseBackupConfigSchema.safeParse({
      enabled: true,
      intervalMinutes: 60,
      retentionDays: 30,
      dir: "/backups",
    });
    expect(result.success).toBe(true);
  });

  it("rejects intervalMinutes below minimum (0)", () => {
    const result = databaseBackupConfigSchema.safeParse({ intervalMinutes: 0, retentionDays: 30, dir: "/x" });
    expect(result.success).toBe(false);
  });

  it("rejects retentionDays above maximum", () => {
    const result = databaseBackupConfigSchema.safeParse({ intervalMinutes: 60, retentionDays: 9999, dir: "/x" });
    expect(result.success).toBe(false);
  });

  it("applies defaults when fields are omitted", () => {
    const result = databaseBackupConfigSchema.parse({});
    expect(result.enabled).toBe(true);
    expect(result.intervalMinutes).toBe(60);
    expect(result.retentionDays).toBe(30);
  });
});

describe("serverConfigSchema", () => {
  it("accepts valid server config", () => {
    const result = serverConfigSchema.safeParse({
      deploymentMode: "local_trusted",
      exposure: "private",
      host: "0.0.0.0",
      port: 8080,
      allowedHostnames: ["example.com"],
      serveUi: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects port 0", () => {
    const result = serverConfigSchema.safeParse({ port: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects port above 65535", () => {
    const result = serverConfigSchema.safeParse({ port: 65536 });
    expect(result.success).toBe(false);
  });

  it("applies defaults", () => {
    const result = serverConfigSchema.parse({});
    expect(result.deploymentMode).toBe("local_trusted");
    expect(result.exposure).toBe("private");
    expect(result.port).toBe(3100);
  });
});

describe("authConfigSchema", () => {
  it("accepts auto mode without publicBaseUrl", () => {
    const result = authConfigSchema.safeParse({ baseUrlMode: "auto" });
    expect(result.success).toBe(true);
  });

  it("applies defaults", () => {
    const result = authConfigSchema.parse({});
    expect(result.baseUrlMode).toBe("auto");
    expect(result.disableSignUp).toBe(false);
  });
});

describe("crewspaceConfigSchema cross-field validation", () => {
  it("accepts a valid local_trusted config", () => {
    const result = crewspaceConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it("rejects local_trusted with public exposure", () => {
    const result = crewspaceConfigSchema.safeParse({
      ...validConfig,
      server: { ...validConfig.server, deploymentMode: "local_trusted", exposure: "public" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("exposure"))).toBe(true);
    }
  });

  it("rejects authenticated+public exposure without publicBaseUrl", () => {
    const result = crewspaceConfigSchema.safeParse({
      ...validConfig,
      server: { ...validConfig.server, deploymentMode: "authenticated", exposure: "public" },
      auth: { baseUrlMode: "explicit", disableSignUp: false },
    });
    expect(result.success).toBe(false);
  });

  it("accepts authenticated+public when publicBaseUrl is provided", () => {
    const result = crewspaceConfigSchema.safeParse({
      ...validConfig,
      server: { ...validConfig.server, deploymentMode: "authenticated", exposure: "public" },
      auth: { baseUrlMode: "explicit", publicBaseUrl: "https://crewspace.example.com", disableSignUp: false },
    });
    expect(result.success).toBe(true);
  });

  it("rejects authenticated mode with explicit baseUrlMode but missing publicBaseUrl", () => {
    const result = crewspaceConfigSchema.safeParse({
      ...validConfig,
      server: { ...validConfig.server, deploymentMode: "authenticated", exposure: "private" },
      auth: { baseUrlMode: "explicit", disableSignUp: false },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("publicBaseUrl"))).toBe(true);
    }
  });
});
