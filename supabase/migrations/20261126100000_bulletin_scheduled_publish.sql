-- Scheduled publication: a published bulletin may carry a future publish_at.
-- status stays draft|published (published = locked and committed); anonymous readers only see it once publish_at has passed.
alter table public.bulletins add column publish_at timestamptz;
alter table public.bulletins add constraint publish_at_needs_published check (publish_at is null or status = 'published');
grant select (publish_at) on public.bulletins to anon;

drop policy "public reads published bulletins" on public.bulletins;
create policy "public reads published bulletins" on public.bulletins for select to anon
  using (status = 'published' and (publish_at is null or publish_at <= now()));

drop policy "public reads visible published items" on public.bulletin_items;
create policy "public reads visible published items" on public.bulletin_items for select to anon
  using (web_visible and exists (select 1 from public.bulletins where id = bulletin_id and status = 'published' and (publish_at is null or publish_at <= now())));

drop policy "public reads published print formats" on public.bulletin_print_formats;
create policy "public reads published print formats" on public.bulletin_print_formats for select to anon
  using (exists (select 1 from public.bulletins b where b.id = bulletin_print_formats.bulletin_id and b.status = 'published' and (b.publish_at is null or b.publish_at <= now())));

drop function public.set_bulletin_publication(uuid, integer, boolean);
drop function private.set_bulletin_publication(uuid, integer, boolean);

create function private.set_bulletin_publication(p_id uuid, p_revision integer, p_publish boolean, p_publish_at timestamptz default null)
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
      (kind = 'image' or btrim(body) <> '' or (kind = 'sermon' and btrim(content->>'reference') <> '') or
       (case when kind in ('worship','offering') then exists (
         select 1 from jsonb_array_elements(content->'rows') r,
         lateral jsonb_array_elements_text(r) c where btrim(c) <> '') else false end))) then
      raise exception 'PUBLIC_CONTENT_REQUIRED' using errcode = '22023';
    end if;
    if p_publish_at is not null and p_publish_at > now() + interval '1 year' then
      raise exception 'SCHEDULE_TOO_FAR' using errcode = '22023';
    end if;
  end if;
  -- A time that has already passed means "publish now".
  update public.bulletins set status = case when p_publish then 'published' else 'draft' end,
    publish_at = case when p_publish and p_publish_at > now() then p_publish_at else null end,
    revision = revision + 1, updated_at = now() where id = p_id returning * into current_bulletin;
  return current_bulletin;
end $$;
revoke all on function private.set_bulletin_publication(uuid,integer,boolean,timestamptz) from public, anon;
grant execute on function private.set_bulletin_publication(uuid,integer,boolean,timestamptz) to authenticated;
create function public.set_bulletin_publication(p_id uuid, p_revision integer, p_publish boolean, p_publish_at timestamptz default null)
returns public.bulletins language sql security invoker set search_path = '' as $$
  select private.set_bulletin_publication(p_id, p_revision, p_publish, p_publish_at);
$$;
revoke all on function public.set_bulletin_publication(uuid,integer,boolean,timestamptz) from public, anon;
grant execute on function public.set_bulletin_publication(uuid,integer,boolean,timestamptz) to authenticated;
