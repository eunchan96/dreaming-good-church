# Vercel 검수 배포

## 관리자 계정 흐름 반영 · 2026-11-13 최신

소스 `9e3f80b`, 새 Preview `dpl_CwgQXrLLHLVCmWuPqzFRgXkDNBeS` READY, Node24/서울icn1/API target=staging. 로컬 계정 브라우저5건 통과 후 기존 고정 검수 별칭을 새 배포로 연결했다. 고정 주소의 관리자 계정/주보 경로와 공개 주보 API200, 새 ‘계정 링크 확인’ UI를 확인했다.

사용자가 기존 배포 계정 로그인·새로고침·로그아웃을 확인했다. 원격 Auth Site/Redirect URL은 사용자 대시보드 저장 후 재조회했고 가입 제한은 유지된다. 자세한 범위와 계정 링크 생성은 `deployed-accounts.md`에 있다. 기본 Vercel 보호·Preview 전용 변수는 유지하며 Production 출시/병합과 실제 계정 비밀번호 변경은 수행하지 않았다. 아래는 이전 배포의 이력이다.

## 최신 운영 준비 확인 · 2026-11-13

아래 초기 검수 기록 이후 PR CI 실제 실행과 Android 사진/PDF/오프라인 검수가 통과했다. 일회성 검수 DB는 삭제했고 현재 Preview는 기존 DB로 연결을 복구했다. `temporary-preview.md`, `ci.md`에 결과가 있다.

현재 배포/서울 리전/변수 메타데이터를 다시 확인했다. 환경변수 3개는 모두 Preview 대상이며 Production 변수는 아직 없다. 이전 임시 DB에 연결했던 배포를 롤백 대상으로 사용하지 않는다. 로컬 격리 DB 복구 연습과 운영/배포 복구 절차는 `operations-recovery.md`에 정리했다. 실제 운영 암호화 백업과 Production 롤백 실행 검증은 미완료다.

## 현재 검수 대상

- 팀: eunchan96s-projects
- 프로젝트: dreaming-good-church (`prj_1EePlmXl4ZLPoUoYKFhK0OTls86X`)
- 소스: GitHub codex/bulletin-domain-rules의884fd07
- 고정 검수URL: https://dreaming-good-church-git-codex-bulle-a36b08-eunchan96s-projects.vercel.app
- 개별 배포URL: https://dreaming-good-church-7nqjm57jr-eunchan96s-projects.vercel.app
- 배포ID: dpl_E8mUpBSssepCoWQrw3y8Vihh2vLC, READY, API target=staging
- Next.js16.4.6, Node24, 함수icn1. 기본 Vercel 로그인 보호 유지.

사용자가 안드로이드 실기기 검수와 Vercel 배포를 요청해 생성했다. 작업 브랜치를 push했으며 main merge나 정식 출시 판정은 하지 않았다. 초기 target=preview 요청은 production으로 생성되어, 공식API의staging 대상으로 다시 배포하고 위 고유URL을 검수 대상으로 확정했다. 최초production 배포는 검수 대상이 아니며 정식 운영 URL로 안내하지 않는다.

## 환경 변수와 데이터

Preview에 NEXT_PUBLIC_SUPABASE_URL·NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY와 서버 전용 SUPABASE_SERVICE_ROLE_KEY를 설정했다. 기존 지정 Supabase 프로젝트에 연결하며 별도 Preview DB 분리는 아직 하지 않았다. 실제 자료가 빈 경우 빈 상태로 표시하며 가상 테스트 계정/주보/재정 자료를 운영 DB에 추가하지 않았다.

SUPABASE_SERVICE_ROLE_KEY는 처음에는 자동 승인 검토에서 명시적 승인 부족으로 거부되었으나, 사용자의2026-11-13 명시적 승인을 받은 뒤 Sensitive 형식·Preview 대상으로만 저장하고 재배포했다. 값의 복호화 조회 없이 환경 변수 메타데이터로 형식과 대상을 확인했다. 이미지 업로드/삭제에 필요한 서버 전용 변수이며 공개 조회·PDF 조회는 익명 키로 동작한다. 서버 키 값을 소스·문서·로그에 출력하지 않는다. 실제 운영자 로그인으로 원격 업로드/삭제를 실행한 결과와는 구분한다.

Vercel 로그인 보호 해제도 자동 승인 검토에서 거부되어 기본 보호를 유지했다. 휴대폰에서 열 때 Vercel 계정 인증이 필요할 수 있다. Vercel 인증과 교회 관리자 로그인은 별개다. CLI 저장 로그인은 만료되어 연결된 Vercel 도구로 배포했다. 인증 토큰을 복사하거나 출력하지 않았다.

## 확인한 응답

- 공개 주보API200·no-store·현재 게시 주보0개.
- 교회 안내API200·no-store·현재6개 항목 본문이 비어 있음.
- 관리자 주보 화면 경로200. 실제 관리자 계정으로 로그인/저장/이미지 업로드를 원격 수행한 것은 아님.
- 미게시 날짜의PDF404·no-store. 게시된 실제 주보가 없어 원격PDF 생성은 미검증; 로컬 브라우저 생성/다운로드는 통과.
- 매니페스트200·standalone·192/512/maskable 아이콘 정의, 서비스워커 응답 확인.

서버 키 설정 후 새 배포에서 공개API2개·관리자 화면 경로·매니페스트200 응답을 재확인했다. 관리자 화면이 참조한 브라우저 스크립트9개의 응답에 서버 키 값이 포함되지 않았는지도 값 출력 없이 검사했다. 실제 원격 운영자 업로드 동작은 아직 미검증이다.

2026-11-13 안드로이드 저장 실패 보고 후 e216675에서 서비스워커가 같은 사이트의 Vercel 접근 쿠키를 유지하도록 수정했다. 보호된 출처의 실제 워커 저장/오프라인 회귀를 포함해 관련 브라우저6건·타입/lint/build 통과. 재배포 후 고정URL의sw.js200/no-cache와수정코드, 공개API2개200/no-store 확인. 최초 개별URL로 설치한 앱에는 새 배포가 반영되지 않으므로 고정URL에서 재확인 후 다시 설치한다. Vercel 로그인 보호는 그대로다.

로컬에서 전체 브라우저23건·타입·ESLint·빌드를 통과했다. 보호된 배포의 응답은 권한 있는 Vercel 연결 도구로 확인했다. 실제 안드로이드 설치·오프라인·성능은 `mobile-verification.md`의 체크리스트로 검수한다. PR CI·Preview DB 분리·Auth 초대 복귀 주소·공식 아이콘·실제 콘텐츠·실기기·정식 출시 확인은 아직 완료가 아니다.
