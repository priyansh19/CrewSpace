import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCodexSkillsInjected } from "@crewspaceai/adapter-codex-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createCrewSpaceRepoSkill(root: string, skillName: string) {
  await fs.mkdir(path.join(root, "server"), { recursive: true });
  await fs.mkdir(path.join(root, "packages", "adapter-utils"), { recursive: true });
  await fs.mkdir(path.join(root, "skills", skillName), { recursive: true });
  await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
  await fs.writeFile(path.join(root, "package.json"), '{"name":"crewspace"}\n', "utf8");
  await fs.writeFile(
    path.join(root, "skills", skillName, "SKILL.md"),
    `---\nname: ${skillName}\n---\n`,
    "utf8",
  );
}

async function createCustomSkill(root: string, skillName: string) {
  await fs.mkdir(path.join(root, "custom", skillName), { recursive: true });
  await fs.writeFile(
    path.join(root, "custom", skillName, "SKILL.md"),
    `---\nname: ${skillName}\n---\n`,
    "utf8",
  );
}

describe("codex local adapter skill injection", () => {
  const crewspaceKey = "crewspaceai/crewspace/crewspace";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("repairs a Codex CrewSpace skill symlink that still points at another live checkout", async () => {
    const currentRepo = await makeTempDir("crewspace-codex-current-");
    const oldRepo = await makeTempDir("crewspace-codex-old-");
    const skillsHome = await makeTempDir("crewspace-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(oldRepo);
    cleanupDirs.add(skillsHome);

    await createCrewSpaceRepoSkill(currentRepo, "crewspace");
    await createCrewSpaceRepoSkill(oldRepo, "crewspace");
    await fs.symlink(path.join(oldRepo, "skills", "crewspace"), path.join(skillsHome, "crewspace"));

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    await ensureCodexSkillsInjected(
      async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
      {
        skillsHome,
        skillsEntries: [{
          key: crewspaceKey,
          runtimeName: "crewspace",
          source: path.join(currentRepo, "skills", "crewspace"),
        }],
      },
    );

    expect(await fs.realpath(path.join(skillsHome, "crewspace"))).toBe(
      await fs.realpath(path.join(currentRepo, "skills", "crewspace")),
    );
    expect(logs).toContainEqual(
      expect.objectContaining({
        stream: "stdout",
        chunk: expect.stringContaining('Repaired Codex skill "crewspace"'),
      }),
    );
  });

  it("preserves a custom Codex skill symlink outside CrewSpace repo checkouts", async () => {
    const currentRepo = await makeTempDir("crewspace-codex-current-");
    const customRoot = await makeTempDir("crewspace-codex-custom-");
    const skillsHome = await makeTempDir("crewspace-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(customRoot);
    cleanupDirs.add(skillsHome);

    await createCrewSpaceRepoSkill(currentRepo, "crewspace");
    await createCustomSkill(customRoot, "crewspace");
    await fs.symlink(path.join(customRoot, "custom", "crewspace"), path.join(skillsHome, "crewspace"));

    await ensureCodexSkillsInjected(async () => {}, {
      skillsHome,
      skillsEntries: [{
        key: crewspaceKey,
        runtimeName: "crewspace",
        source: path.join(currentRepo, "skills", "crewspace"),
      }],
    });

    expect(await fs.realpath(path.join(skillsHome, "crewspace"))).toBe(
      await fs.realpath(path.join(customRoot, "custom", "crewspace")),
    );
  });

  it("prunes broken symlinks for unavailable CrewSpace repo skills before Codex starts", async () => {
    const currentRepo = await makeTempDir("crewspace-codex-current-");
    const oldRepo = await makeTempDir("crewspace-codex-old-");
    const skillsHome = await makeTempDir("crewspace-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(oldRepo);
    cleanupDirs.add(skillsHome);

    await createCrewSpaceRepoSkill(currentRepo, "crewspace");
    await createCrewSpaceRepoSkill(oldRepo, "agent-browser");
    const staleTarget = path.join(oldRepo, "skills", "agent-browser");
    await fs.symlink(staleTarget, path.join(skillsHome, "agent-browser"));
    await fs.rm(staleTarget, { recursive: true, force: true });

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    await ensureCodexSkillsInjected(
      async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
      {
        skillsHome,
        skillsEntries: [{
          key: crewspaceKey,
          runtimeName: "crewspace",
          source: path.join(currentRepo, "skills", "crewspace"),
        }],
      },
    );

    await expect(fs.lstat(path.join(skillsHome, "agent-browser"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(logs).toContainEqual(
      expect.objectContaining({
        stream: "stdout",
        chunk: expect.stringContaining('Removed stale Codex skill "agent-browser"'),
      }),
    );
  });

  it("preserves other live CrewSpace skill symlinks in the shared workspace skill directory", async () => {
    const currentRepo = await makeTempDir("crewspace-codex-current-");
    const skillsHome = await makeTempDir("crewspace-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(skillsHome);

    await createCrewSpaceRepoSkill(currentRepo, "crewspace");
    await createCrewSpaceRepoSkill(currentRepo, "agent-browser");
    await fs.symlink(
      path.join(currentRepo, "skills", "agent-browser"),
      path.join(skillsHome, "agent-browser"),
    );

    await ensureCodexSkillsInjected(async () => {}, {
      skillsHome,
      skillsEntries: [{
        key: crewspaceKey,
        runtimeName: "crewspace",
        source: path.join(currentRepo, "skills", "crewspace"),
      }],
    });

    expect((await fs.lstat(path.join(skillsHome, "crewspace"))).isSymbolicLink()).toBe(true);
    expect((await fs.lstat(path.join(skillsHome, "agent-browser"))).isSymbolicLink()).toBe(true);
    expect(await fs.realpath(path.join(skillsHome, "agent-browser"))).toBe(
      await fs.realpath(path.join(currentRepo, "skills", "agent-browser")),
    );
  });
});
