-- Each exam session stores the ordered ids of the questions it shows,
-- fixed at its start, instead of composing them again on every answer,
-- finish and read. No default and no backfill: exam_sessions is empty
-- wherever this runs (sessions ship together with this migration), and a
-- non-empty table makes the NOT NULL fail loudly instead of inventing lists.
ALTER TABLE "exam_sessions" ADD COLUMN "question_ids" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_question_ids_check" CHECK (jsonb_typeof("exam_sessions"."question_ids") = 'array' and jsonb_array_length("exam_sessions"."question_ids") between 1 and "exam_sessions"."requested_count");