import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const agentMemories = pgTable(
  "agent_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content"),
    memoryType: text("memory_type").notNull().default("fact"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id"),
    updatedByAgentId: uuid("updated_by_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("agent_memories_company_type_idx").on(
      table.companyId,
      table.memoryType,
    ),
    index("agent_memories_company_created_idx").on(
      table.companyId,
      table.createdAt,
    ),
  ],
);

export const agentMemoryAgents = pgTable(
  "agent_memory_agents",
  {
    memoryId: uuid("memory_id")
      .notNull()
      .references(() => agentMemories.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    isOwner: boolean("is_owner").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.memoryId, table.agentId],
      name: "agent_memory_agents_pk",
    }),
    index("agent_memory_agents_memory_idx").on(table.memoryId),
    index("agent_memory_agents_agent_idx").on(table.agentId),
    index("agent_memory_agents_company_idx").on(table.companyId),
  ],
);

export const agentMemoryLinks = pgTable(
  "agent_memory_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    sourceMemoryId: uuid("source_memory_id")
      .notNull()
      .references(() => agentMemories.id, { onDelete: "cascade" }),
    targetMemoryId: uuid("target_memory_id")
      .notNull()
      .references(() => agentMemories.id, { onDelete: "cascade" }),
    relationshipType: text("relationship_type")
      .notNull()
      .default("related_to"),
    label: text("label"),
    weight: text("weight").default("1.0"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("agent_memory_links_company_idx").on(table.companyId),
    index("agent_memory_links_source_idx").on(table.sourceMemoryId),
    index("agent_memory_links_target_idx").on(table.targetMemoryId),
    uniqueIndex("agent_memory_links_pair_uq").on(
      table.sourceMemoryId,
      table.targetMemoryId,
    ),
  ],
);
