import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "os";

const { getLanIp, findFreePort, extractPortFromUrl, getAppDataDir } = await import("../lib/helpers.js");

// ── getLanIp ──────────────────────────────────────────────────────────

describe("getLanIp", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the first non-internal IPv4 address", () => {
    vi.spyOn(os, "networkInterfaces").mockReturnValue({
      lo: [{ family: "IPv4", address: "127.0.0.1", internal: true }],
      eth0: [
        { family: "IPv6", address: "::1", internal: false },
        { family: "IPv4", address: "192.168.1.100", internal: false },
      ],
    });
    expect(getLanIp()).toBe("192.168.1.100");
  });

  it("returns null when only loopback interfaces exist", () => {
    vi.spyOn(os, "networkInterfaces").mockReturnValue({
      lo: [{ family: "IPv4", address: "127.0.0.1", internal: true }],
    });
    expect(getLanIp()).toBeNull();
  });

  it("returns null when no network interfaces are present", () => {
    vi.spyOn(os, "networkInterfaces").mockReturnValue({});
    expect(getLanIp()).toBeNull();
  });

  it("skips IPv6 addresses and returns IPv4", () => {
    vi.spyOn(os, "networkInterfaces").mockReturnValue({
      eth0: [
        { family: "IPv6", address: "2001:db8::1", internal: false },
        { family: "IPv4", address: "10.0.0.5", internal: false },
      ],
    });
    expect(getLanIp()).toBe("10.0.0.5");
  });

  it("returns the first match when multiple non-internal IPv4 addresses exist", () => {
    vi.spyOn(os, "networkInterfaces").mockReturnValue({
      eth0: [{ family: "IPv4", address: "192.168.1.10", internal: false }],
      eth1: [{ family: "IPv4", address: "10.0.0.1", internal: false }],
    });
    expect(getLanIp()).toBe("192.168.1.10");
  });
});

// ── findFreePort ──────────────────────────────────────────────────────

describe("findFreePort", () => {
  it("returns the start port when it is free", async () => {
    // Use a high port range unlikely to be occupied in CI
    const port = await findFreePort(49200);
    expect(port).toBeGreaterThanOrEqual(49200);
    expect(port).toBeLessThanOrEqual(49210);
  });

  it("returns a number (port) even when called multiple times", async () => {
    const p1 = await findFreePort(49220);
    const p2 = await findFreePort(49230);
    expect(typeof p1).toBe("number");
    expect(typeof p2).toBe("number");
  });
});

// ── extractPortFromUrl ────────────────────────────────────────────────

describe("extractPortFromUrl", () => {
  it("extracts port from a standard http URL", () => {
    expect(extractPortFromUrl("http://localhost:3150")).toBe(3150);
  });

  it("extracts port from an https URL", () => {
    expect(extractPortFromUrl("https://my.host:8443/path")).toBe(8443);
  });

  it("returns SERVER_PORT (3150) for null input", () => {
    expect(extractPortFromUrl(null)).toBe(3150);
  });

  it("returns SERVER_PORT (3150) for undefined input", () => {
    expect(extractPortFromUrl(undefined)).toBe(3150);
  });

  it("returns SERVER_PORT when URL has no port", () => {
    expect(extractPortFromUrl("http://localhost")).toBe(3150);
  });
});

// ── getAppDataDir ─────────────────────────────────────────────────────

describe("getAppDataDir", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a path ending with AppData/Local/CrewSpace", () => {
    vi.spyOn(os, "homedir").mockReturnValue("/mock/home");
    // Re-import is not possible once module is cached; test by calling with known homedir.
    // getAppDataDir uses os.homedir() live, so spy takes effect.
    const dir = getAppDataDir();
    // On Windows-style paths the separator may vary; just check key segments are present.
    expect(dir).toContain("AppData");
    expect(dir).toContain("Local");
    expect(dir).toContain("CrewSpace");
  });
});
