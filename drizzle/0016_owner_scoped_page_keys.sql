-- security-hardening S6b: tenant isolation in the database itself. A page
-- carries its notebook's owner, and every row that hangs from a page carries
-- the page's owner (composite keys instead of the single-column ones).
-- Hand-reordered: the two unique constraints come first because the
-- composite keys below reference them. ai_generations.page_id keeps its
-- single-column SET NULL key. The migration fails, changing nothing, if an
-- existing row already has an owner different from its page's (or a page
-- from its notebook's).
ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_id_owner_key" UNIQUE("id","owner_id");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_id_owner_key" UNIQUE("id","owner_id");--> statement-breakpoint
ALTER TABLE "exam_page_state" DROP CONSTRAINT "exam_page_state_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "exam_questions" DROP CONSTRAINT "exam_questions_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "exam_sessions" DROP CONSTRAINT "exam_sessions_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "flashcard_sessions" DROP CONSTRAINT "flashcard_sessions_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "flashcards" DROP CONSTRAINT "flashcards_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_fingerprints" DROP CONSTRAINT "generation_fingerprints_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "import_jobs" DROP CONSTRAINT "import_jobs_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "page_assets" DROP CONSTRAINT "page_assets_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "page_mastery" DROP CONSTRAINT "page_mastery_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "pages" DROP CONSTRAINT "pages_notebook_id_notebooks_id_fk";
--> statement-breakpoint
ALTER TABLE "recall_questions" DROP CONSTRAINT "recall_questions_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "recall_sessions" DROP CONSTRAINT "recall_sessions_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "study_items" DROP CONSTRAINT "study_items_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_notebook_owner_fk" FOREIGN KEY ("notebook_id","owner_id") REFERENCES "public"."notebooks"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_page_state" ADD CONSTRAINT "exam_page_state_page_owner_fk" FOREIGN KEY ("page_id","owner_id") REFERENCES "public"."pages"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_page_owner_fk" FOREIGN KEY ("page_id","owner_id") REFERENCES "public"."pages"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_page_owner_fk" FOREIGN KEY ("page_id","owner_id") REFERENCES "public"."pages"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_sessions" ADD CONSTRAINT "flashcard_sessions_page_owner_fk" FOREIGN KEY ("page_id","owner_id") REFERENCES "public"."pages"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_page_owner_fk" FOREIGN KEY ("page_id","owner_id") REFERENCES "public"."pages"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_fingerprints" ADD CONSTRAINT "generation_fingerprints_page_owner_fk" FOREIGN KEY ("page_id","owner_id") REFERENCES "public"."pages"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_page_owner_fk" FOREIGN KEY ("page_id","owner_id") REFERENCES "public"."pages"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_assets" ADD CONSTRAINT "page_assets_page_owner_fk" FOREIGN KEY ("page_id","owner_id") REFERENCES "public"."pages"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_mastery" ADD CONSTRAINT "page_mastery_page_owner_fk" FOREIGN KEY ("page_id","owner_id") REFERENCES "public"."pages"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_questions" ADD CONSTRAINT "recall_questions_page_owner_fk" FOREIGN KEY ("page_id","owner_id") REFERENCES "public"."pages"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_sessions" ADD CONSTRAINT "recall_sessions_page_owner_fk" FOREIGN KEY ("page_id","owner_id") REFERENCES "public"."pages"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_items" ADD CONSTRAINT "study_items_page_owner_fk" FOREIGN KEY ("page_id","owner_id") REFERENCES "public"."pages"("id","owner_id") ON DELETE cascade ON UPDATE no action;
