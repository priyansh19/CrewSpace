import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const featureProposals = pgTable(
  "feature_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    proposedByAgentId: uuid("proposed_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull().default("other"),
    priority: text("priority").notNull().default("normal"),
    status: text("status").notNull().default("pending"),
    createdIssueId: uuid("created_issue_id").references(() => issues.id, { onDelete: "set null" }),
    reviewedByUserId: text("reviewed_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => ({
    companyStatusIdx: index("feature_proposals_company_status_idx").on(table.companyId, table.status),
  }),
);
