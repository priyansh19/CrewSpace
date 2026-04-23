import type { AdapterModel } from "./types.js";

const LM_STUDIO_MODELS_TIMEOUT_MS = 5000;
const LM_STUDIO_MODELS_CACHE_TTL_MS = 60_000;

let cached: { baseUrl: string; expiresAt: number; models: AdapterModel[] } | null = null;

export const DEFAULT_LM_STUDIO_BASE_URL = "http://localhost:1234";

export function resolveLmStudioBaseUrl(configBaseUrl?: string): string | null {
  if (configBaseUrl && configBaseUrl.trim().length > 0) return configBaseUrl.trim();
  const envUrl = process.env.LM_STUDIO_URL?.trim();
  if (envUrl && envUrl.length > 0) return envUrl;
  return null;
}

function normalizeBaseUrl(baseUrl: string): string {
  // Strip trailing slash; /v1 is appended when calling the models endpoint
  return baseUrl.replace(/\/+$/, "");
}

function dedupeModels(models: AdapterModel[]): AdapterModel[] {
  const seen = new Set<string>();
  const deduped: AdapterModel[] = [];
  for (const model of models) {
    const id = model.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push({ id, label: model.label.trim() || id });
  }
  return deduped;
}

async function fetchLmStudioModels(baseUrl: string): Promise<AdapterModel[]> {
  const normalized = normalizeBaseUrl(baseUrl);
  const endpoint = `${normalized}/v1/models`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LM_STUDIO_MODELS_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: "Bearer lm-studio" },
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as { data?: unknown };
    const data = Array.isArray(payload.data) ? payload.data : [];
    const models: AdapterModel[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) continue;
      const id = (item as { id?: unknown }).id;
      if (typeof id !== "string" || id.trim().length === 0) continue;
      models.push({ id, label: id });
    }
    return dedupeModels(models);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function listLmStudioModels(configBaseUrl?: string): Promise<AdapterModel[]> {
  const baseUrl = resolveLmStudioBaseUrl(configBaseUrl);
  if (!baseUrl) return [];

  const normalized = normalizeBaseUrl(baseUrl);
  const now = Date.now();

  if (cached && cached.baseUrl === normalized && cached.expiresAt > now) {
    return cached.models;
  }

  const fetched = await fetchLmStudioModels(normalized);
  if (fetched.length > 0) {
    cached = { baseUrl: normalized, expiresAt: now + LM_STUDIO_MODELS_CACHE_TTL_MS, models: fetched };
    return fetched;
  }

  if (cached && cached.baseUrl === normalized && cached.models.length > 0) {
    return cached.models;
  }

  return [];
}

export function resetLmStudioModelsCacheForTests() {
  cached = null;
}
