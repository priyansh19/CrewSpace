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
