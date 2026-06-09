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
  const candidates = [
    resolve(dirname(fileURLToPath(import.meta.url)), "../../node_modules/@crewspaceai/server/dist/index.js"),
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
