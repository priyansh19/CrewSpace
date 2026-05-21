#!/usr/bin/env node
/**
 * Prepare the CrewSpace server for desktop packaging.
 *
 * Strategy:
 * 1. Build workspace packages so dist/ exists.
 * 2. Temporarily patch workspace package.json exports to point to dist/ instead of src/.
 *    This ensures pnpm deploy copies packages with correct exports.
 * 3. Run `pnpm deploy --filter @crewspaceai/server` to create a standalone server directory.
 * 4. Copy dist/ directories into deployed workspace packages (pnpm deploy doesn't include
 *    dist/ for workspace packages because it's typically .gitignored).
 * 5. Patch deployed adapter package.json exports to point to dist/.
 * 6. Copy ui-dist and fix known migration issues.
 * 7. Restore original workspace package.json files.
 */
import { execSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cpSyncWithRetry(src, dest, options, maxRetries = 10, delayMs = 300) {
  // On Windows, force-overwriting a directory tree while files are locked
  // (e.g. by pnpm hardlinks or antivirus) often fails. Remove the target
  // first, then copy fresh.
  if (process.platform === "win32" && existsSync(dest)) {
    try {
      rmSync(dest, { recursive: true, force: true });
    } catch {
      // Ignore removal errors; cpSync will retry if files are still locked.
    }
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      cpSync(src, dest, options);
      return;
    } catch (err) {
      const isWindowsLock =
        process.platform === "win32" &&
        (err.code === "EPIPE" || err.code === "EBUSY" || err.code === "EPERM");
      if (isWindowsLock && attempt < maxRetries) {
        const backoff = delayMs * attempt;
        console.log(
          `[prepare-desktop-server] Copy retry ${attempt}/${maxRetries} for ${dest} (code: ${err.code}, backoff ${backoff}ms)`,
        );
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, backoff);
        continue;
      }
      throw err;
    }
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const workspacePackages = [
  "packages/db",
  "packages/shared",
  "packages/adapter-utils",
  "packages/adapters/hermes-crewspace-adapter",
  "packages/plugins/sdk",
];

/**
 * pnpm deploy marks many transitive dependencies as "private" in
 * .modules.yaml — they are only accessible inside .pnpm/ and are not
 * hoisted to the root node_modules.  When we later dereference symlinks
 * and delete .pnpm/, those packages become unresolvable.
 *
 * This function promotes every package found inside .pnpm/{name}/node_modules/
 * to the root node_modules/ (as symlinks) so that Node.js module resolution
 * works after dereferencing.
 */
function promoteAllPnpmPackages(nodeModulesDir) {
  const pnpmDir = join(nodeModulesDir, ".pnpm");
  if (!existsSync(pnpmDir)) return;

  function promoteDirContents(sourceDir, targetDir) {
    for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
      const name = entry.name;
      if (name === ".bin" || name === ".modules.yaml") continue;

      const sourcePath = join(sourceDir, name);
      const targetPath = join(targetDir, name);

      if (entry.isDirectory()) {
        if (name.startsWith("@")) {
          // Scoped packages: always recurse so we don't miss packages
          // that belong to the same scope but come from different .pnpm entries.
          mkdirSync(targetPath, { recursive: true });
          promoteDirContents(sourcePath, targetPath);
          continue;
        }
        if (existsSync(targetPath)) continue;
        const rel = relative(dirname(targetPath), sourcePath);
        symlinkSync(rel, targetPath, "dir");
      } else if (entry.isSymbolicLink()) {
        if (existsSync(targetPath)) continue;
        const rel = relative(dirname(targetPath), sourcePath);
        const s = statSync(sourcePath);
        symlinkSync(rel, targetPath, s.isDirectory() ? "dir" : "file");
      }
    }
  }

  for (const entry of readdirSync(pnpmDir)) {
    const pkgNodeModules = join(pnpmDir, entry, "node_modules");
    if (!existsSync(pkgNodeModules) || !statSync(pkgNodeModules).isDirectory()) {
      continue;
    }
    promoteDirContents(pkgNodeModules, nodeModulesDir);
  }
}

/**
 * Recursively replace all symlinks in a directory tree with the actual
 * files/directories they point to. This is required before packaging
 * because pnpm's node_modules contains symlinks into .pnpm/ which
 * become broken when extracted on a different machine/path.
 */
