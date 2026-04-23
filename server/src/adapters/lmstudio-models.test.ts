import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listLmStudioModels,
  resolveLmStudioBaseUrl,
  resetLmStudioModelsCacheForTests,
  DEFAULT_LM_STUDIO_BASE_URL,
} from "./lmstudio-models.js";

describe("resolveLmStudioBaseUrl", () => {
  beforeEach(() => {
    delete process.env.LM_STUDIO_URL;
  });

  it("returns configBaseUrl when provided", () => {
    expect(resolveLmStudioBaseUrl("http://192.168.1.10:1234")).toBe("http://192.168.1.10:1234");
  });

  it("trims whitespace from configBaseUrl", () => {
    expect(resolveLmStudioBaseUrl("  http://localhost:1234  ")).toBe("http://localhost:1234");
  });

  it("falls back to LM_STUDIO_URL env var when config is empty", () => {
    process.env.LM_STUDIO_URL = "http://host.docker.internal:1234";
    expect(resolveLmStudioBaseUrl("")).toBe("http://host.docker.internal:1234");
  });

  it("returns null when neither config nor env is set", () => {
    expect(resolveLmStudioBaseUrl("")).toBeNull();
    expect(resolveLmStudioBaseUrl()).toBeNull();
  });

  it("prefers configBaseUrl over LM_STUDIO_URL env var", () => {
    process.env.LM_STUDIO_URL = "http://host.docker.internal:1234";
    expect(resolveLmStudioBaseUrl("http://localhost:1234")).toBe("http://localhost:1234");
  });
});

describe("listLmStudioModels", () => {
  beforeEach(() => {
    delete process.env.LM_STUDIO_URL;
    resetLmStudioModelsCacheForTests();
    vi.restoreAllMocks();
  });

  it("returns empty list when no URL is configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const models = await listLmStudioModels();
    expect(models).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches models from LM Studio /v1/models endpoint", async () => {
    process.env.LM_STUDIO_URL = "http://localhost:1234";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "llama-3.2-3b-instruct" },
          { id: "mistral-7b-instruct" },
        ],
      }),
    } as Response);

    const models = await listLmStudioModels();
    expect(models).toHaveLength(2);
    expect(models[0]).toEqual({ id: "llama-3.2-3b-instruct", label: "llama-3.2-3b-instruct" });
    expect(models[1]).toEqual({ id: "mistral-7b-instruct", label: "mistral-7b-instruct" });
  });

  it("uses configBaseUrl over LM_STUDIO_URL env var", async () => {
    process.env.LM_STUDIO_URL = "http://host.docker.internal:1234";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "llama-3.2" }] }),
    } as Response);

    await listLmStudioModels("http://localhost:1234");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost:1234"),
      expect.anything(),
    );
  });

  it("caches results for the same base URL", async () => {
    process.env.LM_STUDIO_URL = "http://localhost:1234";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "llama-3.2" }] }),
    } as Response);

    const first = await listLmStudioModels();
    const second = await listLmStudioModels();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it("returns empty list when LM Studio returns non-ok response", async () => {
    process.env.LM_STUDIO_URL = "http://localhost:1234";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    const models = await listLmStudioModels();
    expect(models).toEqual([]);
  });

  it("returns empty list when connection fails", async () => {
    process.env.LM_STUDIO_URL = "http://localhost:1234";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    const models = await listLmStudioModels();
    expect(models).toEqual([]);
  });

  it("deduplicates models with the same id", async () => {
    process.env.LM_STUDIO_URL = "http://localhost:1234";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "llama-3.2" },
          { id: "llama-3.2" },
          { id: "mistral-7b" },
        ],
      }),
    } as Response);

    const models = await listLmStudioModels();
    expect(models).toHaveLength(2);
    expect(models.map((m) => m.id)).toEqual(["llama-3.2", "mistral-7b"]);
  });

  it("strips trailing slash from base URL before appending /v1/models", async () => {
    process.env.LM_STUDIO_URL = "http://localhost:1234/";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    await listLmStudioModels();
    const calledUrl = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(calledUrl).toBe("http://localhost:1234/v1/models");
    expect(calledUrl).not.toContain("//v1");
  });
});
