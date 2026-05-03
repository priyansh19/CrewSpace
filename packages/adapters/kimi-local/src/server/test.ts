import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@crewspaceai/adapter-utils";
import {
  asString,
  asBoolean,
  asStringArray,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@crewspaceai/adapter-utils/server-utils";
import path from "node:path";
import { parseKimiJsonl } from "./parse.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function commandLooksLike(command: string, expected: string): boolean {
  const base = path.basename(command).toLowerCase();
  return base === expected || base === `${expected}.cmd` || base === `${expected}.exe`;
}

function summarizeProbeDetail(stdout: string, stderr: string, parsedError: string | null): string | null {
  const raw = parsedError?.trim() || firstNonEmptyLine(stderr) || firstNonEmptyLine(stdout);
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  const max = 240;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

const KIMI_AUTH_REQUIRED_RE =
  /(?:not\s+logged\s+in|login\s+required|authentication\s+required|unauthorized|invalid(?:\s+or\s+missing)?\s+api(?:[_\s-]?key)?|api[_\s-]?key.*required|please\s+run\s+`?kimi\s+login`?)/i;

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "kimi");
  const cwd = asString(config.cwd, process.cwd());

  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
    checks.push({
      code: "kimi_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "kimi_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
  }

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }
  const runtimeEnv = Object.fromEntries(
    Object.entries(ensurePathInEnv({ ...process.env, ...env })).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  try {
    await ensureCommandResolvable(command, cwd, runtimeEnv);
    checks.push({
      code: "kimi_command_resolvable",
      level: "info",
      message: `Command is executable: ${command}`,
    });
  } catch (err) {
    checks.push({
      code: "kimi_command_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "Command is not executable",
      detail: command,
    });
  }

  const configApiKey = env.KIMI_API_KEY || env.MOONSHOT_API_KEY;
  const hostApiKey = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY;
  if (isNonEmpty(configApiKey) || isNonEmpty(hostApiKey)) {
    const source = isNonEmpty(configApiKey) ? "adapter config env" : "server environment";
    checks.push({
      code: "kimi_api_key_present",
      level: "info",
      message: "KIMI_API_KEY or MOONSHOT_API_KEY is set for Kimi authentication.",
      detail: `Detected in ${source}.`,
    });
  } else {
    checks.push({
      code: "kimi_api_key_missing",
      level: "warn",
      message: "KIMI_API_KEY / MOONSHOT_API_KEY not set. Kimi runs may fail until authentication is configured.",
      hint: "Set KIMI_API_KEY or MOONSHOT_API_KEY in adapter env or shell environment, or run `kimi login`.",
    });
  }

  const canRunProbe =
    checks.every((check) => check.code !== "kimi_cwd_invalid" && check.code !== "kimi_command_unresolvable");
  if (canRunProbe) {
    if (!commandLooksLike(command, "kimi")) {
      checks.push({
        code: "kimi_hello_probe_skipped_custom_command",
        level: "info",
        message: "Skipped hello probe because command is not `kimi`.",
        detail: command,
        hint: "Use the `kimi` CLI command to run the automatic probe.",
      });
    } else {
      const model = asString(config.model, "").trim();
      const skipPermissions = asBoolean(config.dangerouslySkipPermissions, false);
      const extraArgs = (() => {
        const fromExtraArgs = asStringArray(config.extraArgs);
        if (fromExtraArgs.length > 0) return fromExtraArgs;
        return asStringArray(config.args);
      })();

      const args = ["--print", "--output-format", "stream-json", "--input-format", "text"];
      if (skipPermissions) args.push("--yolo");
      if (model) args.push("--model", model);
      if (extraArgs.length > 0) args.push(...extraArgs);

      const probe = await runChildProcess(
        `kimi-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        command,
        args,
        {
          cwd,
          env: runtimeEnv,
          timeoutSec: 45,
          graceSec: 5,
          stdin: "Respond with hello.",
          onLog: async () => {},
        },
      );
      const parsed = parseKimiJsonl(probe.stdout, probe.stderr);
      const detail = summarizeProbeDetail(probe.stdout, probe.stderr, parsed.errorMessage);
      const authEvidence = `${parsed.errorMessage ?? ""}\n${probe.stdout}\n${probe.stderr}`.trim();

      if (probe.timedOut) {
        checks.push({
          code: "kimi_hello_probe_timed_out",
          level: "warn",
          message: "Kimi hello probe timed out.",
          hint: "Retry the probe. If this persists, verify Kimi can run `Respond with hello` from this directory manually.",
        });
      } else if ((probe.exitCode ?? 1) === 0) {
        const summary = parsed.summary.trim();
        const hasHello = /\bhello\b/i.test(summary);
        checks.push({
          code: hasHello ? "kimi_hello_probe_passed" : "kimi_hello_probe_unexpected_output",
          level: hasHello ? "info" : "warn",
          message: hasHello
            ? "Kimi hello probe succeeded."
            : "Kimi probe ran but did not return `hello` as expected.",
          ...(summary ? { detail: summary.replace(/\s+/g, " ").trim().slice(0, 240) } : {}),
          ...(hasHello
            ? {}
            : {
                hint: "Try the probe manually (`kimi run --format json -` then prompt: Respond with hello) to inspect full output.",
              }),
        });
      } else if (KIMI_AUTH_REQUIRED_RE.test(authEvidence)) {
        checks.push({
          code: "kimi_hello_probe_auth_required",
          level: "warn",
          message: "Kimi CLI is installed, but authentication is not ready.",
          ...(detail ? { detail } : {}),
          hint: "Configure MOONSHOT_API_KEY in adapter env/shell, then retry the probe.",
        });
      } else {
        checks.push({
          code: "kimi_hello_probe_failed",
          level: "error",
          message: "Kimi hello probe failed.",
          ...(detail ? { detail } : {}),
          hint: "Run `kimi run --format json -` manually in this working directory and prompt `Respond with hello` to debug.",
        });
      }
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
