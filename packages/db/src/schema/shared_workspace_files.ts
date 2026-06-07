import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";
import { agents } from "./agents.js";

export const sharedWorkspaceFiles = pgTable("shared_workspace_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  storedPath: text("stored_path").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  uploadedByAgentId: uuid("uploaded_by_agent_id").references(() => agents.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
