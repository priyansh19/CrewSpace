import type { AdapterConfigFieldsProps } from "../types";
import { Field, DraftInput } from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function KimiApiConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
  models,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field label="Model" hint="Kimi model to use for API calls.">
        <select
          className={inputClass}
          value={isCreate ? values!.model : eff("adapterConfig", "model", String(config.model ?? ""))}
          onChange={(e) =>
            isCreate
              ? set!({ model: e.target.value })
              : mark("adapterConfig", "model", e.target.value || undefined)
          }
        >
          <option value="">{models.length > 0 ? "Select a model..." : "No models available"}</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Base URL" hint="Optional. Defaults to https://api.moonshot.cn/v1">
        <DraftInput
          value={
            isCreate
              ? ((values!.baseUrl as string) ?? "")
              : eff("adapterConfig", "baseUrl", String(config.baseUrl ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ baseUrl: v })
              : mark("adapterConfig", "baseUrl", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="https://api.moonshot.cn/v1"
        />
      </Field>

      <Field label="Temperature" hint="Optional. Sampling temperature from 0 to 2.">
        <DraftInput
          value={
            isCreate
              ? (values!.temperature ?? "")
              : eff("adapterConfig", "temperature", String(config.temperature ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ temperature: v })
              : mark("adapterConfig", "temperature", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="0.7"
        />
      </Field>

      <Field label="Max tokens" hint="Optional. Maximum number of tokens to generate.">
        <DraftInput
          value={
            isCreate
              ? (values!.maxTokens ?? "")
              : eff("adapterConfig", "maxTokens", String(config.maxTokens ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ maxTokens: v })
              : mark("adapterConfig", "maxTokens", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="4096"
        />
      </Field>
    </>
  );
}
