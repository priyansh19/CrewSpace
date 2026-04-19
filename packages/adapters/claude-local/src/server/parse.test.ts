import { describe, expect, it } from "vitest";
import {
  parseClaudeStreamJson,
  extractClaudeLoginUrl,
  detectClaudeLoginRequired,
  describeClaudeFailure,
  isClaudeMaxTurnsResult,
  isClaudeUnknownSessionError,
} from "./parse.js";

describe("parseClaudeStreamJson", () => {
  it("parses session id, model, usage, cost, and summary from a full run", () => {
    const stdout = [
      JSON.stringify({ type: "system", subtype: "init", session_id: "sess_abc", model: "claude-sonnet-4-6" }),
      JSON.stringify({ type: "assistant", session_id: "sess_abc", message: { content: [{ type: "text", text: "Hello from Claude" }] } }),
      JSON.stringify({
        type: "result",
        session_id: "sess_abc",
        result: "Done",
        usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 20 },
        total_cost_usd: 0.00123,
      }),
    ].join("\n");

    const parsed = parseClaudeStreamJson(stdout);
    expect(parsed.sessionId).toBe("sess_abc");
    expect(parsed.model).toBe("claude-sonnet-4-6");
    expect(parsed.summary).toBe("Done");
    expect(parsed.usage).toEqual({ inputTokens: 100, outputTokens: 50, cachedInputTokens: 20 });
    expect(parsed.costUsd).toBeCloseTo(0.00123, 6);
    expect(parsed.resultJson).not.toBeNull();
  });

  it("uses assistant text as summary when result has no text", () => {
    const stdout = [
      JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "First paragraph" }] } }),
      JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Second paragraph" }] } }),
      JSON.stringify({ type: "result", result: "", usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 } }),
    ].join("\n");

    const parsed = parseClaudeStreamJson(stdout);
    expect(parsed.summary).toBe("First paragraph\n\nSecond paragraph");
  });

  it("returns nulls for costUsd, usage, and resultJson when no result event is present", () => {
    const stdout = JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "hi" }] } });

    const parsed = parseClaudeStreamJson(stdout);
    expect(parsed.costUsd).toBeNull();
    expect(parsed.usage).toBeNull();
    expect(parsed.resultJson).toBeNull();
    expect(parsed.summary).toBe("hi");
  });

  it("ignores blank lines and malformed lines gracefully", () => {
    const stdout = "\n\nnot-json\n  \n" + JSON.stringify({ type: "system", subtype: "init", session_id: "s1", model: "m1" });
    const parsed = parseClaudeStreamJson(stdout);
    expect(parsed.sessionId).toBe("s1");
    expect(parsed.model).toBe("m1");
  });

  it("prefers the session_id from result event if init did not provide one", () => {
    const stdout = [
      JSON.stringify({ type: "result", session_id: "from_result", result: "ok", usage: { input_tokens: 1, output_tokens: 1 } }),
    ].join("\n");

    const parsed = parseClaudeStreamJson(stdout);
    expect(parsed.sessionId).toBe("from_result");
  });

  it("keeps costUsd as null when total_cost_usd is non-finite", () => {
    const stdout = JSON.stringify({
      type: "result",
      result: "ok",
      usage: { input_tokens: 1, output_tokens: 1 },
      total_cost_usd: "not-a-number",
    });
    const parsed = parseClaudeStreamJson(stdout);
    expect(parsed.costUsd).toBeNull();
  });

  it("ignores non-text content blocks inside assistant messages", () => {
    const stdout = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "deliberating" },
            { type: "tool_use", id: "t1", name: "bash", input: {} },
            { type: "text", text: "Hello" },
          ],
        },
      }),
    ].join("\n");

    const parsed = parseClaudeStreamJson(stdout);
    expect(parsed.summary).toBe("Hello");
  });
});

describe("extractClaudeLoginUrl", () => {
  it("extracts a URL containing 'claude' from text", () => {
    const url = extractClaudeLoginUrl("Please visit https://claude.ai/login to continue.");
    expect(url).toBe("https://claude.ai/login");
  });

  it("extracts a URL containing 'anthropic'", () => {
    const url = extractClaudeLoginUrl("See https://www.anthropic.com/auth?code=abc for details");
    expect(url).toBe("https://www.anthropic.com/auth?code=abc");
  });

  it("falls back to first URL when none matches brand names", () => {
    const url = extractClaudeLoginUrl("Go to https://example.com/auth to log in.");
    expect(url).toBe("https://example.com/auth");
  });

  it("returns null when there are no URLs", () => {
    expect(extractClaudeLoginUrl("no links here")).toBeNull();
  });

  it("strips trailing punctuation from URLs", () => {
    const url = extractClaudeLoginUrl("Login: https://claude.ai/start.");
    expect(url).not.toContain(".");
  });
});

