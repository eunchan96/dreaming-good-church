create table public.homepage_content (
 id boolean primary key default true check(id),
 title_line1 text not null check(length(btrim(title_line1)) between 1 and 12 and title_line1 !~ E'[\\n\\r]'),
 title_line2 text not null check(length(btrim(title_line2)) between 1 and 12 and title_line2 !~ E'[\\n\\r]'),
 description_line1 text not null check(length(description_line1)<=48 and description_line1 !~ E'[\\n\\r]'),
 description_line2 text not null check(length(description_line2)<=48 and description_line2 !~ E'[\\n\\r]'),
 link_label text not null check(length(btrim(link_label)) between 1 and 24 and link_label !~ E'[\\n\\r]'),
 footnote text not null check(length(footnote)<=80 and footnote !~ E'[\\n\\r]'),
 image_mode text not null check(image_mode in ('art','photo','illustration')),
 image_ratio text not null check(image_ratio in ('portrait','square','landscape')),
 image_asset_id uuid references public.bulletin_images(id) on delete restrict,
 image_alt text not null check(length(image_alt)<=200),
 focus_x integer not null check(focus_x between 0 and 100),
 focus_y integer not null check(focus_y between 0 and 100),
 revision integer not null default 1 check(revision>0),
 check((image_mode='art' and image_asset_id is null) or (image_mode<>'art' and image_asset_id is not null and length(btrim(image_alt))>0))
);
alter table public.homepage_content enable row level security;
revoke all on public.homepage_content from anon,authenticated;
grant select,insert,update on public.homepage_content to authenticated;
grant select(id,title_line1,title_line2,description_line1,description_line2,link_label,footnote,image_mode,image_ratio,image_asset_id,image_alt,focus_x,focus_y) on public.homepage_content to anon;
create policy "editors manage homepage" on public.homepage_content for all to authenticated
 using(exists(select 1 from public.church_editors where user_id=(select auth.uid())))
 with check(exists(select 1 from public.church_editors where user_id=(select auth.uid())));
create policy "public homepage" on public.homepage_content for select to anon using(true);
create policy "public homepage images" on public.bulletin_images for select to anon
 using(exists(select 1 from public.homepage_content where image_asset_id=bulletin_images.id));
create index homepage_image_reference on public.homepage_content(image_asset_id) where image_asset_id is not null;

create function public.save_homepage_content(p_revision integer,p_content jsonb) returns public.homepage_content
language plpgsql security invoker set search_path='' as $$
declare saved public.homepage_content; image public.bulletin_images;
begin
 if not exists(select 1 from public.church_editors where user_id=auth.uid()) then raise exception 'EDITOR_REQUIRED' using errcode='42501';end if;
 if p_content->>'image_mode'<>'art' then
  select * into image from public.bulletin_images where id=(p_content->>'image_asset_id')::uuid;
  if image.id is null or (p_content->>'image_mode'='photo' and (image.width<600 or image.height<400)) or (p_content->>'image_mode'='illustration' and (image.width<256 or image.height<256)) then raise exception 'IMAGE_RESOLUTION_REQUIRED' using errcode='22023';end if;
 end if;
 if p_revision=0 then
  insert into public.homepage_content(id,title_line1,title_line2,description_line1,description_line2,link_label,footnote,image_mode,image_ratio,image_asset_id,image_alt,focus_x,focus_y)
   values(true,p_content->>'title_line1',p_content->>'title_line2',p_content->>'description_line1',p_content->>'description_line2',p_content->>'link_label',p_content->>'footnote',p_content->>'image_mode',p_content->>'image_ratio',(p_content->>'image_asset_id')::uuid,p_content->>'image_alt',(p_content->>'focus_x')::integer,(p_content->>'focus_y')::integer) returning * into saved;
 else
  update public.homepage_content set title_line1=p_content->>'title_line1',title_line2=p_content->>'title_line2',description_line1=p_content->>'description_line1',description_line2=p_content->>'description_line2',link_label=p_content->>'link_label',footnote=p_content->>'footnote',image_mode=p_content->>'image_mode',image_ratio=p_content->>'image_ratio',image_asset_id=(p_content->>'image_asset_id')::uuid,image_alt=p_content->>'image_alt',focus_x=(p_content->>'focus_x')::integer,focus_y=(p_content->>'focus_y')::integer,revision=revision+1
   where id and revision=p_revision returning * into saved;
  if saved.id is null then raise exception 'REVISION_CONFLICT' using errcode='40001';end if;
 end if;
 return saved;
end $$;
revoke all on function public.save_homepage_content(integer,jsonb) from public,anon;
grant execute on function public.save_homepage_content(integer,jsonb) to authenticated;
