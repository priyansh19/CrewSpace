import { describe, expect, it } from "vitest";
import { hasCursorTrustBypassArg } from "./trust.js";

describe("hasCursorTrustBypassArg", () => {
  it("returns true for --trust flag", () => {
    expect(hasCursorTrustBypassArg(["--trust"])).toBe(true);
  });

  it("returns true for --yolo flag", () => {
    expect(hasCursorTrustBypassArg(["--yolo"])).toBe(true);
  });

  it("returns true for -f flag", () => {
    expect(hasCursorTrustBypassArg(["-f"])).toBe(true);
  });

  it("returns true for --trust=value form", () => {
    expect(hasCursorTrustBypassArg(["--trust=always"])).toBe(true);
  });

  it("returns false for empty args", () => {
    expect(hasCursorTrustBypassArg([])).toBe(false);
  });

  it("returns false for unrelated flags", () => {
    expect(hasCursorTrustBypassArg(["--model", "gpt-4", "--verbose"])).toBe(false);
  });

  it("returns true when trust flag is among other args", () => {
    expect(hasCursorTrustBypassArg(["--model", "gpt-4", "--trust", "--verbose"])).toBe(true);
  });

  it("returns false for a flag that starts with trust but is different", () => {
    expect(hasCursorTrustBypassArg(["--trustworthy"])).toBe(false);
  });
});
