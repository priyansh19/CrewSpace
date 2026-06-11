import { describe, expect, it, beforeEach } from "vitest";
import { getRecentAssigneeIds, sortAgentsByRecency, trackRecentAssignee } from "./recent-assignees.js";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

beforeEach(() => {
  localStorageMock.clear();
});

describe("getRecentAssigneeIds", () => {
  it("returns empty array when nothing stored", () => {
    expect(getRecentAssigneeIds()).toEqual([]);
  });

  it("returns stored IDs", () => {
    localStorageMock.setItem("crewspace:recent-assignees", JSON.stringify(["id-1", "id-2"]));
    expect(getRecentAssigneeIds()).toEqual(["id-1", "id-2"]);
  });

  it("returns empty array for invalid JSON", () => {
    localStorageMock.setItem("crewspace:recent-assignees", "not-json");
    expect(getRecentAssigneeIds()).toEqual([]);
  });

  it("returns empty array when stored value is not an array", () => {
    localStorageMock.setItem("crewspace:recent-assignees", JSON.stringify({ id: "x" }));
    expect(getRecentAssigneeIds()).toEqual([]);
  });
});

describe("trackRecentAssignee", () => {
  it("adds a new agent to the front of the list", () => {
    trackRecentAssignee("agent-1");
    expect(getRecentAssigneeIds()[0]).toBe("agent-1");
  });

  it("moves existing agent to the front", () => {
    trackRecentAssignee("agent-1");
    trackRecentAssignee("agent-2");
    trackRecentAssignee("agent-1");
    const ids = getRecentAssigneeIds();
    expect(ids[0]).toBe("agent-1");
    expect(ids[1]).toBe("agent-2");
    expect(ids).toHaveLength(2);
  });

  it("caps list at 10 entries", () => {
    for (let i = 0; i < 12; i++) {
      trackRecentAssignee(`agent-${i}`);
    }
    expect(getRecentAssigneeIds()).toHaveLength(10);
  });

  it("ignores empty agentId", () => {
    trackRecentAssignee("");
    expect(getRecentAssigneeIds()).toEqual([]);
  });
});

describe("sortAgentsByRecency", () => {
  const agents = [
    { id: "a1", name: "Alice" },
    { id: "a2", name: "Bob" },
    { id: "a3", name: "Charlie" },
    { id: "a4", name: "Dave" },
  ];

  it("sorts recent agents before non-recent", () => {
    const sorted = sortAgentsByRecency(agents, ["a3", "a1"]);
    expect(sorted[0].id).toBe("a3");
    expect(sorted[1].id).toBe("a1");
  });

  it("sorts non-recent agents alphabetically by name", () => {
    const sorted = sortAgentsByRecency(agents, []);
    expect(sorted.map((a) => a.name)).toEqual(["Alice", "Bob", "Charlie", "Dave"]);
  });

  it("preserves recency ordering among recent agents", () => {
    const sorted = sortAgentsByRecency(agents, ["a4", "a2"]);
    expect(sorted[0].id).toBe("a4");
    expect(sorted[1].id).toBe("a2");
  });

  it("handles empty agents array", () => {
    expect(sortAgentsByRecency([], ["a1"])).toEqual([]);
  });

  it("does not mutate original array", () => {
    const original = [...agents];
    sortAgentsByRecency(agents, ["a3"]);
    expect(agents).toEqual(original);
  });
});
