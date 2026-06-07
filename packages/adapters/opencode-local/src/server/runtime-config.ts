import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { asBoolean, asString } from "@crewspaceai/adapter-utils/server-utils";

type PreparedOpenCodeRuntimeConfig = {
  env: Record<string, string>;
  notes: string[];
  cleanup: () => Promise<void>;
};

function resolveXdgConfigHome(env: Record<string, string>): string {
  return (
    (typeof env.XDG_CONFIG_HOME === "string" && env.XDG_CONFIG_HOME.trim()) ||
    (typeof process.env.XDG_CONFIG_HOME === "string" && process.env.XDG_CONFIG_HOME.trim()) ||
    path.join(os.homedir(), ".config")
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonObject(filepath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(filepath, "utf8");
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function resolveProviderName(config: Record<string, unknown>): string | null {
  const providerName = asString(config.providerName, "").trim();
  if (providerName) return providerName;
  const baseUrl = asString(config.baseUrl, "").trim();
  if (!baseUrl) return null;
  // Auto-detect provider name from base URL presets
  if (baseUrl.includes("integrate.api.nvidia.com")) return "nvidia";
  if (baseUrl.includes("localhost:11434")) return "ollama";
  if (baseUrl.includes("api.together.xyz")) return "together";
  if (baseUrl.includes("api.groq.com")) return "groq";
  if (baseUrl.includes("openrouter.ai")) return "openrouter";
  return "custom";
}

function resolveApiKeyEnvVar(env: Record<string, string>): string | null {
  // Prefer explicit provider keys, fallback to generic OpenAI key
  const candidates = [
    "NVIDIA_API_KEY",
    "NVAPI_KEY",
    "TOGETHER_API_KEY",
    "GROQ_API_KEY",
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
  ];
  for (const key of candidates) {
    if (env[key]?.trim()) return env[key].trim();
  }
  return null;
}

export async function prepareOpenCodeRuntimeConfig(input: {
  env: Record<string, string>;
  config: Record<string, unknown>;
}): Promise<PreparedOpenCodeRuntimeConfig> {
  const skipPermissions = asBoolean(input.config.dangerouslySkipPermissions, true);
  const baseUrl = asString(input.config.baseUrl, "").trim();
  const providerName = resolveProviderName(input.config);

  const sourceConfigDir = path.join(resolveXdgConfigHome(input.env), "opencode");
  const existingConfig = await readJsonObject(path.join(sourceConfigDir, "opencode.json"));
  const existingPermission = isPlainObject(existingConfig.permission)
    ? existingConfig.permission
    : {};

  const notes: string[] = [];
  const nextConfig: Record<string, unknown> = {
    ...existingConfig,
    permission: {
      ...existingPermission,
      external_directory: "allow",
    },
  };

  // Inject custom OpenAI-compatible provider config when baseUrl is set
  if (baseUrl && providerName) {
    const existingProviders = isPlainObject(existingConfig.providers)
      ? existingConfig.providers
      : {};
    const apiKey = resolveApiKeyEnvVar(input.env);
    const providerConfig: Record<string, unknown> = { base_url: baseUrl };
    if (apiKey) {
      providerConfig.api_key = apiKey;
      notes.push(`Injected runtime OpenCode provider "${providerName}" with base URL and API key.`);
    } else {
      notes.push(`Injected runtime OpenCode provider "${providerName}" with base URL (no API key in env).`);
    }
    nextConfig.providers = {
      ...existingProviders,
      [providerName]: providerConfig,
    };
  }

  const needsTempDir = skipPermissions || notes.length > 0;
  if (!needsTempDir) {
    // Nothing to inject and permissions not being overridden — return original env
    return {
      env: { ...input.env },
      notes: [],
      cleanup: async () => {},
    };
  }

  const runtimeConfigHome = await fs.mkdtemp(path.join(os.tmpdir(), "crewspace-opencode-config-"));
  const runtimeConfigDir = path.join(runtimeConfigHome, "opencode");
  const runtimeConfigPath = path.join(runtimeConfigDir, "opencode.json");

  await fs.mkdir(runtimeConfigDir, { recursive: true });
  try {
    await fs.cp(sourceConfigDir, runtimeConfigDir, {
      recursive: true,
      force: true,
      errorOnExist: false,
      dereference: false,
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException | null)?.code !== "ENOENT") {
      throw err;
    }
  }

  await fs.writeFile(runtimeConfigPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");

  return {
    env: {
      ...input.env,
      XDG_CONFIG_HOME: runtimeConfigHome,
    },
    notes: skipPermissions
      ? [
          "Injected runtime OpenCode config with permission.external_directory=allow to avoid headless approval prompts.",
          ...notes,
        ]
      : notes,
    cleanup: async () => {
      await fs.rm(runtimeConfigHome, { recursive: true, force: true });
    },
  };
}
