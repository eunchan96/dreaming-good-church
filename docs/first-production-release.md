# 첫 Production 검증 배포안 · 2026-11-13

## 소스와 PR 검토 결과

기본 브랜치는 main이다. 원격 main/develop은 초기 커밋63d3c5e이며, 배포 후보 ff5cb986a57ce7184118f17825de695528ca0dbe에는 그 이후53개 커밋·153개 변경 파일이 포함된다. 작업 브랜치8개의 HEAD가 모두 이 후보의 조상임을 git merge-base로 확인했다. 사용자가 수정한 미커밋 issue-auto-label-and-project.yml은 후보에 포함하지 않았다.

현재 열린 PR은 다음7개이며 모두 Draft다. 아래 표는 의존 순서이며 병합 완료 목록이 아니다.

| 순서 | PR | 변경 | 대상 브랜치 |
| --- | --- | --- | --- |
| 1 | #2 | CI | codex/bulletin-domain-rules |
| 2 | #3 | 격리 복구 절차 | codex/pr-ci |
| 3 | #4 | 암호화 백업 | codex/operations-readiness |
| 4 | #5 | 실제 SQL 복구 검증 | codex/encrypted-backups |
| 5 | #6 | 배포 초대·재설정 | codex/production-restore-check |
| 6 | #7 | Production 설정 | codex/deployed-account-flow |
| 7 | #8 | 운영 계정 Origin | codex/production-readiness |

현재 조회에서 최초 기능 브랜치→develop의 통합 PR은 확인되지 않았다. 최신 소스와 이 배포 문서를 develop 대상으로 한 통합 Draft PR에 담아 전체 변경을 검토한다. 기존 작업 PR은 보존한다. 개별 PR을 임의 순서로 병합하거나, 이 통합 PR 생성만으로 main/develop을 바꾸지 않는다. 실제 병합 시에는 개별 작업 커밋을 보존하는 merge commit 방식을 검토하고, 병합 결과의 CI 및 Vercel 자동 배포 연결부터 재확인한다.

후보 ff5cb98의 CI43360499857은 lint·타입·단위26개·빌드 모두 성공했다. 공개 API의 anon/RLS 사용, 이미지 쓰기의 getUser+운영자 확인 선행, PDF의 공개 조회/재검증, 서버 키 사용 위치를 검토했다. 이는 전체 코드에 대한 외부 보안감사나 운영 실물 검수를 대신하지 않는다.

## 승인 요청 범위

- 팀 eunchan96s-projects, 프로젝트 dreaming-good-church / prj_1EePlmXl4ZLPoUoYKFhK0OTls86X.
- GitHub 저장소 ID1454034196의 **ff5cb986a57ce7184118f17825de695528ca0dbe**를 직접 지정해 Production 빌드한다. 문서만 추가한 통합 PR의 최신 브랜치 끝으로 자동 대체하지 않는다.
- Node24, 함수 서울icn1, 기존 Production 변수3개와 원래 Supabase zefnxczgwpsmfcixonpb를 사용한다.
- API target=production은 기본 도메인 https://dreaming-good-church.vercel.app 의 실제 전환을 수반하는 것으로 취급한다. 현재 API 도구에 skip-domain이 없으므로 비공개 사전 빌드라고 부르지 않는다.
- 기존 보호 설정은 유지한다. 기본 도메인은 로그인 없는 요청도503으로 앱에 도달하므로 배포 후에도 공개 화면이 방문자에게 보일 수 있다. Preview 고정 주소는 유지한다.
- DB 마이그레이션6개는 원격과 로컬 이름/버전이 일치했다. 새 DB·마이그레이션·자료 게시·키 변경·메일·초대/재설정 토큰 생성은 이 배포에 포함하지 않는다.
- PR 병합과 Supabase Site URL 전환도 이번 승인 범위에서 제외한다. 운영 account redirect는 이미 등록되어 있다.

## 실행과 합격 기준

1. 배포 직전 후보 SHA·CI·프로젝트·Production 변수 대상/타입·Auth redirect·원격 데이터 개수를 다시 확인한다. 대상이 다르거나 새로운 코드/스키마 변경이 있으면 중단하고 안을 갱신한다.
2. 지정 SHA로 Production을 생성하고 READY/ERROR, 소스 SHA, Node/지역, 최종 도메인 할당을 확인한다. 빌드 실패는 성공으로 처리하지 않는다.
3. 기본 도메인과 고유 배포 주소에서 홈·주보·공지·일정·교회안내·관리자/계정 화면을 확인한다. 보호 우회 요청과 일반 방문자 요청은 구분해 기록한다.
4. 주보/교회/공지/일정 API200, 실제 게시 자료가 없으면 빈 목록/안내, 없는 주보·PDF·이미지404, 잘못된 입력400/404, 미인증 이미지 쓰기401을 확인한다. 오류503과 정상 빈 목록을 구분한다. 운영 DB에 시험 자료를 쓰지 않는다.
5. 실제 관리자의 운영 주소 로그인→새로고침→로그아웃은 사용자에게 요청한다. 비밀번호를 전달받지 않는다. 실제 게시 주보가 없어 확인할 수 없는 사진·PDF 본문은 미검증으로 남기며 과거 임시 DB/Android 검수를 운영 검수로 대체하지 않는다.
6. 정상 결과의 배포 ID·SHA·환경·DB 이력·도메인·시각과 검수 결과를 기록한다. 이때 첫 정상 Production 기준점을 만든다. 실제 콘텐츠·인쇄·운영 정책 등이 남으면 WBS43 출시 완료는 보류한다.

