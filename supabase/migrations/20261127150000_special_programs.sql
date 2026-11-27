-- 특별 순서지(임직감사예배처럼 주간 주보에 없는 구성의 순서지): 웹 미리보기용 내용(JSON)과 인쇄용 PDF를 보관한다.
-- 공개된 것만 익명으로 읽을 수 있고, 쓰기는 서비스 권한(운영자가 올리는 스크립트)만 한다.
create table public.special_programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
  title text not null check (length(btrim(title)) between 1 and 120),
  service_date date not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  content jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 200000),
  pdf_path text check (pdf_path is null or pdf_path ~ '^[a-z0-9][a-z0-9-]{2,60}\.pdf$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index special_programs_public_list on public.special_programs (service_date desc) where status = 'published';
alter table public.special_programs enable row level security;
revoke all on public.special_programs from anon, authenticated;
-- status is needed by the storage policy below; anonymous rows are always 'published'.
grant select (slug, title, service_date, status, content, pdf_path) on public.special_programs to anon;
create policy "public reads published special programs" on public.special_programs for select to anon
  using (status = 'published');
-- 편집자는 초안까지 미리 볼 수 있다(쓰기는 하지 않는다).
grant select on public.special_programs to authenticated;
create policy "editors read special programs" on public.special_programs for select to authenticated
  using (exists (select 1 from public.church_editors where user_id = auth.uid()));
create policy "public reads published special programs (signed in)" on public.special_programs for select to authenticated
  using (status = 'published');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('special-programs', 'special-programs', false, 10485760, array['application/pdf']);
create policy "read published special program pdf" on storage.objects for select to anon, authenticated
  using (bucket_id = 'special-programs' and exists (
    select 1 from public.special_programs p where p.status = 'published' and p.pdf_path = storage.objects.name));
