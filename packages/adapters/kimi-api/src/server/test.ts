import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@crewspaceai/adapter-utils";
import { asString, parseObject } from "@crewspaceai/adapter-utils/server-utils";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const DEFAULT_BASE_URL = "https://api.moonshot.cn/v1";

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const baseUrl = asString(config.baseUrl, DEFAULT_BASE_URL).replace(/\/$/, "");

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }

  const apiKey = env.MOONSHOT_API_KEY || env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY;

  if (isNonEmpty(apiKey)) {
    checks.push({
      code: "kimi_api_key_present",
      level: "info",
      message: "MOONSHOT_API_KEY / KIMI_API_KEY is set for Kimi API authentication.",
    });
  } else {
    checks.push({
      code: "kimi_api_key_missing",
      level: "error",
      message: "MOONSHOT_API_KEY / KIMI_API_KEY is not set. Kimi API adapter cannot run without an API key.",
      hint: "Set MOONSHOT_API_KEY in adapter env or shell environment.",
    });
  }

  const model = asString(config.model, "kimi-k2").trim();

  if (isNonEmpty(apiKey)) {
    try {
      const res = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
      });

      if (res.ok) {
        checks.push({
          code: "kimi_api_models_list_ok",
          level: "info",
          message: `Moonshot API is reachable. Model ${model} will be used.`,
        });
      } else {
        const text = await res.text().catch(() => "Unknown error");
        let msg = text;
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>;
          const errObj = parsed.error as Record<string, unknown> | undefined;
          msg = String(errObj?.message ?? text);
        } catch {
          // ignore
        }
        checks.push({
          code: "kimi_api_models_list_failed",
          level: "error",
          message: `Moonshot API returned error ${res.status}: ${msg}`,
          hint: "Verify your API key and base URL are correct.",
        });
      }
    } catch (err) {
      checks.push({
        code: "kimi_api_unreachable",
        level: "error",
        message: err instanceof Error ? err.message : "Failed to reach Moonshot API.",
        hint: "Check network connectivity and base URL configuration.",
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
