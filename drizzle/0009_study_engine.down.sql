-- Manual reversion for 0009_study_engine.sql (drizzle-kit has no `down`
-- command; apply by hand with psql or the Supabase SQL editor).
-- review_logs references study_items, so it goes first. Every SM-2 state,
-- review history, page mastery, flashcard session and session feedback is
-- lost, and archived flashcards become visible again (archived_at is gone).
drop table if exists session_feedback;
drop table if exists flashcard_sessions;
drop table if exists page_mastery;
drop table if exists review_logs;
drop table if exists study_items;
alter table flashcards drop column if exists archived_at;
