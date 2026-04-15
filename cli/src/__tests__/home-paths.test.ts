import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolveCrewSpaceHomeDir,
  resolveCrewSpaceInstanceId,
} from "../config/home.js";

const ORIGINAL_ENV = { ...process.env };

describe("home path resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to ~/.crewspace and default instance", () => {
    delete process.env.CREWSPACE_HOME;
    delete process.env.CREWSPACE_INSTANCE_ID;

    const paths = describeLocalInstancePaths();
    expect(paths.homeDir).toBe(path.resolve(os.homedir(), ".crewspace"));
    expect(paths.instanceId).toBe("default");
    expect(paths.configPath).toBe(path.resolve(os.homedir(), ".crewspace", "instances", "default", "config.json"));
  });

  it("supports CREWSPACE_HOME and explicit instance ids", () => {
    process.env.CREWSPACE_HOME = "~/crewspace-home";

    const home = resolveCrewSpaceHomeDir();
    expect(home).toBe(path.resolve(os.homedir(), "crewspace-home"));
    expect(resolveCrewSpaceInstanceId("dev_1")).toBe("dev_1");
  });

  it("rejects invalid instance ids", () => {
    expect(() => resolveCrewSpaceInstanceId("bad/id")).toThrow(/Invalid instance id/);
  });

  it("expands ~ prefixes", () => {
    expect(expandHomePrefix("~")).toBe(os.homedir());
    expect(expandHomePrefix("~/x/y")).toBe(path.resolve(os.homedir(), "x/y"));
  });
});
