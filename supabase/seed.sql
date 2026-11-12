-- Fictional local development data only. Never push this seed to production.
-- Fixed IDs and insert-only behavior preserve edited samples when this file is rerun.
begin;
do $$
declare week integer; bulletin uuid; service_day date; item_id uuid;
begin
 for week in 1..3 loop
  bulletin := ('d0000000-0000-4000-8000-'||lpad(week::text,12,'0'))::uuid;
  service_day := date '2026-11-01' + (week-1)*7;
  if exists(select 1 from public.bulletins where id=bulletin) then continue; end if;
  insert into public.bulletins(id,service_date,issue_number) values(bulletin,service_day,week);
  insert into public.bulletin_items(id,bulletin_id,position,title,body,kind,content,review_on_copy,needs_review)
  values
   (('d1000000-0000-4000-8000-'||lpad((week*100+1)::text,12,'0'))::uuid,bulletin,0,'[샘플] 예배 순서','실제 예배 자료가 아닌 개발용 예시입니다.','worship','{"rows":[["찬송","함께 찬양","다 같이"],["기도","예배를 위한 기도","담당자 예시"],["말씀","주일 말씀","설교자 예시"]]}',true,week=3),
   (('d1000000-0000-4000-8000-'||lpad((week*100+2)::text,12,'0'))::uuid,bulletin,1,'[샘플] 함께 자라는 공동체 '||week,'서로를 돌아보고 이웃을 섬기는 한 주를 준비합니다. 본문은 검증용 창작 예시입니다.','sermon','{"reference":"사도행전 2:42~47","preacher":"설교자 예시"}',true,week=3),
   (('d1000000-0000-4000-8000-'||lpad((week*100+3)::text,12,'0'))::uuid,bulletin,2,'[샘플] 이번 주 교회 소식',case when week in (1,3) then '첫째·셋째 주 오후예배 예시: 오후 1시 40분, 예배실. 자동 생성이 아닌 샘플 문구입니다.' else '이번 주에는 주일 예배 후 함께 교제합니다. 반복 공지의 문구 수정 예시입니다.' end,'text','{}',true,false);
  insert into public.bulletin_items(id,bulletin_id,position,title,body,web_visible)
   values(('d1000000-0000-4000-8000-'||lpad((week*100+4)::text,12,'0'))::uuid,bulletin,3,'[샘플] 인쇄 전용 안내','비공개 동작 검증용 가상 메모입니다. 개인정보는 없습니다.',false);
  if week=1 then
   insert into public.bulletin_items(id,bulletin_id,position,title,body,kind,content,review_on_copy)
    values('d1000000-0000-4000-8000-000000000105',bulletin,4,'[샘플] 지난달 헌금 합계','모든 금액은 검증용 가상 수치입니다.','offering','{"month":"2026-10","rows":[["주일헌금","100000"],["감사헌금","50000"]]}',true);
  end if;
  if week<3 then update public.bulletins set status='published' where id=bulletin; end if;
 end loop;
end $$;

insert into public.community_entries(id,kind,title,body,status,is_public,sensitive,source_bulletin_id,source_item_id)
values
 ('d2000000-0000-4000-8000-000000000001','notice','[샘플] 함께하는 주일 안내','주보에서 가져와 별도 공지로 게시한 가상 안내입니다.','published',true,false,'d0000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000103'),
 ('d2000000-0000-4000-8000-000000000002','notice','[샘플] 내부 준비 안내','민감정보 표시 동작을 확인하기 위한 가상 문구입니다. 개인정보는 없습니다.','published',false,true,null,null),
 ('d2000000-0000-4000-8000-000000000003','notice','[샘플] 다음 주 공지 초안','아직 게시되지 않은 초안의 예시입니다.','draft',true,false,null,null)
on conflict(id) do nothing;
insert into public.community_entries(id,kind,title,body,location,starts_at,ends_at,status)
values
 ('d3000000-0000-4000-8000-000000000001','event','[샘플] 첫째 주 오후예배','한국 시간 입력·표시를 확인하는 가상 일정입니다.','예배실 예시','2026-11-01 13:40:00+09','2026-11-01 14:40:00+09','published'),
 ('d3000000-0000-4000-8000-000000000002','event','[샘플] 셋째 주 오후예배','반복 일정 복사 후 문구를 수정하는 예시입니다.','예배실 예시','2026-11-15 13:40:00+09','2026-11-15 14:40:00+09','published')
on conflict(id) do nothing;
update public.church_info set body=case key
 when 'name' then '[샘플] 개발용 교회'
 when 'address' then '[샘플] 실제 주소가 아닌 위치 안내 예시입니다.'
 when 'phone' then '[샘플] 실제 연락처를 입력하지 않았습니다.'
 when 'worship' then '[샘플] 주일 오전 10:45 / 첫째·셋째 주 오후 1:40'
 when 'introduction' then '[샘플] 함께 예배하고 이웃을 섬기는 공동체입니다.'
 when 'directions' then '[샘플] 오시는 길을 설명하는 영역입니다. 실제 지도는 후속 작업입니다.' end
where body='';
commit;
