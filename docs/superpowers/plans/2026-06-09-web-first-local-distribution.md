# Web-First Local Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship CrewSpace as a locally-installed developer tool via `npm install -g crewspace` and standalone binaries, with a static landing page at crewspace.ai — keeping all local adapters intact.

**Architecture:** A new `packages/cli` workspace package exposes a `crewspace` CLI that starts/stops the existing `@crewspaceai/server` as a background process. The server already handles embedded postgres, UI serving, and all adapters — the CLI is purely a process manager and UX wrapper. Standalone binaries bundle Node + the built server using `caxa`. The landing page is a static HTML/CSS site deployed to the existing VPS.

**Tech Stack:** TypeScript, tsx, caxa (binary bundler), detect-port (already used by server), open (browser opener), pnpm workspaces, GitHub Actions

---

## File Map

### New Files
- `packages/cli/package.json` — CLI package, exports `crewspace` bin
- `packages/cli/tsconfig.json` — TypeScript config
- `packages/cli/src/index.ts` — entry point, routes commands
- `packages/cli/src/commands/start.ts` — start server, open browser
- `packages/cli/src/commands/stop.ts` — graceful shutdown via PID
- `packages/cli/src/commands/status.ts` — show running state
- `packages/cli/src/commands/doctor.ts` — system health checks
- `packages/cli/src/commands/update.ts` — check npm for newer version
- `packages/cli/src/utils/pid.ts` — PID file read/write/clear
- `packages/cli/src/utils/port.ts` — find available port starting at 3100
- `packages/cli/src/utils/browser.ts` — cross-platform browser open
- `packages/cli/src/utils/version.ts` — read own package.json version
- `packages/cli/src/__tests__/pid.test.ts` — unit tests for PID utils
- `packages/cli/src/__tests__/port.test.ts` — unit tests for port utils
- `packages/cli/src/__tests__/version.test.ts` — unit tests for version util
- `scripts/build-binaries.mjs` — caxa binary build script
- `website/index.html` — landing page
- `website/styles.css` — landing page styles
- `.github/workflows/publish.yml` — npm publish + binary build + site deploy

### Modified Files
- `pnpm-workspace.yaml` — add `packages/cli`
- `package.json` (root) — add `build:cli`, `start` scripts
- `.github/workflows/release-desktop.yml` — keep as-is (desktop preserved branch)

---

## Task 1: Scaffold `packages/cli`

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Add cli to workspace**

Edit `pnpm-workspace.yaml`:
```yaml
packages:
  - packages/*
  - packages/adapters/*
  - packages/plugins/sdk
  - server
  - desktop-electron
  - desktop-electron/installer
  - packages/cli
```

- [ ] **Step 2: Create `packages/cli/package.json`**

```json
{
  "name": "crewspace",
  "version": "1.0.0",
  "description": "AI agent company control plane — run locally, access in browser",
  "bin": {
    "crewspace": "./dist/index.js"
  },
  "type": "module",
  "main": "./dist/index.js",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@crewspaceai/server": "workspace:*",
    "detect-port": "^1.6.1",
    "open": "^10.1.0"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "tsx": "^4.19.2",
    "vitest": "^3.0.5",
    "@types/node": "^22.0.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 3: Create `packages/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `packages/cli/src/index.ts`**

```typescript
#!/usr/bin/env node
import { startCommand } from "./commands/start.js";
import { stopCommand } from "./commands/stop.js";
import { statusCommand } from "./commands/status.js";
import { doctorCommand } from "./commands/doctor.js";
import { updateCommand } from "./commands/update.js";

const command = process.argv[2];

const commands: Record<string, () => Promise<void>> = {
  start: startCommand,
  stop: stopCommand,
  status: statusCommand,
  doctor: doctorCommand,
  update: updateCommand,
};

async function main() {
  if (!command || command === "--help" || command === "-h") {
    console.log(`
CrewSpace — AI agent company control plane

Usage:
  crewspace start     Start the server and open in browser
  crewspace stop      Stop the running server
  crewspace status    Show server status
  crewspace doctor    Run system health checks
  crewspace update    Check for updates
