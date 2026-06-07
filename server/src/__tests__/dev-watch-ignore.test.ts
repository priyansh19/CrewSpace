import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveServerDevWatchIgnorePaths } from "../dev-watch-ignore.js";

describe("resolveServerDevWatchIgnorePaths", () => {
  it("includes both the worktree desktop-electron paths and their real shared targets", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "crewspace-dev-watch-"));
    const sharedDesktopRoot = path.join(tempRoot, "shared-desktop");
    const worktreeRoot = path.join(tempRoot, "repo", ".crewspace", "worktrees", "PAP-884");
    const serverRoot = path.join(worktreeRoot, "server");
    const worktreeDesktopRoot = path.join(worktreeRoot, "desktop-electron");

    fs.mkdirSync(path.join(sharedDesktopRoot, "node_modules"), { recursive: true });
    fs.mkdirSync(path.join(sharedDesktopRoot, ".vite"), { recursive: true });
    fs.mkdirSync(path.join(sharedDesktopRoot, "renderer-dist"), { recursive: true });
    fs.mkdirSync(path.join(sharedDesktopRoot, "dist"), { recursive: true });
    fs.mkdirSync(serverRoot, { recursive: true });
    fs.mkdirSync(worktreeDesktopRoot, { recursive: true });

    fs.symlinkSync(path.join(sharedDesktopRoot, "node_modules"), path.join(worktreeDesktopRoot, "node_modules"));
    fs.symlinkSync(path.join(sharedDesktopRoot, ".vite"), path.join(worktreeDesktopRoot, ".vite"));
    fs.symlinkSync(path.join(sharedDesktopRoot, "renderer-dist"), path.join(worktreeDesktopRoot, "renderer-dist"));
    fs.symlinkSync(path.join(sharedDesktopRoot, "dist"), path.join(worktreeDesktopRoot, "dist"));

    const ignorePaths = resolveServerDevWatchIgnorePaths(serverRoot);

    expect(ignorePaths).toContain(path.join(worktreeDesktopRoot, "node_modules"));
    expect(ignorePaths).toContain(`${path.join(worktreeDesktopRoot, "node_modules").replaceAll(path.sep, "/")}/**`);
    expect(ignorePaths).toContain(fs.realpathSync(path.join(sharedDesktopRoot, "node_modules")));
    expect(ignorePaths).toContain(`${fs.realpathSync(path.join(sharedDesktopRoot, "node_modules")).replaceAll(path.sep, "/")}/**`);
    expect(ignorePaths).toContain(path.join(worktreeDesktopRoot, "node_modules", ".vite-temp"));
    expect(ignorePaths).toContain(
      `${path.join(worktreeDesktopRoot, "node_modules", ".vite-temp").replaceAll(path.sep, "/")}/**`,
    );
    expect(ignorePaths).toContain(path.join(worktreeDesktopRoot, ".vite"));
    expect(ignorePaths).toContain(fs.realpathSync(path.join(sharedDesktopRoot, ".vite")));
    expect(ignorePaths).toContain(path.join(worktreeDesktopRoot, "renderer-dist"));
    expect(ignorePaths).toContain(fs.realpathSync(path.join(sharedDesktopRoot, "renderer-dist")));
    expect(ignorePaths).toContain(path.join(worktreeDesktopRoot, "dist"));
    expect(ignorePaths).toContain(fs.realpathSync(path.join(sharedDesktopRoot, "dist")));
    expect(ignorePaths).toContain("**/{node_modules,bower_components,vendor}/**");
    expect(ignorePaths).toContain("**/.vite-temp/**");
  });
});
