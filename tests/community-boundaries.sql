-- Local-only test data, rolled back even on success. now() is fixed within this
-- transaction, so exact inclusive/exclusive boundaries need no sleeps or mocks.
begin;
create temporary table expected_period_access (
  id uuid default gen_random_uuid(), label text, visible boolean,
  starts timestamptz, ends timestamptz, status text default 'published',
  is_public boolean default true, sensitive boolean default false
) on commit drop;
insert into expected_period_access(label,visible,starts,ends) values
  ('unbounded', true, null, null),
  ('start equals now', true, now(), null),
  ('start one microsecond later', false, now()+interval '1 microsecond', null),
  ('end equals now', false, null, now()),
  ('end one microsecond before', false, null, now()-interval '1 microsecond'),
  ('end one microsecond later', true, null, now()+interval '1 microsecond'),
  ('inside both bounds', true, now()-interval '1 microsecond', now()+interval '1 microsecond');
insert into expected_period_access(label,visible,status,is_public,sensitive) values
  ('draft',false,'draft',true,false),
  ('archived',false,'archived',true,false),
  ('private',false,'published',false,false),
  ('sensitive private',false,'published',false,true);
insert into public.community_entries(id,kind,title,body,status,is_public,sensitive,publish_from,publish_until)
  select id,'notice',label,'period boundary fixture',status,is_public,sensitive,starts,ends from expected_period_access;
grant select on expected_period_access to anon;
set local role anon;
do $$
declare expected uuid[]; actual uuid[];
begin
  if current_user <> 'anon' then raise exception 'Boundary test must exercise anon RLS'; end if;
  select array_agg(id order by id) into expected from expected_period_access where visible;
  select array_agg(id order by id) into actual from public.community_entries
    where id in (select id from expected_period_access);
  if actual is distinct from expected then raise exception 'Community boundary RLS mismatch'; end if;
end $$;
reset role;
rollback;
