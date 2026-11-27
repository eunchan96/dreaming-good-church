-- 편집자는 공개 전(초안) 순서지의 PDF도 볼 수 있다(공개 전 미리보기). 익명 정책은 그대로 공개된 것만.
create policy "editors read special program pdf" on storage.objects for select to authenticated
  using (bucket_id = 'special-programs' and exists (select 1 from public.church_editors where user_id = auth.uid()));
