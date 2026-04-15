import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listOpenCodeSkills,
  syncOpenCodeSkills,
} from "@crewspaceai/adapter-opencode-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("opencode local skill sync", () => {
  const crewspaceKey = "crewspaceai/crewspace/crewspace";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("reports configured CrewSpace skills and installs them into the shared Claude/OpenCode skills home", async () => {
    const home = await makeTempDir("crewspace-opencode-skill-sync-");
    cleanupDirs.add(home);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "opencode_local",
      config: {
        env: {
          HOME: home,
        },
        crewspaceSkillSync: {
          desiredSkills: [crewspaceKey],
        },
      },
    } as const;

    const before = await listOpenCodeSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.warnings).toContain("OpenCode currently uses the shared Claude skills home (~/.claude/skills).");
    expect(before.desiredSkills).toContain(crewspaceKey);
    expect(before.entries.find((entry) => entry.key === crewspaceKey)?.required).toBe(true);
    expect(before.entries.find((entry) => entry.key === crewspaceKey)?.state).toBe("missing");

    const after = await syncOpenCodeSkills(ctx, [crewspaceKey]);
    expect(after.entries.find((entry) => entry.key === crewspaceKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".claude", "skills", "crewspace"))).isSymbolicLink()).toBe(true);
  });

  it("keeps required bundled CrewSpace skills installed even when the desired set is emptied", async () => {
    const home = await makeTempDir("crewspace-opencode-skill-prune-");
    cleanupDirs.add(home);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "opencode_local",
      config: {
        env: {
          HOME: home,
        },
        crewspaceSkillSync: {
          desiredSkills: [crewspaceKey],
        },
      },
    } as const;

    await syncOpenCodeSkills(configuredCtx, [crewspaceKey]);

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

    const after = await syncOpenCodeSkills(clearedCtx, []);
    expect(after.desiredSkills).toContain(crewspaceKey);
    expect(after.entries.find((entry) => entry.key === crewspaceKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".claude", "skills", "crewspace"))).isSymbolicLink()).toBe(true);
  });
});
