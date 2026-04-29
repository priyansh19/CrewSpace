import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    primaryAgentId: uuid("primary_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("chat_sessions_company_idx").on(table.companyId),
    index("chat_sessions_company_updated_idx").on(table.companyId, table.updatedAt),
  ],
);
