-- Keep existing block JSON valid; add reversible row states and guide attribution.
create or replace function public.valid_bulletin_content(kind text,content jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare base jsonb; entry jsonb; field text; n integer;
begin
 if content is null or jsonb_typeof(content)<>'object' or length(content::text)>200000 then return false;end if;
 if content?'disabled' and jsonb_typeof(content->'disabled')<>'boolean' then return false;end if;
 if content?'attribution' and (kind<>'text' or jsonb_typeof(content->'attribution')<>'string' or length(content->>'attribution')>200) then return false;end if;
 if content?'footer' and (kind<>'worship' or jsonb_typeof(content->'footer')<>'string' or length(content->>'footer')>1000) then return false;end if;
 foreach field in array array['disabledRows','fullRows'] loop
  if content?field then
   if kind not in ('worship','offering') or (field='fullRows' and kind<>'worship') or jsonb_typeof(content->field)<>'array' or jsonb_typeof(content->'rows') is distinct from 'array' then return false;end if;
   if jsonb_array_length(content->field)>100 then return false;end if;
   for entry in select value from jsonb_array_elements(content->field) loop
    if jsonb_typeof(entry)<>'number' or entry::text!~'^[0-9]{1,3}$' then return false;end if;
    n=(entry::text)::integer;if n>=jsonb_array_length(content->'rows') then return false;end if;
   end loop;
   if (select count(*) from jsonb_array_elements(content->field))<>(select count(distinct value) from jsonb_array_elements(content->field)) then return false;end if;
  end if;
 end loop;
 base=content-array['disabled','attribution','disabledRows','fullRows','footer'];
 if kind='image' then
  return jsonb_typeof(base)='object' and (select count(*) from jsonb_object_keys(base))=2
   and jsonb_typeof(base->'assetId')='string' and base->>'assetId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and jsonb_typeof(base->'alt')='string' and length(btrim(base->>'alt')) between 1 and 500;
 end if;
 return public.valid_text_bulletin_content(kind,base);
end $$;
-- No grants, RLS, publication functions or existing data are changed.