describe("detectClaudeLoginRequired", () => {
  it("detects 'not logged in' in stdout", () => {
    const result = detectClaudeLoginRequired({
      parsed: null,
      stdout: "Error: not logged in",
      stderr: "",
    });
    expect(result.requiresLogin).toBe(true);
  });

  it("detects 'please run claude login' in result text", () => {
    const result = detectClaudeLoginRequired({
      parsed: { result: "Please run `claude login` to continue." },
      stdout: "",
      stderr: "",
    });
    expect(result.requiresLogin).toBe(true);
  });

  it("detects login-required phrase in stderr", () => {
    const result = detectClaudeLoginRequired({
      parsed: null,
      stdout: "",
      stderr: "authentication required",
    });
    expect(result.requiresLogin).toBe(true);
  });

  it("returns requiresLogin=false when no auth phrase is present", () => {
    const result = detectClaudeLoginRequired({
      parsed: { result: "Hello, world!" },
      stdout: "all good",
      stderr: "",
    });
    expect(result.requiresLogin).toBe(false);
  });

  it("extracts loginUrl from stdout when auth is required", () => {
    const result = detectClaudeLoginRequired({
      parsed: null,
      stdout: "Not logged in. Visit https://claude.ai/login",
      stderr: "",
    });
    expect(result.requiresLogin).toBe(true);
    expect(result.loginUrl).toContain("claude.ai");
  });
});

describe("describeClaudeFailure", () => {
  it("includes subtype and result detail in the description", () => {
    const desc = describeClaudeFailure({ subtype: "error_max_turns", result: "Reached max turns" });
    expect(desc).toContain("Claude run failed");
    expect(desc).toContain("error_max_turns");
    expect(desc).toContain("Reached max turns");
  });

  it("falls back to errors array when result is empty", () => {
    const desc = describeClaudeFailure({ subtype: "error", errors: ["context_limit"] });
    expect(desc).toContain("context_limit");
  });

  it("returns null when no meaningful detail is present", () => {
    expect(describeClaudeFailure({ subtype: "", result: "" })).toBeNull();
  });

  it("handles error objects inside the errors array", () => {
    const desc = describeClaudeFailure({ errors: [{ message: "network error" }] });
    expect(desc).toContain("network error");
  });
});

describe("isClaudeMaxTurnsResult", () => {
  it("detects error_max_turns subtype", () => {
    expect(isClaudeMaxTurnsResult({ subtype: "error_max_turns" })).toBe(true);
  });

  it("detects max_turns stop_reason", () => {
    expect(isClaudeMaxTurnsResult({ stop_reason: "max_turns" })).toBe(true);
  });

  it("detects phrase 'max turns' in result text", () => {
    expect(isClaudeMaxTurnsResult({ result: "Hit the maximum turns" })).toBe(true);
  });

  it("returns false for normal completion", () => {
    expect(isClaudeMaxTurnsResult({ subtype: "success", stop_reason: "end_turn" })).toBe(false);
  });

  it("returns false for null input", () => {
    expect(isClaudeMaxTurnsResult(null)).toBe(false);
  });

  it("returns false for undefined input", () => {
    expect(isClaudeMaxTurnsResult(undefined)).toBe(false);
  });
});

describe("isClaudeUnknownSessionError", () => {
  it("detects 'no conversation found with session id'", () => {
    expect(isClaudeUnknownSessionError({ result: "No conversation found with session id abc123" })).toBe(true);
  });

  it("detects 'unknown session' in errors array", () => {
    expect(isClaudeUnknownSessionError({ errors: ["unknown session xyz"] })).toBe(true);
  });

  it("detects 'session not found' pattern", () => {
    expect(isClaudeUnknownSessionError({ result: "Session abc not found" })).toBe(true);
  });

  it("returns false for non-session errors", () => {
    expect(isClaudeUnknownSessionError({ result: "Network error" })).toBe(false);
  });

  it("returns false for empty record", () => {
    expect(isClaudeUnknownSessionError({})).toBe(false);
  });
});
