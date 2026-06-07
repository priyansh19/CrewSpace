import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { chatSessions } from "./chat_sessions.js";
import { agents } from "./agents.js";

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("chat_messages_session_created_idx").on(table.sessionId, table.createdAt),
  ],
);
