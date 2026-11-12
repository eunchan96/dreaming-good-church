# Vercel 검수 배포

## 현재 검수 대상

- 팀: eunchan96s-projects
- 프로젝트: dreaming-good-church (`prj_1EePlmXl4ZLPoUoYKFhK0OTls86X`)
- 소스: GitHub codex/bulletin-domain-rules의f5a4a2a
- 검수URL: https://dreaming-good-church-d8zau47v4-eunchan96s-projects.vercel.app
- 배포ID: dpl_5tFTVKu3udWWCoCdQEpa3q8ZwYK1, READY, API target=staging
- Next.js16.4.6, Node24, 함수icn1. 기본 Vercel 로그인 보호 유지.

사용자가 안드로이드 실기기 검수와 Vercel 배포를 요청해 생성했다. 작업 브랜치를 push했으며 main merge나 정식 출시 판정은 하지 않았다. 초기 target=preview 요청은 production으로 생성되어, 공식API의staging 대상으로 다시 배포하고 위 고유URL을 검수 대상으로 확정했다. 최초production 배포는 검수 대상이 아니며 정식 운영 URL로 안내하지 않는다.

## 환경 변수와 데이터

Preview에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY만 설정했다. 기존 지정 Supabase 프로젝트에 연결하며 별도 Preview DB 분리는 아직 하지 않았다. 실제 자료가 빈 경우 빈 상태로 표시하며 가상 테스트 계정/주보/재정 자료를 운영 DB에 추가하지 않았다.

SUPABASE_SERVICE_ROLE_KEY 전송/저장은 자동 승인 검토에서 명시적 승인이 없다는 이유로 거부되어 수행하지 않았다. 이미지 업로드/삭제에 필요한 서버 전용 변수이므로 승인 후Sensitive Preview 환경 변수로 저장하고 재배포해야 한다. 공개 조회·PDF 조회는 익명 키로 동작하며 서버 키가 필요하지 않다. 서버 키는 브라우저 번들·소스·로그에 포함하지 않는다.

Vercel 로그인 보호 해제도 자동 승인 검토에서 거부되어 기본 보호를 유지했다. 휴대폰에서 열 때 Vercel 계정 인증이 필요할 수 있다. Vercel 인증과 교회 관리자 로그인은 별개다. CLI 저장 로그인은 만료되어 연결된 Vercel 도구로 배포했다. 인증 토큰을 복사하거나 출력하지 않았다.

## 확인한 응답

- 공개 주보API200·no-store·현재 게시 주보0개.
- 교회 안내API200·no-store·현재6개 항목 본문이 비어 있음.
- 관리자 주보 화면 경로200. 실제 관리자 계정으로 로그인/저장/이미지 업로드를 원격 수행한 것은 아님.
- 미게시 날짜의PDF404·no-store. 게시된 실제 주보가 없어 원격PDF 생성은 미검증; 로컬 브라우저 생성/다운로드는 통과.
- 매니페스트200·standalone·192/512/maskable 아이콘 정의, 서비스워커 응답 확인.

로컬에서 전체 브라우저23건·타입·ESLint·빌드를 통과했다. 보호된 배포의 응답은 권한 있는 Vercel 연결 도구로 확인했다. 실제 안드로이드 설치·오프라인·성능은 `mobile-verification.md`의 체크리스트로 검수한다. PR CI·Preview DB 분리·Auth 초대 복귀 주소·공식 아이콘·실제 콘텐츠·실기기·정식 출시 확인은 아직 완료가 아니다.
