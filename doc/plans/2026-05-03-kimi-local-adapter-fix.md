# Plan: Fix kimi-local Adapter Hangs

Date: 2026-05-03
Branch: `claude-theme-revamp` (merged to main)

## Problem

Agents using the `kimi-local` adapter start a run but never receive a response. The process appears to hang indefinitely. This happens for any task assigned to a Kimi agent.

## Root Cause Analysis

### 1. `dangerouslySkipPermissions` defaults to `false` on server, but UI shows `true`

**The smoking gun.** `packages/adapters/kimi-local/src/server/execute.ts` line 153:

```ts
const skipPermissions = asBoolean(config.dangerouslySkipPermissions, false);
```

Compare with `claude-local` (`packages/adapters/claude-local/src/server/execute.ts` line 322):

```ts
// Default to true for automated agent runs so Claude can write files
// without interactive approval prompts
const dangerouslySkipPermissions = asBoolean(config.dangerouslySkipPermissions, true);
```

Meanwhile, the UI config field (`ui/src/adapters/kimi-local/config-fields.tsx` line 67) shows:

```tsx
config.dangerouslySkipPermissions !== false
```

When the config value is `undefined` (never explicitly set), the UI renders the toggle **ON**, but the server treats it as **OFF**.

**Why this causes a hang:** Kimi CLI in `--print` mode is non-interactive. When it wants to make a tool call (e.g. read a file, run a shell command) and `--yolo` is NOT passed, the CLI pauses waiting for interactive approval. There is no TTY, so it waits forever. CrewSpace default `timeoutSec = 0` means `runChildProcess` never applies a timeout, so the run hangs until manual cancellation.

**Verified manually:**
- Without `--yolo`: `echo "List files" | kimi --print ...` → hangs indefinitely.
- With `--yolo`: same command → completes (may be slow on Windows, but does not hang).

### 2. Auth / API key not validated at execution time

`testEnvironment.ts` checks for `MOONSHOT_API_KEY` and warns if missing, but `execute.ts` does not. If the user has not run `kimi login` and has no API key in env, the Kimi CLI falls back to OAuth / device-login flow. In non-interactive `--print` mode this also hangs because it cannot open a browser or wait for user input.

The adapter also hardcodes `billingType: "unknown"` instead of detecting `"api"` vs `"subscription"` like Claude and Codex adapters do.

### 3. Test-environment probe uses wrong env object

`test.ts` line 150 passes `env` (only the adapter-config overlay) to `runChildProcess`:

```ts
const probe = await runChildProcess(..., { cwd, env, ... });
```

But `execute.ts` passes `runtimeEnv` (merged `process.env + env`). If `MOONSHOT_API_KEY` is present in the shell environment but not in adapter config, the probe fails with an auth warning while actual execution works — or vice versa. This creates confusion during agent onboarding.

### 4. Session resume flag discrepancy

The adapter passes `--session <id>`. The Kimi CLI help text documents `-r` / `--resume` for resuming. Both appear to work in local testing, but aligning with the documented flag is safer.

### 5. Documentation drift

`packages/adapters/kimi-local/src/index.ts` `agentConfigurationDoc` says:

```
pass --dangerously-skip-permissions to Kimi
```

The actual flag passed is `--yolo`.

### 6. Windows-specific tool-call latency

Even with `--yolo`, tool-heavy prompts on Windows can take 60s+ or appear to hang because Python subprocess spawning is slower. This is a kimi-cli limitation, but CrewSpace should surface it clearly and recommend a sensible `timeoutSec` default.

## Impact

| Layer | What breaks |
|-------|-------------|
| `packages/adapters/kimi-local` | Core execution hangs on any tool call |
| `ui/src/adapters/kimi-local` | UI shows misleading default for skip-permissions |
| Agent onboarding | Test probe gives false auth warnings |
| Billing / cost tracking | `billingType` is always `"unknown"` |

## Proposed Changes

### Change A: Default `dangerouslySkipPermissions` to `true`

**File:** `packages/adapters/kimi-local/src/server/execute.ts`

```ts
// BEFORE
const skipPermissions = asBoolean(config.dangerouslySkipPermissions, false);

// AFTER
// Default true for automated agent runs; --print mode has no TTY,
// so any tool-call approval prompt hangs forever.
const skipPermissions = asBoolean(config.dangerouslySkipPermissions, true);
```

This matches `claude-local` behavior and the UI’s visual default.

### Change B: Validate auth before spawning + detect billing type

**File:** `packages/adapters/kimi-local/src/server/execute.ts`

Add helper functions (mirroring claude/codex pattern):