`);
    process.exit(0);
  }

  const handler = commands[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error("Run 'crewspace --help' for usage.");
    process.exit(1);
  }

  await handler();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

- [ ] **Step 5: Install dependencies**

```bash
pnpm install
```

Expected: no errors, `packages/cli/node_modules` created.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/package.json packages/cli/tsconfig.json packages/cli/src/index.ts pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(cli): scaffold crewspace CLI package"
```

---

## Task 2: PID and Port utilities

**Files:**
- Create: `packages/cli/src/utils/pid.ts`
- Create: `packages/cli/src/utils/port.ts`
- Create: `packages/cli/src/utils/version.ts`
- Create: `packages/cli/src/__tests__/pid.test.ts`
- Create: `packages/cli/src/__tests__/port.test.ts`
- Create: `packages/cli/src/__tests__/version.test.ts`

- [ ] **Step 1: Write failing PID tests**

Create `packages/cli/src/__tests__/pid.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writePid, readPid, clearPid } from "../utils/pid.js";

const testDir = join(tmpdir(), "crewspace-pid-test-" + Date.now());

beforeEach(() => mkdirSync(testDir, { recursive: true }));
afterEach(() => rmSync(testDir, { recursive: true, force: true }));

describe("pid utils", () => {
  it("returns null when no pid file exists", () => {
    expect(readPid(testDir)).toBeNull();
  });

  it("writes and reads pid", () => {
    writePid(testDir, 12345, 3100);
    const result = readPid(testDir);
    expect(result).toEqual({ pid: 12345, port: 3100 });
  });

  it("clears pid file", () => {
    writePid(testDir, 12345, 3100);
    clearPid(testDir);
    expect(readPid(testDir)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/cli && pnpm test
```

Expected: FAIL — `Cannot find module '../utils/pid.js'`

- [ ] **Step 3: Create `packages/cli/src/utils/pid.ts`**

```typescript
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const PID_FILE = "server.pid";

type PidEntry = { pid: number; port: number };

export function pidFilePath(dir: string): string {
  return join(dir, PID_FILE);
}

export function writePid(dir: string, pid: number, port: number): void {
  writeFileSync(pidFilePath(dir), JSON.stringify({ pid, port }), "utf8");
}

export function readPid(dir: string): PidEntry | null {
  const file = pidFilePath(dir);
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.pid === "number" && typeof parsed.port === "number") {
      return { pid: parsed.pid, port: parsed.port };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPid(dir: string): void {
  const file = pidFilePath(dir);
  if (existsSync(file)) unlinkSync(file);
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
cd packages/cli && pnpm test
```

Expected: PASS for all pid tests.

- [ ] **Step 5: Write failing port tests**

Create `packages/cli/src/__tests__/port.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { findAvailablePort } from "../utils/port.js";

describe("findAvailablePort", () => {
  it("returns a number >= 3100", async () => {
    const port = await findAvailablePort(3100);
    expect(typeof port).toBe("number");
    expect(port).toBeGreaterThanOrEqual(3100);
  });
});
```

- [ ] **Step 6: Create `packages/cli/src/utils/port.ts`**

```typescript
import detectPort from "detect-port";

export async function findAvailablePort(start: number): Promise<number> {
  const port = await detectPort(start);
  return port;
}
```

- [ ] **Step 7: Write failing version tests**

Create `packages/cli/src/__tests__/version.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { getCliVersion } from "../utils/version.js";

describe("getCliVersion", () => {
  it("returns a semver string", () => {
    const v = getCliVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });
});
```

- [ ] **Step 8: Create `packages/cli/src/utils/version.ts`**

```typescript
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function getCliVersion(): string {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "../../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  return pkg.version as string;
}
```

- [ ] **Step 9: Run all tests — verify PASS**

```bash
cd packages/cli && pnpm test
```

Expected: all tests PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/cli/src/utils/ packages/cli/src/__tests__/
git commit -m "feat(cli): add pid, port, and version utilities with tests"
```

---

## Task 3: Browser utility + `crewspace start` command

**Files:**
- Create: `packages/cli/src/utils/browser.ts`
- Create: `packages/cli/src/commands/start.ts`

- [ ] **Step 1: Create `packages/cli/src/utils/browser.ts`**

```typescript
import { exec } from "node:child_process";