function dereferenceDir(dir) {
  if (!existsSync(dir)) return;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isSymbolicLink()) {
      // Read the symlink target
      let target;
      try {
        target = readlinkSync(fullPath);
      } catch {
        continue;
      }

      // Resolve relative targets
      const resolvedTarget = resolve(dir, target);
      if (!existsSync(resolvedTarget)) {
        // Broken symlink — remove it
        rmSync(fullPath, { recursive: true, force: true });
        continue;
      }

      // Remove symlink and copy the real content
      rmSync(fullPath, { recursive: true, force: true });
      const stat = statSync(resolvedTarget);
      if (stat.isDirectory()) {
        cpSync(resolvedTarget, fullPath, { recursive: true, dereference: true });
      } else {
        mkdirSync(dirname(fullPath), { recursive: true });
        copyFileSync(resolvedTarget, fullPath);
      }
      continue;
    }

    if (entry.isDirectory()) {
      dereferenceDir(fullPath);
    }
  }
}

function patchPackageExports(pkgPath) {
  const original = readFileSync(pkgPath, "utf-8");
  const pkg = JSON.parse(original);

  function rewrite(val) {
    if (typeof val === "string") {
      if (val.startsWith("./src/") && val.endsWith(".ts")) {
        return val.replace("./src/", "./dist/").replace(".ts", ".js");
      }
      return val;
    }
    if (Array.isArray(val)) return val.map(rewrite);
    if (typeof val === "object" && val !== null) {
      const out = {};
      for (const [k, v] of Object.entries(val)) out[k] = rewrite(v);
      return out;
    }
    return val;
  }

  const patched = { ...pkg, exports: rewrite(pkg.exports) };
  writeFileSync(pkgPath, JSON.stringify(patched, null, 2) + "\n");
  return original;
}

function restorePackage(pkgPath, original) {
  writeFileSync(pkgPath, original);
}

function copyDistIntoDeployed(deployBase, repoBase, name) {
  const srcDist = join(repoBase, name, "dist");
  if (!existsSync(srcDist)) return false;

  // Determine deployed path name
  let deployName = name;
  if (repoBase.includes("adapters") && !deployName.startsWith("adapter-")) {
    deployName = "adapter-" + name;
  }

  const junctionPath = join(deployBase, deployName);
  if (!existsSync(junctionPath)) return false;

  const targetDist = join(junctionPath, "dist");
  if (existsSync(targetDist)) {
    // Already has dist, ensure it's up to date
    cpSyncWithRetry(srcDist, targetDist, { recursive: true, force: true });
    return true;
  }

  cpSyncWithRetry(srcDist, targetDist, { recursive: true, force: true });
  return true;
}

function patchAllExportsInDir(dir) {
  const entries = readdirSync(dir).filter((n) => {
    const s = statSync(join(dir, n));
    return s.isDirectory();
  });

  function rewrite(obj) {
    if (typeof obj === "string") {
      if (obj.startsWith("./src/") && obj.endsWith(".ts")) {
        return obj.replace("./src/", "./dist/").replace(".ts", ".js");
      }
      return obj;
    }
    if (Array.isArray(obj)) return obj.map(rewrite);
    if (typeof obj === "object" && obj !== null) {
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k] = rewrite(v);
      return out;
    }
    return obj;
  }

  for (const name of entries) {
    const pkgPath = join(dir, name, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const orig = JSON.stringify(pkg.exports);
    pkg.exports = rewrite(pkg.exports);
    if (JSON.stringify(pkg.exports) !== orig) {
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
      console.log(`[prepare-desktop-server] Patched exports: ${name}`);
    }
  }
}