```ts
function hasNonEmptyEnvValue(env: Record<string, string>, key: string): boolean {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}

function resolveKimiBillingType(env: Record<string, string>): "api" | "subscription" {
  return hasNonEmptyEnvValue(env, "KIMI_API_KEY") || hasNonEmptyEnvValue(env, "MOONSHOT_API_KEY")
    ? "api"
    : "subscription";
}
```

At the top of `execute()`, after building `runtimeEnv`, add an early-auth check:

```ts
const billingType = resolveKimiBillingType(runtimeEnv);
if (billingType === "subscription") {
  // Subscription mode requires `kimi login` interactive auth.
  // In non-interactive --print mode this will hang on OAuth/device flow.
  // We still allow it (the user may have run login already), but we log a warning.
  await onLog(
    "stdout",
    "[crewspace] Warning: No KIMI_API_KEY or MOONSHOT_API_KEY detected. " +
      "Kimi CLI will use interactive/session auth. If the run hangs, run `kimi login` or set an API key.\n",
  );
}
```

Then use `billingType` in the result instead of `"unknown"`:

```ts
// BEFORE
billingType: "unknown",

// AFTER
billingType,
```

### Change C: Fix test-environment probe env

**File:** `packages/adapters/kimi-local/src/server/test.ts`

```ts
// BEFORE
const probe = await runChildProcess(..., { cwd, env, ... });

// AFTER
const probe = await runChildProcess(..., { cwd, env: runtimeEnv, ... });
```

This ensures the probe uses the same merged environment as actual execution.

### Change D: Align session resume flag with CLI docs

**File:** `packages/adapters/kimi-local/src/server/execute.ts`

```ts
// BEFORE
if (resumeSessionId) args.push("--session", resumeSessionId);

// AFTER
if (resumeSessionId) args.push("--resume", resumeSessionId);
```

Local testing shows both `--session` and `--resume` work, but `--resume` is the documented flag.

### Change E: Fix documentation drift

**File:** `packages/adapters/kimi-local/src/index.ts`

```
// BEFORE
- dangerouslySkipPermissions (boolean, optional): pass --dangerously-skip-permissions to Kimi

// AFTER
- dangerouslySkipPermissions (boolean, optional): pass --yolo to Kimi CLI so tool calls are auto-approved in non-interactive mode
```

### Change F: Update parser to handle `turn.completed` event with embedded `usage`

**File:** `packages/adapters/kimi-local/src/server/parse.ts`

Current parser checks `type === "turn.completed" || type === "usage"` and reads `event.usage`. The Kimi CLI `stream-json` output sometimes nests usage inside `turn.completed` as:

```json
{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}
```

The current parser handles this correctly (`usageObj = parseObject(event.usage ?? event)`), but we should verify it also handles the flat form:

```json
{"type":"usage","input_tokens":10,"output_tokens":5}
```

Both are already supported. No code change needed unless testing reveals a gap.

### Change G: Add `KIMI_API_KEY` detection to test probe

**File:** `packages/adapters/kimi-local/src/server/test.ts`

```ts
// BEFORE
const configApiKey = env.MOONSHOT_API_KEY;
const hostApiKey = process.env.MOONSHOT_API_KEY;

// AFTER
const configApiKey = env.KIMI_API_KEY || env.MOONSHOT_API_KEY;
const hostApiKey = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY;
```

Update messages to mention both env vars.

## Verification Steps

1. **Unit test the parser** with real kimi-cli v1.40.0 output captured from manual runs.
2. **Run the hello probe** in testEnvironment with no API key → expect `kimi_hello_probe_auth_required` warning but no false failure.
3. **Run the hello probe** with `KIMI_API_KEY` in shell env but NOT in adapter config → expect pass (validates Change C).
4. **Create a Kimi agent** with default config (do not touch the "Skip permissions" toggle) → verify the run completes instead of hanging.
5. **Assign a task that requires a file read** → verify tool call executes and returns results.
6. **Typecheck + build + test** across the workspace.

## Out of Scope

- Changing the default `timeoutSec` (all adapters use `0`). Users should configure this per-agent.
- Fixing kimi-cli Windows performance issues (upstream limitation).
- Adding `getQuotaWindows` / `detectModel` exports (nice-to-have, not required for the hang fix).

## Files to Modify

| File | Change |
|------|--------|
| `packages/adapters/kimi-local/src/server/execute.ts` | A, B, D |
| `packages/adapters/kimi-local/src/server/test.ts` | C, G |
| `packages/adapters/kimi-local/src/server/parse.ts` | F (verify, likely no-op) |
| `packages/adapters/kimi-local/src/index.ts` | E |
| `packages/adapters/kimi-local/src/server/test.ts` | Add unit tests for auth checks |
