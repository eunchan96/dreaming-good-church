create table public.worship_videos (
 id uuid primary key default gen_random_uuid(),
 service_type text not null check(service_type in ('sunday','afternoon','friday','dawn')),
 service_date date not null check(service_date between '1900-01-01' and '2199-12-31'),
 video_id text not null check(video_id ~ '^[A-Za-z0-9_-]{11}$'),
 title text not null check(length(btrim(title)) between 1 and 200),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 featured boolean not null default false check(not featured or status='published'),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now(),
 unique(service_type,video_id)
);
create unique index worship_one_featured on public.worship_videos(service_type) where featured;
create index worship_public_page on public.worship_videos(service_type,service_date desc,id desc) where status='published';
alter table public.worship_videos enable row level security;
revoke all on public.worship_videos from anon,authenticated;
grant select,insert,update on public.worship_videos to authenticated;
grant select(id,service_type,service_date,video_id,title,featured) on public.worship_videos to anon;
create policy "editors manage worship videos" on public.worship_videos for all to authenticated
 using(exists(select 1 from public.church_editors where user_id=(select auth.uid())))
 with check(exists(select 1 from public.church_editors where user_id=(select auth.uid())));
create policy "public worship videos" on public.worship_videos for select to anon using(status='published');

create function public.save_worship_video(p_id uuid,p_revision integer,p_type text,p_date date,p_video text,p_title text,p_status text,p_featured boolean)
returns public.worship_videos language plpgsql security invoker set search_path='' as $$
declare saved public.worship_videos;
begin
 if not exists(select 1 from public.church_editors where user_id=auth.uid()) then raise exception 'EDITOR_REQUIRED' using errcode='42501'; end if;
 -- Serialize representative changes and edits together; failure rolls back any previous representative update.
 perform pg_advisory_xact_lock(61113093440);
 if p_featured and p_status='published' then
  update public.worship_videos set featured=false,revision=revision+1,updated_at=now()
   where service_type=p_type and featured and id<>p_id;
 end if;
 if p_revision=0 then
  insert into public.worship_videos(id,service_type,service_date,video_id,title,status,featured)
   values(p_id,p_type,p_date,p_video,btrim(p_title),p_status,p_featured and p_status='published') returning * into saved;
 else
  update public.worship_videos set service_type=p_type,service_date=p_date,video_id=p_video,title=btrim(p_title),status=p_status,
   featured=p_featured and p_status='published',revision=revision+1,updated_at=now()
   where id=p_id and revision=p_revision returning * into saved;
  if saved.id is null then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
 end if;
 return saved;
end $$;
revoke all on function public.save_worship_video(uuid,integer,text,date,text,text,text,boolean) from public,anon;
grant execute on function public.save_worship_video(uuid,integer,text,date,text,text,text,boolean) to authenticated;
