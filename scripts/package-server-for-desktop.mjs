#!/usr/bin/env node
/**
 * Package the CrewSpace server for desktop embedding.
 *
 * This script uses `pkg` (vercel/pkg) to compile the Node.js server
 * into a single executable that can be bundled as a Tauri sidecar.
 *
 * Usage:
 *   node scripts/package-server-for-desktop.mjs
 *
 * Prerequisites:
 *   npm install -g @yao-pkg/pkg   (or vercel/pkg if available)
 *
 * Outputs:
 *   desktop/src-tauri/binaries/crewspace-server-x86_64-pc-windows-msvc.exe
 */

import { execSync } from "node:child_process";
import { existsSync, copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const binaryDir = join(repoRoot, "desktop", "src-tauri", "binaries");
const serverDist = join(repoRoot, "server", "dist");
const serverNodeModules = join(repoRoot, "server", "node_modules");

function findBinaries() {
  const candidates = [
    "crewspace-server-x86_64-pc-windows-msvc.exe",
    "crewspace-server.exe",
  ];
  for (const name of candidates) {
    const p = join(binaryDir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

function copyNativeAddons() {
  // pkg sometimes misses native .node binaries. Copy them explicitly.
  const nativePaths = [
    join(serverNodeModules, "sharp", "prebuilds"),
    join(serverNodeModules, "@img", "sharp-libv8-*/**"),
  ];

  // Note: native addons must live alongside the executable or in a known
  // location. pkg's asset handling is the most reliable way.
  console.log("[package-server] Native addons will be included via pkg assets config.");
}

function ensurePkgInstalled() {
  try {
    execSync("pkg --version", { stdio: "ignore" });
  } catch {
    console.error(
      "[package-server] 'pkg' is not installed. Install it with:\n" +
        "  npm install -g @yao-pkg/pkg\n" +
        "Or if you are on an older Node version:\n" +
        "  npm install -g pkg"
    );
    process.exit(1);
  }
}

function main() {
  console.log("[package-server] Packaging CrewSpace server for desktop...");

  if (!existsSync(serverDist)) {
    console.error(
      `[package-server] Server dist not found at ${serverDist}. Run "pnpm -r build" first.`
    );
    process.exit(1);
  }

  ensurePkgInstalled();
  mkdirSync(binaryDir, { recursive: true });

  const entry = join(serverDist, "index.js");
  const outputName = "crewspace-server";

  // pkg config embedded as JSON string
  const pkgConfig = {
    pkg: {
      assets: [
        "../server/ui-dist/**/*",
        "../server/dist/onboarding-assets/**/*",
        "../server/node_modules/embedded-postgres/**/*",
        "../server/node_modules/sharp/prebuilds/**/*",
        "../server/node_modules/@img/**/*",
        "../packages/db/drizzle/**/*",
      ],
      targets: ["node20-win-x64"],
      outputPath: binaryDir,
    },
  };

  const configPath = join(binaryDir, "pkg-config.json");
  import { writeFileSync } from "node:fs";
  writeFileSync(configPath, JSON.stringify(pkgConfig, null, 2));

  console.log(`[package-server] Running pkg for ${entry}...`);
  try {
    execSync(
      `pkg ${entry} --config ${configPath} --output ${join(binaryDir, outputName)} --targets node20-win-x64`,
      {
        cwd: repoRoot,
        stdio: "inherit",
      }
    );
  } catch (err) {
    console.error("[package-server] pkg failed:", err.message);
    process.exit(1);
  }

  // pkg names the output without the platform suffix; rename for Tauri.
  const plainOutput = join(binaryDir, `${outputName}.exe`);
  const tauriOutput = join(binaryDir, `${outputName}-x86_64-pc-windows-msvc.exe`);

  if (existsSync(plainOutput)) {
    copyFileSync(plainOutput, tauriOutput);
    console.log(`[package-server] Copied to ${tauriOutput}`);
  }

  const found = findBinaries();
  if (found) {
    const stats = statSync(found);
    const sizeMb = (stats.size / 1024 / 1024).toFixed(1);
    console.log(`[package-server] Success: ${found} (${sizeMb} MB)`);
  } else {
    console.error("[package-server] Could not locate output binary.");
    process.exit(1);
  }
}

main();
