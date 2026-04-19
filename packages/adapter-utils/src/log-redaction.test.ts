import { describe, expect, it } from "vitest";
import {
  REDACTED_HOME_PATH_USER,
  redactHomePathUserSegments,
  redactHomePathUserSegmentsInValue,
  redactTranscriptEntryPaths,
} from "./log-redaction.js";

describe("redactHomePathUserSegments", () => {
  it("redacts macOS home path user segment", () => {
    const result = redactHomePathUserSegments("/Users/alice/projects/app");
    expect(result).toBe("/Users/a****/projects/app");
  });

  it("redacts Linux home path user segment", () => {
    const result = redactHomePathUserSegments("/home/bob/code");
    expect(result).toBe("/home/b**/code");
  });

  it("redacts Windows home path user segment", () => {
    const result = redactHomePathUserSegments("C:\\Users\\Charlie\\Documents");
    expect(result).toBe("C:\\Users\\C******\\Documents");
  });

  it("redacts multiple occurrences in a single string", () => {
    const result = redactHomePathUserSegments("/Users/alice/a and /home/bob/b");
    expect(result).toContain("/Users/a****/a");
    expect(result).toContain("/home/b**/b");
  });

  it("returns text unchanged when opts.enabled is false", () => {
    const input = "/Users/alice/projects";
    expect(redactHomePathUserSegments(input, { enabled: false })).toBe(input);
  });

  it("redacts by default when opts is undefined", () => {
    const result = redactHomePathUserSegments("/Users/alice/x");
    expect(result).not.toContain("alice");
  });

  it("leaves paths without user segments unchanged", () => {
    const input = "/var/log/app.log";
    expect(redactHomePathUserSegments(input)).toBe(input);
  });

  it("handles single-character username", () => {
    const result = redactHomePathUserSegments("/Users/a/projects");
    expect(result).toBe(`/Users/${REDACTED_HOME_PATH_USER}/projects`);
  });

  it("handles empty string", () => {
    expect(redactHomePathUserSegments("")).toBe("");
  });
});

describe("redactHomePathUserSegmentsInValue", () => {
  it("redacts strings", () => {
    const result = redactHomePathUserSegmentsInValue("/home/carol/file.txt");
    expect(result).not.toContain("carol");
  });

  it("redacts inside arrays", () => {
    const result = redactHomePathUserSegmentsInValue(["/home/alice/a", "/home/bob/b"]);
    expect(result[0]).not.toContain("alice");
    expect(result[1]).not.toContain("bob");
  });

  it("redacts inside plain objects", () => {
    const result = redactHomePathUserSegmentsInValue({ path: "/home/dave/x", count: 1 });
    expect((result as any).path).not.toContain("dave");
    expect((result as any).count).toBe(1);
  });

  it("recursively redacts nested structures", () => {
    const result = redactHomePathUserSegmentsInValue({ nested: { path: "/Users/eve/work" } });
    expect((result as any).nested.path).not.toContain("eve");
  });

  it("returns non-string/non-object values unchanged", () => {
    expect(redactHomePathUserSegmentsInValue(42)).toBe(42);
    expect(redactHomePathUserSegmentsInValue(null)).toBe(null);
    expect(redactHomePathUserSegmentsInValue(true)).toBe(true);
  });
});

describe("redactTranscriptEntryPaths", () => {
  it("redacts text in assistant entry", () => {
    const entry = { kind: "assistant" as const, text: "/Users/frank/work" };
    const result = redactTranscriptEntryPaths(entry);
    expect(result.kind).toBe("assistant");
    expect((result as any).text).not.toContain("frank");
  });

  it("redacts text in user entry", () => {
    const entry = { kind: "user" as const, text: "/home/grace/project" };
    const result = redactTranscriptEntryPaths(entry);
    expect((result as any).text).not.toContain("grace");
  });

  it("redacts name and input in tool_call entry", () => {
    const entry = {
      kind: "tool_call" as const,
      name: "/Users/henry/tool",
      input: { path: "/Users/henry/file.txt" },
    };
    const result = redactTranscriptEntryPaths(entry);
    expect((result as any).name).not.toContain("henry");
    expect((result as any).input.path).not.toContain("henry");
  });

  it("redacts content in tool_result entry", () => {
    const entry = { kind: "tool_result" as const, content: "/home/iris/output" };
    const result = redactTranscriptEntryPaths(entry);
    expect((result as any).content).not.toContain("iris");
  });

  it("redacts model and sessionId in init entry", () => {
    const entry = { kind: "init" as const, model: "claude", sessionId: "/Users/jack/session" };
    const result = redactTranscriptEntryPaths(entry);
    expect((result as any).sessionId).not.toContain("jack");
  });

  it("redacts text and errors in result entry", () => {
    const entry = {
      kind: "result" as const,
      text: "/home/kate/output",
      subtype: "success",
      errors: ["/home/kate/error.log"],
    };
    const result = redactTranscriptEntryPaths(entry);
    expect((result as any).text).not.toContain("kate");
    expect((result as any).errors[0]).not.toContain("kate");
  });

  it("returns unknown kind entry unchanged", () => {
    const entry = { kind: "unknown_kind" as any, data: "x" };
    const result = redactTranscriptEntryPaths(entry);
    expect(result).toEqual(entry);
  });
});
