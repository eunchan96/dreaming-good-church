create table public.community_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('notice','event')),
  title text not null check (length(btrim(title)) between 1 and 200),
  body text not null default '' check (length(body) <= 20000),
  location text not null default '' check (length(location) <= 500),
  starts_at timestamptz,
  ends_at timestamptz,
  is_public boolean not null default true,
  sensitive boolean not null default false,
  publish_from timestamptz,
  publish_until timestamptz,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  revision integer not null default 1 check (revision > 0),
  source_bulletin_id uuid,
  source_item_id uuid,
  updated_at timestamptz not null default now(),
  check (kind <> 'event' or starts_at is not null),
  check (ends_at is null or (starts_at is not null and ends_at >= starts_at)),
  check (publish_until is null or publish_from is null or publish_until > publish_from),
  check (not sensitive or not is_public),
  check (status <> 'published' or kind <> 'notice' or length(btrim(body)) > 0)
);
create unique index community_notice_origin on public.community_entries(source_bulletin_id, source_item_id)
  where source_item_id is not null;
create index community_public_listing on public.community_entries(kind, updated_at desc) where status='published' and is_public;
alter table public.community_entries enable row level security;
revoke all on public.community_entries from anon, authenticated;
grant select, insert, update on public.community_entries to authenticated;
grant select (id,kind,title,body,location,starts_at,ends_at,publish_from,publish_until,updated_at) on public.community_entries to anon;
create policy "editors manage community entries" on public.community_entries for all to authenticated
  using (exists(select 1 from public.church_editors where user_id=(select auth.uid())))
  with check (exists(select 1 from public.church_editors where user_id=(select auth.uid())));
create policy "public reads active community entries" on public.community_entries for select to anon
  using (status='published' and is_public and not sensitive
    and (publish_from is null or publish_from <= now()) and (publish_until is null or publish_until > now()));

create function public.save_community_entry(p_id uuid,p_revision integer,p_entry jsonb)
returns public.community_entries language plpgsql security invoker set search_path='' as $$
declare saved public.community_entries;
begin
  if not exists(select 1 from public.church_editors where user_id=auth.uid()) then raise exception 'EDITOR_REQUIRED' using errcode='42501'; end if;
  if p_entry is null or jsonb_typeof(p_entry) <> 'object' then raise exception 'INVALID_ENTRY' using errcode='22023'; end if;
  if p_revision=0 then
    insert into public.community_entries(id,kind,title,body,location,starts_at,ends_at,is_public,sensitive,publish_from,publish_until,status)
    values(p_id,p_entry->>'kind',p_entry->>'title',p_entry->>'body',p_entry->>'location',
      nullif(p_entry->>'starts_at','')::timestamptz,nullif(p_entry->>'ends_at','')::timestamptz,
      (p_entry->>'is_public')::boolean,(p_entry->>'sensitive')::boolean,
      nullif(p_entry->>'publish_from','')::timestamptz,nullif(p_entry->>'publish_until','')::timestamptz,p_entry->>'status') returning * into saved;
  else
    update public.community_entries set title=p_entry->>'title',body=p_entry->>'body',location=p_entry->>'location',
      starts_at=nullif(p_entry->>'starts_at','')::timestamptz,ends_at=nullif(p_entry->>'ends_at','')::timestamptz,
      is_public=(p_entry->>'is_public')::boolean,sensitive=(p_entry->>'sensitive')::boolean,
      publish_from=nullif(p_entry->>'publish_from','')::timestamptz,publish_until=nullif(p_entry->>'publish_until','')::timestamptz,
      status=p_entry->>'status',revision=revision+1,updated_at=now()
      where id=p_id and revision=p_revision and kind=p_entry->>'kind' returning * into saved;
    if saved.id is null then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
  end if;
  return saved;
end $$;

create function public.create_notice_from_bulletin(p_bulletin uuid,p_item uuid,p_revision integer)
returns public.community_entries language plpgsql security invoker set search_path='' as $$
declare item record; saved public.community_entries;
begin
  if not exists(select 1 from public.church_editors where user_id=auth.uid()) then raise exception 'EDITOR_REQUIRED' using errcode='42501'; end if;
  -- One statement snapshot: no UPDATE-policy lock is needed to read a published bulletin.
  select b.revision as source_revision,i.* into item from public.bulletins b
    join public.bulletin_items i on i.bulletin_id=b.id where b.id=p_bulletin and i.id=p_item;
  if item.id is null or item.source_revision<>p_revision then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
  if item.id is null or item.kind<>'text' then raise exception 'TEXT_NOTICE_REQUIRED' using errcode='22023'; end if;
  insert into public.community_entries(kind,title,body,is_public,source_bulletin_id,source_item_id)
    values('notice',item.title,item.body,item.web_visible,p_bulletin,p_item) on conflict do nothing returning * into saved;
  if saved.id is null then select * into saved from public.community_entries where source_bulletin_id=p_bulletin and source_item_id=p_item; end if;
  return saved;
