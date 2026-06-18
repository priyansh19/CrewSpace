#!/usr/bin/env node
/**
 * Forbidden token checker for pre-publish safety.
 *
 * Scans tracked files for tokens (e.g. local usernames, secrets) that must
 * not appear in published packages.  Tokens are sourced from two places:
 *
 *   1. Dynamic — derived from the current OS user at runtime.
 *   2. Static  — listed in a tokens file (one token per line, # comments ok).
 *
 * Usage (CLI):
 *   node scripts/check-forbidden-tokens.mjs [tokens-file]
 *
 * Exports (for testing):
 *   resolveDynamicForbiddenTokens(env, osInterface)
 *   resolveForbiddenTokens(tokensFile, env, osInterface)
 *   runForbiddenTokenCheck({ repoRoot, tokens, exec, log, error })
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

/**
 * Derive forbidden tokens from the current OS user without shelling out to
 * `whoami` (unreliable in some CI environments).
 *
 * @param {Record<string, string | undefined>} env
 * @param {{ userInfo: () => { username: string } }} osInterface
 * @returns {string[]}
 */
export function resolveDynamicForbiddenTokens(env, osInterface) {
  const seen = new Set();
  const tokens = [];

  const add = (value) => {
    if (value && typeof value === "string" && value.length > 0 && !seen.has(value)) {
      seen.add(value);
      tokens.push(value);
    }
  };

  // Collect from well-known env vars
  for (const key of ["USER", "LOGNAME", "USERNAME"]) {
    add(env[key]);
  }

  // Collect from os.userInfo() — may throw in containers or CI
  try {
    const { username } = osInterface.userInfo();
    add(username);
  } catch {
    // fall through — no username available
  }

  return tokens;
}

/**
 * Read static tokens from a file (one per line; lines starting with # and
 * blank lines are ignored), then merge with dynamic tokens.
 *
 * @param {string} tokensFile  Path to the static tokens file.
 * @param {Record<string, string | undefined>} env
 * @param {{ userInfo: () => { username: string } }} osInterface
 * @returns {string[]}
 */
export function resolveForbiddenTokens(tokensFile, env, osInterface) {
  const dynamic = resolveDynamicForbiddenTokens(env, osInterface);
  const seen = new Set(dynamic);
  const tokens = [...dynamic];

  const content = readFileSync(tokensFile, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (!seen.has(line)) {
      seen.add(line);
      tokens.push(line);
    }
  }

  return tokens;
}

/**
 * Run the forbidden-token check by calling exec() once per token.
 *
 * exec() is expected to return a non-empty string when matches are found and
 * throw when no matches are found (mirroring `git grep` / `grep -r` exit
 * codes).
 *
 * @param {{
 *   repoRoot: string,
 *   tokens: string[],
 *   exec: (token: string, repoRoot: string) => string,
 *   log: (...args: unknown[]) => void,
 *   error: (...args: unknown[]) => void,
 * }} opts
 * @returns {0 | 1}
 */
export function runForbiddenTokenCheck({ repoRoot, tokens, exec, log, error }) {
  const matches = [];

  for (const token of tokens) {
    try {
      const output = exec(token, repoRoot);
      if (output && output.trim().length > 0) {
        for (const line of output.trim().split("\n")) {
          if (line.trim().length > 0) {
            matches.push(line.trim());
          }
        }
      }
    } catch {
      // grep / git grep exits non-zero when no match is found — that is
      // the happy path here.
    }
  }

  if (matches.length === 0) return 0;

  error("ERROR: Forbidden tokens found in tracked files:\n");
  for (const match of matches) {
    error(`  ${match}`);
  }
  error("\nBuild blocked. Remove the forbidden token(s) before publishing.");
  return 1;
}

// ── CLI entry point ─────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const tokensFile = process.argv[2];

  let tokens;
  if (tokensFile && existsSync(tokensFile)) {
    tokens = resolveForbiddenTokens(tokensFile, process.env, os);
  } else {
    tokens = resolveDynamicForbiddenTokens(process.env, os);
  }

  if (tokens.length === 0) {
    console.log("[check-forbidden-tokens] No tokens to check.");
    process.exit(0);
  }

  const exitCode = runForbiddenTokenCheck({
    repoRoot,
    tokens,
    exec: (token, root) =>
      execSync(
        `git grep -rn --fixed-strings -- ${JSON.stringify(token)}`,
        { cwd: root, encoding: "utf8" },
      ),
    log: console.log,
    error: console.error,
  });

  process.exit(exitCode);
}
