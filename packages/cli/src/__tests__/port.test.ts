import { describe, it, expect } from "vitest";
import { findAvailablePort } from "../utils/port.js";

describe("findAvailablePort", () => {
  it("returns a number >= 3100", async () => {
    const port = await findAvailablePort(3100);
    expect(typeof port).toBe("number");
    expect(port).toBeGreaterThanOrEqual(3100);
  });
});
