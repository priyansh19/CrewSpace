CREATE TABLE "ai_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'custom' NOT NULL,
	"base_url" text NOT NULL,
	"api_key_secret_id" uuid,
	"default_model" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_api_key_secret_id_company_secrets_id_fk" FOREIGN KEY ("api_key_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_providers_company_idx" ON "ai_providers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ai_providers_company_active_idx" ON "ai_providers" USING btree ("company_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_providers_company_name_uq" ON "ai_providers" USING btree ("company_id","name");