## 장애 대응 범위

현재 Production dpl_GifqnfsSQBcbrkrMbncvHdfuZ8sy / f5a4a2a는 공개 API503인 초기 시험 버전이다. 정상 복구 기준점으로 승인하지 않는다. 정상 Preview Cwg도 Production Instant Rollback 대상이 아니다.

새 빌드가 실패하고 기존 도메인에 영향이 없으면 기존 상태를 유지하고 원인을 기록한다. 도메인 전환 후 핵심 API503·권한 이상·비공개 노출 등으로 검수가 실패하면, 이번 승인에 포함된 경우에만 위 기존 Production으로 트래픽을 돌려 새 화면 제공을 중단한다. 이는 정상 서비스 복구가 아니라 **기존503 상태로의 전환 철회**다. DB/Storage/키/Auth 설정을 되돌리거나 운영 자료를 삭제하지 않는다.

철회 뒤 도메인 대상과 응답·Preview 유지를 확인하고 원인 수정 후 재배포를 검토한다. 롤백이 자동 도메인 할당을 중단시킨 경우 정상 배포 Promote 단계도 다시 확인한다. 이 철회 절차가 승인되지 않으면 배포 전에 대응 범위를 먼저 확정한다.

## 승인·결과 기록

사용자가 지정 커밋 Production 배포 및 검수 실패 시 기존503 배포로의 전환 철회를 승인했다. 2026-11-13 12:52 KST 기준 첫 정상 Production 배포와 검수를 완료했다. 실제 병합·보호·DB/자료/Auth Site URL 변경은 수행하지 않았다. 검수가 통과하여 철회는 실행하지 않았다.

| 기준점 | 확인 결과 |
| --- | --- |
| 배포 | dpl_EMpcY533KjrfQ8M7LE43niidLKqb, READY, Production |
| 고정 소스 | ff5cb986a57ce7184118f17825de695528ca0dbe |
| 운영 주소 | https://dreaming-good-church.vercel.app |
| 고유 주소 | https://dreaming-good-church-f1uepymbi-eunchan96s-projects.vercel.app |
| 실행 환경 | 프로젝트 Node24, 함수 서울icn1, 기존 Production 변수3개 |
| DB | 원래 zefnxczgwpsmfcixonpb, 마이그레이션6개 유지 |
| Preview | 고정 별칭의 실제 대상이 기존 Cwg임을 get_alias로 확인 |
| 보호 | all_except_custom_domains 설정 유지. 기본 운영 주소는 비로그인 API200, 고유 배포는 비로그인302 Vercel 인증/연결 도구로200 |

배포 후 로그인/우회 없는 요청에서 API11개 검증을 통과했다. 주보·교회 안내·공지·일정200, 빈 주보/공지/일정 목록, 없는 주보/PDF/이미지404, 잘못된 날짜/월400, 비인증 이미지 POST/DELETE401 및 no-store를 확인했다. 기본 주소의 주보 API503은200 정상 빈 목록으로 바뀌었다.

별도 Edge 브라우저에서 PC1440px·모바일390px 각각 홈·주보·공지·일정·교회 안내·주보 관리·계정7개 화면이200이며 가로 넘침과 처리되지 않은 JavaScript 오류가 없음을 확인했다. 사용자가 실제 운영 주소에서 기존 계정의 로그인→목록→새로고침→로그아웃을 정상 확인했다. 비밀번호는 전달받지 않았다.

운영 DB 쓰기 없이 배포 전후 주보0·이미지0·Storage0·운영자1을 재확인했다. 실제 게시 주보가 없어 운영 사진/PDF 본문과 게시/취소 흐름, 실물 인쇄는 미검증이다. 과거 임시 자료 검수를 현재 운영 콘텐츠 검수로 대체하지 않는다.

이 배포를 첫 정상 Production 기준점으로 채택한다. 이후 변경 배포의 복구 기준으로 보존하지만, 실제 Production 롤백 훈련까지 수행했다는 뜻은 아니다. 초기503 배포와는 구분한다. WBS42/43은 남은 운영 정책·롤백/실제 콘텐츠 조건 때문에 진행 중을 유지한다.

통합 PR9의 e325d38 CI43361247053도 lint·타입·단위 테스트·빌드 및 별도 PR 자동화가 통과했다. 배포는 문서 후속 커밋이 아닌 위 ff5cb98 소스를 그대로 사용했다.

관련: [설정 준비](production-readiness.md), [운영 복구](operations-recovery.md), [Vercel 배포 API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment), [Instant Rollback](https://vercel.com/docs/instant-rollback).
