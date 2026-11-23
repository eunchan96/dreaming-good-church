-- 주보 테마(레이아웃·색 구성). 값은 영문 소문자 키(classic, modern …)이고 화면이 알지 못하는 키는 classic으로 보인다.
alter table public.bulletins add column theme text not null default 'classic'
  check (theme ~ '^[a-z][a-z0-9-]{0,31}$');
-- 공개 주보와 PDF가 같은 테마로 그려지도록 이 열만 공개 읽기에 연다. 행 공개 규칙(게시된 주보)은 그대로다.
grant select (theme) on public.bulletins to anon;

-- 저장 함수에 선택 인수 p_theme을 더한다. 인수를 주지 않으면(예전 화면·테스트) 기존 테마를 그대로 둔다.
drop function public.save_bulletin_draft(uuid, date, integer, integer, jsonb);
create function public.save_bulletin_draft(
  p_id uuid, p_service_date date, p_issue_number integer, p_revision integer, p_items jsonb, p_theme text default null
) returns public.bulletins language plpgsql security invoker set search_path = '' as $$
declare saved public.bulletins; item jsonb; item_position integer := 0;
begin
  if not exists (select 1 from public.church_editors where user_id = auth.uid()) then
    raise exception 'EDITOR_REQUIRED' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'TOO_MANY_ITEMS' using errcode = '22023';
  end if;
  if p_revision = 0 then
    insert into public.bulletins(id, service_date, issue_number, theme)
      values (p_id, p_service_date, p_issue_number, coalesce(p_theme, 'classic')) returning * into saved;
  else
    update public.bulletins set service_date = p_service_date, issue_number = p_issue_number,
      theme = coalesce(p_theme, theme), revision = revision + 1, updated_at = now()
      where id = p_id and revision = p_revision and status = 'draft' returning * into saved;
    if saved.id is null then raise exception 'REVISION_CONFLICT' using errcode = '40001'; end if;
  end if;
  delete from public.bulletin_items where bulletin_id = p_id;
  for item in select value from jsonb_array_elements(p_items) loop
    if item ? 'printPage' and item->'printPage' <> 'null'::jsonb and
      (jsonb_typeof(item->'printPage') <> 'number' or item->>'printPage' !~ '^[1-4]$') then
      raise exception 'INVALID_PRINT_PAGE' using errcode = '22023';
    end if;
    insert into public.bulletin_items(id, bulletin_id, position, title, body, web_visible, review_on_copy, needs_review, kind, content, print_page)
      values ((item->>'id')::uuid, p_id, item_position, item->>'title', item->>'body',
        (item->>'webVisible')::boolean, (item->>'reviewOnCopy')::boolean, (item->>'needsReview')::boolean, coalesce(item->>'kind', 'text'), coalesce(item->'content', '{}'::jsonb), (item->>'printPage')::smallint);
    item_position := item_position + 1;
  end loop;
  return saved;
end $$;
revoke all on function public.save_bulletin_draft(uuid, date, integer, integer, jsonb, text) from public, anon;
grant execute on function public.save_bulletin_draft(uuid, date, integer, integer, jsonb, text) to authenticated;

-- 지난 주 주보를 복사할 때 테마도 함께 가져온다.
create or replace function public.copy_bulletin_draft(p_source uuid,p_service_date date,p_issue_number integer)
returns public.bulletins language plpgsql security invoker set search_path='' as $$
declare copied public.bulletins; snapshot record;
begin
  if not exists(select 1 from public.church_editors where user_id=auth.uid()) then raise exception 'EDITOR_REQUIRED' using errcode='42501'; end if;
  select b.id,b.service_date,b.theme,coalesce((select jsonb_agg(to_jsonb(i)) from public.bulletin_items i where i.bulletin_id=b.id),'[]'::jsonb) as items
    into snapshot from public.bulletins b where b.id=p_source;
  if snapshot.id is null or p_service_date<=snapshot.service_date then raise exception 'INVALID_COPY_DATE_OR_SOURCE' using errcode='22023'; end if;
  insert into public.bulletins(service_date,issue_number,theme) values(p_service_date,p_issue_number,snapshot.theme) returning * into copied;
  insert into public.bulletin_items(bulletin_id,position,title,body,web_visible,review_on_copy,needs_review,kind,content,print_page)
    select copied.id,i.position,i.title,i.body,i.web_visible,i.review_on_copy,i.review_on_copy,i.kind,i.content,i.print_page
      from jsonb_populate_recordset(null::public.bulletin_items,snapshot.items) i;
  return copied;
end $$;
