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

function extractTextFromContentArray(content: unknown[]): string {
  const texts: string[] = [];
  for (const item of content) {
    const rec = asRecord(item);
    if (rec && rec.type === "text" && typeof rec.text === "string") {
      texts.push(rec.text);
    }
  }
  return texts.join("");
}

function extractThinkFromContentArray(content: unknown[]): string {
  const texts: string[] = [];
  for (const item of content) {
    const rec = asRecord(item);
    if (rec && rec.type === "think" && typeof rec.think === "string") {
      texts.push(rec.think);
    }
  }
  return texts.join("");
}

export function parseKimiApiStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  const event = safeJsonParse(trimmed);
  if (!event || typeof event !== "object") {
    return [{ kind: "stdout", ts, text: trimmed }];
  }

  const rec = event as Record<string, unknown>;

  if (rec.role === "assistant") {
    const content = rec.content;
    const entries: TranscriptEntry[] = [];

    if (typeof content === "string") {
      if (content) entries.push({ kind: "assistant", ts, text: content, delta: true });
    } else if (Array.isArray(content)) {
      const think = extractThinkFromContentArray(content);
      const text = extractTextFromContentArray(content);
      if (think) entries.push({ kind: "thinking", ts, text: think, delta: true });
      if (text) entries.push({ kind: "assistant", ts, text, delta: true });
    }

    return entries.length > 0 ? entries : [{ kind: "stdout", ts, text: trimmed }];
  }

  if (rec.role === "tool" && Array.isArray(rec.content)) {
    const text = extractTextFromContentArray(rec.content);
    const toolCallId = asString(rec.tool_call_id, "");
    if (text) {
      return [{ kind: "tool_result", ts, toolUseId: toolCallId, content: text, isError: false }];
    }
    return [];
  }

  return [{ kind: "stdout", ts, text: trimmed }];
}