function main() {
  console.log("[prepare-desktop-server] Starting...");

  // 1. Build workspace packages
  console.log("[prepare-desktop-server] Building workspace packages...");
  const packagesToBuild = [
    "packages/shared",
    "packages/adapter-utils",
    "packages/db",
    "packages/plugins/sdk",
    "server",
  ];
  for (const pkg of packagesToBuild) {
    const pkgJsonPath = join(repoRoot, pkg, "package.json");
    if (!existsSync(pkgJsonPath)) continue;
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    if (!pkgJson.scripts?.build) continue;
    console.log(`[prepare-desktop-server] Building ${pkg}...`);
    execSync("pnpm run build", { cwd: join(repoRoot, pkg), stdio: "inherit" });
  }

  // Also build adapters
  const adaptersDir = join(repoRoot, "packages", "adapters");
  for (const adapter of readdirSync(adaptersDir)) {
    const adapterDir = join(adaptersDir, adapter);
    const pkgJsonPath = join(adapterDir, "package.json");
    if (!existsSync(pkgJsonPath)) continue;
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    if (!pkgJson.scripts?.build) continue;
    console.log(`[prepare-desktop-server] Building adapter ${adapter}...`);
    execSync("pnpm run build", { cwd: adapterDir, stdio: "inherit" });
  }

  // 2. Patch workspace package.json exports
  console.log("[prepare-desktop-server] Patching workspace exports...");
  const originals = new Map();
  for (const pkgDir of workspacePackages) {
    const pkgPath = join(repoRoot, pkgDir, "package.json");
    originals.set(pkgDir, patchPackageExports(pkgPath));
    console.log(`[prepare-desktop-server] Patched ${pkgDir}/package.json`);
  }

  try {
    // 3. Deploy server
    const serverProdDir = join(repoRoot, "desktop-electron", "server-prod");
    if (existsSync(serverProdDir)) {
      console.log("[prepare-desktop-server] Clearing existing server-prod...");
      rmSync(serverProdDir, { recursive: true, force: true });
    }
    console.log("[prepare-desktop-server] Running pnpm deploy...");
    execSync(`pnpm deploy --filter @crewspaceai/server "${serverProdDir}"`, {
      cwd: repoRoot,
      stdio: "inherit",
    });

    // 4. Copy dist/ into deployed workspace packages
    const deployBase = join(serverProdDir, "node_modules", "@crewspaceai");
    console.log("[prepare-desktop-server] Copying dist/ into deployed packages...");

    for (const pkgDir of workspacePackages) {
      const name = pkgDir.split("/").pop();
      const repoBase = dirname(join(repoRoot, pkgDir));
      if (copyDistIntoDeployed(deployBase, repoBase, name)) {
        console.log(`[prepare-desktop-server] Copied dist for ${name}`);
      }
    }

    // Copy adapter dists
    for (const adapter of readdirSync(adaptersDir)) {
      if (copyDistIntoDeployed(deployBase, adaptersDir, adapter)) {
        console.log(`[prepare-desktop-server] Copied dist for adapter-${adapter}`);
      }
    }

    // 5. Patch all deployed @crewspaceai package exports
    console.log("[prepare-desktop-server] Patching deployed package exports...");
    patchAllExportsInDir(deployBase);

    // 5b. Promote private .pnpm packages to root node_modules, then dereference
    const deployedNodeModules = join(serverProdDir, "node_modules");
    console.log("[prepare-desktop-server] Promoting private .pnpm packages to root node_modules...");
    promoteAllPnpmPackages(deployedNodeModules);
    console.log("[prepare-desktop-server] Dereferencing symlinks in node_modules...");
    dereferenceDir(deployedNodeModules);
    // Also remove the .pnpm store since all symlinks to it are now resolved
    const pnpmStore = join(deployedNodeModules, ".pnpm");
    if (existsSync(pnpmStore)) {
      rmSync(pnpmStore, { recursive: true, force: true });
      console.log("[prepare-desktop-server] Removed .pnpm store");
    }

    // 6. Copy renderer-dist into desktop-electron build artifacts
    // The desktop app bundles renderer-dist directly; server ui-dist is not needed.
    const rendererDistSrc = join(repoRoot, "desktop-electron", "renderer-dist");
    const rendererDistDst = join(repoRoot, "desktop-electron", "dist", "renderer-dist");
    if (existsSync(rendererDistSrc)) {
      cpSyncWithRetry(rendererDistSrc, rendererDistDst, { recursive: true, force: true });
      console.log("[prepare-desktop-server] Copied renderer-dist");
    }

    // 7. Remove duplicate/conflicting migrations from deployed db package
    const deployedMigrationsDir = join(deployBase, "db", "dist", "migrations");
    const conflictingMigrations = [
      "0050_dear_thunderbolt.sql",
      "0051_petite_switch.sql",
    ];
    for (const migration of conflictingMigrations) {
      const migrationPath = join(deployedMigrationsDir, migration);
      if (existsSync(migrationPath)) {
        rmSync(migrationPath);
        console.log(`[prepare-desktop-server] Removed conflicting migration: ${migration}`);
      }
    }

    console.log(`[prepare-desktop-server] Success: ${serverProdDir}`);
  } finally {
    // 7. Always restore originals
    console.log("[prepare-desktop-server] Restoring workspace package.json files...");
    for (const [pkgDir, original] of originals) {
      restorePackage(join(repoRoot, pkgDir, "package.json"), original);
      console.log(`[prepare-desktop-server] Restored ${pkgDir}/package.json`);
    }
  }
}

main();