export async function openBrowser(url: string): Promise<void> {
  const { default: open } = await import("open");
  await open(url);
}
```

- [ ] **Step 2: Create `packages/cli/src/commands/start.ts`**

```typescript
import { spawn } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { findAvailablePort } from "../utils/port.js";
import { writePid, readPid } from "../utils/pid.js";
import { openBrowser } from "../utils/browser.js";

function getStateDir(): string {
  const dir = join(homedir(), ".crewspace", "cli");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function getServerEntryPoint(): string {
  // When installed as npm package, server dist is in node_modules
  // Try several locations
  const candidates = [
    // npm global install: crewspace/node_modules/@crewspaceai/server/dist/index.js
    resolve(dirname(fileURLToPath(import.meta.url)), "../../node_modules/@crewspaceai/server/dist/index.js"),
    // monorepo dev: server/dist/index.js
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../../server/dist/index.js"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(
    "Server entry point not found. Run 'pnpm build' first, or reinstall crewspace."
  );
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function startCommand(): Promise<void> {
  const stateDir = getStateDir();
  const existing = readPid(stateDir);

  if (existing && isProcessRunning(existing.pid)) {
    console.log(`CrewSpace is already running at http://localhost:${existing.port} (PID ${existing.pid})`);
    await openBrowser(`http://localhost:${existing.port}`);
    return;
  }

  const port = await findAvailablePort(3100);
  const serverEntry = getServerEntryPoint();

  const logsDir = join(homedir(), ".crewspace", "instances", "default", "logs");
  mkdirSync(logsDir, { recursive: true });

  const child = spawn(process.execPath, [serverEntry], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      PORT: String(port),
      SERVE_UI: "true",
      CREWSPACE_DEPLOYMENT_MODE: "local_trusted",
    },
  });

  child.unref();

  writePid(stateDir, child.pid!, port);

  console.log(`Starting CrewSpace on port ${port}...`);

  // Poll health endpoint until ready (max 30s)
  const url = `http://localhost:${port}`;
  const healthUrl = `${url}/api/health`;
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 800));
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        console.log(`\nCrewSpace is ready → ${url}\n`);
        await openBrowser(url);
        return;
      }
    } catch {
      process.stdout.write(".");
    }
  }

  console.error("\nServer did not become ready in time. Check logs at ~/.crewspace/instances/default/logs/");
  process.exit(1);
}
```

- [ ] **Step 3: Build CLI and smoke test locally**

```bash
pnpm --filter @crewspaceai/server build
cd packages/cli && pnpm build
node dist/index.js start
```

Expected: server starts, browser opens at `http://localhost:3100`, health check passes.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/start.ts packages/cli/src/utils/browser.ts
git commit -m "feat(cli): add crewspace start command"
```

---

## Task 4: `stop`, `status`, `doctor`, `update` commands

**Files:**
- Create: `packages/cli/src/commands/stop.ts`
- Create: `packages/cli/src/commands/status.ts`
- Create: `packages/cli/src/commands/doctor.ts`
- Create: `packages/cli/src/commands/update.ts`

- [ ] **Step 1: Create `packages/cli/src/commands/stop.ts`**

```typescript
import { join } from "node:path";
import { homedir } from "node:os";
import { readPid, clearPid } from "../utils/pid.js";

function getStateDir(): string {
  return join(homedir(), ".crewspace", "cli");
}

export async function stopCommand(): Promise<void> {
  const stateDir = getStateDir();
  const entry = readPid(stateDir);

  if (!entry) {
    console.log("CrewSpace is not running.");
    return;
  }

  try {
    process.kill(entry.pid, "SIGTERM");
    clearPid(stateDir);
    console.log(`Stopped CrewSpace (PID ${entry.pid})`);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ESRCH") {
      // Process already dead
      clearPid(stateDir);
      console.log("CrewSpace was not running (stale PID cleared).");
    } else {
      throw err;
    }
  }
}
```

- [ ] **Step 2: Create `packages/cli/src/commands/status.ts`**

```typescript
import { join } from "node:path";
import { homedir } from "node:os";
import { readPid } from "../utils/pid.js";

