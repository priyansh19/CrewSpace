import { asString, asNumber, parseObject } from "@crewspaceai/adapter-utils/server-utils";

export interface SseChunk {
  deltaText?: string;
  deltaThinking?: string;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export function parseSseStream(buffer: string): { chunks: SseChunk[]; remaining: string } {
  const chunks: SseChunk[] = [];
  const lines = buffer.split("\n");
  let remaining = "";

  // If buffer doesn't end with a newline, the last line is incomplete
  if (!buffer.endsWith("\n")) {
    remaining = lines.pop() ?? "";
  }

  let dataLine = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data:")) {
      dataLine = trimmed.slice(5).trim();
      continue;
    }
    if (!trimmed && dataLine) {
      if (dataLine === "[DONE]") {
        dataLine = "";
        continue;
      }
      const chunk = parseSseDataLine(dataLine);
      if (chunk) chunks.push(chunk);
      dataLine = "";
    }
  }

  // If we ended mid-data line without a blank line after it
  if (dataLine && !remaining) {
    remaining = dataLine;
  }

  return { chunks, remaining };
}

function parseSseDataLine(data: string): SseChunk | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const rec = parsed as Record<string, unknown>;

  const chunk: SseChunk = {};

  // Error response inside stream
  if (rec.error) {
    const err = parseObject(rec.error);
    chunk.error = asString(err?.message, asString(rec.error, "Stream error"));
    return chunk;
  }

  // Usage in the final chunk (choices may be empty)
  if (rec.usage) {
    const usage = parseObject(rec.usage);
    if (usage) {
      chunk.usage = {
        prompt_tokens: asNumber(usage.prompt_tokens, 0),
        completion_tokens: asNumber(usage.completion_tokens, 0),
      };
    }
  }

  const choices = Array.isArray(rec.choices) ? rec.choices : [];
  for (const choice of choices) {
    if (typeof choice !== "object" || choice === null) continue;
    const c = choice as Record<string, unknown>;
    const delta = parseObject(c.delta);
    if (!delta) continue;

    const reasoning = asString(delta.reasoning_content, "");
    if (reasoning) {
      chunk.deltaThinking = reasoning;
    }

    const content = asString(delta.content, "");
    if (content) {
      chunk.deltaText = content;
    }
  }

  return chunk;
}

export function buildOpenAiMessages(
  prompt: string,
  _context: Record<string, unknown>,
): Array<{ role: string; content: string }> {
  return [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: prompt },
  ];
}
