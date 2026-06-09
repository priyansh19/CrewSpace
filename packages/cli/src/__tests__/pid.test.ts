import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writePid, readPid, clearPid } from "../utils/pid.js";

const testDir = join(tmpdir(), "crewspace-pid-test-" + Date.now());

beforeEach(() => mkdirSync(testDir, { recursive: true }));
afterEach(() => rmSync(testDir, { recursive: true, force: true }));

describe("pid utils", () => {
  it("returns null when no pid file exists", () => {
    expect(readPid(testDir)).toBeNull();
  });

  it("writes and reads pid", () => {
    writePid(testDir, 12345, 3100);
    const result = readPid(testDir);
    expect(result).toEqual({ pid: 12345, port: 3100 });
  });

  it("clears pid file", () => {
    writePid(testDir, 12345, 3100);
    clearPid(testDir);
    expect(readPid(testDir)).toBeNull();
  });
});
