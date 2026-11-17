-- User authorized only stable, legible Word-reference transcription corrections.
-- Correct the previously unreadable staff reader; preserve weekly readings and all other data.
do $$
declare current_revision integer; current_status text; original_content jsonb; expected_other text; actual_other text; n integer;
begin
 select revision,status into current_revision,current_status from public.bulletins where id='fc7f7371-4da1-47f0-9a5d-877b67503608' for update;
 if current_status is distinct from 'draft' then raise exception 'Expected draft';end if;
 select content into original_content from public.bulletin_items where id='237efe3e-4e7e-4894-9d1c-ad708dd6a5b2' and bulletin_id='fc7f7371-4da1-47f0-9a5d-877b67503608';
 if original_content#>>'{rows,8,0}'='성경 봉독' and original_content#>>'{rows,8,1}'='조근혜' then return;end if;
 if current_revision<>14 or md5(original_content::text)<>'c24ccbb71e8b197df035e63f099b0102' then raise exception 'Source changed';end if;
 select md5(jsonb_agg(to_jsonb(i) order by i.id)::text) into expected_other from public.bulletin_items i where bulletin_id='fc7f7371-4da1-47f0-9a5d-877b67503608' and id<>'237efe3e-4e7e-4894-9d1c-ad708dd6a5b2';
 update public.bulletin_items set content=jsonb_set(content,'{rows,8}',jsonb_build_array('성경 봉독','조근혜','')) where id='237efe3e-4e7e-4894-9d1c-ad708dd6a5b2';
 get diagnostics n=row_count;if n<>1 then raise exception 'Target missing';end if;
 if (select content#-'{rows,8}' from public.bulletin_items where id='237efe3e-4e7e-4894-9d1c-ad708dd6a5b2') is distinct from (original_content#-'{rows,8}') then raise exception 'Other staff rows changed';end if;
 select md5(jsonb_agg(to_jsonb(i) order by i.id)::text) into actual_other from public.bulletin_items i where bulletin_id='fc7f7371-4da1-47f0-9a5d-877b67503608' and id<>'237efe3e-4e7e-4894-9d1c-ad708dd6a5b2';
 if expected_other is distinct from actual_other then raise exception 'Unrelated data changed';end if;
 update public.bulletins set revision=revision+1 where id='fc7f7371-4da1-47f0-9a5d-877b67503608' and revision=14 and status='draft';
 get diagnostics n=row_count;if n<>1 then raise exception 'Revision conflict';end if;
end $$;