function getStateDir(): string {
  return join(homedir(), ".crewspace", "cli");
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function statusCommand(): Promise<void> {
  const stateDir = getStateDir();
  const entry = readPid(stateDir);

  if (!entry) {
    console.log("Status: stopped");
    return;
  }

  if (isProcessRunning(entry.pid)) {
    console.log(`Status:  running`);
    console.log(`URL:     http://localhost:${entry.port}`);
    console.log(`PID:     ${entry.pid}`);
    console.log(`Data:    ~/.crewspace/instances/default/`);
  } else {
    console.log("Status: stopped (stale PID found — run 'crewspace start')");
  }
}
```

- [ ] **Step 3: Create `packages/cli/src/commands/doctor.ts`**

```typescript
import { execSync } from "node:child_process";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import { existsSync } from "node:fs";
import { findAvailablePort } from "../utils/port.js";
import { getCliVersion } from "../utils/version.js";

export async function doctorCommand(): Promise<void> {
  const checks: Array<{ label: string; ok: boolean; detail?: string }> = [];

  // Node version
  const nodeVer = process.versions.node;
  const [nodeMajor] = nodeVer.split(".").map(Number);
  checks.push({
    label: "Node.js >= 20",
    ok: nodeMajor >= 20,
    detail: `v${nodeVer}`,
  });

  // Port 3100 available
  const availablePort = await findAvailablePort(3100);
  checks.push({
    label: "Port 3100 available",
    ok: availablePort === 3100,
    detail: availablePort !== 3100 ? `port 3100 in use, would use ${availablePort}` : "free",
  });

  // Data directory
  const dataDir = join(homedir(), ".crewspace");
  checks.push({
    label: "Data directory (~/.crewspace)",
    ok: existsSync(dataDir) || true, // will be created on first start
    detail: existsSync(dataDir) ? "exists" : "will be created on first start",
  });

  // CLI version
  checks.push({
    label: "CrewSpace version",
    ok: true,
    detail: `v${getCliVersion()}`,
  });

  // Print results
  console.log("\nCrewSpace Doctor\n");
  for (const check of checks) {
    const icon = check.ok ? "✓" : "✗";
    const detail = check.detail ? ` (${check.detail})` : "";
    console.log(`  ${icon} ${check.label}${detail}`);
  }

  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    console.log(`\n${failed.length} check(s) failed.`);
    process.exit(1);
  } else {
    console.log("\nAll checks passed.");
  }
}
```

- [ ] **Step 4: Create `packages/cli/src/commands/update.ts`**

```typescript
import { getCliVersion } from "../utils/version.js";

export async function updateCommand(): Promise<void> {
  const current = getCliVersion();
  console.log(`Current version: v${current}`);
  console.log("Checking npm for latest version...");

  try {
    const res = await fetch("https://registry.npmjs.org/crewspace/latest");
    const data = await res.json() as { version: string };
    const latest = data.version;

    if (latest === current) {
      console.log("You are on the latest version.");
    } else {
      console.log(`\nNew version available: v${latest}`);
      console.log("Run: npm install -g crewspace");
    }
  } catch {
    console.error("Could not reach npm registry. Check your internet connection.");
    process.exit(1);
  }
}
```

- [ ] **Step 5: Build and smoke test each command**

```bash
cd packages/cli && pnpm build
node dist/index.js status
node dist/index.js doctor
node dist/index.js update
```

Expected: each command prints output without crashing.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/
git commit -m "feat(cli): add stop, status, doctor, update commands"
```

---

## Task 5: Root package scripts + npm publish workflow

**Files:**
- Modify: `package.json` (root)
- Create: `.github/workflows/publish.yml`

- [ ] **Step 1: Update root `package.json` scripts**

Add these scripts to the root `package.json`:
```json
{
  "scripts": {
    "start": "node packages/cli/dist/index.js start",
    "build:cli": "pnpm --filter crewspace build"
  }
}
```

- [ ] **Step 2: Create `.github/workflows/publish.yml`**

