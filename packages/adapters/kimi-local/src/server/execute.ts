import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { inferOpenAiCompatibleBiller, type AdapterExecutionContext, type AdapterExecutionResult } from "@crewspaceai/adapter-utils";
import {
  asString,
  asNumber,
  asBoolean,
  asStringArray,
  parseObject,
  buildCrewSpaceEnv,
  buildInvocationEnvForLogs,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensureCrewSpaceSkillSymlink,
  ensurePathInEnv,
  readCrewSpaceRuntimeSkillEntries,
  resolveCommandForLogs,
  resolveCrewSpaceDesiredSkillNames,
  renderTemplate,
  joinPromptSections,
  runChildProcess,
  sanitizeCwd,
} from "@crewspaceai/adapter-utils/server-utils";
import { cleanKimiStderr, detectKimiLoginRequired, isKimiUnknownSessionError, isKimiMaxTurnsResult, parseKimiJsonl } from "./parse.js";
import { ensureKimiSkillsInjected } from "./skills.js";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function hasNonEmptyEnvValue(env: Record<string, string>, key: string): boolean {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}

function resolveKimiBillingType(env: Record<string, string>): "api" | "subscription" {
  return hasNonEmptyEnvValue(env, "KIMI_API_KEY") || hasNonEmptyEnvValue(env, "MOONSHOT_API_KEY")
    ? "api"
    : "subscription";
}

function parseModelProvider(model: string | null): string | null {
  if (!model) return null;
  const trimmed = model.trim();
  if (!trimmed.includes("/")) return "moonshot";
  return trimmed.slice(0, trimmed.indexOf("/")).trim() || "moonshot";
}

