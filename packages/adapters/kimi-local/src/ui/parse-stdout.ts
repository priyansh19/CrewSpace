import type { TranscriptEntry } from "@crewspaceai/adapter-utils";

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function extractTextFromContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const texts: string[] = [];
  for (const item of content) {
    const rec = asRecord(item);
    if (rec && rec.type === "text" && typeof rec.text === "string") {
      texts.push(rec.text);
    }
  }
  return texts.join("");
}

export function parseKimiStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  const event = asRecord(safeJsonParse(trimmed));
  if (!event) {
    return [{ kind: "stdout", ts, text: trimmed }];
  }

  // Main response format: {"role":"assistant","content":[...]}
  if (event.role === "assistant" && Array.isArray(event.content)) {
    const text = extractTextFromContent(event.content);
    if (text) return [{ kind: "assistant", ts, text }];
    return [];
  }

  const type = asString(event.type, "");

  if (type === "message" || type === "item.completed") {
    const item = asRecord(event.item) ?? event;
    const text = asString(item.text, asString(item.content, ""));
    if (text) return [{ kind: "assistant", ts, text }];
  }

  if (type === "thinking" || type === "reasoning") {
    const text = asString(event.text, asString(event.content, ""));
    if (text) return [{ kind: "thinking", ts, text }];
  }

  if (type === "error") {
    const msg = asString(event.message, "");
    if (msg) return [{ kind: "stderr", ts, text: msg }];
  }

  if (type === "tool_call") {
    const name = asString(event.name, asString(event.tool_name, "tool"));
    return [{ kind: "tool_call", ts, name, input: asString(event.arguments, asString(event.args, "")) }];
  }

  if (type === "turn.completed" || type === "usage") {
    const usage = asRecord(event.usage ?? event);
    return [{
      kind: "result",
      ts,
      text: "",
      inputTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : 0,
      outputTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : 0,
      cachedTokens: typeof usage?.cached_input_tokens === "number" ? usage.cached_input_tokens : 0,
      costUsd: 0,
      subtype: type,
      isError: false,
      errors: [],
    }];
  }

  return [{ kind: "stdout", ts, text: trimmed }];
}
