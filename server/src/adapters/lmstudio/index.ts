import type { ServerAdapterModule } from "../types.js";
import {
  sessionCodec,
  getQuotaWindows,
  listCodexSkills,
  syncCodexSkills,
} from "@crewspaceai/adapter-codex-local/server";
import { getAdapterSessionManagement } from "@crewspaceai/adapter-utils";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";
import { listLmStudioModels } from "../lmstudio-models.js";

export const lmStudioAdapter: ServerAdapterModule = {
  type: "lmstudio_local",
  execute,
  testEnvironment,
  listSkills: listCodexSkills,
  syncSkills: syncCodexSkills,
  sessionCodec,
  sessionManagement: getAdapterSessionManagement("lmstudio_local") ?? undefined,
  models: [],
  listModels: () => listLmStudioModels(),
  supportsLocalAgentJwt: true,
  getQuotaWindows,
  agentConfigurationDoc: `# lmstudio_local agent configuration

Adapter: lmstudio_local

Connects to a locally running LM Studio instance via its OpenAI-compatible API
and delegates execution to the Codex CLI pointed at that endpoint.

Core fields:
- baseUrl (string, required): Base URL of the LM Studio server, e.g. http://localhost:1234
  Falls back to the LM_STUDIO_URL environment variable if not set in adapter config.
- model (string, optional): Model ID to use (as shown in LM Studio). Defaults to the first loaded model.
- cwd (string, optional): Default working directory for agent runs.
- instructionsFilePath (string, optional): Path to a markdown instructions file.
- promptTemplate (string, optional): Run prompt template.
- dangerouslyBypassApprovalsAndSandbox (boolean, optional): Skip Codex approval prompts.
- command (string, optional): Codex CLI command path. Defaults to "codex".
- extraArgs (string[], optional): Additional CLI arguments.
- env (object, optional): KEY=VALUE environment variables injected into the agent process.
- timeoutSec (number, optional): Run timeout in seconds.
- graceSec (number, optional): SIGTERM grace period in seconds.

Notes:
- LM Studio must be running and have at least one model loaded before agents can execute.
- For Docker setups, use host.docker.internal instead of localhost in the baseUrl.
- OPENAI_BASE_URL and OPENAI_API_KEY are automatically injected; do not set them manually.
`,
};
