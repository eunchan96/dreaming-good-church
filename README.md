# 꿈꾸는좋은교회 홈페이지

작은 교회를 위한 홈페이지입니다. 목사님이 관리자 화면에서 주보를 입력하면 모바일 주보, 인쇄용 주보(PDF·Word)가 함께 만들어지고, 성도는 가입 없이 스마트폰으로 주보·예배 영상·교회 소식을 봅니다.

- 운영 주소: <https://towbchurch.com> (관리자: [/admin](https://towbchurch.com/admin))
- 기술: Next.js 16 · React 19 · TypeScript · CSS Modules · Supabase(Postgres·Auth·RLS) · Vercel

> Next.js 16은 이전 버전과 API가 다릅니다. 코드를 고치기 전에 `node_modules/next/dist/docs/`를 먼저 봅니다([AGENTS.md](AGENTS.md)).

## 주요 기능

| 구분 | 내용 |
| --- | --- |
| 공개 화면 | 홈, 교회 소개(인사말·오시는 길·예배시간·온라인 헌금), 예배 영상 6종, 주보·특별 순서지·교회 소식·교회 일정·토라&토브, 앱 추가 안내 |
| 관리자 | 주보 관리(지난주 복사·자동 저장·인쇄 미리보기·게시/취소·예약 공개·초안 삭제·테마 5종·PDF/Word 내려받기), 특별 순서지 게시·예약, 홈페이지 관리, 예배 영상 관리·곡 목록(Notion), 공지·일정 관리, 편집자 초대, 사용 안내(`/admin/guide`) |
| 검색·공유 | sitemap·robots·화면별 설명, 공유 미리보기 이미지, 교회 구조화 데이터 (`lib/site.ts`) |

## 폴더 구성

```
app/            공개 화면 (app/admin = 관리자, app/api = Route Handler)
lib/            주보·교회 정보·사이트 설정 등 공통 로직, DB 타입(database.types.ts)
supabase/       마이그레이션, 시드, Edge Function(invite-church-editor)
scripts/        로컬 실행·테스트·백업·DB 타입 생성
tests/          단위 테스트(*.test.mjs)와 Playwright e2e(tests/e2e)
docs/           기능별 구현·운영 기록
assets/fonts/   PDF·Word에 넣는 글꼴
```

## 로컬에서 실행하기

준비: Node.js 24, Docker(로컬 Supabase), Windows PowerShell

```powershell
npm ci
npx supabase start          # 로컬 Supabase (마이그레이션·시드 적용)
npm run dev:local           # http://localhost:3001 — 로컬 DB에 연결
```

- `npm run dev:local`은 로컬 Supabase에 연결합니다. 개인정보 없는 샘플은 [로컬 샘플 안내](docs/local-samples.md)를 봅니다.
- `npm run dev`는 `.env.local`의 **운영 Supabase**에 연결하므로 평소 개발에는 쓰지 않습니다.
- `.env.local`은 저장소에 올리지 않습니다. 필요한 값은 `.env.default`를 참고합니다.

## 검사

| 명령 | 내용 |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | 경로 타입 생성 후 TypeScript 검사 |
| `npm test` | 단위 테스트 |
| `scripts/test-e2e.ps1` | Playwright e2e (로컬 Supabase + 개발 서버 3001 필요) |
| `scripts/test-db.ps1` | DB·RLS 테스트 |
| `npm run types:check` | DB 타입이 마이그레이션과 같은지 확인 |

PR과 main·develop 푸시에서는 GitHub Actions가 lint·타입 검사·단위 테스트·빌드를 돌립니다([CI 안내](docs/ci.md)).

## 브랜치와 배포

1. `main`에서 작업 브랜치(`feat/내용`, `fix/내용`, `docs/내용`)를 만들어 작업하고 푸시하면 Vercel 브랜치 미리보기 주소가 생깁니다(검색 엔진 수집 막음).
2. 전체 e2e·`npm test`·운영 빌드를 통과하면 작업 브랜치를 `develop`에 squash합니다.
3. `develop`을 `main`에 merge commit으로 합치면 Vercel이 운영(towbchurch.com)에 배포합니다.

- 주일(일요일) 오전에는 `main`에 배포하지 않습니다.
- 브랜치 미리보기도 **운영 DB**에 연결되어 있습니다. 미리보기에서는 게시하기·삭제·예약 공개를 누르지 않습니다.
- 운영 Supabase 변경(마이그레이션·Edge Function 배포)은 따로 확인을 받고 합니다.
- 커밋 메시지는 `타입: 내용`(feat, fix, design, db, test, docs, refactor, chore)을 따릅니다.

## 운영 문서

- **[운영·인수인계 안내](docs/handoff.md)** — 기술 담당자가 먼저 볼 문서(서비스·계정, 정기 점검, 정해진 일정, 장애 때 할 일, 문서 지도)
- **[관리 화면 사용 안내](docs/user-guide.md)** — 목사님·편집자용(주보 작성·인쇄·게시·예약·삭제, 특별 순서지, 공지·영상·곡 목록·홈페이지 관리). 관리 화면 `/admin/guide`에 그대로 보이며, 캡처는 `public/admin/guide`
- [배포 계정·편집자 초대·비밀번호 재설정](docs/deployed-accounts.md)
- [암호화 백업](docs/encrypted-backups.md) · [운영 준비와 복구](docs/operations-recovery.md) · [운영 정책과 되돌리기](docs/operating-policy-and-rollback.md)
- [주보 작성](docs/bulletin-drafts.md) · [주보 게시·예약·삭제](docs/bulletin-publication.md) · [주보 인쇄](docs/bulletin-printing.md) · [특별 순서지](docs/special-programs.md)
- [홈페이지 콘텐츠 관리](docs/homepage-content-management.md) · [예배 영상 관리](docs/worship-video-management.md) · [공지·일정](docs/community.md)
