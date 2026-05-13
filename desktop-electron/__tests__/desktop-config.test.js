import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import os from "os";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Use a unique temp directory per test run so tests never touch the real config.
const tmpBase = path.join(os.tmpdir(), `crewspace-test-${crypto.randomBytes(6).toString("hex")}`);

// Spy BEFORE requiring desktop-config so getConfigPath() calls pick up the mock.
// desktop-config.js captures `os` via require but calls os.homedir() lazily (inside
// getConfigPath), so a spy set before any call is sufficient.
vi.spyOn(os, "homedir").mockReturnValue(tmpBase);

const {
  readConfig,
  writeConfig,
  hasConfig,
  isFirstRunComplete,
  markFirstRunComplete,
  saveThemePreference,
  getThemePreference,
  saveAuthConfig,
  getAuthConfig,
  authConfigToEnv,
} = await import("../desktop-config.js");

const configDir = path.join(tmpBase, "AppData", "Local", "CrewSpace");
const configFile = path.join(configDir, "desktop-config.enc");

beforeEach(() => {
  if (fs.existsSync(configFile)) fs.rmSync(configFile);
});

afterEach(() => {
  if (fs.existsSync(configDir)) fs.rmSync(configDir, { recursive: true });
});

// ── hasConfig ────────────────────────────────────────────────────────

describe("hasConfig", () => {
  it("returns false when no config file exists", () => {
    expect(hasConfig()).toBe(false);
  });

  it("returns true after writing a config", () => {
    writeConfig({ test: true });
    expect(hasConfig()).toBe(true);
  });
});

// ── readConfig / writeConfig ──────────────────────────────────────────

describe("readConfig / writeConfig", () => {
  it("returns null when no config file exists", () => {
    expect(readConfig()).toBeNull();
  });

  it("round-trips a simple object", () => {
    const data = { foo: "bar", count: 42, flag: true };
    writeConfig(data);
    expect(readConfig()).toEqual(data);
  });

  it("round-trips nested objects", () => {
    const data = { github: { pat: "ghp_secret" }, kimi: { apiKey: "kimi_key" } };
    writeConfig(data);
    expect(readConfig()).toEqual(data);
  });

  it("creates the config directory if it does not exist", () => {
    expect(fs.existsSync(configDir)).toBe(false);
    writeConfig({ created: true });
    expect(fs.existsSync(configDir)).toBe(true);
    expect(fs.existsSync(configFile)).toBe(true);
  });

  it("stores data encrypted — plain JSON must not appear in file", () => {
    writeConfig({ secret: "do-not-leak" });
    const raw = fs.readFileSync(configFile, "utf-8");
    expect(raw).not.toContain("do-not-leak");
    expect(raw).not.toContain("{");
  });

  it("overwrites previous config on second write", () => {
    writeConfig({ version: 1 });
    writeConfig({ version: 2 });
    expect(readConfig()).toEqual({ version: 2 });
  });
});

// ── isFirstRunComplete / markFirstRunComplete ─────────────────────────

describe("isFirstRunComplete / markFirstRunComplete", () => {
  it("returns false when no config exists", () => {
    expect(isFirstRunComplete()).toBe(false);
  });

  it("returns false when firstRunComplete is absent from config", () => {
    writeConfig({ theme: "dark" });
    expect(isFirstRunComplete()).toBe(false);
  });

  it("returns true after markFirstRunComplete", () => {
    markFirstRunComplete();
    expect(isFirstRunComplete()).toBe(true);
  });

  it("preserves existing config keys when marking first run complete", () => {
    writeConfig({ theme: "light" });
    markFirstRunComplete();
    const config = readConfig();
    expect(config.theme).toBe("light");
    expect(config.firstRunComplete).toBe(true);
  });
});

// ── saveThemePreference / getThemePreference ──────────────────────────

describe("saveThemePreference / getThemePreference", () => {
  it("returns 'system' when no config exists", () => {
    expect(getThemePreference()).toBe("system");
  });

  it("returns 'system' when config has no theme key", () => {
    writeConfig({ firstRunComplete: true });
    expect(getThemePreference()).toBe("system");
  });

  it("saves and retrieves dark theme", () => {
    saveThemePreference("dark");
    expect(getThemePreference()).toBe("dark");
  });

  it("saves and retrieves light theme", () => {
    saveThemePreference("light");
    expect(getThemePreference()).toBe("light");
  });

  it("overwrites a previously saved theme", () => {
    saveThemePreference("dark");
    saveThemePreference("light");
    expect(getThemePreference()).toBe("light");
  });

  it("preserves other config keys when saving theme", () => {
    writeConfig({ firstRunComplete: true });
    saveThemePreference("dark");
    expect(readConfig().firstRunComplete).toBe(true);
  });
});