end $$;

create function public.copy_community_to_bulletin(p_entry uuid,p_bulletin uuid,p_revision integer)
returns public.bulletins language plpgsql security invoker set search_path='' as $$
declare entry public.community_entries; target public.bulletins; item_count integer; rendered text;
begin
  if not exists(select 1 from public.church_editors where user_id=auth.uid()) then raise exception 'EDITOR_REQUIRED' using errcode='42501'; end if;
  select * into target from public.bulletins where id=p_bulletin for update;
  if target.id is null or target.revision<>p_revision then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
  if target.status<>'draft' then raise exception 'DRAFT_REQUIRED' using errcode='22023'; end if;
  select * into entry from public.community_entries where id=p_entry and status<>'archived' for share;
  if entry.id is null then raise exception 'ENTRY_REQUIRED' using errcode='22023'; end if;
  select count(*) into item_count from public.bulletin_items where bulletin_id=p_bulletin;
  if item_count>=100 then raise exception 'TOO_MANY_ITEMS' using errcode='22023'; end if;
  rendered:=entry.body;
  if entry.kind='event' then
    rendered:=to_char(entry.starts_at at time zone 'Asia/Seoul','YYYY-MM-DD HH24:MI') ||
      case when entry.ends_at is null then '' else ' ~ '||to_char(entry.ends_at at time zone 'Asia/Seoul','YYYY-MM-DD HH24:MI') end || ' (한국 시간)' ||
      case when entry.location='' then '' else E'\n장소: '||entry.location end || E'\n'||entry.body;
  end if;
  insert into public.bulletin_items(bulletin_id,position,title,body,web_visible,review_on_copy,needs_review)
    select p_bulletin,coalesce(max(position),-1)+1,entry.title,rendered,entry.is_public and not entry.sensitive,true,true
      from public.bulletin_items where bulletin_id=p_bulletin;
  update public.bulletins set revision=revision+1,updated_at=now() where id=p_bulletin returning * into target;
  return target;
end $$;
revoke all on function public.save_community_entry(uuid,integer,jsonb) from public,anon;
revoke all on function public.create_notice_from_bulletin(uuid,uuid,integer) from public,anon;
revoke all on function public.copy_community_to_bulletin(uuid,uuid,integer) from public,anon;
grant execute on function public.save_community_entry(uuid,integer,jsonb) to authenticated;
grant execute on function public.create_notice_from_bulletin(uuid,uuid,integer) to authenticated;
grant execute on function public.copy_community_to_bulletin(uuid,uuid,integer) to authenticated;

-- Copy header and items from one MVCC snapshot, including read-only published sources.
create or replace function public.copy_bulletin_draft(p_source uuid,p_service_date date,p_issue_number integer)
returns public.bulletins language plpgsql security invoker set search_path='' as $$
declare copied public.bulletins; snapshot record;
begin
  if not exists(select 1 from public.church_editors where user_id=auth.uid()) then raise exception 'EDITOR_REQUIRED' using errcode='42501'; end if;
  select b.id,b.service_date,coalesce((select jsonb_agg(to_jsonb(i)) from public.bulletin_items i where i.bulletin_id=b.id),'[]'::jsonb) as items
    into snapshot from public.bulletins b where b.id=p_source;
  if snapshot.id is null or p_service_date<=snapshot.service_date then raise exception 'INVALID_COPY_DATE_OR_SOURCE' using errcode='22023'; end if;
  insert into public.bulletins(service_date,issue_number) values(p_service_date,p_issue_number) returning * into copied;
  insert into public.bulletin_items(bulletin_id,position,title,body,web_visible,review_on_copy,needs_review,kind,content)
    select copied.id,i.position,i.title,i.body,i.web_visible,i.review_on_copy,i.review_on_copy,i.kind,i.content
      from jsonb_populate_recordset(null::public.bulletin_items,snapshot.items) i;
  return copied;
end $$;
