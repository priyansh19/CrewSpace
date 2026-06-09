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
