import { describe, expect, it } from "vitest";
import {
  deriveProjectUrlKey,
  hasNonAsciiContent,
  normalizeProjectUrlKey,
} from "./project-url-key.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("normalizeProjectUrlKey", () => {
  it("lowercases an ASCII name", () => {
    expect(normalizeProjectUrlKey("MyProject")).toBe("myproject");
  });

  it("replaces spaces with dashes", () => {
    expect(normalizeProjectUrlKey("my project")).toBe("my-project");
  });

  it("collapses multiple special characters to one dash", () => {
    expect(normalizeProjectUrlKey("my--project!!name")).toBe("my-project-name");
  });

  it("trims leading and trailing dashes", () => {
    expect(normalizeProjectUrlKey("--my-project--")).toBe("my-project");
  });

  it("trims whitespace before normalizing", () => {
    expect(normalizeProjectUrlKey("  hello world  ")).toBe("hello-world");
  });

  it("replaces underscores with dashes", () => {
    expect(normalizeProjectUrlKey("my_project_name")).toBe("my-project-name");
  });

  it("preserves digits", () => {
    expect(normalizeProjectUrlKey("Project42")).toBe("project42");
  });

  it("returns null for null", () => {
    expect(normalizeProjectUrlKey(null)).toBe(null);
  });

  it("returns null for undefined", () => {
    expect(normalizeProjectUrlKey(undefined)).toBe(null);
  });

  it("returns null for empty string", () => {
    expect(normalizeProjectUrlKey("")).toBe(null);
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizeProjectUrlKey("   ")).toBe(null);
  });

  it("returns null for all-special-char string", () => {
    expect(normalizeProjectUrlKey("!!!")).toBe(null);
  });
});

describe("hasNonAsciiContent", () => {
  it("returns false for pure ASCII string", () => {
    expect(hasNonAsciiContent("hello-world")).toBe(false);
  });

  it("returns true for string with emoji", () => {
    expect(hasNonAsciiContent("project 🚀")).toBe(true);
  });

  it("returns true for string with accented characters", () => {
    expect(hasNonAsciiContent("Façade")).toBe(true);
  });

  it("returns true for CJK characters", () => {
    expect(hasNonAsciiContent("项目")).toBe(true);
  });

  it("returns false for null", () => {
    expect(hasNonAsciiContent(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(hasNonAsciiContent(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasNonAsciiContent("")).toBe(false);
  });
});

describe("deriveProjectUrlKey", () => {
  it("uses normalized name when name is pure ASCII", () => {
    expect(deriveProjectUrlKey("My Project")).toBe("my-project");
  });

  it("falls back to fallback UUID short-id when name is null", () => {
    const result = deriveProjectUrlKey(null, VALID_UUID);
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });

  it("falls back to fallback when name normalizes to null", () => {
    const result = deriveProjectUrlKey("!!!", VALID_UUID);
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });

  it("appends UUID short-id when name has non-ASCII content", () => {
    const result = deriveProjectUrlKey("项目名称", VALID_UUID);
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });

  it("appends UUID suffix when name has mixed ASCII + non-ASCII", () => {
    const result = deriveProjectUrlKey("my-项目", VALID_UUID);
    expect(result).toMatch(/^my-[0-9a-f]{8}$/);
  });

  it("returns 'project' when both name and fallback are null", () => {
    expect(deriveProjectUrlKey(null, null)).toBe("project");
  });

  it("returns 'project' when both name and fallback are undefined", () => {
    expect(deriveProjectUrlKey(undefined, undefined)).toBe("project");
  });

  it("prefers name over fallback for clean ASCII name", () => {
    expect(deriveProjectUrlKey("Primary", VALID_UUID)).toBe("primary");
  });

  it("uses fallback string when name is null and fallback is not a UUID", () => {
    expect(deriveProjectUrlKey(null, "backup-project")).toBe("backup-project");
  });
});
