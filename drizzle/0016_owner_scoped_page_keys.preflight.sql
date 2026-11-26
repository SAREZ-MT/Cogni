-- Read-only check for 0016_owner_scoped_page_keys.sql: lists, per table, the
-- rows the migration would refuse (a page whose owner is not its notebook's,
-- or a row whose owner is not its page's). An empty result means the
-- migration applies. Run by hand (psql or the Supabase SQL editor) before a
-- deploy that carries the migration; it changes nothing.
select 'pages' as table_name, count(*) as mismatched_rows
from pages p join notebooks n on n.id = p.notebook_id
where p.owner_id <> n.owner_id
having count(*) > 0
union all
select 'page_assets', count(*)
from page_assets c join pages p on p.id = c.page_id
where c.owner_id <> p.owner_id
having count(*) > 0
union all
select 'import_jobs', count(*)
from import_jobs c join pages p on p.id = c.page_id
where c.owner_id <> p.owner_id
having count(*) > 0
union all
select 'flashcards', count(*)
from flashcards c join pages p on p.id = c.page_id
where c.owner_id <> p.owner_id
having count(*) > 0
union all
select 'study_items', count(*)
from study_items c join pages p on p.id = c.page_id
where c.owner_id <> p.owner_id
having count(*) > 0
union all
select 'page_mastery', count(*)
from page_mastery c join pages p on p.id = c.page_id
where c.owner_id <> p.owner_id
having count(*) > 0
union all
select 'flashcard_sessions', count(*)
from flashcard_sessions c join pages p on p.id = c.page_id
where c.owner_id <> p.owner_id
having count(*) > 0
union all
select 'exam_questions', count(*)
from exam_questions c join pages p on p.id = c.page_id
where c.owner_id <> p.owner_id
having count(*) > 0
union all
select 'exam_sessions', count(*)
from exam_sessions c join pages p on p.id = c.page_id
where c.owner_id <> p.owner_id
having count(*) > 0
union all
select 'exam_page_state', count(*)
from exam_page_state c join pages p on p.id = c.page_id
where c.owner_id <> p.owner_id
having count(*) > 0
union all
select 'recall_questions', count(*)
from recall_questions c join pages p on p.id = c.page_id
where c.owner_id <> p.owner_id
having count(*) > 0
union all
select 'recall_sessions', count(*)
from recall_sessions c join pages p on p.id = c.page_id
where c.owner_id <> p.owner_id
having count(*) > 0
union all
select 'generation_fingerprints', count(*)
from generation_fingerprints c join pages p on p.id = c.page_id
where c.owner_id <> p.owner_id
having count(*) > 0;
