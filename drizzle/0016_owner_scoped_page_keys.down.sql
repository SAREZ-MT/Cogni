-- Manual reversion for 0016_owner_scoped_page_keys.sql (drizzle-kit has no
-- `down` command; apply by hand with psql or the Supabase SQL editor).
-- Puts back the single-column keys (page_id -> pages.id, notebook_id ->
-- notebooks.id, ON DELETE CASCADE) under their original names and drops the
-- two unique constraints the composite keys pointed at. No row is changed;
-- the database stops refusing a row whose owner differs from its page's.
alter table pages drop constraint if exists pages_notebook_owner_fk;
alter table page_assets drop constraint if exists page_assets_page_owner_fk;
alter table import_jobs drop constraint if exists import_jobs_page_owner_fk;
alter table flashcards drop constraint if exists flashcards_page_owner_fk;
alter table study_items drop constraint if exists study_items_page_owner_fk;
alter table page_mastery drop constraint if exists page_mastery_page_owner_fk;
alter table flashcard_sessions drop constraint if exists flashcard_sessions_page_owner_fk;
alter table exam_questions drop constraint if exists exam_questions_page_owner_fk;
alter table exam_sessions drop constraint if exists exam_sessions_page_owner_fk;
alter table exam_page_state drop constraint if exists exam_page_state_page_owner_fk;
alter table recall_questions drop constraint if exists recall_questions_page_owner_fk;
alter table recall_sessions drop constraint if exists recall_sessions_page_owner_fk;
alter table generation_fingerprints drop constraint if exists generation_fingerprints_page_owner_fk;

alter table pages add constraint pages_notebook_id_notebooks_id_fk foreign key (notebook_id) references notebooks(id) on delete cascade on update no action;
alter table page_assets add constraint page_assets_page_id_pages_id_fk foreign key (page_id) references pages(id) on delete cascade on update no action;
alter table import_jobs add constraint import_jobs_page_id_pages_id_fk foreign key (page_id) references pages(id) on delete cascade on update no action;
alter table flashcards add constraint flashcards_page_id_pages_id_fk foreign key (page_id) references pages(id) on delete cascade on update no action;
alter table study_items add constraint study_items_page_id_pages_id_fk foreign key (page_id) references pages(id) on delete cascade on update no action;
alter table page_mastery add constraint page_mastery_page_id_pages_id_fk foreign key (page_id) references pages(id) on delete cascade on update no action;
alter table flashcard_sessions add constraint flashcard_sessions_page_id_pages_id_fk foreign key (page_id) references pages(id) on delete cascade on update no action;
alter table exam_questions add constraint exam_questions_page_id_pages_id_fk foreign key (page_id) references pages(id) on delete cascade on update no action;
alter table exam_sessions add constraint exam_sessions_page_id_pages_id_fk foreign key (page_id) references pages(id) on delete cascade on update no action;
alter table exam_page_state add constraint exam_page_state_page_id_pages_id_fk foreign key (page_id) references pages(id) on delete cascade on update no action;
alter table recall_questions add constraint recall_questions_page_id_pages_id_fk foreign key (page_id) references pages(id) on delete cascade on update no action;
alter table recall_sessions add constraint recall_sessions_page_id_pages_id_fk foreign key (page_id) references pages(id) on delete cascade on update no action;
alter table generation_fingerprints add constraint generation_fingerprints_page_id_pages_id_fk foreign key (page_id) references pages(id) on delete cascade on update no action;

alter table pages drop constraint if exists pages_id_owner_key;
alter table notebooks drop constraint if exists notebooks_id_owner_key;
