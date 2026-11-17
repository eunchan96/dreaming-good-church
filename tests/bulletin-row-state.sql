do $$
begin
 if not public.valid_bulletin_content('text','{}') or not public.valid_bulletin_content('text','{"attribution":"3, 4 여선교회"}') then raise exception 'text compatibility';end if;
 if not public.valid_bulletin_content('worship','{"rows":[["first","",""],["second","",""]],"fullRows":[0],"disabledRows":[1],"footer":"stand"}') then raise exception 'row metadata';end if;
 if not public.valid_bulletin_content('offering','{"month":"2026-10","rows":[["gift","1000"]],"disabledRows":[0]}') then raise exception 'offering compatibility';end if;
 if public.valid_bulletin_content('worship','{"rows":[["a","",""]],"disabledRows":[1]}') or public.valid_bulletin_content('worship','{"rows":[["a","",""]],"disabledRows":[0,0]}') then raise exception 'state bounds';end if;
 if public.valid_bulletin_content('offering','{"month":"","rows":[["a","0"]],"fullRows":[0]}') or public.valid_bulletin_content('text','{"disabled":"true"}') or public.valid_bulletin_content('text','{"unexpected":"value"}') then raise exception 'invalid metadata accepted';end if;
 if exists(select 1 from public.bulletin_items where not public.valid_bulletin_content(kind,content)) then raise exception 'existing data rejected';end if;
 if has_function_privilege('anon','public.valid_bulletin_content(text,jsonb)','execute') or has_function_privilege('anon','public.set_bulletin_publication(uuid,integer,boolean)','execute') then raise exception 'anonymous execute';end if;
 if not exists(select 1 from pg_proc where oid='private.set_bulletin_publication(uuid,integer,boolean)'::regprocedure and prosecdef) or has_schema_privilege('anon','private','usage') then raise exception 'private promotion boundary changed';end if;
 if exists(select 1 from pg_proc where oid in ('public.valid_bulletin_content(text,jsonb)'::regprocedure,'public.set_bulletin_publication(uuid,integer,boolean)'::regprocedure) and prosecdef) then raise exception 'security invoker changed';end if;
end $$;
