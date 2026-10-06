CREATE TABLE "recall_answers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer_text" text NOT NULL,
	"self_rating" integer NOT NULL,
	"evaluation_status" text DEFAULT 'pending' NOT NULL,
	"ai_evaluation" jsonb,
	"ai_score" integer,
	"combined_quality" integer,
	"generation_id" uuid,
	"disagreed" boolean DEFAULT false NOT NULL,
	"evaluation_claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recall_answers_session_question_key" UNIQUE("session_id","question_id"),
	CONSTRAINT "recall_answers_self_rating_range" CHECK ("recall_answers"."self_rating" between 0 and 5),
	CONSTRAINT "recall_answers_ai_score_range" CHECK ("recall_answers"."ai_score" between 0 and 5),
	CONSTRAINT "recall_answers_combined_quality_range" CHECK ("recall_answers"."combined_quality" between 0 and 5),
	CONSTRAINT "recall_answers_evaluation_check" CHECK (("recall_answers"."evaluation_status" = 'pending' and "recall_answers"."ai_score" is null and "recall_answers"."combined_quality" is null)
        or ("recall_answers"."evaluation_status" = 'done' and "recall_answers"."ai_evaluation" is not null
          and "recall_answers"."ai_score" is not null and "recall_answers"."combined_quality" is not null)
        or ("recall_answers"."evaluation_status" = 'failed' and "recall_answers"."ai_evaluation" is not null
          and "recall_answers"."ai_score" is null and "recall_answers"."combined_quality" is null))
);
--> statement-breakpoint
ALTER TABLE "recall_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recall_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"rubric" jsonb NOT NULL,
	"origin" text NOT NULL,
	"generation_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recall_questions_id_owner_key" UNIQUE("id","owner_id"),
	CONSTRAINT "recall_questions_origin_check" CHECK ("recall_questions"."origin" in ('ai', 'manual')),
	CONSTRAINT "recall_questions_prompt_not_blank" CHECK (length(btrim("recall_questions"."prompt")) > 0),
	CONSTRAINT "recall_questions_rubric_shape" CHECK (coalesce(jsonb_typeof("recall_questions"."rubric") = 'object'
        and case when jsonb_typeof("recall_questions"."rubric" -> 'keyConcepts') = 'array'
          then jsonb_array_length("recall_questions"."rubric" -> 'keyConcepts') > 0
          else false end
        and jsonb_typeof("recall_questions"."rubric" -> 'acceptableAnswerSummary') = 'string'
        and length(btrim("recall_questions"."rubric" ->> 'acceptableAnswerSummary')) > 0, false))
);
--> statement-breakpoint
ALTER TABLE "recall_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recall_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"evaluation_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recall_sessions_id_owner_key" UNIQUE("id","owner_id"),
	CONSTRAINT "recall_sessions_evaluation_status_check" CHECK ("recall_sessions"."evaluation_status" in ('pending', 'done', 'partial')
        and ("recall_sessions"."evaluation_status" = 'pending' or "recall_sessions"."finished_at" is not null)),
	CONSTRAINT "recall_sessions_finished_after_start" CHECK ("recall_sessions"."finished_at" is null or "recall_sessions"."finished_at" >= "recall_sessions"."started_at")
);
--> statement-breakpoint
ALTER TABLE "recall_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recall_answers" ADD CONSTRAINT "recall_answers_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_answers" ADD CONSTRAINT "recall_answers_generation_id_ai_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_answers" ADD CONSTRAINT "recall_answers_session_owner_fk" FOREIGN KEY ("session_id","owner_id") REFERENCES "public"."recall_sessions"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_answers" ADD CONSTRAINT "recall_answers_question_owner_fk" FOREIGN KEY ("question_id","owner_id") REFERENCES "public"."recall_questions"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_questions" ADD CONSTRAINT "recall_questions_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_questions" ADD CONSTRAINT "recall_questions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_questions" ADD CONSTRAINT "recall_questions_generation_id_ai_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_sessions" ADD CONSTRAINT "recall_sessions_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_sessions" ADD CONSTRAINT "recall_sessions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recall_answers_session_pending_idx" ON "recall_answers" USING btree ("session_id") WHERE "recall_answers"."evaluation_status" = 'pending';--> statement-breakpoint
CREATE INDEX "recall_answers_question_id_idx" ON "recall_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "recall_answers_owner_id_idx" ON "recall_answers" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "recall_questions_page_active_idx" ON "recall_questions" USING btree ("page_id","created_at") WHERE "recall_questions"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "recall_questions_owner_id_idx" ON "recall_questions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "recall_sessions_page_started_idx" ON "recall_sessions" USING btree ("page_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recall_sessions_owner_started_idx" ON "recall_sessions" USING btree ("owner_id","started_at" DESC NULLS LAST);