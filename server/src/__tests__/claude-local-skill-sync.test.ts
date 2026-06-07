import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listClaudeSkills,
  syncClaudeSkills,
} from "@crewspaceai/adapter-claude-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createSkillDir(root: string, name: string) {
  const skillDir = path.join(root, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  return skillDir;
}

describe("claude local skill sync", () => {
  const crewspaceKey = "crewspaceai/crewspace/crewspace";
  const createAgentKey = "crewspaceai/crewspace/crewspace-create-agent";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("defaults to mounting all built-in CrewSpace skills when no explicit selection exists", async () => {
    const snapshot = await listClaudeSkills({
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "claude_local",
      config: {},
    });

    expect(snapshot.mode).toBe("ephemeral");
    expect(snapshot.supported).toBe(true);
    expect(snapshot.desiredSkills).toContain(crewspaceKey);
    expect(snapshot.entries.find((entry) => entry.key === crewspaceKey)?.required).toBe(true);
    expect(snapshot.entries.find((entry) => entry.key === crewspaceKey)?.state).toBe("configured");
  });

  it("respects an explicit desired skill list without mutating a persistent home", async () => {
    const snapshot = await syncClaudeSkills({
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "claude_local",
      config: {
        crewspaceSkillSync: {
          desiredSkills: [crewspaceKey],
        },
      },
    }, [crewspaceKey]);

    expect(snapshot.desiredSkills).toContain(crewspaceKey);
    expect(snapshot.entries.find((entry) => entry.key === crewspaceKey)?.state).toBe("configured");
    expect(snapshot.entries.find((entry) => entry.key === createAgentKey)?.state).toBe("configured");
  });

  it("normalizes legacy flat CrewSpace skill refs to canonical keys", async () => {
    const snapshot = await listClaudeSkills({
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "claude_local",
      config: {
        crewspaceSkillSync: {
          desiredSkills: ["crewspace"],
        },
      },
    });

    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.desiredSkills).toContain(crewspaceKey);
    expect(snapshot.desiredSkills).not.toContain("crewspace");
    expect(snapshot.entries.find((entry) => entry.key === crewspaceKey)?.state).toBe("configured");
    expect(snapshot.entries.find((entry) => entry.key === "crewspace")).toBeUndefined();
  });

  it("shows host-level user-installed Claude skills as read-only external entries", async () => {
    const home = await makeTempDir("crewspace-claude-user-skills-");
    cleanupDirs.add(home);
    await createSkillDir(path.join(home, ".claude", "skills"), "crack-python");

    const snapshot = await listClaudeSkills({
      agentId: "agent-4",
      companyId: "company-1",
      adapterType: "claude_local",
      config: {
        env: {
          HOME: home,
        },
      },
    });

    expect(snapshot.entries).toContainEqual(expect.objectContaining({
      key: "crack-python",
      runtimeName: "crack-python",
      state: "external",
      managed: false,
      origin: "user_installed",
      originLabel: "User-installed",
      locationLabel: "~/.claude/skills",
      readOnly: true,
      detail: "Installed outside CrewSpace management in the Claude skills home.",
    }));
  });
});
