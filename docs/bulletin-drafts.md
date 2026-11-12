# 주보 초안 편집

관리자 화면: `/admin/bulletins`

현재 지원: 이메일/비밀번호 로그인, 편집자 권한 확인, 주보 목록, 텍스트 항목 작성,
웹 공개 설정, 주간 확인 표시, 수동 저장, 이전 주 복사, 웹 표시 미리보기.
게시·공개 조회·인쇄 PDF·HWP 가져오기·자동 저장은 아직 제공하지 않는다.

## 저장 규칙

- 새 항목은 기본 공개. 복사한 항목은 기존 공개 설정을 유지한다.
- 복사본은 초안이며 원본 항목 ID와 내용을 변경하지 않는다.
- `review_on_copy` 항목은 복사 시 `needs_review`가 켜진다.
- 내용을 수정하거나 ‘그대로 사용’을 선택하면 확인 표시가 해제된다.
- 저장은 하나의 DB 함수 호출로 주보와 항목을 함께 반영한다.
- `revision`이 다르면 저장을 거부해 다른 편집 내용을 덮어쓰지 않는다.
- 테이블 직접 접근도 RLS로 제한한다. 편집자 등록은 신뢰할 수 있는 운영자가 수행한다.
- 이 단계의 테이블은 익명 조회를 허용하지 않는다. 공개 조회 정책은 게시 기능에서 추가한다.

## 로컬 실행 (Windows)

Node 22.16 이상, Docker, 설치된 프로젝트 의존성이 필요하다.

```powershell
npx --no-install supabase start
powershell -NoProfile -File scripts/dev-local.ps1
```

개발 화면은 `http://localhost:3001/admin/bulletins`이다.
실행 스크립트는 현재 프로세스에만 로컬 연결 정보를 설정한다. 기존 `.env.local`은 수정하지 않는다.

## 검증

```powershell
npm test
npm run typecheck
npm run lint
npm run build
powershell -NoProfile -File scripts/test-db.ps1
# 로컬 개발 서버를 실행한 상태에서 (설치된 Microsoft Edge 사용)
powershell -NoProfile -File scripts/test-e2e.ps1
```

DB·브라우저 테스트는 `127.0.0.1:54321`에만 접속한다. 임시 계정을 생성하고 테스트 후 정리한다.
실제 성도 정보·주보 사진·운영 계정을 테스트 데이터로 사용하지 않는다.
단위 테스트는 Node의 실험적 TypeScript 직접 실행 기능을 사용한다.

## 원격 설정

원격 DB에는 `20261112042207_bulletin_drafts`가 적용되어 있다.
로컬 파일과 이력 번호도 동일하게 맞췄다.

브라우저 연결에는 `NEXT_PUBLIC_SUPABASE_URL`과
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 사용한다. 서비스 역할 키는 화면에 전달하지 않는다.
관리자는 Supabase Auth 계정과 `church_editors.user_id` 등록이 모두 필요하다.
계정 초대·비밀번호 설정 화면은 후속 작업이며 현재 운영 사용자 계정은 생성하지 않았다.

## 후속 작업

1. 관리자 초대 수락·비밀번호 설정 흐름 연결.
2. 항목 삭제·순서 변경, 실패 재시도와 자동 저장 설계.
3. 실제 주보의 예배 순서·표·이미지·헌금 집계용 편집 블록.
4. 게시 전 검수·공개 페이지·공개용/인쇄용 PDF 분리.
5. HWP 원본 확보 후 인식과 검수 가져오기.

참고: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[DB 함수](https://supabase.com/docs/guides/database/functions),
[비밀번호 로그인](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).
