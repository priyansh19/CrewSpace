import { Router } from "express";
import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import type { Request } from "express";
import type { Db } from "@crewspaceai/db";
import { terminalHistory } from "@crewspaceai/db";
import { validate } from "../middleware/validate.js";
import { assertBoard } from "./authz.js";

const execSchema = z.object({
  command: z.string().min(1).max(4096),
  cwd: z.string().min(1),
});

const CWD_SENTINEL = "::CREWSPACE_CWD::";
const EXEC_TIMEOUT_MS = 30_000;
const HISTORY_LIMIT = 500;

/** Resolve the initial working directory for the CEO terminal. Prefer /app (the standard CrewSpace deployment root). */
function resolveDefaultCwd(): string {
  if (existsSync("/app")) return "/app";
  return process.cwd();
}

function resolveActorId(req: Request): string {
  if (req.actor.type === "board" && req.actor.userId) return req.actor.userId;
  return "board";
}

export function terminalRoutes(db: Db) {
  const router = Router();

  router.get("/terminal/cwd", (req, res) => {
    assertBoard(req);
    res.json({ cwd: resolveDefaultCwd() });
  });

  router.get("/terminal/history", async (req, res) => {
    assertBoard(req);
    const actorId = resolveActorId(req);
    const rows = await db
      .select()
      .from(terminalHistory)
      .where(eq(terminalHistory.actorId, actorId))
      .orderBy(desc(terminalHistory.executedAt))
      .limit(HISTORY_LIMIT);
    res.json(rows.reverse());
  });

  router.post("/terminal/exec", validate(execSchema), (req, res) => {
    assertBoard(req);
    const { command, cwd } = req.body as { command: string; cwd: string };
    const actorId = resolveActorId(req);

    // Wrap command in a subshell so cd persists: capture new cwd as last line via sentinel.
    const wrapped = `cd ${JSON.stringify(cwd)} 2>/dev/null; ${command}; echo "${CWD_SENTINEL}$(pwd)"`;

    exec(wrapped, { shell: "/bin/bash", timeout: EXEC_TIMEOUT_MS }, (err, stdout, stderr) => {
      const sentinelIdx = stdout.lastIndexOf(CWD_SENTINEL);
      let newCwd = cwd;
      let cleanStdout = stdout;

      if (sentinelIdx !== -1) {
        newCwd = stdout.slice(sentinelIdx + CWD_SENTINEL.length).trimEnd();
        cleanStdout = stdout.slice(0, sentinelIdx).replace(/\n$/, "");
      }

      const timedOut = err?.signal === "SIGTERM";
      const finalStderr = timedOut ? "Command timed out after 30 seconds" : (stderr ?? "");
      const exitCode = err && "code" in err && typeof err.code === "number" ? err.code : 0;

      db.insert(terminalHistory)
        .values({ actorId, command, stdout: cleanStdout, stderr: finalStderr, exitCode, cwd: newCwd })
        .catch(() => {
          // Non-fatal: don't fail the response if history write fails
        });

      res.json({ stdout: cleanStdout, stderr: finalStderr, exitCode, cwd: newCwd });
    });
  });

  return router;
}
