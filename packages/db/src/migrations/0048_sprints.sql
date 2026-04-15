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
CREATE TABLE "sprint_issues" (
	"sprint_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sprint_issues_pk" PRIMARY KEY("sprint_id","issue_id")
);
--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sprint_issues" ADD CONSTRAINT "sprint_issues_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sprint_issues" ADD CONSTRAINT "sprint_issues_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sprint_issues" ADD CONSTRAINT "sprint_issues_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sprints_company_status_idx" ON "sprints" USING btree ("company_id","status");
--> statement-breakpoint
CREATE INDEX "sprints_company_created_idx" ON "sprints" USING btree ("company_id","created_at");
--> statement-breakpoint
CREATE INDEX "sprint_issues_sprint_idx" ON "sprint_issues" USING btree ("sprint_id");
--> statement-breakpoint
CREATE INDEX "sprint_issues_issue_idx" ON "sprint_issues" USING btree ("issue_id");
--> statement-breakpoint
CREATE INDEX "sprint_issues_company_idx" ON "sprint_issues" USING btree ("company_id");
