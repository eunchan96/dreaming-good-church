# 특별 순서지

주간 주보에 없는 구성(1부·2부, 서약문 박스, 임직 대상 표 등)의 행사 순서지를 웹과 인쇄 모양으로 보여 준다. 읽기 전용이며 관리자 편집 화면은 없다.

## 관리자 화면 (주보 관리)

- 주보 목록에 주보와 함께 날짜 순으로 보인다(제목과 상태 표시: 초안·예약·게시됨). 누르면 주보 상세와 같은 틀로 열린다.
- 본문에는 웹 미리보기, "인쇄 미리보기" 버튼은 올려 둔 PDF를 창으로 보여 준다(공개 전에도 가능).
- 내용은 수정하지 않는다(수정·삭제 버튼 없음). **예약 공개**(달력·시계), **게시하기**, **게시 취소**는 주보와 같다. 서버 함수 `set_special_program_publication`(마이그레이션 `20261127190000`)이 편집자·상태·시각(1년 이내)을 검사한다.
- 예약된 순서지는 `status=published`에 `publish_at`이 미래다. 익명 RLS(행과 PDF)가 `publish_at <= now()`를 함께 보므로 시각이 되면 별도 작업 없이 공개된다.

## 보는 곳

- `/bulletins` 위쪽의 "특별 순서지" 바로가기(공개된 것이 있을 때만 보인다) → `/bulletins/special/<slug>`.
- **웹 미리보기**: 주보와 같은 부품(띠, 순서 줄, 박스)으로 그린다. 모바일에서는 주보와 같은 방식으로 줄이 쌓인다.
- **인쇄 미리보기**: 올려 둔 PDF를 화면에서 바로 보여 주고 "PDF로 내려받기"를 둔다(`/api/special-programs/pdf?slug=…[&download=1]`). 일부 휴대폰은 첫 쪽만 보일 수 있어 안내 문구를 둔다.
- 순서지에는 성도 이름이 들어가므로 검색 엔진에 올리지 않는다(`noindex`). 사이트맵에도 없다.

- 공개 전(초안) 미리보기는 서버가 아니라 로그인한 편집자의 브라우저가 직접 읽는다(RLS: 편집자만 초안 행·PDF 읽기, 마이그레이션 `20261127170000`).

## 저장 구조 (마이그레이션 `20261127150000_special_programs`)

- 테이블 `special_programs`: `slug`(주소), `title`, `service_date`, `status`(draft/published), `content`(웹 미리보기용 JSON), `pdf_path`(버킷 `special-programs`의 파일 이름).
- 익명은 `published` 행의 공개 열만, 그 행의 PDF만 읽는다(RLS·스토리지 정책). 편집자는 초안도 읽을 수 있다. **쓰기는 아무도 못 하고** 서비스 권한(운영자가 올리는 절차)만 한다.
- `content` 형식과 검사: `lib/special-programs.ts`(`parseProgramContent`). 형식이 틀리면 그리지 않고 404. 포스터 이미지는 `/special/` 아래 정적 파일만 쓴다.

## 새 순서지 올리기 (이름은 공개 저장소에 넣지 않는다)

1. Word·PDF는 `church-program` 스킬로 만들고, 같은 내용을 `content` JSON으로 만든다(블록 종류: title, band, table, rows, note, schedule, boxes). 포스터는 `public/special/`에 넣는다(성도 이름이 없는 홍보 이미지만).
2. 행 넣기: `supabase db query --remote=<ref>`로 `insert into special_programs …`(처음에는 `status='draft'`).
3. PDF 올리기: `supabase storage cp <로컬 pdf> ss:///special-programs/<slug>.pdf --remote=<ref>`.
4. 관리자 "주보 관리" 목록에서 열어 미리 보고, 괜찮으면 **게시하기**(또는 예약 공개)를 누른다. 내리기는 **게시 취소**.

## 검증

`tests/special-programs.integration.mjs`(권한: 공개·초안·쓰기·PDF), `tests/special-programs.test.mjs`(형식 검사), `tests/e2e/special-programs.spec.ts`(바로가기→웹→인쇄 미리보기, 초안 404).
