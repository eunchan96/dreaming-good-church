create function public.valid_church_page_setting(p_key text,p_payload jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb;
begin
 if p_key in ('worship_times','offering_accounts') then
  if jsonb_typeof(p_payload) is distinct from 'array' then return false;end if;
  if jsonb_array_length(p_payload)<>(case when p_key='worship_times' then 6 else 2 end) then return false;end if;
  if (select count(distinct value->>'key') from jsonb_array_elements(p_payload))<>jsonb_array_length(p_payload) then return false;end if;
  for item in select value from jsonb_array_elements(p_payload) loop
   if jsonb_typeof(item) is distinct from 'object' then return false;end if;
   if jsonb_typeof(item->'key') is distinct from 'string' then return false;end if;
   if p_key='worship_times' then
    if (select count(*) from jsonb_object_keys(item))<>3 or item->>'key' not in ('sunday','afternoon','friday','dawn','students','monthly') then return false;end if;
    if not coalesce(jsonb_typeof(item->'time')='string' and item->>'time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and jsonb_typeof(item->'recurrence')='string' and length(btrim(item->>'recurrence'))>=1 and length(item->>'recurrence')<=60 and item->>'recurrence' !~ E'[\\n\\r]',false) then return false;end if;
   else
    if (select count(*) from jsonb_object_keys(item))<>4 or item->>'key' not in ('general','building') then return false;end if;
    if not coalesce(jsonb_typeof(item->'bank')='string' and length(btrim(item->>'bank'))>=1 and length(item->>'bank')<=30 and item->>'bank' !~ E'[\\n\\r]' and jsonb_typeof(item->'holder')='string' and length(btrim(item->>'holder'))>=1 and length(item->>'holder')<=60 and item->>'holder' !~ E'[\\n\\r]' and jsonb_typeof(item->'number')='string' and item->>'number' ~ '^[0-9][0-9-]{4,38}[0-9]$' and strpos(item->>'number','--')=0,false) then return false;end if;
   end if;
  end loop;
  return true;
 elsif p_key='location' then
  if jsonb_typeof(p_payload) is distinct from 'object' then return false;end if;
  if (select count(*) from jsonb_object_keys(p_payload))<>5 then return false;end if;
  if jsonb_typeof(p_payload->'latitude') is distinct from 'number' or jsonb_typeof(p_payload->'longitude') is distinct from 'number' or jsonb_typeof(p_payload->'zoom') is distinct from 'number' then return false;end if;
  return coalesce((p_payload->>'latitude')::numeric between -90 and 90 and (p_payload->>'longitude')::numeric between -180 and 180 and (p_payload->>'zoom')::numeric between 10 and 20 and (p_payload->>'zoom')::numeric=trunc((p_payload->>'zoom')::numeric) and jsonb_typeof(p_payload->'landmark')='string' and length(p_payload->>'landmark')<=200 and p_payload->>'landmark' !~ E'[\\n\\r]' and jsonb_typeof(p_payload->'transit')='string' and length(p_payload->>'transit')<=1000,false);
 end if;
 return false;
end $$;
revoke all on function public.valid_church_page_setting(text,jsonb) from public,anon;
grant execute on function public.valid_church_page_setting(text,jsonb) to authenticated,service_role;
create table public.church_page_settings (
 key text primary key check(key in ('worship_times','offering_accounts','location')),
 payload jsonb not null check(octet_length(payload::text)<=20000 and public.valid_church_page_setting(key,payload) is true),
 revision integer not null default 1 check(revision>0)
);
alter table public.church_page_settings enable row level security;
revoke all on public.church_page_settings from anon,authenticated;
grant select,insert,update on public.church_page_settings to authenticated;
grant select(key,payload) on public.church_page_settings to anon;
create policy "editors manage page settings" on public.church_page_settings for all to authenticated
 using(exists(select 1 from public.church_editors where user_id=(select auth.uid())))
 with check(exists(select 1 from public.church_editors where user_id=(select auth.uid())));
create policy "public page settings" on public.church_page_settings for select to anon using(true);
create function public.save_church_page_setting(p_key text,p_revision integer,p_payload jsonb) returns public.church_page_settings
language plpgsql security invoker set search_path='' as $$
declare saved public.church_page_settings;
begin
 if not exists(select 1 from public.church_editors where user_id=auth.uid()) then raise exception 'EDITOR_REQUIRED' using errcode='42501';end if;
 if public.valid_church_page_setting(p_key,p_payload) is not true then raise exception 'INVALID_CHURCH_SETTING' using errcode='22023';end if;
 if p_revision=0 then insert into public.church_page_settings(key,payload) values(p_key,p_payload) returning * into saved;
 else update public.church_page_settings set payload=p_payload,revision=revision+1 where key=p_key and revision=p_revision returning * into saved;
  if saved.key is null then raise exception 'REVISION_CONFLICT' using errcode='40001';end if;
 end if;
 return saved;
end $$;
revoke all on function public.save_church_page_setting(text,integer,jsonb) from public,anon;
grant execute on function public.save_church_page_setting(text,integer,jsonb) to authenticated;
