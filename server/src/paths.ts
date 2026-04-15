import fs from "node:fs";
import path from "node:path";
import { resolveDefaultConfigPath } from "./home-paths.js";

const CREWSPACE_CONFIG_BASENAME = "config.json";
const CREWSPACE_ENV_FILENAME = ".env";

function findConfigFileFromAncestors(startDir: string): string | null {
  const absoluteStartDir = path.resolve(startDir);
  let currentDir = absoluteStartDir;

  while (true) {
    const candidate = path.resolve(currentDir, ".crewspace", CREWSPACE_CONFIG_BASENAME);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const nextDir = path.resolve(currentDir, "..");
    if (nextDir === currentDir) break;
    currentDir = nextDir;
  }

  return null;
}

export function resolveCrewSpaceConfigPath(overridePath?: string): string {
  if (overridePath) return path.resolve(overridePath);
  if (process.env.CREWSPACE_CONFIG) return path.resolve(process.env.CREWSPACE_CONFIG);
  return findConfigFileFromAncestors(process.cwd()) ?? resolveDefaultConfigPath();
}

export function resolveCrewSpaceEnvPath(overrideConfigPath?: string): string {
  return path.resolve(path.dirname(resolveCrewSpaceConfigPath(overrideConfigPath)), CREWSPACE_ENV_FILENAME);
}
