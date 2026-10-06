-- Manual reversion for 0012_active_recall.sql (drizzle-kit has no `down`
-- command; apply by hand with psql or the Supabase SQL editor).
-- recall_answers references recall_sessions and recall_questions, so it
-- goes first. Every recall question, session and answer is lost; the
-- study items of kind recall_question (0009) and the review logs of
-- session kind recall stay and must be removed by hand if active recall
-- is not coming back.
drop table if exists recall_answers;
drop table if exists recall_sessions;
drop table if exists recall_questions;
