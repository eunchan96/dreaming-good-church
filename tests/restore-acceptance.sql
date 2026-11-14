-- Run ONLY in an isolated DB created by scripts/test-restore.ps1.
begin;
do $$ begin
 if current_database() !~ '^church_restore_[a-f0-9]{32}$' then
  raise exception 'Restore acceptance requires an isolated drill database';
 end if;
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and c.relrowsecurity) <> 6+(case when to_regclass('public.worship_videos') is null then 0 else 1 end)+(case when to_regclass('public.homepage_content') is null then 0 else 1 end)+(case when to_regclass('public.church_page_settings') is null then 0 else 1 end) then
  raise exception 'Expected all application tables to have RLS';
 end if;
end $$;
insert into auth.users(id) values ('eaba4024-ad4c-4403-9400-533ca7cec001');
insert into public.church_editors(user_id) values ('eaba4024-ad4c-4403-9400-533ca7cec001');
insert into public.bulletins(id,service_date,issue_number) values
 ('eaba4024-ad4c-4403-9400-533ca7cec002','2199-01-01',9001),
 ('eaba4024-ad4c-4403-9400-533ca7cec003','2199-01-08',9002);
insert into public.bulletin_items(bulletin_id,position,title,body,web_visible) values
 ('eaba4024-ad4c-4403-9400-533ca7cec002',0,'restore public','public body',true),
 ('eaba4024-ad4c-4403-9400-533ca7cec002',1,'restore private','private body',false),
 ('eaba4024-ad4c-4403-9400-533ca7cec003',0,'restore draft','draft body',true);
update public.bulletins set status='published' where id='eaba4024-ad4c-4403-9400-533ca7cec002';
set local role anon;
do $$ begin
 if (select count(*) from public.bulletins where issue_number in (9001,9002)) <> 1 then raise exception 'Anonymous draft protection failed'; end if;
 if (select count(*) from public.bulletin_items where title like 'restore %') <> 1 then raise exception 'Anonymous private item protection failed'; end if;
 begin
  insert into public.bulletins(service_date,issue_number) values('2199-01-15',9003);
  raise exception 'Anonymous write unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','eaba4024-ad4c-4403-9400-533ca7cec099',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.bulletins where issue_number in (9001,9002)) <> 0 then raise exception 'Non-editor protection failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','eaba4024-ad4c-4403-9400-533ca7cec001',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.bulletins where issue_number in (9001,9002)) <> 2 then raise exception 'Restored editor cannot read'; end if;
 perform public.set_bulletin_publication('eaba4024-ad4c-4403-9400-533ca7cec003',1,true);
end $$;
reset role;
delete from public.church_editors where user_id='eaba4024-ad4c-4403-9400-533ca7cec001';
set local role authenticated;
do $$ begin
 if (select count(*) from public.bulletins where issue_number in (9001,9002)) <> 0 then raise exception 'Revoked editor still has access'; end if;
 begin
  perform public.set_bulletin_publication('eaba4024-ad4c-4403-9400-533ca7cec003',2,false);
  raise exception 'Revoked editor can publish';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
