import type { CreateConfigValues } from "@crewspaceai/adapter-utils";

export const DEFAULT_LM_STUDIO_BASE_URL = "http://localhost:1234";

export function buildLmStudioLocalConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  const baseUrl = v.url?.trim() || DEFAULT_LM_STUDIO_BASE_URL;
  ac.baseUrl = baseUrl;
  if (v.model?.trim()) ac.model = v.model.trim();
  if (v.cwd) ac.cwd = v.cwd;
  if (v.instructionsFilePath) ac.instructionsFilePath = v.instructionsFilePath;
  if (v.promptTemplate) ac.promptTemplate = v.promptTemplate;
  ac.dangerouslyBypassApprovalsAndSandbox = true;
  ac.timeoutSec = 0;
  ac.graceSec = 15;

  // Store API key from envBindings if provided
  const bindings = v.envBindings as Record<string, unknown> | undefined;
  const apiKey =
    typeof bindings?.OPENAI_API_KEY === "string" ? bindings.OPENAI_API_KEY.trim() : "";
  if (apiKey) ac.apiKey = { type: "plain", value: apiKey };

  return ac;
}
