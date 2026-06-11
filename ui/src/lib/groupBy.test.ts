import { describe, expect, it } from "vitest";
import { groupBy } from "./groupBy.js";

describe("groupBy", () => {
  it("groups items by string key", () => {
    const items = [
      { status: "active", id: "1" },
      { status: "inactive", id: "2" },
      { status: "active", id: "3" },
    ];
    const result = groupBy(items, (item) => item.status);
    expect(result.active).toHaveLength(2);
    expect(result.inactive).toHaveLength(1);
    expect(result.active[0].id).toBe("1");
    expect(result.active[1].id).toBe("3");
  });

  it("returns empty record for empty input", () => {
    expect(groupBy([], (x: any) => x.key)).toEqual({});
  });

  it("creates a single group when all items share the same key", () => {
    const items = [{ type: "a" }, { type: "a" }, { type: "a" }];
    const result = groupBy(items, (i) => i.type);
    expect(Object.keys(result)).toHaveLength(1);
    expect(result.a).toHaveLength(3);
  });

  it("preserves item order within groups", () => {
    const items = [{ k: "b", v: 1 }, { k: "a", v: 2 }, { k: "b", v: 3 }, { k: "a", v: 4 }];
    const result = groupBy(items, (i) => i.k);
    expect(result.b.map((i) => i.v)).toEqual([1, 3]);
    expect(result.a.map((i) => i.v)).toEqual([2, 4]);
  });

  it("handles dynamic key computation", () => {
    const items = [1, 2, 3, 4, 5, 6];
    const result = groupBy(items, (n) => (n % 2 === 0 ? "even" : "odd"));
    expect(result.even).toEqual([2, 4, 6]);
    expect(result.odd).toEqual([1, 3, 5]);
  });
});
