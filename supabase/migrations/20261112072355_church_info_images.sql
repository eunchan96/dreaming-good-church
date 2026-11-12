create table public.church_info (
  key text primary key check (key in ('name','address','phone','worship','introduction','directions')),
  body text not null default '' check (length(body)<=10000),
  web_visible boolean not null default true,
  revision integer not null default 1 check (revision>0)
);
insert into public.church_info(key) values ('name'),('address'),('phone'),('worship'),('introduction'),('directions');
alter table public.church_info enable row level security;
revoke all on public.church_info from anon,authenticated;
grant select,update on public.church_info to authenticated;
grant select(key,body) on public.church_info to anon;
create policy "editors manage church info" on public.church_info for all to authenticated
using (exists(select 1 from public.church_editors where user_id=(select auth.uid())))
with check (exists(select 1 from public.church_editors where user_id=(select auth.uid())));
create policy "public church info" on public.church_info for select to anon using(web_visible);
create function public.save_church_info(p_fields jsonb) returns setof public.church_info
language plpgsql security invoker set search_path='' as $$
declare field jsonb; updated_key text;
begin
 if not exists(select 1 from public.church_editors where user_id=auth.uid()) then raise exception 'EDITOR_REQUIRED' using errcode='42501'; end if;
 if jsonb_typeof(p_fields) is distinct from 'array' or jsonb_array_length(p_fields)<>6 then raise exception 'INVALID_FIELDS' using errcode='22023'; end if;
 if (select count(distinct value->>'key') from jsonb_array_elements(p_fields))<>6 then raise exception 'INVALID_FIELDS' using errcode='22023'; end if;
 for field in select value from jsonb_array_elements(p_fields) order by value->>'key' loop
  update public.church_info set body=field->>'body',web_visible=(field->>'web_visible')::boolean,revision=revision+1
   where key=field->>'key' and revision=(field->>'revision')::integer returning key into updated_key;
  if updated_key is null then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
 end loop;
 return query select * from public.church_info order by key;
end $$;
revoke all on function public.save_church_info(jsonb) from public,anon;
grant execute on function public.save_church_info(jsonb) to authenticated;

create table public.bulletin_images (
 id uuid primary key,
 title text not null check(length(btrim(title)) between 1 and 200),
 alt text not null check(length(btrim(alt)) between 1 and 500),
 width integer not null check(width between 1 and 2400),
 height integer not null check(height between 1 and 2400),
 bytes integer not null check(bytes between 1 and 8388608),
 created_at timestamptz not null default now()
);
alter table public.bulletin_images enable row level security;
revoke all on public.bulletin_images from anon,authenticated;
grant select on public.bulletin_images to authenticated,anon;
-- Only the authenticated upload endpoint can write normalized images using the server key.
create policy "editors read images" on public.bulletin_images for select to authenticated
using(exists(select 1 from public.church_editors where user_id=(select auth.uid())));

alter table public.bulletin_items drop constraint bulletin_items_kind_check;
alter table public.bulletin_items add constraint bulletin_items_kind_check check(kind in ('text','sermon','worship','offering','image'));
alter function public.valid_bulletin_content(text,jsonb) rename to valid_text_bulletin_content;
create function public.valid_bulletin_content(kind text,content jsonb) returns boolean
language sql immutable security invoker set search_path='' as $$
 select case when kind='image' then
  jsonb_typeof(content)='object' and (select count(*) from jsonb_object_keys(content))=2
  and jsonb_typeof(content->'assetId')='string' and content->>'assetId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and jsonb_typeof(content->'alt')='string' and length(btrim(content->>'alt')) between 1 and 500
 else public.valid_text_bulletin_content(kind,content) end;
$$;
revoke all on function public.valid_bulletin_content(text,jsonb) from public,anon;
grant execute on function public.valid_bulletin_content(text,jsonb) to authenticated,service_role;
alter table public.bulletin_items drop constraint valid_block_content;
alter table public.bulletin_items add constraint valid_block_content check(public.valid_bulletin_content(kind,content) is true);
alter table public.bulletin_items add column image_asset_id uuid generated always as (case when kind='image' then (content->>'assetId')::uuid end) stored references public.bulletin_images(id) on delete restrict;
create index bulletin_items_image_asset_idx on public.bulletin_items(image_asset_id) where image_asset_id is not null;
grant select(image_asset_id) on public.bulletin_items to anon;
create policy "public referenced images" on public.bulletin_images for select to anon
using(exists(select 1 from public.bulletin_items i where i.image_asset_id=bulletin_images.id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('bulletin-images','bulletin-images',false,8388608,array['image/webp']);
create policy "read permitted bulletin images" on storage.objects for select to anon,authenticated
using(bucket_id='bulletin-images' and exists(select 1 from public.bulletin_images i where name=i.id::text||'.webp'));
create or replace function private.set_bulletin_publication(p_id uuid, p_revision integer, p_publish boolean)
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
  end if;
  update public.bulletins set status = case when p_publish then 'published' else 'draft' end,
    revision = revision + 1, updated_at = now() where id = p_id returning * into current_bulletin;
  return current_bulletin;
end $$;
