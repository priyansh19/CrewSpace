import type { AdapterExecutionContext, AdapterExecutionResult } from "@crewspaceai/adapter-utils";
import {
  asString,
  asNumber,
  asBoolean,
  parseObject,
  buildCrewSpaceEnv,
  renderTemplate,
  joinPromptSections,
  buildInvocationEnvForLogs,
} from "@crewspaceai/adapter-utils/server-utils";
import { parseSseStream, buildOpenAiMessages } from "./parse.js";

const DEFAULT_BASE_URL = "https://api.moonshot.cn/v1";
const DEFAULT_MODEL = "kimi-k2";

function hasNonEmptyEnvValue(env: Record<string, string>, key: string): boolean {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}

function resolveApiKey(env: Record<string, string>): string | null {
  return env.MOONSHOT_API_KEY || env.KIMI_API_KEY || null;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, config, context, onLog, onMeta } = ctx;

  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your CrewSpace work.",
  );
  const model = asString(config.model, DEFAULT_MODEL).trim();
  const baseUrl = asString(config.baseUrl, DEFAULT_BASE_URL).replace(/\/$/, "");
  const temperature = asNumber(config.temperature, -1);
  const maxTokens = asNumber(config.maxTokens, 0);
  const timeoutSec = asNumber(config.timeoutSec, 300);

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = { ...buildCrewSpaceEnv(agent) };
  env.CREWSPACE_RUN_ID = runId;
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }

  const apiKey = resolveApiKey(env);
  if (!apiKey) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "MOONSHOT_API_KEY or KIMI_API_KEY is required in adapter env or shell environment.",
      errorCode: "kimi_api_key_missing",
      provider: "moonshot",
      biller: "moonshot",
      model,
    };
  }

  const templateData = {
    agent: { id: agent.id, name: agent.name },
    run: { id: runId },
    context,
  };
  const renderedPrompt = renderTemplate(promptTemplate, templateData);
  const sessionHandoffNote = asString(context.crewspaceSessionHandoffMarkdown, "").trim();
  const prompt = joinPromptSections([sessionHandoffNote, renderedPrompt]);

  const messages = buildOpenAiMessages(prompt, context);

  const url = `${baseUrl}/chat/completions`;
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
  };
  if (temperature >= 0) body.temperature = temperature;
  if (maxTokens > 0) body.max_tokens = maxTokens;

  const loggedEnv = buildInvocationEnvForLogs(env);

  if (onMeta) {
    await onMeta({
      adapterType: "kimi_api",
      command: url,
      commandArgs: [`POST ${url}`, `model=${model}`, `stream=true`],
      env: loggedEnv,
      prompt,
      promptMetrics: { promptChars: prompt.length },
      context,
    });
  }

  const controller = new AbortController();
  const timer = timeoutSec > 0 ? setTimeout(() => controller.abort(), timeoutSec * 1000) : null;

  let fullText = "";
  let fullThinking = "";
  let usageInputTokens = 0;
  let usageOutputTokens = 0;
  let errorMessage: string | null = null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      const msg =
        (parsed && typeof parsed === "object" && parsed !== null
          ? ((parsed as Record<string, unknown>).error as Record<string, unknown> | undefined)?.message
          : null) || text;
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: `Moonshot API error ${res.status}: ${msg}`,
        errorCode: "kimi_api_error",
        provider: "moonshot",
        biller: "moonshot",
        model,
      };
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: "Moonshot API response body is empty.",
        errorCode: "kimi_api_empty_body",
        provider: "moonshot",
        biller: "moonshot",
        model,
      };
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const { chunks, remaining } = parseSseStream(buffer);
      buffer = remaining;

      for (const chunk of chunks) {
        if (chunk.usage) {
          usageInputTokens = chunk.usage.prompt_tokens ?? usageInputTokens;
          usageOutputTokens = chunk.usage.completion_tokens ?? usageOutputTokens;
        }
        if (chunk.deltaThinking) {
          fullThinking += chunk.deltaThinking;
          await onLog("stdout", JSON.stringify({ role: "assistant", content: [{ type: "think", think: chunk.deltaThinking }] }) + "\n");
        }
        if (chunk.deltaText) {
          fullText += chunk.deltaText;
          await onLog("stdout", JSON.stringify({ role: "assistant", content: [{ type: "text", text: chunk.deltaText }] }) + "\n");
        }
        if (chunk.error) {
          errorMessage = chunk.error;
        }
      }
    }
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      exitCode: 1,
      signal: null,
      timedOut: isAbort,
      errorMessage: isAbort
        ? `Moonshot API request timed out after ${timeoutSec}s.`
        : err instanceof Error
          ? err.message
          : "Moonshot API request failed.",
      errorCode: isAbort ? "kimi_api_timeout" : "kimi_api_request_failed",
      provider: "moonshot",
      biller: "moonshot",
      model,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }

  const summary = fullThinking
    ? `<thinking>\n${fullThinking}\n</thinking>\n\n${fullText}`
    : fullText;

  return {
    exitCode: errorMessage ? 1 : 0,
    signal: null,
    timedOut: false,
    errorMessage,
    errorCode: errorMessage ? "kimi_api_stream_error" : null,
    usage: {
      inputTokens: usageInputTokens,
      outputTokens: usageOutputTokens,
      cachedInputTokens: 0,
    },
    provider: "moonshot",
    biller: "moonshot",
    model,
    summary,
  };
}
