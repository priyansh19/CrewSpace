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
      clearPid(stateDir);
      console.log("CrewSpace was not running (stale PID cleared).");
    } else {
      throw err;
    }
  }
}
