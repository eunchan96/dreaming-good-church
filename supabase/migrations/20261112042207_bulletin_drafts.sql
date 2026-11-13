-- Membership is provisioned by a trusted operator, never by a browser client.
create table public.church_editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.church_editors enable row level security;
revoke all on public.church_editors from anon, authenticated;
grant select on public.church_editors to authenticated;
create policy "read own editor membership" on public.church_editors
  for select to authenticated using (user_id = (select auth.uid()));

create table public.bulletins (
  id uuid primary key default gen_random_uuid(),
  service_date date not null unique,
  issue_number integer not null check (issue_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
create table public.bulletin_items (
  id uuid primary key default gen_random_uuid(),
  bulletin_id uuid not null references public.bulletins(id) on delete cascade,
  position integer not null check (position >= 0),
  title text not null check (length(title) between 1 and 200),
  body text not null default '' check (length(body) <= 20000),
  web_visible boolean not null default true,
  review_on_copy boolean not null default false,
  needs_review boolean not null default false,
  unique (bulletin_id, position)
);
alter table public.bulletins enable row level security;
alter table public.bulletin_items enable row level security;
revoke all on public.bulletins, public.bulletin_items from anon, authenticated;
grant select, insert, update on public.bulletins to authenticated;
grant select, insert, update, delete on public.bulletin_items to authenticated;
-- This increment delivers private drafts only. Public publishing is a later feature.
create policy "editors read bulletins" on public.bulletins for select to authenticated
  using (exists (select 1 from public.church_editors where user_id = (select auth.uid())));
create policy "editors create drafts" on public.bulletins for insert to authenticated
  with check (status = 'draft' and exists (select 1 from public.church_editors where user_id = (select auth.uid())));
create policy "editors update drafts" on public.bulletins for update to authenticated
  using (status = 'draft' and exists (select 1 from public.church_editors where user_id = (select auth.uid())))
  with check (status = 'draft' and exists (select 1 from public.church_editors where user_id = (select auth.uid())));
create policy "editors read items" on public.bulletin_items for select to authenticated
  using (exists (select 1 from public.church_editors where user_id = (select auth.uid())));
create policy "editors insert draft items" on public.bulletin_items for insert to authenticated
  with check (exists (select 1 from public.bulletins where id = bulletin_id and status = 'draft'));
create policy "editors update draft items" on public.bulletin_items for update to authenticated
  using (exists (select 1 from public.bulletins where id = bulletin_id and status = 'draft'))
  with check (exists (select 1 from public.bulletins where id = bulletin_id and status = 'draft'));
create policy "editors delete draft items" on public.bulletin_items for delete to authenticated
  using (exists (select 1 from public.bulletins where id = bulletin_id and status = 'draft'));

-- Row lock + revision check make a multi-item save atomic and reject stale editors.
create function public.save_bulletin_draft(
  p_id uuid, p_service_date date, p_issue_number integer, p_revision integer, p_items jsonb
) returns public.bulletins language plpgsql security invoker set search_path = '' as $$
declare saved public.bulletins; item jsonb; item_position integer := 0;
begin
  if not exists (select 1 from public.church_editors where user_id = auth.uid()) then
    raise exception 'EDITOR_REQUIRED' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'TOO_MANY_ITEMS' using errcode = '22023';
  end if;
  if p_revision = 0 then
    insert into public.bulletins(id, service_date, issue_number)
      values (p_id, p_service_date, p_issue_number) returning * into saved;
  else
    update public.bulletins set service_date = p_service_date, issue_number = p_issue_number,
      revision = revision + 1, updated_at = now()
      where id = p_id and revision = p_revision and status = 'draft' returning * into saved;
    if saved.id is null then raise exception 'REVISION_CONFLICT' using errcode = '40001'; end if;
  end if;
  delete from public.bulletin_items where bulletin_id = p_id;
  for item in select value from jsonb_array_elements(p_items) loop
    insert into public.bulletin_items(id, bulletin_id, position, title, body, web_visible, review_on_copy, needs_review)
      values ((item->>'id')::uuid, p_id, item_position, item->>'title', item->>'body',
        (item->>'webVisible')::boolean, (item->>'reviewOnCopy')::boolean, (item->>'needsReview')::boolean);
    item_position := item_position + 1;
  end loop;
  return saved;
end $$;

create function public.copy_bulletin_draft(p_source uuid, p_service_date date, p_issue_number integer)
returns public.bulletins language plpgsql security invoker set search_path = '' as $$
declare source public.bulletins; copied public.bulletins;
begin
  if not exists (select 1 from public.church_editors where user_id = auth.uid()) then
    raise exception 'EDITOR_REQUIRED' using errcode = '42501';
  end if;
  select * into source from public.bulletins where id = p_source for share;
  if source.id is null then raise exception 'SOURCE_NOT_FOUND' using errcode = '22023'; end if;
  if p_service_date <= source.service_date then raise exception 'INVALID_COPY_DATE' using errcode = '22023'; end if;
  insert into public.bulletins(service_date, issue_number) values (p_service_date, p_issue_number)
    returning * into copied;
  insert into public.bulletin_items(bulletin_id, position, title, body, web_visible, review_on_copy, needs_review)
    select copied.id, position, title, body, web_visible, review_on_copy, review_on_copy
      from public.bulletin_items where bulletin_id = source.id;
  return copied;
end $$;
revoke all on function public.save_bulletin_draft(uuid,date,integer,integer,jsonb) from public, anon;
revoke all on function public.copy_bulletin_draft(uuid,date,integer) from public, anon;
grant execute on function public.save_bulletin_draft(uuid,date,integer,integer,jsonb) to authenticated;
grant execute on function public.copy_bulletin_draft(uuid,date,integer) to authenticated;
