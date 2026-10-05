-- Manual reversion for 0010_exams.sql (drizzle-kit has no `down` command;
-- apply by hand with psql or the Supabase SQL editor). exam_answers and
-- exam_page_state reference exam_sessions and exam_questions, so they go
-- first; dropping the tables drops their composite lineage keys too. Every
-- exam question, session, answer and page state is lost; the
-- study items of kind exam_question (0009) stay and must be removed by
-- hand if the exams are not coming back.
drop table if exists exam_page_state;
drop table if exists exam_answers;
drop table if exists exam_sessions;
drop table if exists exam_questions;
