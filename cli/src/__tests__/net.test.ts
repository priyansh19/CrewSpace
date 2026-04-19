import { describe, expect, it } from "vitest";
import { checkPort } from "../utils/net.js";

describe("checkPort", () => {
  it("returns available: true for a free port", async () => {
    const result = await checkPort(0);
    expect(result.available).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns available: false when port is in use", async () => {
    const net = await import("node:net");
    const server = net.default.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address() as { port: number };
    const occupiedPort = addr.port;

    const result = await checkPort(occupiedPort);

    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(result.available).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain(String(occupiedPort));
  });
});
