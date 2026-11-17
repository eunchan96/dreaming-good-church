-- 인쇄 서식(문단·칸별 크기·굵기·색·정렬)을 주보마다 저장한다. 주보 저장·게시 흐름(revision)과는 분리된 표.
-- 편집자는 읽고 쓰며, 방문자는 게시된 주보의 서식만 읽는다(공개 주보에 같은 서식을 적용).
create table public.bulletin_print_formats (
 bulletin_id uuid primary key references public.bulletins(id) on delete cascade,
 formats jsonb not null default '{}'::jsonb check (jsonb_typeof(formats) = 'object' and octet_length(formats::text) <= 200000),
 updated_at timestamptz not null default now()
);
alter table public.bulletin_print_formats enable row level security;
revoke all on public.bulletin_print_formats from anon, authenticated;
grant select on public.bulletin_print_formats to anon;
grant select, insert, update on public.bulletin_print_formats to authenticated;
create policy "editors manage print formats" on public.bulletin_print_formats for all to authenticated
 using (exists (select 1 from public.church_editors where user_id = (select auth.uid())))
 with check (exists (select 1 from public.church_editors where user_id = (select auth.uid())));
create policy "public reads published print formats" on public.bulletin_print_formats for select to anon
 using (exists (select 1 from public.bulletins b where b.id = bulletin_print_formats.bulletin_id and b.status = 'published'));
