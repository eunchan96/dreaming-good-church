# 주보 초안 편집

관리자 화면: `/admin/bulletins`

현재 지원: 이메일/비밀번호 로그인, 편집자 권한 확인, 주보 목록, 텍스트 항목 작성,
웹 공개 설정, 주간 확인 표시, 항목 삭제·순서 변경, 수동/자동 저장, 이전 주 복사, 웹 표시 미리보기.
설교(구절·설교자), 예배 순서(순서·내용·담당자), 헌금 내역(집계 월·구분·금액·합계) 블록을 추가할 수 있다.
게시·공개 조회는 [게시·공개 조회 안내](bulletin-publication.md)를 참고한다. 인쇄 PDF·HWP 가져오기·사진 업로드는 아직 제공하지 않는다. 색감·디자인 상세는 후속 작업이다.

## 자동 저장과 세션 복구

새 초안은 첫 저장을 직접 한다. 이후 입력을 1.2초 멈추면 자동 저장한다.
저장 중에도 입력은 가능하며, 응답이 늦게 도착해도 새 입력을 덮어쓰지 않고 다음 요청으로 저장한다.
실패·동시 수정 충돌은 자동 저장을 중지한다. 입력을 보관한 뒤 문제를 해결하고 `저장 다시 시도`를 누른다.
충돌 시에는 현재 입력을 별도 보관하고 페이지를 새로고침해 최신 저장본에 필요한 변경만 다시 반영한다.

세션 종료 이벤트 또는 탭 복귀 시 만료 응답을 받으면 편집 화면을 숨기고 로그인을 안내한다.
같은 계정으로 재로그인하면 현재 탭의 미저장 초안을 이어 쓴다. 다른 계정 로그인이나 명시적인 로그아웃은 이전 초안을 지운다.
복구 대상은 메모리이며 브라우저 저장소에 주보 본문을 저장하지 않는다. 탭 종료·새로고침 후에는 미저장 내용을 복구하지 못한다.

## 전용 블록 계약

`bulletin_items.kind`: `text | sermon | worship | offering`, `content`: JSON 객체.
기존 텍스트는 `kind=text`, `content={}`로 호환한다.
- sermon: `{reference: string, preacher: string}`
- worship: `{rows: [순서, 내용, 담당자][]}`
- offering: `{month: YYYY-MM 또는 빈 문자열, rows: [구분, 금액문자열][]}`

표는 최대 100행, 셀은 500자 이내. 금액은 빈 문자열 또는 12자리 이하의 0 이상 정수 문자열이다.
DB 제약 `valid_bulletin_content`가 형태·길이·월·금액을 검사하며 실패하면 저장 전체가 롤백된다.
각 블록은 웹 공개 설정·주간 재확인·복사 규칙을 동일하게 따른다. 헌금 합계는 금액 행의 합으로 계산한다.

## 저장 규칙

- 새 항목은 기본 공개. 복사한 항목은 기존 공개 설정을 유지한다.
- 복사본은 초안이며 원본 항목 ID와 내용을 변경하지 않는다.
- `review_on_copy` 항목은 복사 시 `needs_review`가 켜진다.
- 내용을 수정하거나 ‘그대로 사용’을 선택하면 확인 표시가 해제된다.
- 저장은 하나의 DB 함수 호출로 주보와 항목을 함께 반영한다.
- `revision`이 다르면 저장을 거부해 다른 편집 내용을 덮어쓰지 않는다.
- 테이블 직접 접근도 RLS로 제한한다. 편집자 등록은 신뢰할 수 있는 운영자가 수행한다.
- 익명 조회는 게시된 주보의 공개 항목과 허용된 열에만 적용한다. 초안과 비공개 항목은 편집자만 조회한다.

## 로컬 실행 (Windows)

### 실제 프로젝트를 화면에서 확인

```powershell
npm run dev
```

`http://localhost:3000/admin/bulletins`에 접속한다. 루트 `/`는 아직 초기 Next.js 화면이다.
이 명령은 `.env.local`에 등록된 실제 Supabase에 연결한다. 아래의 격리 테스트 환경과 계정이 다르다.

`Another next dev server is already running`은 동일 프로젝트의 서버가 이미 실행 중이라는 뜻이다.
표시된 URL을 사용하거나 기존 서버 터미널에서 Ctrl+C로 종료한 뒤 다시 실행한다.
프로세스를 강제 종료해야 한다면 경로와 PID가 이 프로젝트인지 먼저 확인한다.
프로젝트 밖 package-lock 경고는 `turbopack.root`를 저장소 경로로 지정하여 해결했다.

### 격리된 로컬 테스트 환경

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
`20261112045118_bulletin_structured_blocks`도 로컬·운영에 적용되어 있다.
로컬 파일과 이력 번호도 동일하게 맞췄다.

브라우저 연결에는 `NEXT_PUBLIC_SUPABASE_URL`과
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 사용한다. 서비스 역할 키는 화면에 전달하지 않는다.
관리자는 Supabase Auth 계정과 `church_editors.user_id` 등록이 모두 필요하다.
초대 수락·비밀번호 설정 화면은 `/admin/account`다. 일회용 초대 해시를 확인하고 편집자 등록을 검사한다.
비밀번호는 사용자가 12자 이상으로 직접 설정한다. 만료·재사용 링크는 거절하고, 입력 불일치나 통신 실패 시 입력을 유지한다.

신뢰할 수 있는 로컬 터미널에서만 다음 명령을 실행한다. 메일을 보내지 않고 초대와 편집 권한을 등록한다.

```powershell
node --env-file=.env.local scripts/invite-editor.mjs <관리자이메일>
```

생성된 `.local/admin-invite.html`을 브라우저로 열어 설정 링크를 누른다. 개발 서버는 3000번 포트여야 한다.
링크가 만료되면 아직 수락하지 않은 계정에 위 명령으로 재발급한다. 이미 설정한 계정의 비밀번호 재설정은 별도 후속 기능이다.
`.local`은 Git에서 제외되며 링크·비밀번호·서비스 키를 Notion이나 커밋에 기록하지 않는다.
초대 링크 생성은 [generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), 수락은 [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp)를 사용한다.

## 후속 작업

1. 일정·공지의 별도 관리와 주보 연결, 공개 목록 페이지네이션·예약 공개 정책.
2. 이미지 업로드·교회 정보 관리, 이후 인쇄 4면·공개용/인쇄용 PDF 분리.
3. 배포 URL 설정 및 비밀번호 재설정 흐름. 디자인 세부 시안은 후속 검토.
4. HWP 원본 확보 후 인식과 검수 가져오기.

운영 Auth는 이미 가입 차단 상태였으며 `scripts/check-signup.mjs`로 실제 `signup_disabled` 응답을 확인했다.
로컬 `enable_signup=false`는 다음 Supabase 재시작부터 반영된다.
원격 보안 점검의 유출 비밀번호 검사 비활성 경고는 운영 준비 항목으로 남겼다. 해당 기능은 Pro 이상에서 제공되며 요금제 변경은 하지 않았다.

참고: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[DB 함수](https://supabase.com/docs/guides/database/functions),
[비밀번호 로그인](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).