```yaml
name: Publish

on:
  push:
    tags:
      - 'v*'

jobs:
  publish-npm:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: write
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
          registry-url: https://registry.npmjs.org

      - name: Install dependencies
        run: pnpm install --no-frozen-lockfile

      - name: Build all packages
        run: pnpm build

      - name: Sync CLI version with tag
        run: |
          TAG="${{ github.ref_name }}"
          VERSION="${TAG#v}"
          cd packages/cli
          node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
            pkg.version = '$VERSION';
            fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
          "
          echo "CLI version set to $VERSION"

      - name: Publish to npm
        run: pnpm --filter crewspace publish --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  build-binaries:
    runs-on: ${{ matrix.os }}
    timeout-minutes: 30
    needs: publish-npm
    permissions:
      contents: write

    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            target: linux-x64
            ext: ''
          - os: windows-latest
            target: windows-x64
            ext: '.exe'
          - os: macos-latest
            target: macos-universal
            ext: ''

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --no-frozen-lockfile

      - name: Build all packages
        run: pnpm build

      - name: Install caxa
        run: npm install -g caxa

      - name: Build binary
        shell: bash
        run: |
          TAG="${{ github.ref_name }}"
          VERSION="${TAG#v}"
          OUT="crewspace-${{ matrix.target }}${{ matrix.ext }}"
          caxa --input . --output "$OUT" -- "{{caxa}}/node_modules/.bin/node" "{{caxa}}/packages/cli/dist/index.js"
          echo "Binary built: $OUT"

      - name: Upload binary to release
        env:
          GH_TOKEN: ${{ github.token }}
        shell: bash
        run: |
          TAG="${{ github.ref_name }}"
          OUT="crewspace-${{ matrix.target }}${{ matrix.ext }}"
          gh release upload "$TAG" "$OUT" --clobber || gh release create "$TAG" "$OUT" --title "CrewSpace $TAG" --latest
```

- [ ] **Step 3: Add NPM_TOKEN secret to GitHub repo**

Go to npmjs.com → Account → Access Tokens → Generate New Token → Automation type.
Then: GitHub repo → Settings → Secrets → Actions → New secret → `NPM_TOKEN`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/publish.yml package.json
git commit -m "feat(ci): add npm publish and binary build workflow"
```

---

## Task 6: Static landing page

**Files:**
- Create: `website/index.html`
- Create: `website/styles.css`

- [ ] **Step 1: Create `website/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CrewSpace — AI Agent Company Control Plane</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header>
    <nav>
      <span class="logo">CrewSpace</span>
      <a href="https://github.com/priyansh19/CrewSpace" target="_blank">GitHub</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <h1>Your AI agent company,<br/>running locally.</h1>
      <p class="subtitle">
        Multi-agent orchestration, task queues, and a 3D workspace —
        all on your machine. No cloud, no subscription.
      </p>

      <div class="install-box">
        <code>npm install -g crewspace && crewspace start</code>
      </div>

      <div class="downloads">
        <p>Or download a binary:</p>
        <div class="download-buttons">
          <a class="btn" href="https://github.com/priyansh19/CrewSpace/releases/latest/download/crewspace-windows-x64.exe">
            Windows
          </a>
          <a class="btn" href="https://github.com/priyansh19/CrewSpace/releases/latest/download/crewspace-macos-universal">
            macOS
          </a>
          <a class="btn" href="https://github.com/priyansh19/CrewSpace/releases/latest/download/crewspace-linux-x64">
            Linux
          </a>
        </div>
      </div>
    </section>

    <section class="steps">
      <h2>Get started in 3 steps</h2>
      <ol>
        <li><strong>Install</strong> — <code>npm install -g crewspace</code></li>
        <li><strong>Run</strong> — <code>crewspace start</code></li>
        <li><strong>Open</strong> — browser opens automatically at localhost:3100</li>
      </ol>
    </section>

    <section class="features">
      <h2>What's inside</h2>
      <ul>
        <li>Local AI adapters — Claude, Gemini, Cursor, Codex and more</li>
        <li>3D office workspace with role-based agent hierarchy</li>
        <li>Task queues, budget policies, approval gates</li>
        <li>Embedded database — your data never leaves your machine</li>
        <li>Open source — MIT license</li>
      </ul>
    </section>
  </main>

  <footer>
    <p>
      Built by <a href="https://github.com/priyansh19">Priyansh Gupta</a> ·
      <a href="https://github.com/priyansh19/CrewSpace">GitHub</a>
    </p>
  </footer>
