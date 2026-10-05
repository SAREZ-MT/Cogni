CREATE TABLE "exam_answers" (
	"owner_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"root_id" uuid NOT NULL,
	"selected_index" integer NOT NULL,
	"is_correct" boolean NOT NULL,
	"answered_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_answers_pkey" PRIMARY KEY("session_id","question_id"),
	CONSTRAINT "exam_answers_session_root_key" UNIQUE("session_id","root_id"),
	CONSTRAINT "exam_answers_selected_index_range" CHECK ("exam_answers"."selected_index" between 0 and 3)
);
--> statement-breakpoint
ALTER TABLE "exam_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_page_state" (
	"page_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"retake_pending" boolean DEFAULT false NOT NULL,
	"failed_root_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_passed_session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_page_state_failed_root_ids_array" CHECK (jsonb_typeof("exam_page_state"."failed_root_ids") = 'array')
);
--> statement-breakpoint
ALTER TABLE "exam_page_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"stem" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"explanation" text NOT NULL,
	"concept" text NOT NULL,
	"root_id" uuid NOT NULL,
	"variant_of" uuid,
	"origin" text NOT NULL,
	"generation_id" uuid,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_questions_origin_check" CHECK ("exam_questions"."origin" in ('ai', 'manual', 'ai_variant')),
	CONSTRAINT "exam_questions_options_count" CHECK (jsonb_typeof("exam_questions"."options") = 'array' and jsonb_array_length("exam_questions"."options") = 4),
	CONSTRAINT "exam_questions_correct_index_range" CHECK ("exam_questions"."correct_index" between 0 and 3),
	CONSTRAINT "exam_questions_stem_not_blank" CHECK (length(btrim("exam_questions"."stem")) > 0),
	CONSTRAINT "exam_questions_concept_not_blank" CHECK (length(btrim("exam_questions"."concept")) > 0),
	CONSTRAINT "exam_questions_lineage_check" CHECK (("exam_questions"."variant_of" is null) = ("exam_questions"."root_id" = "exam_questions"."id"))
);
--> statement-breakpoint
ALTER TABLE "exam_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"requested_count" integer NOT NULL,
	"is_retake" boolean DEFAULT false NOT NULL,
	"retake_of_session_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"total" integer,
	"correct" integer,
	"score" double precision,
	"passed" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_sessions_requested_count_range" CHECK ("exam_sessions"."requested_count" between 10 and 30),
	CONSTRAINT "exam_sessions_retake_check" CHECK ("exam_sessions"."retake_of_session_id" is null or "exam_sessions"."is_retake"),
	CONSTRAINT "exam_sessions_result_check" CHECK (("exam_sessions"."finished_at" is null and "exam_sessions"."total" is null and "exam_sessions"."correct" is null and "exam_sessions"."score" is null and "exam_sessions"."passed" is null)
        or ("exam_sessions"."finished_at" is not null and "exam_sessions"."total" between 1 and "exam_sessions"."requested_count"
          and "exam_sessions"."correct" between 0 and "exam_sessions"."total"
          and "exam_sessions"."score" between 0 and 1 and "exam_sessions"."passed" is not null))
);
--> statement-breakpoint
ALTER TABLE "exam_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_session_id_exam_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."exam_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_question_id_exam_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."exam_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_root_id_exam_questions_id_fk" FOREIGN KEY ("root_id") REFERENCES "public"."exam_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_page_state" ADD CONSTRAINT "exam_page_state_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_page_state" ADD CONSTRAINT "exam_page_state_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_page_state" ADD CONSTRAINT "exam_page_state_last_passed_session_id_exam_sessions_id_fk" FOREIGN KEY ("last_passed_session_id") REFERENCES "public"."exam_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_root_id_exam_questions_id_fk" FOREIGN KEY ("root_id") REFERENCES "public"."exam_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_variant_of_exam_questions_id_fk" FOREIGN KEY ("variant_of") REFERENCES "public"."exam_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_generation_id_ai_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_retake_of_session_id_exam_sessions_id_fk" FOREIGN KEY ("retake_of_session_id") REFERENCES "public"."exam_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_answers_question_id_idx" ON "exam_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "exam_answers_owner_id_idx" ON "exam_answers" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "exam_page_state_owner_id_idx" ON "exam_page_state" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "exam_questions_page_active_idx" ON "exam_questions" USING btree ("page_id","created_at") WHERE "exam_questions"."retired_at" is null;--> statement-breakpoint
CREATE INDEX "exam_questions_root_id_idx" ON "exam_questions" USING btree ("root_id");--> statement-breakpoint
CREATE INDEX "exam_questions_owner_id_idx" ON "exam_questions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "exam_sessions_page_finished_idx" ON "exam_sessions" USING btree ("page_id","finished_at");--> statement-breakpoint
CREATE INDEX "exam_sessions_owner_started_idx" ON "exam_sessions" USING btree ("owner_id","started_at");