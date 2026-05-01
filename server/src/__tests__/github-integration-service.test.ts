import { describe, expect, it } from "vitest";
import { generateStateToken } from "../services/github-integration.js";

describe("generateStateToken", () => {
  it("returns a 64-character hex string", () => {
    const token = generateStateToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns unique tokens on successive calls", () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateStateToken()));
    expect(tokens.size).toBe(10);
  });
});
