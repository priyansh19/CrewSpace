import fs from "node:fs";
import { crewspaceConfigSchema, type CrewSpaceConfig } from "@crewspaceai/shared";
import { resolveCrewSpaceConfigPath } from "./paths.js";

export function readConfigFile(): CrewSpaceConfig | null {
  const configPath = resolveCrewSpaceConfigPath();

  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return crewspaceConfigSchema.parse(raw);
  } catch {
    return null;
  }
}
