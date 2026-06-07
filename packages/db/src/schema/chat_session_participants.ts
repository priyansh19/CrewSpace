import { pgTable, uuid, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { chatSessions } from "./chat_sessions.js";
import { agents } from "./agents.js";

export const chatSessionParticipants = pgTable(
  "chat_session_participants",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.agentId], name: "chat_session_participants_pk" }),
    index("chat_session_participants_session_idx").on(table.sessionId),
    index("chat_session_participants_agent_idx").on(table.agentId),
  ],
);
