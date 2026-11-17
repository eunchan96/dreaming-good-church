-- 인사말 담임목사 사진: 한 줄짜리 설정. 보관함 이미지를 가리키며(사용 중이면 삭제 불가), 공개 인사말에서 읽는다.
create table public.church_portrait (
 id smallint primary key default 1 check (id = 1),
 image_asset_id uuid references public.bulletin_images(id) on delete restrict,
 alt text not null default '' check (char_length(alt) <= 200),
 revision integer not null default 1 check (revision > 0)
);
insert into public.church_portrait (id) values (1);
create index church_portrait_image_idx on public.church_portrait (image_asset_id);
alter table public.church_portrait enable row level security;
revoke all on public.church_portrait from anon, authenticated;
grant select on public.church_portrait to anon, authenticated;
grant update (image_asset_id, alt, revision) on public.church_portrait to authenticated;
create policy "public portrait" on public.church_portrait for select to anon, authenticated using (true);
create policy "editors update portrait" on public.church_portrait for update to authenticated
 using (exists (select 1 from public.church_editors where user_id = (select auth.uid())))
 with check (exists (select 1 from public.church_editors where user_id = (select auth.uid())));
-- Anonymous visitors may read an image only when a public page uses it (주보 · 홈 · 인사말 사진).
alter policy "public referenced images" on public.bulletin_images using (
 exists(select 1 from public.bulletin_items i where i.image_asset_id=bulletin_images.id)
 or exists(select 1 from public.homepage_content h where h.image_asset_id=bulletin_images.id)
 or exists(select 1 from public.church_portrait p where p.image_asset_id=bulletin_images.id)
);