function resolveKimiBiller(env: Record<string, string>, provider: string | null): string {
  return inferOpenAiCompatibleBiller(env, provider) ?? provider ?? "moonshot";
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta, onSpawn, authToken } = ctx;

  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your CrewSpace work.",
  );
  const command = asString(config.command, "kimi");
  const model = asString(config.model, "").trim();

  const workspaceContext = parseObject(context.crewspaceWorkspace);
  const workspaceCwd = asString(workspaceContext.cwd, "");
  const workspaceSource = asString(workspaceContext.source, "");
  const workspaceId = asString(workspaceContext.workspaceId, "");
  const workspaceRepoUrl = asString(workspaceContext.repoUrl, "");
  const workspaceRepoRef = asString(workspaceContext.repoRef, "");
  const agentHome = asString(workspaceContext.agentHome, "");
  const workspaceHints = Array.isArray(context.crewspaceWorkspaces)
    ? context.crewspaceWorkspaces.filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
      )
    : [];
  const configuredCwd = asString(config.cwd, "");
  const useConfiguredInsteadOfAgentHome = workspaceSource === "agent_home" && configuredCwd.length > 0;
  const effectiveWorkspaceCwd = useConfiguredInsteadOfAgentHome ? "" : workspaceCwd;
  const cwd = sanitizeCwd(effectiveWorkspaceCwd || configuredCwd || process.cwd());
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });

  const kimiSkillEntries = await readCrewSpaceRuntimeSkillEntries(config, __moduleDir);
  const desiredKimiSkillNames = resolveCrewSpaceDesiredSkillNames(config, kimiSkillEntries);
  await ensureKimiSkillsInjected(onLog, kimiSkillEntries, desiredKimiSkillNames);

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = { ...buildCrewSpaceEnv(agent) };
  env.CREWSPACE_RUN_ID = runId;
  const wakeTaskId =
    (typeof context.taskId === "string" && context.taskId.trim().length > 0 && context.taskId.trim()) ||
    (typeof context.issueId === "string" && context.issueId.trim().length > 0 && context.issueId.trim()) ||
    null;
  const wakeReason =
    typeof context.wakeReason === "string" && context.wakeReason.trim().length > 0
      ? context.wakeReason.trim()
      : null;
  const wakeCommentId =
    (typeof context.wakeCommentId === "string" && context.wakeCommentId.trim().length > 0 && context.wakeCommentId.trim()) ||
    (typeof context.commentId === "string" && context.commentId.trim().length > 0 && context.commentId.trim()) ||
    null;
  const approvalId =
    typeof context.approvalId === "string" && context.approvalId.trim().length > 0
      ? context.approvalId.trim()
      : null;
  const approvalStatus =
    typeof context.approvalStatus === "string" && context.approvalStatus.trim().length > 0
      ? context.approvalStatus.trim()
      : null;
  const linkedIssueIds = Array.isArray(context.issueIds)
    ? context.issueIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  if (wakeTaskId) env.CREWSPACE_TASK_ID = wakeTaskId;
  if (wakeReason) env.CREWSPACE_WAKE_REASON = wakeReason;
  if (wakeCommentId) env.CREWSPACE_WAKE_COMMENT_ID = wakeCommentId;
  if (approvalId) env.CREWSPACE_APPROVAL_ID = approvalId;
  if (approvalStatus) env.CREWSPACE_APPROVAL_STATUS = approvalStatus;
  if (linkedIssueIds.length > 0) env.CREWSPACE_LINKED_ISSUE_IDS = linkedIssueIds.join(",");
  if (effectiveWorkspaceCwd) env.CREWSPACE_WORKSPACE_CWD = effectiveWorkspaceCwd;
  if (workspaceSource) env.CREWSPACE_WORKSPACE_SOURCE = workspaceSource;
  if (workspaceId) env.CREWSPACE_WORKSPACE_ID = workspaceId;
  if (workspaceRepoUrl) env.CREWSPACE_WORKSPACE_REPO_URL = workspaceRepoUrl;
  if (workspaceRepoRef) env.CREWSPACE_WORKSPACE_REPO_REF = workspaceRepoRef;
  if (agentHome) env.AGENT_HOME = agentHome;
  if (workspaceHints.length > 0) env.CREWSPACE_WORKSPACES_JSON = JSON.stringify(workspaceHints);

  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }

  const hasExplicitApiKey =
    typeof envConfig.CREWSPACE_API_KEY === "string" && envConfig.CREWSPACE_API_KEY.trim().length > 0;
  if (!hasExplicitApiKey && authToken) {
    env.CREWSPACE_API_KEY = authToken;
  }

  // Force Python UTF-8 mode on Windows so Kimi CLI doesn't crash when
  // outputting Unicode characters (emojis, CJK text, etc.).
  env.PYTHONIOENCODING = "utf-8";
  env.PYTHONUTF8 = "1";

  // Isolate Kimi share dir per agent to avoid concurrent write conflicts on
  // ~/.kimi/kimi.json when multiple agents run simultaneously.
  const kimiShareDir = path.join(os.tmpdir(), "crewspace-kimi", agent.companyId, agent.id);
  env.KIMI_SHARE_DIR = kimiShareDir;
  try {
    const defaultKimiDir = path.join(os.homedir(), ".kimi");
    const defaultConfigPath = path.join(defaultKimiDir, "config.toml");
    const agentConfigPath = path.join(kimiShareDir, "config.toml");
    const defaultConfigExists = await fs.stat(defaultConfigPath).then(() => true).catch(() => false);
    const agentConfigExists = await fs.stat(agentConfigPath).then(() => true).catch(() => false);
    if (defaultConfigExists) {
      await fs.mkdir(kimiShareDir, { recursive: true });
      if (!agentConfigExists) {
        await fs.copyFile(defaultConfigPath, agentConfigPath);
      }
      // Always sync auth credentials so isolated share dir can authenticate.
      const defaultCredentialsDir = path.join(defaultKimiDir, "credentials");
      const agentCredentialsDir = path.join(kimiShareDir, "credentials");
      const defaultCredentialsExists = await fs.stat(defaultCredentialsDir).then(() => true).catch(() => false);
      if (defaultCredentialsExists) {
        await fs.mkdir(agentCredentialsDir, { recursive: true });
        for (const entry of await fs.readdir(defaultCredentialsDir, { withFileTypes: true })) {
          const src = path.join(defaultCredentialsDir, entry.name);
          const dst = path.join(agentCredentialsDir, entry.name);
          if (entry.isFile()) {
            await fs.copyFile(src, dst);
          }
        }
      }
      const defaultKimiJson = path.join(defaultKimiDir, "kimi.json");
      const agentKimiJson = path.join(kimiShareDir, "kimi.json");
      const defaultKimiJsonExists = await fs.stat(defaultKimiJson).then(() => true).catch(() => false);
      if (defaultKimiJsonExists) {
        await fs.copyFile(defaultKimiJson, agentKimiJson);
      }
    }
  } catch {
    // Best-effort config copy; Kimi will create defaults if missing.
  }

  const runtimeEnv = Object.fromEntries(
    Object.entries(ensurePathInEnv({ ...process.env, ...env })).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

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

  await ensureCommandResolvable(command, cwd, runtimeEnv);
  const resolvedCommand = await resolveCommandForLogs(command, cwd, runtimeEnv);
  const loggedEnv = buildInvocationEnvForLogs(env, {
    runtimeEnv,
    includeRuntimeKeys: ["HOME"],
    resolvedCommand,
  });

  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 20);
  const extraArgs = (() => {
    const fromExtraArgs = asStringArray(config.extraArgs);
    if (fromExtraArgs.length > 0) return fromExtraArgs;
    return asStringArray(config.args);
  })();
  // Default true for automated agent runs; --print mode has no TTY,
  // so any tool-call approval prompt hangs forever.
  const skipPermissions = asBoolean(config.dangerouslySkipPermissions, true);

  const runtimeSessionParams = parseObject(runtime.sessionParams);
  const runtimeSessionId = asString(runtimeSessionParams.sessionId, runtime.sessionId ?? "");
  const runtimeSessionCwd = asString(runtimeSessionParams.cwd, "");
  const canResumeSession =
    runtimeSessionId.length > 0 &&
    (runtimeSessionCwd.length === 0 || path.resolve(runtimeSessionCwd) === path.resolve(cwd));
  const sessionId = canResumeSession ? runtimeSessionId : null;
  if (runtimeSessionId && !canResumeSession) {
    await onLog(
      "stdout",
      `[crewspace] Kimi session "${runtimeSessionId}" was saved for cwd "${runtimeSessionCwd}" and will not be resumed in "${cwd}".\n`,
    );
  }

  const instructionsFilePath = asString(config.instructionsFilePath, "").trim();
  const resolvedInstructionsFilePath = instructionsFilePath
    ? path.resolve(cwd, instructionsFilePath)
    : "";
  const instructionsDir = resolvedInstructionsFilePath ? `${path.dirname(resolvedInstructionsFilePath)}/` : "";
  let instructionsPrefix = "";
  if (resolvedInstructionsFilePath) {
    try {
      const instructionsContents = await fs.readFile(resolvedInstructionsFilePath, "utf8");
      instructionsPrefix =
        `${instructionsContents}\n\n` +
        `The above agent instructions were loaded from ${resolvedInstructionsFilePath}. ` +
        `Resolve any relative file references from ${instructionsDir}.\n\n`;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await onLog(
        "stdout",
        `[crewspace] Warning: could not read agent instructions file "${resolvedInstructionsFilePath}": ${reason}\n`,
      );
    }
  }

  const commandNotes = (() => {
    const notes: string[] = [];
    if (!resolvedInstructionsFilePath) return notes;
    if (instructionsPrefix.length > 0) {
      notes.push(`Loaded agent instructions from ${resolvedInstructionsFilePath}`);
      notes.push(
        `Prepended instructions + path directive to stdin prompt (relative references from ${instructionsDir}).`,
      );
      return notes;
    }
    notes.push(
      `Configured instructionsFilePath ${resolvedInstructionsFilePath}, but file could not be read; continuing without injected instructions.`,
    );
    return notes;
  })();

  const bootstrapPromptTemplate = asString(config.bootstrapPromptTemplate, "");
  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  };
  const renderedPrompt = renderTemplate(promptTemplate, templateData);
  const renderedBootstrapPrompt =
    !sessionId && bootstrapPromptTemplate.trim().length > 0
      ? renderTemplate(bootstrapPromptTemplate, templateData).trim()
      : "";
  const sessionHandoffNote = asString(context.crewspaceSessionHandoffMarkdown, "").trim();
  const prompt = joinPromptSections([
    instructionsPrefix,
    renderedBootstrapPrompt,
    sessionHandoffNote,
    renderedPrompt,
  ]);
  const promptMetrics = {
    promptChars: prompt.length,
    instructionsChars: instructionsPrefix.length,
    bootstrapPromptChars: renderedBootstrapPrompt.length,
    sessionHandoffChars: sessionHandoffNote.length,
    heartbeatPromptChars: renderedPrompt.length,
  };

  const buildArgs = (resumeSessionId: string | null) => {
    const args = ["--print", "--output-format", "stream-json", "--input-format", "text"];
    if (resumeSessionId) args.push("--resume", resumeSessionId);
    if (model) args.push("--model", model);
    if (skipPermissions) args.push("--yolo");
    if (extraArgs.length > 0) args.push(...extraArgs);
    return args;
  };

  const runAttempt = async (resumeSessionId: string | null) => {
    const args = buildArgs(resumeSessionId);
    if (onMeta) {
      await onMeta({
        adapterType: "kimi_local",
        command: resolvedCommand,
        cwd,
        commandNotes,
        commandArgs: [...args, `<stdin prompt ${prompt.length} chars>`],
        env: loggedEnv,
        prompt,
        promptMetrics,
        context,
      });
    }

    // Intercept stderr in real-time to strip loguru internal errors before they reach the transcript.
    // Loguru blocks may span multiple chunks, so we maintain state across data events.
    let stderrBuffer = "";
    let inLoguruBlock = false;

    const wrappedOnLog = async (stream: "stdout" | "stderr", chunk: string) => {
      if (stream === "stdout") {
        await onLog(stream, chunk);
        return;
      }

      stderrBuffer += chunk;
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop() ?? ""; // keep trailing partial line

      const outLines: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("--- Logging error in Loguru") || trimmed === "Traceback (most recent call last):") {
          inLoguruBlock = true;
          continue;
        }
        if (trimmed === "--- End of logging error ---") {
          inLoguruBlock = false;
          continue;
        }
        if (!inLoguruBlock) {
          outLines.push(line);
        }
      }

      if (outLines.length > 0) {
        await onLog(stream, outLines.join("\n") + "\n");
      }
    };

    const proc = await runChildProcess(runId, command, args, {
      cwd,
      env: runtimeEnv,
      stdin: prompt,
      timeoutSec,
      graceSec,
      onSpawn,
      onLog: wrappedOnLog,
    });

    // Flush any remaining buffered stderr
    if (stderrBuffer && !inLoguruBlock) {
      await onLog("stderr", stderrBuffer);
    }

    const cleanedStderr = cleanKimiStderr(proc.stderr);
    return {
      proc: { ...proc, stderr: cleanedStderr },
      rawStderr: cleanedStderr,
      parsed: parseKimiJsonl(proc.stdout, cleanedStderr),
    };
  };

  const toResult = (
    attempt: {
      proc: { exitCode: number | null; signal: string | null; timedOut: boolean; stdout: string; stderr: string };
      rawStderr: string;
      parsed: ReturnType<typeof parseKimiJsonl>;
    },
    clearSessionOnMissingSession = false,
  ): AdapterExecutionResult => {
    const loginMeta = detectKimiLoginRequired({
      stdout: attempt.proc.stdout,
      stderr: attempt.proc.stderr,
    });
    const errorMeta =
      loginMeta.loginUrl != null
        ? {
            loginUrl: loginMeta.loginUrl,
          }
        : undefined;

    if (attempt.proc.timedOut) {
      return {
        exitCode: attempt.proc.exitCode,
        signal: attempt.proc.signal,
        timedOut: true,
        errorMessage: `Timed out after ${timeoutSec}s`,
        clearSession: clearSessionOnMissingSession,
        errorCode: loginMeta.requiresLogin ? "kimi_auth_required" : null,
        errorMeta,
      };
    }

    const resolvedSessionId =
      attempt.parsed.sessionId ??
      (clearSessionOnMissingSession ? null : runtimeSessionId ?? runtime.sessionId ?? null);
    const resolvedSessionParams = resolvedSessionId
      ? ({
          sessionId: resolvedSessionId,
          cwd,
          ...(workspaceId ? { workspaceId } : {}),
          ...(workspaceRepoUrl ? { repoUrl: workspaceRepoUrl } : {}),
          ...(workspaceRepoRef ? { repoRef: workspaceRepoRef } : {}),
        } as Record<string, unknown>)
      : null;

    const parsedError = typeof attempt.parsed.errorMessage === "string" ? attempt.parsed.errorMessage.trim() : "";
    const stderrLine = firstNonEmptyLine(attempt.proc.stderr);
    const rawExitCode = attempt.proc.exitCode;
    const synthesizedExitCode = parsedError && (rawExitCode ?? 0) === 0 ? 1 : rawExitCode;
    const fallbackErrorMessage =
      parsedError ||
      stderrLine ||
      `Kimi exited with code ${synthesizedExitCode ?? -1}`;
    const modelId = model || null;

    const clearSessionForMaxTurns = isKimiMaxTurnsResult(attempt.parsed.errorMessage);

    return {
      exitCode: synthesizedExitCode,
      signal: attempt.proc.signal,
      timedOut: false,
      errorMessage: (synthesizedExitCode ?? 0) === 0 ? null : fallbackErrorMessage,
      errorCode: loginMeta.requiresLogin ? "kimi_auth_required" : null,
      errorMeta,
      usage: {
        inputTokens: attempt.parsed.usage.inputTokens,
        outputTokens: attempt.parsed.usage.outputTokens,
        cachedInputTokens: attempt.parsed.usage.cachedInputTokens,
      },
      sessionId: resolvedSessionId,
      sessionParams: resolvedSessionParams,
      sessionDisplayId: resolvedSessionId,
      provider: parseModelProvider(modelId),
      biller: resolveKimiBiller(runtimeEnv, parseModelProvider(modelId)),
      model: modelId,
      billingType,
      costUsd: attempt.parsed.costUsd,
      resultJson: {
        stdout: attempt.proc.stdout,
        stderr: attempt.proc.stderr,
      },
      summary: attempt.parsed.summary,
      clearSession: clearSessionForMaxTurns || Boolean(clearSessionOnMissingSession && !attempt.parsed.sessionId),
    };
  };

  const initial = await runAttempt(sessionId);
  const initialHasError =
    initial.proc.timedOut ||
    (initial.proc.exitCode ?? 0) !== 0 ||
    Boolean(initial.parsed.errorMessage);

  // Unknown session → retry once immediately with a fresh session.
  if (
    sessionId &&
    initialHasError &&
    isKimiUnknownSessionError(initial.proc.stdout, initial.rawStderr)
  ) {
    await onLog(
      "stdout",
      `[crewspace] Kimi session "${sessionId}" is unavailable; retrying with a fresh session.\n`,
    );
    const retry = await runAttempt(null);
    return toResult(retry, true);
  }

  // ── Generic session-resume retry loop ──────────────────────────────
  // If a session fails with any error (disconnect, transient failure, etc.)
  // retry resuming the same session up to 3 times with 60-second delays.
  const MAX_SESSION_RETRIES = 3;
  const SESSION_RETRY_INTERVAL_MS = 60_000;

  if (sessionId && initialHasError) {
    const initialLoginMeta = detectKimiLoginRequired({
      stdout: initial.proc.stdout,
      stderr: initial.proc.stderr,
    });
    const isPermanentFailure =
      initialLoginMeta.requiresLogin || isKimiMaxTurnsResult(initial.parsed.errorMessage);

    if (!isPermanentFailure) {
      let lastAttempt = initial;
      for (let attempt = 1; attempt <= MAX_SESSION_RETRIES; attempt++) {
        await onLog(
          "stdout",
          `[crewspace] Kimi session "${sessionId}" failed (exit=${initial.proc.exitCode ?? "null"}, err=${initial.parsed.errorMessage ?? "none"}); waiting ${SESSION_RETRY_INTERVAL_MS / 1000}s before retry ${attempt}/${MAX_SESSION_RETRIES}...\n`,
        );
        await new Promise((r) => setTimeout(r, SESSION_RETRY_INTERVAL_MS));

        const retry = await runAttempt(sessionId);
        const retryHasError =
          retry.proc.timedOut ||
          (retry.proc.exitCode ?? 0) !== 0 ||
          Boolean(retry.parsed.errorMessage);

        if (!retryHasError) {
          await onLog(
            "stdout",
            `[crewspace] Kimi session "${sessionId}" resumed successfully on retry ${attempt}/${MAX_SESSION_RETRIES}.\n`,
          );
          return toResult(retry);
        }

        lastAttempt = retry;

        // Stop retrying if the session became unknown or auth is required
        if (isKimiUnknownSessionError(retry.proc.stdout, retry.rawStderr)) {
          await onLog(
            "stdout",
            `[crewspace] Kimi session "${sessionId}" became unavailable during retry; giving up.\n`,
          );
          break;
        }
        const retryLoginMeta = detectKimiLoginRequired({
          stdout: retry.proc.stdout,
          stderr: retry.proc.stderr,
        });
        if (retryLoginMeta.requiresLogin) {
          await onLog(
            "stdout",
            `[crewspace] Kimi auth required during retry; giving up.\n`,
          );
          break;
        }
        if (isKimiMaxTurnsResult(retry.parsed.errorMessage)) {
          await onLog(
            "stdout",
            `[crewspace] Kimi max turns reached during retry; giving up.\n`,
          );
          break;
        }
      }
      return toResult(lastAttempt);
    }
  }

  return toResult(initial);
}
