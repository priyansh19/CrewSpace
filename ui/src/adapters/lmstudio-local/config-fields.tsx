import type { AdapterConfigFieldsProps } from "../types";
import { Field, DraftInput, help } from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function LmStudioLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field
        label="LM Studio URL"
        hint={help(
          "Base URL of your LM Studio server. For Docker, use host.docker.internal instead of localhost.",
        )}
      >
        <DraftInput
          value={
            isCreate
              ? values!.url ?? "http://localhost:1234"
              : eff("adapterConfig", "baseUrl", String(config.baseUrl ?? "http://localhost:1234"))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ url: v })
              : mark("adapterConfig", "baseUrl", v || "http://localhost:1234")
          }
          immediate
          className={inputClass}
          placeholder="http://localhost:1234"
        />
      </Field>
      <Field
        label="API key"
        hint={help("Optional API key for LM Studio. Leave empty if no key is configured.")}
      >
        <input
          type="password"
          autoComplete="off"
          defaultValue={
            isCreate
              ? ""
              : (() => {
                  const raw = config.apiKey;
                  if (typeof raw === "string") return raw;
                  if (typeof raw === "object" && raw !== null)
                    return String((raw as { value?: unknown }).value ?? "");
                  return "";
                })()
          }
          onBlur={(e) => {
            if (!isCreate) {
              const v = e.target.value.trim();
              mark("adapterConfig", "apiKey", v ? { type: "plain", value: v } : undefined);
            }
          }}
          className={inputClass}
          placeholder="Leave empty if LM Studio has no key set"
        />
      </Field>
    </>
  );
}
