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

  // Inject OPENAI_BASE_URL and a placeholder API key into the adapter env so
  // the codex CLI routes its requests to LM Studio instead of api.openai.com.
  const env =
    typeof config.env === "object" && config.env !== null && !Array.isArray(config.env)
      ? { ...(config.env as Record<string, unknown>) }
      : {};

  mergeEnvEntry(env, "OPENAI_BASE_URL", openAiBaseUrl);
  mergeEnvEntry(env, "OPENAI_API_KEY", "lm-studio");

  const patchedConfig = { ...config, env };

  return codexExecute({ ...ctx, config: patchedConfig });
}
