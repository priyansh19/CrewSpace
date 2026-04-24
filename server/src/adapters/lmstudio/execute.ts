import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString, parseObject } from "../utils.js";
import { execute as codexExecute } from "@crewspaceai/adapter-codex-local/server";
import { resolveLmStudioBaseUrl } from "../lmstudio-models.js";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function mergeEnvEntry(
  env: Record<string, unknown>,
  key: string,
  value: string,
): void {
  if (env[key] !== undefined) return;
  env[key] = { type: "plain", value };
}

function resolveApiKey(config: Record<string, unknown>): string {
  const raw = config.apiKey;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "object" && raw !== null) {
    const rec = raw as Record<string, unknown>;
    if (rec.type === "plain" && typeof rec.value === "string" && rec.value.trim()) {
      return rec.value.trim();
    }
  }
  return "lm-studio";
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const config = parseObject(ctx.config);
  const configBaseUrl = asString(config.baseUrl, "");
  const baseUrl = resolveLmStudioBaseUrl(configBaseUrl);

  if (!baseUrl) {
    throw new Error(
      "LM Studio URL is not configured. Set baseUrl in the adapter config or set LM_STUDIO_URL in the server environment.",
    );
  }

  const openAiBaseUrl = `${normalizeBaseUrl(baseUrl)}/v1`;
  const apiKey = resolveApiKey(config);

  // Inject OPENAI_BASE_URL and API key so the codex CLI routes to LM Studio.
  const env =
    typeof config.env === "object" && config.env !== null && !Array.isArray(config.env)
      ? { ...(config.env as Record<string, unknown>) }
      : {};

  mergeEnvEntry(env, "OPENAI_BASE_URL", openAiBaseUrl);
  mergeEnvEntry(env, "OPENAI_API_KEY", apiKey);

  const patchedConfig = { ...config, env };

  return codexExecute({ ...ctx, config: patchedConfig });
}
