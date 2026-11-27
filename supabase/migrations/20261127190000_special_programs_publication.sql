-- 특별 순서지 게시: 편집자가 관리자 화면에서 바로 게시·예약 게시·게시 취소한다(주보와 같은 방식).
-- status는 draft|published, 게시된 순서지가 미래의 publish_at을 가지면 그 시각 전까지 익명에게 보이지 않는다.
alter table public.special_programs add column publish_at timestamptz;
alter table public.special_programs add constraint special_publish_at_needs_published check (publish_at is null or status = 'published');
-- 아래 정책(과 스토리지 정책)이 이 열을 읽으므로 익명에게 열 읽기 권한이 필요하다.
grant select (publish_at) on public.special_programs to anon;

drop policy "public reads published special programs" on public.special_programs;
create policy "public reads published special programs" on public.special_programs for select to anon
  using (status = 'published' and (publish_at is null or publish_at <= now()));
drop policy "public reads published special programs (signed in)" on public.special_programs;
create policy "public reads published special programs (signed in)" on public.special_programs for select to authenticated
  using (status = 'published' and (publish_at is null or publish_at <= now()));

drop policy "read published special program pdf" on storage.objects;
create policy "read published special program pdf" on storage.objects for select to anon, authenticated
  using (bucket_id = 'special-programs' and exists (
    select 1 from public.special_programs p
    where p.status = 'published' and (p.publish_at is null or p.publish_at <= now()) and p.pdf_path = storage.objects.name));

create function private.set_special_program_publication(p_slug text, p_publish boolean, p_publish_at timestamptz default null)
returns public.special_programs language plpgsql security definer set search_path = '' as $$
declare current_program public.special_programs;
begin
  if auth.uid() is null or not exists (select 1 from public.church_editors where user_id = auth.uid()) then
    raise exception 'EDITOR_REQUIRED' using errcode = '42501';
  end if;
  select * into current_program from public.special_programs where slug = p_slug for update;
  if current_program.id is null then
    raise exception 'PROGRAM_NOT_FOUND' using errcode = '22023';
  end if;
  if p_publish is null or current_program.status <> (case when p_publish then 'draft' else 'published' end) then
    raise exception 'INVALID_PUBLICATION_STATE' using errcode = '22023';
  end if;
  if p_publish and p_publish_at is not null and p_publish_at > now() + interval '1 year' then
    raise exception 'SCHEDULE_TOO_FAR' using errcode = '22023';
  end if;
  -- 이미 지난 시각이면 지금 공개로 본다.
  update public.special_programs set status = case when p_publish then 'published' else 'draft' end,
    publish_at = case when p_publish and p_publish_at > now() then p_publish_at else null end,
    updated_at = now() where id = current_program.id returning * into current_program;
  return current_program;
end $$;
revoke all on function private.set_special_program_publication(text,boolean,timestamptz) from public, anon;
grant execute on function private.set_special_program_publication(text,boolean,timestamptz) to authenticated;
create function public.set_special_program_publication(p_slug text, p_publish boolean, p_publish_at timestamptz default null)
returns public.special_programs language sql security invoker set search_path = '' as $$
  select * from private.set_special_program_publication(p_slug, p_publish, p_publish_at);
$$;
revoke all on function public.set_special_program_publication(text,boolean,timestamptz) from public, anon;
grant execute on function public.set_special_program_publication(text,boolean,timestamptz) to authenticated;
