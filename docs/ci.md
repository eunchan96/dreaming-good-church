# PR 자동 검사

`.github/workflows/ci.yml`의CI는 모든 대상 브랜치의PR 생성/갱신/재개, main/develop push, 수동 실행에서 동작한다. PR별 이전 실행은 새 커밋이 올라오면 취소한다.

Ubuntu24.04·Node24에서 잠금 파일 기반 npm ci 후 lint→경로 타입 생성/타입 검사→단위 테스트→프로덕션 빌드를 수행한다. 공식checkout/setup-node를확인한커밋SHA로고정하고저장소토큰은contents:read만부여한다. 체크아웃인증정보는후속명령에남기지않는다.

운영Supabase/Vercel키나프로젝트접근토큰을이작업에주입하지않는다. 빌드용공개환경값은localhost/가상문자열이며원격마이그레이션·가상자료등록·배포·클라우드프로젝트생성은실행하지않는다. npm캐시는사용하지만.env·브라우저인증정보·빌드결과를공유아티팩트로올리지않는다.

`npm run typecheck`는Next.js문서의next typegen→tsc 순서로변경했다. 개발서버/빌드실행전의새체크아웃에서도LayoutProps등생성타입을사용할수있다.

DB/RLS와브라우저전체테스트는Docker의로컬Supabase에서기존scripts/test-db.ps1·scripts/test-e2e.ps1로실행한다. 이번CI기본작업은단위테스트만포함하며DB/E2E까지자동실행한다는뜻은아니다. Vercel배포및실기기검수와도구분한다.

CI변경PR은기존구현브랜치codex/bulletin-domain-rules를대상으로codex/pr-ci에서작성해자동검사변경만보이도록한다. 기존기능전체를main에병합하는작업과분리하며기존PR/이슈라벨자동화파일은수정하지않는다. CI검사가실제통과한뒤PR/실행링크를WBS에기록한다.
