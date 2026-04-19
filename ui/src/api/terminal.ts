import { api } from "./client";

export interface TerminalHistoryEntry {
  id: string;
  actorId: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
  executedAt: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
}

export const terminalApi = {
  getCwd: () => api.get<{ cwd: string }>("/terminal/cwd"),
  getHistory: () => api.get<TerminalHistoryEntry[]>("/terminal/history"),
  exec: (command: string, cwd: string) =>
    api.post<ExecResult>("/terminal/exec", { command, cwd }),
};
