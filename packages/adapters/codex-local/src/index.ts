export const type = "codex_local";
export const label = "Codex (local)";
// An empty model leaves selection to the operator's Codex CLI configuration.
export const DEFAULT_CODEX_LOCAL_MODEL = "";
export const DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX = true;

export function normalizeCodexModel(value: unknown): string {
  const model = typeof value === "string" ? value.trim() : "";
  return model.toLowerCase() === "default" ? DEFAULT_CODEX_LOCAL_MODEL : model;
}

export const models = [
  { id: "gpt-6.1-sol", label: "gpt-6.1-sol" },
  { id: "gpt-6-astra", label: "gpt-6-astra" },
  { id: "gpt-6-sol", label: "gpt-6-sol" },
  { id: "gpt-6-luna", label: "gpt-6-luna" },
];

export const agentConfigurationDoc = `# codex_local agent configuration

Adapter: codex_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to stdin prompt at runtime
- model (string, optional): Codex model id override; omit, leave blank, or use "default" (case-insensitive) to use the Codex CLI's configured default. Surrounding whitespace is ignored.
- modelReasoningEffort (string, optional): reasoning effort override (minimal|low|medium|high|xhigh) passed via -c model_reasoning_effort=...
- promptTemplate (string, optional): run prompt template
- search (boolean, optional): run codex with --search
- dangerouslyBypassApprovalsAndSandbox (boolean, optional): run with bypass flag
- command (string, optional): defaults to "codex"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables
- workspaceStrategy (object, optional): execution workspace strategy; currently supports { type: "git_worktree", baseRef?, branchTemplate?, worktreeParentDir? }
- workspaceRuntime (object, optional): reserved for workspace runtime metadata; workspace runtime services are manually controlled from the workspace UI and are not auto-started by heartbeats

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Prompts are piped via stdin (Codex receives "-" prompt argument).
- If instructionsFilePath is configured, CrewSpace prepends that file's contents to the stdin prompt on every run.
- Codex exec automatically applies repo-scoped AGENTS.md instructions from the active workspace. CrewSpace cannot suppress that discovery in exec mode, so repo AGENTS.md files may still apply even when you only configured an explicit instructionsFilePath.
- CrewSpace injects desired local skills into the effective CODEX_HOME/skills/ directory at execution time so Codex can discover "$crewspace" and related skills without polluting the project working directory. In managed-home mode (the default) this is ~/.crewspace/instances/<id>/companies/<companyId>/codex-home/skills/; when CODEX_HOME is explicitly overridden in adapter config, that override is used instead.
- Unless explicitly overridden in adapter config, CrewSpace runs Codex with a per-company managed CODEX_HOME under the active CrewSpace instance and seeds auth/config from the shared Codex home (the CODEX_HOME env var, when set, or ~/.codex).
- Some model/tool combinations reject certain effort levels (for example minimal with web search enabled).
- When CrewSpace realizes a workspace/runtime for a run, it injects CREWSPACE_WORKSPACE_* and CREWSPACE_RUNTIME_* env vars for agent-side tooling.
`;
