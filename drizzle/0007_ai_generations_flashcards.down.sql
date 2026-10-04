-- Manual reversion for 0007_ai_generations_flashcards.sql (drizzle-kit has no
-- `down` command; apply by hand with psql or the Supabase SQL editor).
-- flashcards references ai_generations, so it goes first. All generated cards
-- and the AI audit trail are lost.
drop table if exists flashcards;
drop table if exists ai_generations;
