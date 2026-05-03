import { pgTable, uuid, boolean, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { agents } from "./agents.js";

export const sharedWorkspacePermissions = pgTable("shared_workspace_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  canRead: boolean("can_read").notNull().default(true),
  canWrite: boolean("can_write").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
