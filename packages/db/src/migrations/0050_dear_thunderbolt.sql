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
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_session_participants" (
	"session_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_session_participants_pk" PRIMARY KEY("session_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"primary_agent_id" uuid NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sprint_issues" (
	"sprint_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sprint_issues_sprint_id_issue_id_pk" PRIMARY KEY("sprint_id","issue_id")
);
--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal" text,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"created_by_user_id" text,
	"created_by_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terminal_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text NOT NULL,
	"command" text NOT NULL,
	"stdout" text DEFAULT '' NOT NULL,
	"stderr" text DEFAULT '' NOT NULL,
	"exit_code" integer DEFAULT 0 NOT NULL,
	"cwd" text NOT NULL,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_updated_by_agent_id_agents_id_fk" FOREIGN KEY ("updated_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_agents" ADD CONSTRAINT "agent_memory_agents_memory_id_agent_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."agent_memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_agents" ADD CONSTRAINT "agent_memory_agents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_agents" ADD CONSTRAINT "agent_memory_agents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_links" ADD CONSTRAINT "agent_memory_links_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_links" ADD CONSTRAINT "agent_memory_links_source_memory_id_agent_memories_id_fk" FOREIGN KEY ("source_memory_id") REFERENCES "public"."agent_memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_links" ADD CONSTRAINT "agent_memory_links_target_memory_id_agent_memories_id_fk" FOREIGN KEY ("target_memory_id") REFERENCES "public"."agent_memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_links" ADD CONSTRAINT "agent_memory_links_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_session_participants" ADD CONSTRAINT "chat_session_participants_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_session_participants" ADD CONSTRAINT "chat_session_participants_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_primary_agent_id_agents_id_fk" FOREIGN KEY ("primary_agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_issues" ADD CONSTRAINT "sprint_issues_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_issues" ADD CONSTRAINT "sprint_issues_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_issues" ADD CONSTRAINT "sprint_issues_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_memories_company_type_idx" ON "agent_memories" USING btree ("company_id","memory_type");--> statement-breakpoint
CREATE INDEX "agent_memories_company_created_idx" ON "agent_memories" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_memory_agents_memory_idx" ON "agent_memory_agents" USING btree ("memory_id");--> statement-breakpoint
CREATE INDEX "agent_memory_agents_agent_idx" ON "agent_memory_agents" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_memory_agents_company_idx" ON "agent_memory_agents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "agent_memory_links_company_idx" ON "agent_memory_links" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "agent_memory_links_source_idx" ON "agent_memory_links" USING btree ("source_memory_id");--> statement-breakpoint
CREATE INDEX "agent_memory_links_target_idx" ON "agent_memory_links" USING btree ("target_memory_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_memory_links_pair_uq" ON "agent_memory_links" USING btree ("source_memory_id","target_memory_id");--> statement-breakpoint
CREATE INDEX "chat_messages_session_created_idx" ON "chat_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_session_participants_session_idx" ON "chat_session_participants" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_session_participants_agent_idx" ON "chat_session_participants" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_company_idx" ON "chat_sessions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_company_updated_idx" ON "chat_sessions" USING btree ("company_id","updated_at");--> statement-breakpoint
CREATE INDEX "sprint_issues_sprint_idx" ON "sprint_issues" USING btree ("sprint_id");--> statement-breakpoint
CREATE INDEX "sprint_issues_issue_idx" ON "sprint_issues" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "sprint_issues_company_idx" ON "sprint_issues" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sprints_company_status_idx" ON "sprints" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "sprints_company_created_idx" ON "sprints" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "terminal_history_actor_executed_idx" ON "terminal_history" USING btree ("actor_id","executed_at");