export const type = "kimi_local";
export const label = "Kimi Code (local)";
export const DEFAULT_KIMI_LOCAL_MODEL = "kimi-k2";

export const models = [
  { id: DEFAULT_KIMI_LOCAL_MODEL, label: DEFAULT_KIMI_LOCAL_MODEL },
  { id: "kimi-k2-coder", label: "kimi-k2-coder" },
  { id: "kimi-k2-mini", label: "kimi-k2-mini" },
  { id: "kimi-k1.6", label: "kimi-k1.6" },
];

export const agentConfigurationDoc = `# kimi_local agent configuration

Adapter: kimi_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to stdin prompt at runtime
- model (string, optional): Kimi model id
- promptTemplate (string, optional): run prompt template
- dangerouslySkipPermissions (boolean, optional): pass --yolo to Kimi CLI so tool calls are auto-approved in non-interactive mode
- command (string, optional): defaults to "kimi"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables
- workspaceStrategy (object, optional): execution workspace strategy; currently supports { type: "git_worktree", baseRef?, branchTemplate?, worktreeParentDir? }
- workspaceRuntime (object, optional): reserved for workspace runtime metadata; workspace runtime services are manually controlled from the workspace UI and are not auto-started by heartbeats

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Prompts are piped via stdin.
- If instructionsFilePath is configured, CrewSpace prepends that file's contents to the stdin prompt on every run.
- CrewSpace injects desired local skills into the effective KIMI_HOME/skills/ directory at execution time.
`;
