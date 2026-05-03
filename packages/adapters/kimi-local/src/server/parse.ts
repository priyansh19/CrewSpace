import { asString, asNumber, parseObject, parseJson } from "@crewspaceai/adapter-utils/server-utils";

function extractSessionIdFromStderr(stderr: string): string | null {
  // Look for: "Created new session: <uuid>" or "Resuming session: <uuid>"
  const createdMatch = stderr.match(/Created new session:\s*([a-f0-9-]{36})/i);
  if (createdMatch) return createdMatch[1];
  const resumedMatch = stderr.match(/Resuming session:\s*([a-f0-9-]{36})/i);
  if (resumedMatch) return resumedMatch[1];
  return null;
}

function extractTextFromContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const texts: string[] = [];
  for (const item of content) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    if (rec.type === "text" && typeof rec.text === "string") {
      texts.push(rec.text);
    }
  }
  return texts.join("");
}

function extractThinkFromContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const texts: string[] = [];
  for (const item of content) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    if (rec.type === "think" && typeof rec.think === "string") {
      texts.push(rec.think);
    }
  }
  return texts.join("");
}

export function parseKimiJsonl(stdout: string, stderr?: string) {
  let sessionId: string | null = stderr ? extractSessionIdFromStderr(stderr) : null;
  const messages: string[] = [];
  let errorMessage: string | null = null;
  const usage = {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
  };

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const event = parseJson(line);
    if (!event) {
      // Fallback: treat non-JSON lines as plain text output
      messages.push(line);
      continue;
    }

    const type = asString(event.type, "");

    if (type === "session.started" || type === "thread.started") {
      sessionId = asString(event.session_id, asString(event.thread_id, sessionId ?? "")) || sessionId;
      continue;
    }

    if (type === "error") {
      const msg = asString(event.message, "").trim();
      if (msg) errorMessage = msg;
      continue;
    }

    // Main response format: {"role":"assistant","content":[...]}
    if (event.role === "assistant" && Array.isArray(event.content)) {
      const text = extractTextFromContent(event.content);
      const think = extractThinkFromContent(event.content);
      if (think) messages.push(think);
      if (text) messages.push(text);
      continue;
    }

    // Tool result format: {"role":"tool","content":[...]}
    if (event.role === "tool" && Array.isArray(event.content)) {
      const text = extractTextFromContent(event.content);
      if (text) messages.push(text);
      continue;
    }

    if (type === "message" || type === "item.completed") {
      const item = parseObject(event.item ?? event);
      const text = asString(item.text, asString(item.content, ""));
      if (text) messages.push(text);
      continue;
    }

    if (type === "turn.completed" || type === "usage") {
      const usageObj = parseObject(event.usage ?? event);
      usage.inputTokens = asNumber(usageObj.input_tokens, usage.inputTokens);
      usage.cachedInputTokens = asNumber(usageObj.cached_input_tokens, usage.cachedInputTokens);
      usage.outputTokens = asNumber(usageObj.output_tokens, usage.outputTokens);
      continue;
    }

    if (type === "turn.failed" || type === "failed") {
      const err = parseObject(event.error);
      const msg = asString(err?.message, "").trim();
      if (msg) errorMessage = msg;
      continue;
    }

    // Fallback: preserve unrecognized JSON lines so they are not silently lost
    messages.push(line);
  }

  return {
    sessionId,
    summary: messages.join("\n\n").trim(),
    usage,
    errorMessage,
    costUsd: null as number | null,
  };
}

/** Remove internal Python loguru logging errors from stderr output.
 *  These are non-fatal Windows file-lock errors during log rotation
 *  and should not be shown to users in transcripts.
 */
export function cleanKimiStderr(stderr: string): string {
  const lines = stderr.split(/\r?\n/);
  const result: string[] = [];
  let inLoguruBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Detect start of loguru error block — it may start with the handler header
    // or directly with the traceback
    if (
      line.startsWith("--- Logging error in Loguru") ||
      line === "Traceback (most recent call last):"
    ) {
      inLoguruBlock = true;
      continue;
    }

    // Detect end of loguru error block
    if (line === "--- End of logging error ---") {
      inLoguruBlock = false;
      continue;
    }

    // Skip everything inside the block
    if (inLoguruBlock) {
      continue;
    }

    result.push(rawLine);
  }

  return result.join("\n").trim();
}

export function isKimiUnknownSessionError(stdout: string, stderr: string): boolean {
  const haystack = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
  return /unknown (session|thread)|session .* not found|thread .* not found/i.test(haystack);
}
