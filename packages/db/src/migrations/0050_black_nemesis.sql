CREATE TABLE "github_oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "github_oauth_states_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "project_github_repos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"installation_id" integer NOT NULL,
	"repo_owner" text NOT NULL,
	"repo_name" text NOT NULL,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_repo_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"can_read" boolean DEFAULT true NOT NULL,
	"can_push" boolean DEFAULT false NOT NULL,
	"can_create_branch" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_workspace_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"filename" text NOT NULL,
	"stored_path" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"uploaded_by_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_workspace_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"can_read" boolean DEFAULT true NOT NULL,
	"can_write" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_oauth_states" ADD CONSTRAINT "github_oauth_states_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_oauth_states" ADD CONSTRAINT "github_oauth_states_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_repos" ADD CONSTRAINT "project_github_repos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_repos" ADD CONSTRAINT "project_github_repos_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_repo_permissions" ADD CONSTRAINT "project_repo_permissions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_repo_permissions" ADD CONSTRAINT "project_repo_permissions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_workspace_files" ADD CONSTRAINT "shared_workspace_files_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_workspace_files" ADD CONSTRAINT "shared_workspace_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_workspace_files" ADD CONSTRAINT "shared_workspace_files_uploaded_by_agent_id_agents_id_fk" FOREIGN KEY ("uploaded_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_workspace_permissions" ADD CONSTRAINT "shared_workspace_permissions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_workspace_permissions" ADD CONSTRAINT "shared_workspace_permissions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;