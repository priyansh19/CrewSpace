import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listCursorSkills,
  syncCursorSkills,
} from "@crewspaceai/adapter-cursor-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createSkillDir(root: string, name: string) {
  const skillDir = path.join(root, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  return skillDir;
}

describe("cursor local skill sync", () => {
  const crewspaceKey = "crewspaceai/crewspace/crewspace";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("reports configured CrewSpace skills and installs them into the Cursor skills home", async () => {
    const home = await makeTempDir("crewspace-cursor-skill-sync-");
    cleanupDirs.add(home);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "cursor",
      config: {
        env: {
          HOME: home,
        },
        crewspaceSkillSync: {
          desiredSkills: [crewspaceKey],
        },
      },
    } as const;

    const before = await listCursorSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.desiredSkills).toContain(crewspaceKey);
    expect(before.entries.find((entry) => entry.key === crewspaceKey)?.required).toBe(true);
    expect(before.entries.find((entry) => entry.key === crewspaceKey)?.state).toBe("missing");

    const after = await syncCursorSkills(ctx, [crewspaceKey]);
    expect(after.entries.find((entry) => entry.key === crewspaceKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "crewspace"))).isSymbolicLink()).toBe(true);
  });

  it("recognizes company-library runtime skills supplied outside the bundled CrewSpace directory", async () => {
    const home = await makeTempDir("crewspace-cursor-runtime-skills-home-");
    const runtimeSkills = await makeTempDir("crewspace-cursor-runtime-skills-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);

    const crewspaceDir = await createSkillDir(runtimeSkills, "crewspace");
    const asciiHeartDir = await createSkillDir(runtimeSkills, "ascii-heart");

    const ctx = {
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "cursor",
      config: {
        env: {
          HOME: home,
        },
        crewspaceRuntimeSkills: [
          {
            key: "crewspace",
            runtimeName: "crewspace",
            source: crewspaceDir,
            required: true,
            requiredReason: "Bundled CrewSpace skills are always available for local adapters.",
          },
          {
            key: "ascii-heart",
            runtimeName: "ascii-heart",
            source: asciiHeartDir,
          },
        ],
        crewspaceSkillSync: {
          desiredSkills: ["ascii-heart"],
        },
      },
    } as const;

    const before = await listCursorSkills(ctx);
    expect(before.warnings).toEqual([]);
    expect(before.desiredSkills).toEqual(["crewspace", "ascii-heart"]);
    expect(before.entries.find((entry) => entry.key === "ascii-heart")?.state).toBe("missing");

    const after = await syncCursorSkills(ctx, ["ascii-heart"]);
    expect(after.warnings).toEqual([]);
    expect(after.entries.find((entry) => entry.key === "ascii-heart")?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "ascii-heart"))).isSymbolicLink()).toBe(true);
  });

  it("keeps required bundled CrewSpace skills installed even when the desired set is emptied", async () => {
    const home = await makeTempDir("crewspace-cursor-skill-prune-");
    cleanupDirs.add(home);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "cursor",
      config: {
        env: {
          HOME: home,
        },
        crewspaceSkillSync: {
          desiredSkills: [crewspaceKey],
        },
      },
    } as const;

    await syncCursorSkills(configuredCtx, [crewspaceKey]);

    const clearedCtx = {
      ...configuredCtx,
      config: {
        env: {
          HOME: home,
        },
        crewspaceSkillSync: {
          desiredSkills: [],
        },
      },
    } as const;

    const after = await syncCursorSkills(clearedCtx, []);
    expect(after.desiredSkills).toContain(crewspaceKey);
    expect(after.entries.find((entry) => entry.key === crewspaceKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "crewspace"))).isSymbolicLink()).toBe(true);
  });
});