</body>
</html>
```

- [ ] **Step 2: Create `website/styles.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0a0a0a;
  --surface: #111;
  --border: #222;
  --text: #f0f0f0;
  --muted: #888;
  --accent: #6366f1;
  --accent-hover: #818cf8;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body { background: var(--bg); color: var(--text); min-height: 100vh; }

nav {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1.25rem 2rem; border-bottom: 1px solid var(--border);
}
.logo { font-weight: 700; font-size: 1.1rem; letter-spacing: -0.02em; }
nav a { color: var(--muted); text-decoration: none; font-size: 0.9rem; }
nav a:hover { color: var(--text); }

main { max-width: 720px; margin: 0 auto; padding: 4rem 2rem; }

.hero { text-align: center; padding-bottom: 4rem; border-bottom: 1px solid var(--border); }
h1 { font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; line-height: 1.15; letter-spacing: -0.03em; margin-bottom: 1rem; }
.subtitle { color: var(--muted); font-size: 1.1rem; line-height: 1.6; max-width: 500px; margin: 0 auto 2rem; }

.install-box {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: 1rem 1.5rem; display: inline-block;
  margin-bottom: 2rem;
}
.install-box code { font-size: 0.95rem; color: var(--accent-hover); }

.downloads p { color: var(--muted); font-size: 0.875rem; margin-bottom: 0.75rem; }
.download-buttons { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }

.btn {
  background: var(--surface); border: 1px solid var(--border);
  color: var(--text); text-decoration: none; padding: 0.5rem 1.25rem;
  border-radius: 6px; font-size: 0.875rem; transition: border-color 0.15s;
}
.btn:hover { border-color: var(--accent); color: var(--accent-hover); }

.steps, .features { padding: 3rem 0; border-bottom: 1px solid var(--border); }
h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 1.25rem; }

ol, ul { padding-left: 1.5rem; }
li { margin-bottom: 0.75rem; line-height: 1.6; color: var(--muted); }
li strong, li code { color: var(--text); }
code { font-size: 0.875rem; background: var(--surface); padding: 0.1em 0.4em; border-radius: 4px; }

footer { text-align: center; padding: 2rem; color: var(--muted); font-size: 0.875rem; }
footer a { color: var(--muted); }
footer a:hover { color: var(--text); }
```

- [ ] **Step 3: Preview locally**

Open `website/index.html` in a browser to verify it looks correct.

- [ ] **Step 4: Commit**

```bash
git add website/
git commit -m "feat(website): add static landing page"
```

---

## Task 7: Wire everything together + tag first release

- [ ] **Step 1: Full build verification**

```bash
pnpm install && pnpm build
cd packages/cli && node dist/index.js --help
```

Expected: help text prints without errors.

- [ ] **Step 2: End-to-end smoke test**

```bash
cd packages/cli && node dist/index.js doctor
node dist/index.js start
# verify browser opens and app loads
node dist/index.js status
node dist/index.js stop
node dist/index.js status
```

Expected: start opens browser, status shows running, stop kills process, final status shows stopped.

- [ ] **Step 3: Update root package.json version and CLI version to 1.0.0**

In `packages/cli/package.json`:
```json
{ "version": "1.0.0" }
```

- [ ] **Step 4: Final commit and tag**

```bash
git add -A
git commit -m "feat: web-first local distribution v1.0.0 — npm package + binaries + landing page"
git tag v1.0.0-cli
git push origin main --tags
```

Expected: GitHub Actions `publish.yml` triggers, npm package publishes, binaries are built and attached to release.

---

## Self-Review Notes

- All commands share the same `getStateDir()` logic — this is intentional duplication across files to keep each command self-contained and readable without cross-file dependencies at the command level.
- The binary build uses `caxa` which bundles the entire repo directory. This means `node_modules` and `dist` must be built before running `caxa`. The CI workflow handles this via the `pnpm build` step.
- The `update` command checks npmjs.com — this will 404 until the package is first published. That's expected.
- The landing page download links point to GitHub Releases `latest` — these will 404 until the first binary release. That's expected.
