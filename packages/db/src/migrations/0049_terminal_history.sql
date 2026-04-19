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
CREATE INDEX "terminal_history_actor_executed_idx" ON "terminal_history" USING btree ("actor_id","executed_at");
