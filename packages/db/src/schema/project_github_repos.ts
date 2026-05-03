import { pgTable, uuid, integer, text, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";

export const projectGithubRepos = pgTable("project_github_repos", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  installationId: integer("installation_id").notNull(),
  repoOwner: text("repo_owner").notNull(),
  repoName: text("repo_name").notNull(),
  defaultBranch: text("default_branch").notNull().default("main"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
