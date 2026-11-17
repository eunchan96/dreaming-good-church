-- Explicit user correction from the 2026-11-15 feedback and supplied Word reference.
-- Only three items are corrected; publication state and all other items are preserved.
-- Expected source revision: 9. This script is idempotent after the exact correction.
do $$
declare before_hash text; after_hash text; current_revision integer; current_status text; n integer;
begin
 select revision,status into current_revision,current_status from public.bulletins where id='fc7f7371-4da1-47f0-9a5d-877b67503608' for update;
 if current_status is distinct from 'draft' then raise exception 'Expected draft';end if;
 if (select count(*) from public.bulletin_items where
  (id='22ff75be-9e9f-46ba-9b82-128a3ce1bade' and title='좋은 소식 · 안내' and md5(body)='22f2ac772ddd068b46b68e31c54c2b9d') or
  (id='1981ab04-9347-47ad-94ee-375ae35f4b04' and md5(body)='94aa4bf838e40d3923935099217ffc5f') or
  (id='74f4b9f9-2b29-4898-9ef0-18df65b467a0' and md5(body)='5af0801390e81cb3e33c520ab90ae149'))=3 then return;end if;
 if current_revision<>9 then raise exception 'Revision conflict';end if;
 if (select count(*) from public.bulletin_items where bulletin_id='fc7f7371-4da1-47f0-9a5d-877b67503608' and
  ((id='22ff75be-9e9f-46ba-9b82-128a3ce1bade' and title='좋은 소식 · 자치 동정' and md5(body)='06df28c7bf9506503eee16d5ab3384c7') or
  (id='1981ab04-9347-47ad-94ee-375ae35f4b04' and md5(body)='02cfbd9d8d017e35a0521effa0c8c25e') or
  (id='74f4b9f9-2b29-4898-9ef0-18df65b467a0' and md5(body)='58e3a853265dc2cd9d6d919f8bd99eae')))=3 then null;else raise exception 'Source changed';end if;
 select md5(jsonb_agg(to_jsonb(i) order by i.id)::text) into before_hash from public.bulletin_items i where bulletin_id='fc7f7371-4da1-47f0-9a5d-877b67503608' and id not in ('22ff75be-9e9f-46ba-9b82-128a3ce1bade','1981ab04-9347-47ad-94ee-375ae35f4b04','74f4b9f9-2b29-4898-9ef0-18df65b467a0');
 update public.bulletin_items set title='좋은 소식 · 안내',body='1층 남선교회 김동주 집사, 김형신 집사' where id='22ff75be-9e9f-46ba-9b82-128a3ce1bade';
 update public.bulletin_items set body='온라인 헌금계좌: '||replace(replace(body,'301-0233-','301-0223-'),' · ',' ') where id='1981ab04-9347-47ad-94ee-375ae35f4b04';
 update public.bulletin_items set body='온라인 건축헌금: '||replace(body,' · ',' ') where id='74f4b9f9-2b29-4898-9ef0-18df65b467a0';
 select md5(jsonb_agg(to_jsonb(i) order by i.id)::text) into after_hash from public.bulletin_items i where bulletin_id='fc7f7371-4da1-47f0-9a5d-877b67503608' and id not in ('22ff75be-9e9f-46ba-9b82-128a3ce1bade','1981ab04-9347-47ad-94ee-375ae35f4b04','74f4b9f9-2b29-4898-9ef0-18df65b467a0');
 if before_hash is distinct from after_hash then raise exception 'Unrelated content changed';end if;
 update public.bulletins set revision=revision+1 where id='fc7f7371-4da1-47f0-9a5d-877b67503608' and revision=9 and status='draft';
 get diagnostics n=row_count;if n<>1 then raise exception 'Revision conflict';end if;
end $$;
