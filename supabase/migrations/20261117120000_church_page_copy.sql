-- 교회 소개 화면의 고정 문구와 담임목사 이름을 관리자에서 편집할 수 있게 church_info 항목을 늘린다.
alter table public.church_info drop constraint church_info_key_check;
alter table public.church_info add constraint church_info_key_check check (key in (
 'name','address','phone','worship','introduction','directions',
 'pastor_name','page_lead','greeting_title','greeting_closing','map_caption','offering_title','offering_note'
));
insert into public.church_info(key) values ('pastor_name'),('page_lead'),('greeting_title'),('greeting_closing'),('map_caption'),('offering_title'),('offering_note')
on conflict (key) do nothing;

-- 보낸 항목만 저장한다(중복 없이 1개 이상, 표에 있는 항목 수 이하). 6개만 보내는 이전 화면과 새 화면이 모두 저장할 수 있다.
create or replace function public.save_church_info(p_fields jsonb) returns setof public.church_info
language plpgsql security invoker set search_path='' as $$
declare field jsonb; updated_key text; expected integer;
begin
 if not exists(select 1 from public.church_editors where user_id=auth.uid()) then raise exception 'EDITOR_REQUIRED' using errcode='42501'; end if;
 select count(*) into expected from public.church_info;
 if jsonb_typeof(p_fields) is distinct from 'array' or jsonb_array_length(p_fields) not between 1 and expected then raise exception 'INVALID_FIELDS' using errcode='22023'; end if;
 if (select count(distinct value->>'key') from jsonb_array_elements(p_fields))<>jsonb_array_length(p_fields) then raise exception 'INVALID_FIELDS' using errcode='22023'; end if;
 for field in select value from jsonb_array_elements(p_fields) order by value->>'key' loop
  update public.church_info set body=field->>'body',web_visible=(field->>'web_visible')::boolean,revision=revision+1
   where key=field->>'key' and revision=(field->>'revision')::integer returning key into updated_key;
  if updated_key is null then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
 end loop;
 return query select * from public.church_info order by key;
end $$;
revoke all on function public.save_church_info(jsonb) from public,anon;
grant execute on function public.save_church_info(jsonb) to authenticated;
