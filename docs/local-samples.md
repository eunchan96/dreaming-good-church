# 로컬 샘플과 DB 타입

## 두 실행 환경

| 실행 | 주소 | 데이터 |
| --- | --- | --- |
| `npm run dev` | localhost:3000 | 기존 `.env.local`의 운영 Supabase |
| `npm run dev:local` | localhost:3001 | Docker의 로컬 Supabase, 샘플 검증 전용 |

로컬 실행은 프로세스 환경변수만 바꾸며 `.env.local`을 수정하지 않는다.
두 서버의 빌드 폴더도 `.next`와 `.next-test`로 분리한다.
샘플은 운영 DB에 넣지 않는다. 이 작업에는 운영 마이그레이션 변경이 없다.

## 처음 준비하기

Docker Desktop과 `npm install`이 완료된 저장소 루트에서 실행한다.

```powershell
npx --no-install supabase start
```

새 로컬 DB에서는 마이그레이션과 `supabase/seed.sql`이 적용된다.
이미 사용하던 로컬 DB를 처음 상태로 되돌리려면 아래 명령을 사용한다.
**로컬에서 작성한 주보·계정·파일을 지우므로 보존할 자료가 있다면 먼저 백업한다.**

```powershell
npx --no-install supabase db reset
```

설치된 CLI v3는 기본값이 로컬이다. `--remote`를 붙이지 않는다.
운영 배포에 샘플을 포함하는 옵션도 사용하지 않는다.

```powershell
npm run demo:account
npm run dev:local
```

공개 주보: http://localhost:3001/bulletins

관리자: http://localhost:3001/admin/bulletins

로컬 전용 이메일은 `editor@example.test`다. 무작위 비밀번호는 `.local/demo-account.txt`에만 기록한다.
실제 이메일을 보내지 않으며 운영 관리자 계정과 무관하다. `demo:account` 재실행 시 이 로컬 계정의 비밀번호를 새로 만든다.
로컬 reset 후에는 계정을 다시 준비해야 한다. `.local`은 Git에서 제외한다.

## 샘플 구성

- 2026-11-01: 게시됨. 예배 순서·설교·첫째 주 오후예배 공지·인쇄 전용 비공개 항목·지난달 헌금 예시.
- 2026-11-08: 게시됨. 반복 공지 문구를 바꾼 주보와 비공개 항목.
- 2026-11-15: 초안. 예배 순서·설교는 이번 주 확인 필요 상태. 셋째 주 오후예배 공지 포함.
- 공지 3개: 공개 게시, 민감정보 표시 비공개, 게시 전 초안.
- 일정 2개: 첫째·셋째 주 오후 1:40, 한국 시간 기준.
- 교회 정보 6개: 모두 `[샘플]`이 붙은 가상 문구. 실명·실제 주소·전화·계좌·헌금 내역을 사용하지 않는다.

날짜는 재현을 위한 고정값이며 현재 주차로 자동 이동하지 않는다. 오후예배·헌금 규칙은 수동 샘플이고 자동화 기능이 아니다.
이미지 파일은 샘플 시드에 포함하지 않는다. 이미지 업로드 흐름은 별도 테스트에서 임시 가상 이미지를 생성해 확인한다.
시드는 고정 ID를 사용한다. 다시 적용해도 중복 생성하지 않고 기존 주보·공지·일정 수정 내용을 덮어쓰지 않는다.
교회 정보는 비어 있는 항목만 채운다. 고정 날짜와 다른 주보가 충돌하면 오류로 중단하며 임의로 지우지 않는다.

## 생성 DB 타입

```powershell
npm run types:generate
npm run types:check
npm run typecheck
```

`lib/database.types.ts`는 로컬 public 스키마에서 CLI로 생성한 파일이다. 직접 수정하지 않는다.
생성 스크립트는 성공한 결과만 파일에 쓰고 TypeScript 프린터로 일관되게 정리한다.
`types:check`는 DB와 커밋된 타입이 다르면 실패하며 파일을 바꾸지 않는다.
앱의 브라우저/서버 Supabase 클라이언트는 `Database` 타입을 사용한다. 교회 정보·이미지·주보·공지의 행 타입도 여기서 유도한다.
CHECK 제약에 있는 문자열 범위와 블록 JSON 구조는 자동 생성 타입이 표현하지 못하므로 앱 변환 경계에서 처리한다.
`tests/database-types.check.ts`는 잘못된 테이블·RPC 인자·revision·생성 열 쓰기가 컴파일 오류인지 확인한다.

## 검증

```powershell
powershell -NoProfile -File scripts/verify-seed.ps1
powershell -NoProfile -File scripts/test-db.ps1
# 별도 터미널에 npm run dev:local을 띄운 다음:
powershell -NoProfile -File scripts/test-e2e.ps1
```

샘플 검증은 초기 샘플 내용을 기대한다. 사람이 샘플을 편집했다면 실패할 수 있으며, 검증하려고 기존 작업을 임의로 reset하지 않는다.
일반 테스트는 자신의 임시 데이터만 정리한다. 공개 주보·공지·일정·교회 안내의 샘플 표시와 비공개 제외를 브라우저에서도 확인한다.

참고: [Supabase 로컬 개발 및 시드](https://supabase.com/docs/guides/local-development/cli-workflows).
