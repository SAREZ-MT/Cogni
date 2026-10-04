CREATE TABLE "flashcard_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"reviewed_count" integer DEFAULT 0 NOT NULL,
	"again_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flashcard_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "page_mastery" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"level" text NOT NULL,
	"score" double precision NOT NULL,
	"items_total" integer NOT NULL,
	"items_due" integer NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_mastery_page_id_key" UNIQUE("page_id"),
	CONSTRAINT "page_mastery_level_check" CHECK ("page_mastery"."level" in ('Nuevo', 'Aprendiendo', 'Consolidando', 'Dominado')),
	CONSTRAINT "page_mastery_score_range" CHECK ("page_mastery"."score" >= 0 and "page_mastery"."score" <= 1)
);
--> statement-breakpoint
ALTER TABLE "page_mastery" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quality" integer NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"interval_before" integer NOT NULL,
	"interval_after" integer NOT NULL,
	"easiness_after" double precision NOT NULL,
	"session_kind" text NOT NULL,
	"session_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_logs_quality_range" CHECK ("review_logs"."quality" between 0 and 5),
	CONSTRAINT "review_logs_session_kind_check" CHECK ("review_logs"."session_kind" in ('flashcards', 'exam', 'recall'))
);
--> statement-breakpoint
ALTER TABLE "review_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session_feedback" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"session_kind" text NOT NULL,
	"session_id" uuid NOT NULL,
	"content" jsonb,
	"generation_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_feedback_session_key" UNIQUE("session_kind","session_id"),
	CONSTRAINT "session_feedback_session_kind_check" CHECK ("session_feedback"."session_kind" in ('flashcards', 'exam', 'recall')),
	CONSTRAINT "session_feedback_status_check" CHECK ("session_feedback"."status" in ('pending', 'done', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "session_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "study_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source_id" uuid NOT NULL,
	"easiness" double precision DEFAULT 2.5 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"last_quality" integer,
	"last_reviewed_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_items_kind_source_key" UNIQUE("kind","source_id"),
	CONSTRAINT "study_items_kind_check" CHECK ("study_items"."kind" in ('flashcard', 'exam_question', 'recall_question')),
	CONSTRAINT "study_items_easiness_min" CHECK ("study_items"."easiness" >= 1.3),
	CONSTRAINT "study_items_counters_non_negative" CHECK ("study_items"."interval_days" >= 0 and "study_items"."repetitions" >= 0 and "study_items"."lapses" >= 0),
	CONSTRAINT "study_items_last_quality_range" CHECK ("study_items"."last_quality" between 0 and 5)
);
--> statement-breakpoint
ALTER TABLE "study_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "flashcard_sessions" ADD CONSTRAINT "flashcard_sessions_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_sessions" ADD CONSTRAINT "flashcard_sessions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_mastery" ADD CONSTRAINT "page_mastery_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_mastery" ADD CONSTRAINT "page_mastery_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_item_id_study_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."study_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_feedback" ADD CONSTRAINT "session_feedback_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_feedback" ADD CONSTRAINT "session_feedback_generation_id_ai_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_items" ADD CONSTRAINT "study_items_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_items" ADD CONSTRAINT "study_items_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flashcard_sessions_owner_started_idx" ON "flashcard_sessions" USING btree ("owner_id","started_at");--> statement-breakpoint
CREATE INDEX "flashcard_sessions_page_id_idx" ON "flashcard_sessions" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_mastery_owner_id_idx" ON "page_mastery" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "review_logs_item_reviewed_idx" ON "review_logs" USING btree ("item_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "review_logs_owner_reviewed_idx" ON "review_logs" USING btree ("owner_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "session_feedback_owner_id_idx" ON "session_feedback" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "study_items_owner_due_idx" ON "study_items" USING btree ("owner_id","due_at");--> statement-breakpoint
CREATE INDEX "study_items_page_id_idx" ON "study_items" USING btree ("page_id");--> statement-breakpoint
-- Hand-written backfill (T2): every existing, non-archived flashcard gets the
-- study item it would have had from the start (documento-maestro §3.4):
-- easiness 2.5, interval 0, repetitions 0, lapses 0, due at the card's
-- creation, so pre-Phase-4 decks are due immediately. ids are v4 here
-- (gen_random_uuid) because Postgres has no v7 generator before 18; the
-- application keeps creating v7 ids. ON CONFLICT keeps it re-runnable.
-- tests/db/study-engine-schema.smoke.test.ts runs the statement between
-- the two markers below.
-- backfill:study_items:start
INSERT INTO "study_items" ("id", "owner_id", "page_id", "kind", "source_id", "easiness", "interval_days", "repetitions", "lapses", "due_at", "created_at", "updated_at")
SELECT gen_random_uuid(), "f"."owner_id", "f"."page_id", 'flashcard', "f"."id", 2.5, 0, 0, 0, "f"."created_at", "f"."created_at", now()
FROM "flashcards" "f"
WHERE "f"."archived_at" IS NULL
ON CONFLICT ("kind", "source_id") DO NOTHING;
-- backfill:study_items:end
