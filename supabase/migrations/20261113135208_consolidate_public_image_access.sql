-- Multiple permissive SELECT policies are OR'ed by Postgres. Keep exactly
-- that access rule in one policy so each anonymous read evaluates it once.
alter policy "public referenced images" on public.bulletin_images using (
 exists(select 1 from public.bulletin_items i where i.image_asset_id=bulletin_images.id)
 or exists(select 1 from public.homepage_content h where h.image_asset_id=bulletin_images.id)
);
drop policy "public homepage images" on public.bulletin_images;
