import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";

export const githubOAuthStates = pgTable("github_oauth_states", {
  id: uuid("id").primaryKey().defaultRandom(),
  state: text("state").notNull().unique(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
