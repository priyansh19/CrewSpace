import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import type {
  AdapterSkillContext,
  AdapterSkillEntry,
  AdapterSkillSnapshot,
} from "@crewspaceai/adapter-utils";
import {
  readCrewSpaceRuntimeSkillEntries,
  resolveCrewSpaceDesiredSkillNames,
  ensureCrewSpaceSkillSymlink,
  removeMaintainerOnlySkillSymlinks,
} from "@crewspaceai/adapter-utils/server-utils";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

function resolveKimiSkillsHome(): string {
  const kimiHome = process.env.KIMI_HOME || path.join(os.homedir(), ".kimi");
  return path.join(kimiHome, "skills");
}

export async function ensureKimiSkillsInjected(
  onLog: import("@crewspaceai/adapter-utils").AdapterExecutionContext["onLog"],
  skillsEntries: Array<{ key: string; runtimeName: string; source: string }>,
  desiredSkillNames?: string[],
) {
  const skillsHome = resolveKimiSkillsHome();
  await fs.mkdir(skillsHome, { recursive: true });
  const desiredSet = new Set(desiredSkillNames ?? skillsEntries.map((entry) => entry.key));
  const selectedEntries = skillsEntries.filter((entry) => desiredSet.has(entry.key));
  const removedSkills = await removeMaintainerOnlySkillSymlinks(
    skillsHome,
    selectedEntries.map((entry) => entry.runtimeName),
  );
  for (const skillName of removedSkills) {
    await onLog(
      "stderr",
      `[crewspace] Removed maintainer-only Kimi skill "${skillName}" from ${skillsHome}\n`,
    );
  }
  for (const entry of selectedEntries) {
    const target = path.join(skillsHome, entry.runtimeName);
    try {
      const result = await ensureCrewSpaceSkillSymlink(entry.source, target);
      if (result === "skipped") continue;
      await onLog(
        "stderr",
        `[crewspace] ${result === "repaired" ? "Repaired" : "Injected"} Kimi skill "${entry.key}" into ${skillsHome}\n`,
      );
    } catch (err) {
      await onLog(
        "stderr",
        `[crewspace] Failed to inject Kimi skill "${entry.key}" into ${skillsHome}: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }
}

async function buildKimiSkillSnapshot(
  config: Record<string, unknown>,
): Promise<AdapterSkillSnapshot> {
  const availableEntries = await readCrewSpaceRuntimeSkillEntries(config, __moduleDir);
  const availableByKey = new Map(availableEntries.map((entry) => [entry.key, entry]));
  const desiredSkills = resolveCrewSpaceDesiredSkillNames(config, availableEntries);
  const desiredSet = new Set(desiredSkills);
  const entries: AdapterSkillEntry[] = availableEntries.map((entry) => ({
    key: entry.key,
    runtimeName: entry.runtimeName,
    desired: desiredSet.has(entry.key),
    managed: true,
    state: desiredSet.has(entry.key) ? "configured" : "available",
    origin: entry.required ? "crewspace_required" : "company_managed",
    originLabel: entry.required ? "Required by CrewSpace" : "Managed by CrewSpace",
    readOnly: false,
    sourcePath: entry.source,
    targetPath: null,
    detail: desiredSet.has(entry.key)
      ? "Will be linked into the effective KIMI_HOME/skills/ directory on the next run."
      : null,
    required: Boolean(entry.required),
    requiredReason: entry.requiredReason ?? null,
  }));
  const warnings: string[] = [];

  for (const desiredSkill of desiredSkills) {
    if (availableByKey.has(desiredSkill)) continue;
    warnings.push(`Desired skill "${desiredSkill}" is not available from the CrewSpace skills directory.`);
    entries.push({
      key: desiredSkill,
      runtimeName: null,
      desired: true,
      managed: true,
      state: "missing",
      origin: "external_unknown",
      originLabel: "External or unavailable",
      readOnly: false,
      sourcePath: null,
      targetPath: null,
      detail: "CrewSpace cannot find this skill in the local runtime skills directory.",
    });
  }

  entries.sort((left, right) => left.key.localeCompare(right.key));

  return {
    adapterType: "kimi_local",
    supported: true,
    mode: "ephemeral",
    desiredSkills,
    entries,
    warnings,
  };
}

export async function listKimiSkills(ctx: AdapterSkillContext): Promise<AdapterSkillSnapshot> {
  return buildKimiSkillSnapshot(ctx.config);
}

export async function syncKimiSkills(
  ctx: AdapterSkillContext,
  _desiredSkills: string[],
): Promise<AdapterSkillSnapshot> {
  return buildKimiSkillSnapshot(ctx.config);
}

export function resolveKimiDesiredSkillNames(
  config: Record<string, unknown>,
  availableEntries: Array<{ key: string; required?: boolean }>,
) {
  return resolveCrewSpaceDesiredSkillNames(config, availableEntries);
}
