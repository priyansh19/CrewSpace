import { pgTable, uuid, boolean, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { agents } from "./agents.js";

export const projectRepoPermissions = pgTable("project_repo_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  canRead: boolean("can_read").notNull().default(true),
  canPush: boolean("can_push").notNull().default(false),
  canCreateBranch: boolean("can_create_branch").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
