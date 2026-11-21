-- 공개 주보의 "PDF로 내려받기"가 관리자 인쇄 미리보기와 같은 면 배치를 쓰도록,
-- 인쇄 면 번호(1~4)만 공개 읽기에 연다. 행 공개 규칙(게시됨 + 웹 공개 항목)은 그대로다.
grant select (print_page) on public.bulletin_items to anon;
