import { describe, expect, it } from "vitest";
import { normalizeCursorStreamLine } from "./stream.js";

describe("normalizeCursorStreamLine", () => {
  it("returns null stream for empty line", () => {
    expect(normalizeCursorStreamLine("")).toEqual({ stream: null, line: "" });
  });

  it("returns null stream for whitespace-only line", () => {
    expect(normalizeCursorStreamLine("   ")).toEqual({ stream: null, line: "" });
  });

  it("detects stdout prefix", () => {
    const result = normalizeCursorStreamLine('stdout: {"type":"text"}');
    expect(result.stream).toBe("stdout");
    expect(result.line).toBe('{"type":"text"}');
  });

  it("detects stderr prefix", () => {
    const result = normalizeCursorStreamLine('stderr: {"error":"oops"}');
    expect(result.stream).toBe("stderr");
    expect(result.line).toBe('{"error":"oops"}');
  });

  it("is case-insensitive for stream prefix", () => {
    const result = normalizeCursorStreamLine('STDOUT: {"foo":"bar"}');
    expect(result.stream).toBe("stdout");
  });

  it("returns null stream for plain JSON without prefix", () => {
    const result = normalizeCursorStreamLine('{"type":"message"}');
    expect(result.stream).toBeNull();
    expect(result.line).toBe('{"type":"message"}');
  });

  it("handles stdout= assignment syntax", () => {
    const result = normalizeCursorStreamLine('stdout={"key":"value"}');
    expect(result.stream).toBe("stdout");
  });

  it("trims whitespace from input", () => {
    const result = normalizeCursorStreamLine('  {"plain":"json"}  ');
    expect(result.stream).toBeNull();
    expect(result.line).toBe('{"plain":"json"}');
  });
});
