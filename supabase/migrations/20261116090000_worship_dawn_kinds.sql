-- Dawn videos can be tagged as 월삭새벽예배(monthly) and/or 특별새벽기도(special).
alter table public.worship_videos
 add column dawn_kinds text[] not null default '{}'::text[]
 constraint worship_dawn_kinds_valid check (
  dawn_kinds <@ array['monthly','special']::text[]
  and (service_type='dawn' or cardinality(dawn_kinds)=0)
 );
grant select(dawn_kinds) on public.worship_videos to anon;
