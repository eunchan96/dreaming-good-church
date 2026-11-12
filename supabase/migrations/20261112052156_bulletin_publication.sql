-- Public reads receive only published, visible content. Internal review fields stay private.
grant select (id, service_date, issue_number, status) on public.bulletins to anon;
grant select (id, bulletin_id, position, title, body, kind, content) on public.bulletin_items to anon;
create policy "public reads published bulletins" on public.bulletins for select to anon
  using (status = 'published');
create policy "public reads visible published items" on public.bulletin_items for select to anon
  using (web_visible and exists (select 1 from public.bulletins where id = bulletin_id and status = 'published'));

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- A narrow promotion operation is the only way to bypass the draft-only UPDATE policy.
create function private.set_bulletin_publication(p_id uuid, p_revision integer, p_publish boolean)
returns public.bulletins language plpgsql security definer set search_path = '' as $$
declare current_bulletin public.bulletins;
begin
  if auth.uid() is null or not exists (select 1 from public.church_editors where user_id = auth.uid()) then
    raise exception 'EDITOR_REQUIRED' using errcode = '42501';
  end if;
  select * into current_bulletin from public.bulletins where id = p_id for update;
  if current_bulletin.id is null or current_bulletin.revision <> p_revision then
    raise exception 'REVISION_CONFLICT' using errcode = '40001';
  end if;
  if p_publish is null or current_bulletin.status <> (case when p_publish then 'draft' else 'published' end) then
    raise exception 'INVALID_PUBLICATION_STATE' using errcode = '22023';
  end if;
  if p_publish then
    if exists (select 1 from public.bulletin_items where bulletin_id = p_id and needs_review) then
      raise exception 'REVIEW_REQUIRED' using errcode = '22023';
    end if;
    if not exists (select 1 from public.bulletin_items where bulletin_id = p_id and web_visible and
      (btrim(body) <> '' or (kind = 'sermon' and btrim(content->>'reference') <> '') or
       (case when kind in ('worship','offering') then exists (
         select 1 from jsonb_array_elements(content->'rows') r,
         lateral jsonb_array_elements_text(r) c where btrim(c) <> '') else false end))) then
      raise exception 'PUBLIC_CONTENT_REQUIRED' using errcode = '22023';
    end if;
  end if;
  update public.bulletins set status = case when p_publish then 'published' else 'draft' end,
    revision = revision + 1, updated_at = now() where id = p_id returning * into current_bulletin;
  return current_bulletin;
end $$;
revoke all on function private.set_bulletin_publication(uuid,integer,boolean) from public, anon;
grant execute on function private.set_bulletin_publication(uuid,integer,boolean) to authenticated;
create function public.set_bulletin_publication(p_id uuid, p_revision integer, p_publish boolean)
returns public.bulletins language sql security invoker set search_path = '' as $$
  select private.set_bulletin_publication(p_id, p_revision, p_publish);
$$;
revoke all on function public.set_bulletin_publication(uuid,integer,boolean) from public, anon;
grant execute on function public.set_bulletin_publication(uuid,integer,boolean) to authenticated;

-- Serialize item changes with publication, including direct REST writes.
create function public.guard_bulletin_item_mutation() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare parent_id uuid; parent_status text; old_id uuid; new_id uuid;
begin
  if tg_op <> 'INSERT' then old_id := old.bulletin_id; end if;
  if tg_op <> 'DELETE' then new_id := new.bulletin_id; end if;
  for parent_id in select distinct x from unnest(array[old_id,new_id]) x where x is not null order by x loop
    select status into parent_status from public.bulletins where id = parent_id for update;
    if parent_status is null and tg_op = 'DELETE' then continue; end if;
    if parent_status is distinct from 'draft' then raise exception 'PUBLISHED_READ_ONLY' using errcode = '42501'; end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.guard_bulletin_item_mutation() from public, anon;
create trigger guard_bulletin_item_mutation before insert or update or delete on public.bulletin_items
for each row execute function public.guard_bulletin_item_mutation();
