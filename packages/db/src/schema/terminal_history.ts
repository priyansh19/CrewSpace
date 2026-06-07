import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const terminalHistory = pgTable(
  "terminal_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").notNull(),
    command: text("command").notNull(),
    stdout: text("stdout").notNull().default(""),
    stderr: text("stderr").notNull().default(""),
    exitCode: integer("exit_code").notNull().default(0),
    cwd: text("cwd").notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actorExecutedIdx: index("terminal_history_actor_executed_idx").on(table.actorId, table.executedAt),
  }),
);
