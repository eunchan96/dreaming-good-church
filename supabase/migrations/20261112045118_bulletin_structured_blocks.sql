-- Structured drafts remain protected by existing editor RLS.
create function public.valid_bulletin_content(kind text, content jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare row_data jsonb; cell jsonb; key_count integer;
begin
  if content is null or jsonb_typeof(content) <> 'object' or length(content::text) > 200000 then return false; end if;
  select count(*) into key_count from jsonb_object_keys(content);
  if kind = 'text' then return content = '{}'::jsonb; end if;
  if kind = 'sermon' then
    return key_count = 2 and jsonb_typeof(content->'reference') = 'string' and length(content->>'reference') <= 500
      and jsonb_typeof(content->'preacher') = 'string' and length(content->>'preacher') <= 500;
  end if;
  if kind not in ('worship','offering') then return false; end if;
  if kind = 'worship' and key_count <> 1 then return false; end if;
  if kind = 'offering' and (key_count <> 2 or jsonb_typeof(content->'month') is distinct from 'string'
    or (content->>'month' <> '' and content->>'month' !~ '^[0-9]{4}-(0[1-9]|1[0-2])$')) then return false; end if;
  if jsonb_typeof(content->'rows') is distinct from 'array' then return false; end if;
  if jsonb_array_length(content->'rows') > 100 then return false; end if;
  for row_data in select value from jsonb_array_elements(content->'rows') loop
    if jsonb_typeof(row_data) <> 'array' then return false; end if;
    if jsonb_array_length(row_data) <> (case when kind = 'worship' then 3 else 2 end) then return false; end if;
    for cell in select value from jsonb_array_elements(row_data) loop
      if jsonb_typeof(cell) <> 'string' or length(cell #>> '{}') > 500 then return false; end if;
    end loop;
    if kind = 'offering' and row_data->>1 !~ '^[0-9]{0,12}$' then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function public.valid_bulletin_content(text,jsonb) from public, anon;
grant execute on function public.valid_bulletin_content(text,jsonb) to authenticated, service_role;
alter table public.bulletin_items add column kind text not null default 'text'
  check (kind in ('text','sermon','worship','offering'));
alter table public.bulletin_items add column content jsonb not null default '{}'::jsonb;
alter table public.bulletin_items add constraint valid_block_content check (public.valid_bulletin_content(kind, content) is true);

create or replace function public.save_bulletin_draft(
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
    insert into public.bulletin_items(id, bulletin_id, position, title, body, web_visible, review_on_copy, needs_review, kind, content)
      values ((item->>'id')::uuid, p_id, item_position, item->>'title', item->>'body',
        (item->>'webVisible')::boolean, (item->>'reviewOnCopy')::boolean, (item->>'needsReview')::boolean, coalesce(item->>'kind', 'text'), coalesce(item->'content', '{}'::jsonb));
    item_position := item_position + 1;
  end loop;
  return saved;
end $$;

create or replace function public.copy_bulletin_draft(p_source uuid, p_service_date date, p_issue_number integer)
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
  insert into public.bulletin_items(bulletin_id, position, title, body, web_visible, review_on_copy, needs_review, kind, content)
    select copied.id, position, title, body, web_visible, review_on_copy, review_on_copy, kind, content
      from public.bulletin_items where bulletin_id = source.id;
  return copied;
end $$;
revoke all on function public.save_bulletin_draft(uuid,date,integer,integer,jsonb) from public, anon;
revoke all on function public.copy_bulletin_draft(uuid,date,integer) from public, anon;
grant execute on function public.save_bulletin_draft(uuid,date,integer,integer,jsonb) to authenticated;
grant execute on function public.copy_bulletin_draft(uuid,date,integer) to authenticated;
