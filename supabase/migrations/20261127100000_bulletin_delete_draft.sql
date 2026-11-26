-- Deleting a bulletin is allowed only for drafts (published ones must be withdrawn first) and only by editors.
-- Items and print formats go with it (ON DELETE CASCADE). Notices created from a bulletin keep their own copy.
create function private.delete_bulletin_draft(p_id uuid, p_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
declare current_bulletin public.bulletins;
begin
  if auth.uid() is null or not exists (select 1 from public.church_editors where user_id = auth.uid()) then
    raise exception 'EDITOR_REQUIRED' using errcode = '42501';
  end if;
  select * into current_bulletin from public.bulletins where id = p_id for update;
  if current_bulletin.id is null or current_bulletin.revision <> p_revision then
    raise exception 'REVISION_CONFLICT' using errcode = '40001';
  end if;
  if current_bulletin.status <> 'draft' then
    raise exception 'INVALID_PUBLICATION_STATE' using errcode = '22023';
  end if;
  delete from public.bulletins where id = p_id;
end $$;
revoke all on function private.delete_bulletin_draft(uuid,integer) from public, anon;
grant execute on function private.delete_bulletin_draft(uuid,integer) to authenticated;
create function public.delete_bulletin_draft(p_id uuid, p_revision integer)
returns void language sql security invoker set search_path = '' as $$
  select private.delete_bulletin_draft(p_id, p_revision);
$$;
revoke all on function public.delete_bulletin_draft(uuid,integer) from public, anon;
grant execute on function public.delete_bulletin_draft(uuid,integer) to authenticated;
