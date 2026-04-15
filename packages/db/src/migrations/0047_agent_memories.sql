CREATE TABLE "agent_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"memory_type" text DEFAULT 'fact' NOT NULL,
	"metadata" jsonb,
	"archived_at" timestamp with time zone,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"updated_by_agent_id" uuid,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memory_agents" (
	"memory_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_memory_agents_pk" PRIMARY KEY("memory_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE "agent_memory_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"source_memory_id" uuid NOT NULL,
	"target_memory_id" uuid NOT NULL,
	"relationship_type" text DEFAULT 'related_to' NOT NULL,
	"label" text,
	"weight" text DEFAULT '1.0',
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_updated_by_agent_id_agents_id_fk" FOREIGN KEY ("updated_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_memory_agents" ADD CONSTRAINT "agent_memory_agents_memory_id_agent_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."agent_memories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_memory_agents" ADD CONSTRAINT "agent_memory_agents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_memory_agents" ADD CONSTRAINT "agent_memory_agents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_memory_links" ADD CONSTRAINT "agent_memory_links_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_memory_links" ADD CONSTRAINT "agent_memory_links_source_memory_id_agent_memories_id_fk" FOREIGN KEY ("source_memory_id") REFERENCES "public"."agent_memories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_memory_links" ADD CONSTRAINT "agent_memory_links_target_memory_id_agent_memories_id_fk" FOREIGN KEY ("target_memory_id") REFERENCES "public"."agent_memories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agent_memories_company_type_idx" ON "agent_memories" USING btree ("company_id","memory_type");
--> statement-breakpoint
CREATE INDEX "agent_memories_company_created_idx" ON "agent_memories" USING btree ("company_id","created_at");
--> statement-breakpoint
CREATE INDEX "agent_memory_agents_memory_idx" ON "agent_memory_agents" USING btree ("memory_id");
--> statement-breakpoint
CREATE INDEX "agent_memory_agents_agent_idx" ON "agent_memory_agents" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX "agent_memory_agents_company_idx" ON "agent_memory_agents" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX "agent_memory_links_company_idx" ON "agent_memory_links" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX "agent_memory_links_source_idx" ON "agent_memory_links" USING btree ("source_memory_id");
--> statement-breakpoint
CREATE INDEX "agent_memory_links_target_idx" ON "agent_memory_links" USING btree ("target_memory_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_memory_links_pair_uq" ON "agent_memory_links" USING btree ("source_memory_id","target_memory_id");
