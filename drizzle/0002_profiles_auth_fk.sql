-- A profile without a matching auth.users row can never sign in, so it is
-- safe to remove before the FK exists.
delete from profiles p where not exists (select 1 from auth.users u where u.id = p.id);

alter table profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
