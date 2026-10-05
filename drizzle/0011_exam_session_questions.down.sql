-- Manual reversion for 0011_exam_session_questions.sql (drizzle-kit has no
-- `down` command; apply by hand with psql or the Supabase SQL editor).
-- Open sessions lose their question list; the code before 0011 composes
-- it again from the page.
alter table exam_sessions drop constraint if exists exam_sessions_question_ids_check;
alter table exam_sessions drop column if exists question_ids;
