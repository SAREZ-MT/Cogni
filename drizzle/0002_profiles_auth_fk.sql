-- Fails closed: refuses to delete profiles when auth.users looks empty,
-- because that shape means DATABASE_URL is probably pointed at the wrong DB.
-- guard:start
do $$
declare
  users_count bigint;
  profiles_count bigint;
  orphan_count bigint;
begin
  select count(*) into users_count from auth.users;
  select count(*) into profiles_count from profiles;
  select count(*) into orphan_count
    from profiles p
    where not exists (select 1 from auth.users u where u.id = p.id);
  raise notice '0002_profiles_auth_fk: auth.users=%, profiles=%, orphans=%', users_count, profiles_count, orphan_count;
  if users_count = 0 and profiles_count > 0 then
    raise exception '0002_profiles_auth_fk: refusing to delete % profiles because auth.users is empty; check DATABASE_URL and clean orphans by hand', profiles_count;
  end if;
end $$;
-- guard:end
--> statement-breakpoint
-- A profile without a matching auth.users row can never sign in, so it is
-- safe to remove before the FK exists.
delete from profiles p where not exists (select 1 from auth.users u where u.id = p.id);
--> statement-breakpoint
alter table profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
