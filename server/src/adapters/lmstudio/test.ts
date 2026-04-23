import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { asString, parseObject } from "../utils.js";
import { resolveLmStudioBaseUrl, listLmStudioModels } from "../lmstudio-models.js";

const LM_STUDIO_PROBE_TIMEOUT_MS = 8000;

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((c) => c.level === "error")) return "fail";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "pass";
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const configBaseUrl = asString(config.baseUrl, "");

  const baseUrl = resolveLmStudioBaseUrl(configBaseUrl);

  if (!baseUrl) {
    checks.push({
      code: "lmstudio_url_missing",
      level: "error",
      message: "LM Studio URL is not configured.",
      hint: "Set the LM Studio URL in the adapter config or set LM_STUDIO_URL in the server environment.",
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(normalizeBaseUrl(baseUrl));
  } catch {
    checks.push({
      code: "lmstudio_url_invalid",
      level: "error",
      message: `Invalid LM Studio URL: ${baseUrl}`,
      hint: "Use a valid http:// URL, e.g. http://localhost:1234",
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    checks.push({
      code: "lmstudio_url_protocol_invalid",
      level: "error",
      message: `Unsupported URL protocol: ${parsedUrl.protocol}`,
      hint: "Use an http:// or https:// URL.",
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  checks.push({
    code: "lmstudio_url_configured",
    level: "info",
    message: `LM Studio URL configured: ${normalizeBaseUrl(baseUrl)}`,
  });

  // Probe /v1/models to verify LM Studio is reachable and has models loaded
  const modelsEndpoint = `${normalizeBaseUrl(baseUrl)}/v1/models`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LM_STUDIO_PROBE_TIMEOUT_MS);

  let models: { id: string; label: string }[] = [];
  try {
    const response = await fetch(modelsEndpoint, {
      headers: { Authorization: "Bearer lm-studio" },
      signal: controller.signal,
    });

    if (!response.ok) {
      checks.push({
        code: "lmstudio_models_endpoint_error",
        level: "error",
        message: `LM Studio /v1/models returned HTTP ${response.status}.`,
        hint: "Verify LM Studio is running and the URL is correct.",
      });
    } else {
      models = await listLmStudioModels(configBaseUrl);

      if (models.length === 0) {
        checks.push({
          code: "lmstudio_no_models_loaded",
          level: "warn",
          message: "LM Studio is reachable but no models are loaded.",
          hint: "Load a model in LM Studio before running agents.",
        });
      } else {
        const modelNames = models
          .slice(0, 3)
          .map((m) => m.id)
          .join(", ");
        checks.push({
          code: "lmstudio_models_available",
          level: "info",
          message: `LM Studio is running with ${models.length} model(s) available: ${modelNames}${models.length > 3 ? "…" : ""}.`,
        });
      }
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    checks.push({
      code: isTimeout ? "lmstudio_connection_timeout" : "lmstudio_connection_failed",
      level: "error",
      message: isTimeout
        ? `Connection to LM Studio timed out (${LM_STUDIO_PROBE_TIMEOUT_MS / 1000}s).`
        : `Could not connect to LM Studio: ${err instanceof Error ? err.message : String(err)}`,
      hint: "Ensure LM Studio is running and the server is accessible from the CrewSpace host. For Docker, use host.docker.internal instead of localhost.",
    });
  } finally {
    clearTimeout(timeout);
  }

  // If models are loaded, run a quick chat completion probe
  if (models.length > 0) {
    const selectedModel = asString(config.model, "").trim() || models[0]?.id;
    if (selectedModel) {
      const completionEndpoint = `${normalizeBaseUrl(baseUrl)}/v1/chat/completions`;
      const probeController = new AbortController();
      const probeTimeout = setTimeout(() => probeController.abort(), LM_STUDIO_PROBE_TIMEOUT_MS);
      try {
        const probeResponse = await fetch(completionEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer lm-studio",
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: "user", content: "Respond with hello." }],
            max_tokens: 20,
            temperature: 0,
          }),
          signal: probeController.signal,
        });

        if (probeResponse.ok) {
          const data = (await probeResponse.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
          const hasHello = /\bhello\b/i.test(reply);
          checks.push({
            code: hasHello ? "lmstudio_probe_passed" : "lmstudio_probe_unexpected_output",
            level: hasHello ? "info" : "warn",
            message: hasHello
              ? `LM Studio model responded correctly (model: ${selectedModel}).`
              : `LM Studio model responded but did not include "hello" (model: ${selectedModel}).`,
            ...(reply ? { detail: reply.slice(0, 200) } : {}),
          });
        } else {
          checks.push({
            code: "lmstudio_probe_http_error",
            level: "warn",
            message: `LM Studio chat completion returned HTTP ${probeResponse.status}.`,
            hint: `Verify model "${selectedModel}" is loaded and compatible.`,
          });
        }
      } catch (err) {
        const isTimeout = err instanceof Error && err.name === "AbortError";
        checks.push({
          code: isTimeout ? "lmstudio_probe_timeout" : "lmstudio_probe_failed",
          level: "warn",
          message: isTimeout
            ? "LM Studio chat completion probe timed out."
            : `LM Studio chat completion probe failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        clearTimeout(probeTimeout);
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
