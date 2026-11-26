# 주보 게시·공개 조회

관리자 `/admin/bulletins`, 공개 독자 화면 `/bulletins`.

## 동작

- 저장된 초안만 게시한다. 미확인 항목이 남았거나 내용 있는 공개 항목이 없으면 UI와 DB 양쪽에서 거절한다.
- 게시 버튼은 즉시 공개한다. 게시 전에 "예약 공개" 시각(한국 시간)을 넣으면 그 시각에 공개된다. 지난 시각은 거절하며, 1년을 넘는 예약은 DB가 거절한다(SCHEDULE_TOO_FAR).
- 게시된 주보는 수정할 수 없다. 게시 취소로 초안으로 돌려 수정한 뒤 다시 게시한다.
- 게시와 취소 모두 revision을 검사하고 증가시켜 오래된 화면의 상태 전환을 거절한다.
- 비공개 블록은 공개 응답에서 제목·본문·구조화 내용 전체가 제외된다. 원본 DB에서 삭제되지는 않는다.

## 조회 계약

- `GET /api/bulletins`: 최신순 게시 주보 20개와 nextCursor 반환. 목록 항목에는 id, service_date, issue_number만 포함. 선택 파라미터 month(YYYY-MM), before(YYYY-MM-DD)로 전체 기록을 월별·날짜 커서로 탐색. 자세한 계약은 public-site.md 참고.
- `GET /api/bulletins?id=<uuid>`: 게시 주보와 공개 블록만 반환. 초안·게시 취소·없는 ID는 모두 404.
- 모든 응답은 `Cache-Control: no-store`. 서버 조회에도 no-store를 적용하며 편집자의 세션이나 서비스 역할 키를 사용하지 않는다.
- 공개 화면은 탭 복귀와 15초 주기로 다시 조회한다. 이미 내려받은 내용을 원격 삭제할 수는 없으며, 열린 화면은 다음 조회 때 게시 취소를 반영한다.
- 페이지네이션, 날짜 검색, 이미지와 인쇄 PDF는 후속 범위다.

## 예약 공개

- 마이그레이션 `20261126100000_bulletin_scheduled_publish`가 `bulletins.publish_at`(timestamptz, 선택)을 추가한다. 값은 `status = published`일 때만 가질 수 있다(CHECK).
- 예약된 주보는 status가 `published`라 읽기 전용이다. 수정하려면 게시를 취소(초안으로 복귀, `publish_at` 비움)한 뒤 다시 게시한다.
- 익명 RLS(주보·항목·인쇄 형식)는 `publish_at is null or publish_at <= now()`를 함께 본다. 그래서 공개 API·PDF·사이트맵이 코드 변경 없이 시각을 따르고, 시각이 되면 별도 작업(크론) 없이 공개된다.
- RPC `set_bulletin_publication(p_id, p_revision, p_publish, p_publish_at default null)`. 과거 시각이면 즉시 공개로 처리한다.
- 관리자 목록·상세는 예약 주보를 "예약 · 11월 30일(일) 오전 9:00"로 표시한다.

## 권한과 동시성

마이그레이션 `20261112052156_bulletin_publication`을 로컬·운영 DB에 적용했다.
익명 역할에는 필요한 열만 SELECT를 부여하며 RLS로 published 주보와 web_visible 항목만 허용한다.
내부 검수 필드는 익명 조회할 수 없다. 로그인된 비편집자는 원본 테이블을 읽지 못하며 공개 API로 읽는다.

공개 RPC `set_bulletin_publication(p_id, p_revision, p_publish)`는 호출자 권한으로 실행한다.
실제 상태 승격은 비노출 private 스키마의 좁은 권한 함수가 담당한다. 이 함수는 auth.uid·편집자 등록·revision·검수 조건을 직접 확인하고 검색 경로를 고정한다.
직접 테이블 UPDATE로 게시 상태를 변경할 수 없다. 항목 변경 트리거는 부모 주보를 잠가 게시와 항목 변경을 직렬화하며, 게시 상태의 항목 변경을 거절한다.

## 검증

DB 테스트: 초안 제외, 미검수 게시 거절, 권한 없는 게시 거절, revision 충돌, 비공개 내용/내부 필드 제외, 게시 중 저장 거절, 게시 취소 후 조회 제외, 공개 내용 없는 게시 거절.
브라우저: 검수 → 자동 저장 → 게시 → 공개 API/화면 확인 → 게시 취소 → 404 확인. 실제 운영 주보를 테스트로 게시하지 않았다.
기존 자동 저장·초대·복사 회귀 테스트도 통과했다. 운영 보안 점검은 기존 유출 비밀번호 검사 비활성 경고 외 신규 항목이 없다.

## 개발 서버 분리

일반 `npm run dev`는 `.next`, `scripts/dev-local.ps1`은 `.next-test`와 3001 포트를 사용한다.
사용자의 3000번 서버를 종료하지 않고 테스트할 수 있다. 테스트 서버는 검증 후 종료한다.
일반 서버 실행 중 빌드 검증은 별도 PowerShell에서 `$env:CHURCH_TEST_SERVER='1'; npm run build`로 분리할 수 있다.
