import type { UIAdapterModule } from "../types";
import { parseKimiApiStdoutLine } from "@crewspaceai/adapter-kimi-api/ui";
import { KimiApiConfigFields } from "./config-fields";
import { buildKimiApiConfig } from "@crewspaceai/adapter-kimi-api/ui";

export const kimiApiUIAdapter: UIAdapterModule = {
  type: "kimi_api",
  label: "Kimi (API)",
  parseStdoutLine: parseKimiApiStdoutLine,
  ConfigFields: KimiApiConfigFields,
  buildAdapterConfig: buildKimiApiConfig,
};
