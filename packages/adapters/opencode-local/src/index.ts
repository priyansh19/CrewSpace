export const type = "opencode_local";
export const label = "OpenCode (local)";

export const DEFAULT_OPENCODE_LOCAL_MODEL = "anthropic/claude-sonnet-4-6";

export const models: Array<{ id: string; label: string; group?: string }> = [
  // Anthropic
  { id: "anthropic/claude-fable-5",        label: "anthropic/claude-fable-5",        group: "Anthropic" },
  { id: "anthropic/claude-opus-4-8",       label: "anthropic/claude-opus-4-8",       group: "Anthropic" },
  { id: "anthropic/claude-opus-4-6",       label: "anthropic/claude-opus-4-6",       group: "Anthropic" },
  { id: DEFAULT_OPENCODE_LOCAL_MODEL,       label: "anthropic/claude-sonnet-4-6 (default)", group: "Anthropic" },
  { id: "anthropic/claude-sonnet-4-5",     label: "anthropic/claude-sonnet-4-5",     group: "Anthropic" },
  { id: "anthropic/claude-haiku-4-5",      label: "anthropic/claude-haiku-4-5",      group: "Anthropic" },
  // OpenAI / Codex
  { id: "openai/gpt-5.4",                  label: "openai/gpt-5.4",                  group: "OpenAI" },
  { id: "openai/gpt-5.3-codex",            label: "openai/gpt-5.3-codex",            group: "OpenAI" },
  { id: "openai/gpt-5.2-codex",            label: "openai/gpt-5.2-codex",            group: "OpenAI" },
  { id: "openai/gpt-5.2",                  label: "openai/gpt-5.2",                  group: "OpenAI" },
  { id: "openai/gpt-5.1-codex-max",        label: "openai/gpt-5.1-codex-max",        group: "OpenAI" },
  { id: "openai/gpt-5.1-codex-mini",       label: "openai/gpt-5.1-codex-mini",       group: "OpenAI" },
  { id: "openai/o3",                        label: "openai/o3",                        group: "OpenAI" },
  { id: "openai/o4-mini",                   label: "openai/o4-mini",                   group: "OpenAI" },
  // Google
  { id: "google/gemini-2.5-pro",           label: "google/gemini-2.5-pro",           group: "Google" },
  { id: "google/gemini-2.5-flash",         label: "google/gemini-2.5-flash",         group: "Google" },
  { id: "google/gemini-2.0-flash",         label: "google/gemini-2.0-flash",         group: "Google" },
];

export const agentConfigurationDoc = `# opencode_local agent configuration

Adapter: opencode_local

Use when:
- You want CrewSpace to run OpenCode locally as the agent runtime
- You want provider/model routing in OpenCode format (provider/model)
- You want OpenCode session resume across heartbeats via --session
- You want to use NVIDIA NIM, Ollama, vLLM, or any OpenAI-compatible endpoint

Don't use when:
- You need webhook-style external invocation (use openclaw_gateway or http)
- You only need one-shot shell commands (use process)
- OpenCode CLI is not installed on the machine

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to the run prompt
- model (string, required): OpenCode model id in provider/model format (for example anthropic/claude-sonnet-4-5)
- variant (string, optional): provider-specific reasoning/profile variant passed as --variant (for example minimal|low|medium|high|xhigh|max)
- dangerouslySkipPermissions (boolean, optional): inject a runtime OpenCode config that allows \`external_directory\` access without interactive prompts; defaults to true for unattended CrewSpace runs
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "opencode"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- OpenCode supports multiple providers and models. Use \
  \`opencode models\` to list available options in provider/model format.
- CrewSpace requires an explicit \`model\` value for \`opencode_local\` agents.
- Runs are executed with: opencode run --format json ...
- Sessions are resumed with --session when stored session cwd matches current cwd.
- The adapter sets OPENCODE_DISABLE_PROJECT_CONFIG=true to prevent OpenCode from \
  writing an opencode.json config file into the project working directory. Model \
  selection is passed via the --model CLI flag instead.
- When \`dangerouslySkipPermissions\` is enabled, CrewSpace injects a temporary \
  runtime config with \`permission.external_directory=allow\` so headless runs do \
  not stall on approval prompts.
`;
