ALTER TABLE "issues" ADD COLUMN "queue_rank" integer;--> statement-breakpoint
CREATE INDEX "issues_company_queue_rank_idx" ON "issues" USING btree ("company_id","queue_rank");