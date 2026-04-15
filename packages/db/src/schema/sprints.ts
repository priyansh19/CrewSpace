import { pgTable, uuid, text, timestamp, index, primaryKey } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";

export const sprints = pgTable(
  "sprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    goal: text("goal"),
    status: text("status").notNull().default("upcoming"), // upcoming | active | completed
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    createdByUserId: text("created_by_user_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("sprints_company_status_idx").on(table.companyId, table.status),
    companyCreatedIdx: index("sprints_company_created_idx").on(table.companyId, table.createdAt),
  }),
);

export const sprintIssues = pgTable(
  "sprint_issues",
  {
    sprintId: uuid("sprint_id").notNull().references(() => sprints.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.sprintId, table.issueId] }),
    sprintIdx: index("sprint_issues_sprint_idx").on(table.sprintId),
    issueIdx: index("sprint_issues_issue_idx").on(table.issueId),
    companyIdx: index("sprint_issues_company_idx").on(table.companyId),
  }),
);
