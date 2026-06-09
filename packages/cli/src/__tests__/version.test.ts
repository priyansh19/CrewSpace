import { describe, it, expect } from "vitest";
import { getCliVersion } from "../utils/version.js";

describe("getCliVersion", () => {
  it("returns a semver string", () => {
    const v = getCliVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });
});
