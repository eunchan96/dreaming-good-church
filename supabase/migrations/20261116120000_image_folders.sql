-- 이미지 보관함 폴더: 이름만 저장하는 한 단계 폴더 (빈 문자열 = 폴더 없음).
-- 쓰기는 기존처럼 서버 이미지 API(서비스 키)만 하므로 권한·RLS 변경은 없다.
alter table public.bulletin_images add column folder text not null default '' check (char_length(folder) <= 40 and folder = btrim(folder));
create index bulletin_images_folder_idx on public.bulletin_images (folder);
