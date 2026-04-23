import type { UIAdapterModule } from "../types";
import { parseCodexStdoutLine } from "@crewspaceai/adapter-codex-local/ui";
import { LmStudioLocalConfigFields } from "./config-fields";
import { buildLmStudioLocalConfig } from "./build-config";

export const lmStudioLocalUIAdapter: UIAdapterModule = {
  type: "lmstudio_local",
  label: "LM Studio (Local)",
  parseStdoutLine: parseCodexStdoutLine,
  ConfigFields: LmStudioLocalConfigFields,
  buildAdapterConfig: buildLmStudioLocalConfig,
};
