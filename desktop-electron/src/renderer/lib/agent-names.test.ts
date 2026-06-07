import { describe, expect, it } from "vitest";
import { suggestAgentName } from "./agent-names";

describe("suggestAgentName", () => {
  it("returns a name from the CEO pool for the first agent", () => {
    const name = suggestAgentName([], true);
    expect(name).toBeTruthy();
    expect(typeof name).toBe("string");
    // CEO names include: Mark, Russel, Jake, Orion, Atlas, Cyrus, Nico, Phoenix
    const ceoNames = ["Mark", "Russel", "Jake", "Orion", "Atlas", "Cyrus", "Nico", "Phoenix"];
    expect(ceoNames).toContain(name);
  });

  it("returns a name from the general pool for non-first agents", () => {
    const name = suggestAgentName([], false);
    expect(name).toBeTruthy();
    expect(typeof name).toBe("string");
  });

  it("excludes already-used names (case-insensitive)", () => {
    const usedNames = ["Mark", "Orion", "Atlas"];
    const name = suggestAgentName(usedNames, true);
    expect(usedNames.map((n) => n.toLowerCase())).not.toContain(name.toLowerCase());
  });

  it("falls back to numbered names when all names are used", () => {
    // Use all names from the pool
    const allNames = [
      "Mark", "Russel", "Carl", "Liza", "Nina",
      "Jake", "Milo", "Zoe", "Lexi", "Kai",
      "Ivy", "Nico", "Arlo", "Sage", "Remy",
      "Orion", "Nova", "Mae", "Finn", "Elara",
      "Cyrus", "Wren", "Theo", "Luna", "Jett",
      "Reese", "Cade", "Dahlia", "Koa", "Sienna",
      "Atlas", "Iris", "Phoenix", "Juno", "Ezra",
      "Cleo", "Rowan", "Aria", "Silas", "Tessa",
    ];
    const name = suggestAgentName(allNames, false);
    expect(name).toBeTruthy();
    // Should have a number suffix like "Mark2"
    expect(/\d$/.test(name)).toBe(true);
  });

  it("increments the number suffix when all pool names are used", () => {
    // Exhaust the small CEO pool (8 names) so fallback numbering kicks in
    const usedNames = [
      "Mark", "Russel", "Jake", "Orion",
      "Atlas", "Cyrus", "Nico", "Phoenix",
      "Mark2", "Mark3",
    ];
    const name = suggestAgentName(usedNames, true);
    expect(name).toBeTruthy();
    expect(name).not.toBe("Mark");
    expect(name).not.toBe("Mark2");
    expect(name).not.toBe("Mark3");
    expect(name).toMatch(/^(Mark|Russel|Jake|Orion|Atlas|Cyrus|Nico|Phoenix)\d+$/);
  });

  it("handles empty used names array gracefully", () => {
    const name = suggestAgentName([], false);
    expect(name).toBeTruthy();
    expect(typeof name).toBe("string");
  });
});