// ── saveAuthConfig / getAuthConfig ────────────────────────────────────

describe("saveAuthConfig / getAuthConfig", () => {
  it("returns null when no config exists", () => {
    expect(getAuthConfig()).toBeNull();
  });

  it("saves and retrieves GitHub PAT config", () => {
    saveAuthConfig({ github: { pat: "ghp_abc123" }, kimi: {} });
    const auth = getAuthConfig();
    expect(auth.github.pat).toBe("ghp_abc123");
    expect(auth.kimi).toEqual({});
  });

  it("saves and retrieves GitHub App config", () => {
    const app = { appId: "123", privateKey: "pem", clientId: "cid", clientSecret: "sec", appSlug: "my-app" };
    saveAuthConfig({ github: app, kimi: {} });
    expect(getAuthConfig().github).toEqual(app);
  });

  it("saves and retrieves kimi API key", () => {
    saveAuthConfig({ github: {}, kimi: { apiKey: "kimi_key_xyz" } });
    expect(getAuthConfig().kimi.apiKey).toBe("kimi_key_xyz");
  });

  it("defaults missing github/kimi to empty objects when config exists", () => {
    writeConfig({});
    const auth = getAuthConfig();
    expect(auth.github).toEqual({});
    expect(auth.kimi).toEqual({});
  });

  it("preserves other config keys when saving auth", () => {
    writeConfig({ firstRunComplete: true });
    saveAuthConfig({ github: { pat: "ghp_x" }, kimi: {} });
    expect(readConfig().firstRunComplete).toBe(true);
  });
});

// ── authConfigToEnv ───────────────────────────────────────────────────

describe("authConfigToEnv", () => {
  it("returns empty object for null input", () => {
    expect(authConfigToEnv(null)).toEqual({});
  });

  it("returns empty object for empty auth config", () => {
    expect(authConfigToEnv({ github: {}, kimi: {} })).toEqual({});
  });

  it("maps GitHub PAT to GITHUB_PAT", () => {
    const env = authConfigToEnv({ github: { pat: "ghp_secret" }, kimi: {} });
    expect(env.GITHUB_PAT).toBe("ghp_secret");
    expect(env.GITHUB_APP_ID).toBeUndefined();
  });

  it("maps GitHub App fields when PAT is absent", () => {
    const env = authConfigToEnv({
      github: { appId: "123", privateKey: "pem", clientId: "cid", clientSecret: "sec", appSlug: "slug" },
      kimi: {},
    });
    expect(env.GITHUB_APP_ID).toBe("123");
    expect(env.GITHUB_APP_PRIVATE_KEY).toBe("pem");
    expect(env.GITHUB_APP_CLIENT_ID).toBe("cid");
    expect(env.GITHUB_APP_CLIENT_SECRET).toBe("sec");
    expect(env.GITHUB_APP_SLUG).toBe("slug");
    expect(env.GITHUB_PAT).toBeUndefined();
  });

  it("PAT takes precedence over GitHub App fields when both are present", () => {
    const env = authConfigToEnv({ github: { pat: "ghp_p", appId: "123" }, kimi: {} });
    expect(env.GITHUB_PAT).toBe("ghp_p");
    expect(env.GITHUB_APP_ID).toBeUndefined();
  });

  it("maps kimi apiKey to KIMI_API_KEY", () => {
    const env = authConfigToEnv({ github: {}, kimi: { apiKey: "kimi_key" } });
    expect(env.KIMI_API_KEY).toBe("kimi_key");
  });

  it("omits undefined GitHub App sub-fields", () => {
    const env = authConfigToEnv({ github: { appId: "123" }, kimi: {} });
    expect(env.GITHUB_APP_ID).toBe("123");
    expect(env.GITHUB_APP_PRIVATE_KEY).toBeUndefined();
    expect(env.GITHUB_APP_CLIENT_ID).toBeUndefined();
  });
});
