-- Applied with explicit user approval on 2026-11-15 after bulletin_row_state.
-- Retained for audit; the operation is idempotent when the value is already present.
-- Only the requested attribution changes; a stale revision aborts the operation.
do $$
declare bulletin public.bulletins; guide public.bulletin_items; before_hash text; after_hash text;
begin
 select * into strict bulletin from public.bulletins where service_date='2026-11-01' and issue_number=44 for update;
 if bulletin.status<>'draft' then raise exception 'DRAFT_REQUIRED';end if;
 select * into strict guide from public.bulletin_items where bulletin_id=bulletin.id and title='묵상 가이드';
 if guide.content->>'attribution'='3, 4 여선교회' then return;end if;
 if bulletin.revision<>3 then raise exception 'REVISION_CONFLICT: re-read current draft before applying' using errcode='40001';end if;
 select md5(jsonb_agg(case when i.id=guide.id then to_jsonb(i)||jsonb_build_object('content',i.content-'attribution') else to_jsonb(i) end order by position)::text) into before_hash from public.bulletin_items i where bulletin_id=bulletin.id;
 update public.bulletin_items set content=jsonb_set(content,'{attribution}',to_jsonb('3, 4 여선교회'::text),true) where id=guide.id;
 select md5(jsonb_agg(case when i.id=guide.id then to_jsonb(i)||jsonb_build_object('content',i.content-'attribution') else to_jsonb(i) end order by position)::text) into after_hash from public.bulletin_items i where bulletin_id=bulletin.id;
 if before_hash is distinct from after_hash then raise exception 'UNRELATED_CONTENT_CHANGED';end if;
 update public.bulletins set revision=revision+1,updated_at=now() where id=bulletin.id and revision=3;
end $$;
