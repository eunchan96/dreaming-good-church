# Production 설정과 첫 정상 배포 기준점

## 확인한 현황 · 2026-11-13

- Vercel 프로젝트: `dreaming-good-church`, `prj_1EePlmXl4ZLPoUoYKFhK0OTls86X`, 팀 `eunchan96s-projects`.
- 기본 주소 `https://dreaming-good-church.vercel.app`는 이 프로젝트에 연결·검증되어 있다. 새 도메인 구입은 필요하지 않다.
- 환경변수3개는 모두 Preview 전용이다. Production 변수는 없다. 기본 운영 주소의 공개 주보 API는 현재503으로 서비스를 준비 중이라고 응답한다.
- 현재 정상 Preview는 `dpl_CwgQXrLLHLVCmWuPqzFRgXkDNBeS`, 코드 `9e3f80b`, Node24/서울icn1이다. 고정 검수 별칭은 계속 이 배포를 가리킨다.
- Production 기록에는 초기 시험 `dpl_GifqnfsSQBcbrkrMbncvHdfuZ8sy` / `f5a4a2a` 1개만 있다. API에 rollback candidate로 나오더라도 현재 기능/설정·정상 검수 기준이 충족된 것은 아니므로 복구 기준점으로 채택하지 않는다.
- 최초 Preview 요청이 Production으로 처리된 과거 이력이 있다. 새 Preview는 API target=staging을 사용한다. Production 생성은 명시적인 출시 단계에서 구분한다.

## 적용안 — 사용자 승인 및 변수 등록 완료

기준 주소는 기본 `https://dreaming-good-church.vercel.app`를 제안한다. 보유 도메인을 사용할 경우 도메인 연결·Auth 허용 주소·Origin 허용 목록을 실제 이름으로 다시 검토한다. 도메인을 임의로 구입하거나 DNS를 변경하지 않는다.

| Production 변수 | 넣을 값의 출처 | 형식·노출 |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | 기존 프로젝트 `https://zefnxczgwpsmfcixonpb.supabase.co` | plain, 공개 URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | 현재 같은 프로젝트에서 쓰는 공개 키 | plain, 브라우저용 |
| SUPABASE_SERVICE_ROLE_KEY | 현재 같은 프로젝트에서 쓰는 서버 키 | Sensitive, Production 서버 전용 |

값은 기존 로컬 비밀 설정에서 필요한3개만 읽어 Vercel에 전달하며 소스·문서·콘솔에 출력하지 않는다. 기존 Preview 변수는 변경하지 않는다. 서버 키의 이전 사용자 승인은 Preview 범위였으므로 Production 대상 등록은 별도로 명시 확인한다. 키를 새로 만들거나 회전하지 않고 기존 운영 DB를 사용한다. 추가 Supabase 프로젝트는 만들지 않는다.

이번 제안은 **Production 변수 준비**다. 등록만으로 기존 빌드가 갱신되거나 위503이 해결되지는 않는다. 새 Production 빌드/정식 출시·도메인 공개·보호 해제·PR 병합은 별도 실행 단계다. 현재 검수 주소와 Auth Site URL은 유지한다.

## 첫 정상 Production 배포를 만드는 순서

1. 주소·환경변수 대상과 실제 콘텐츠/운영 정책을 확정한다. Vercel 로그인 보호 범위와 공개 시점을 확인한다.
2. 기존 PR을 순서대로 정리하고 최종 소스 커밋·CI 성공을 확인한다. PR 생성/CI 성공을 main/develop 병합 완료로 간주하지 않는다.
3. 선택한 운영 Origin을 앱 허용 목록과 Supabase Auth의 `/admin/account` 허용 주소에 추가한다. Preview 복귀 주소를 유지한다. 원격 Auth 변경은 현재 연결 계정의403 때문에 사용자 대시보드 반영이 필요할 수 있다.
4. Production 변수로 새 빌드를 만든다. 현재 도구가 도메인을 붙이지 않는 Production staging을 지원하는지 실행 직전에 확인한다. 지원이 확인되지 않으면 ‘무공개 검수 빌드’라고 가정하지 않고 실제 도메인 전환 범위부터 확인한다.
5. 공개 API·홈·주보·PDF/사진·관리자/권한·설정 링크와 보호 범위를 검수한다. 실제 자료가 없는 빈 상태와 오류503을 구분한다. 가상 자료를 운영 DB에 채워 정상처럼 보이게 하지 않는다.
6. 확인한 Production 배포 ID·커밋·환경 대상·DB/마이그레이션·응답·확인 시각을 첫 정상 기준점으로 기록한다. 첫 배포에 정상 이전 버전이 있다고 가정하지 않는다.

현재 기준점이 될 Production 배포 ID는 아직 없다. WBS43의 실제 콘텐츠·성도/관리자 검수와 주일 오전 배포 제외 조건을 충족한 뒤 출시를 판정한다.

## 되돌리기 기준

Preview의 정상 비교 기준은 위 Cwg 배포이며 Production Instant Rollback 대상과 다르다. 삭제한 임시 DB에 연결했던 배포는 어느 환경에서도 복구 기준점으로 사용하지 않는다.

운영에서는 정상 검수된 **이전 Production** 배포를 기준점으로 삼는다. 첫 정상 배포가 없는 지금은 예전 시험 버전으로 무조건 되돌리지 않는다. 초기 장애는 전환 보류·현재 상태 보존·문제 수정과 재검수 절차로 처리한다.

Hobby의 Instant Rollback은 바로 이전 Production에 한정된다. 이전 빌드의 DB/키 호환성을 확인하고 실행한다. DB 자료·스키마·사진·프로젝트 환경변수를 함께 되돌리는 기능이 아니다. 롤백 후 자동 도메인 할당이 중단되므로 정상 배포를 다시 Promote한 뒤 자동 할당 복구도 확인한다.

## 적용/검증 기록

2026-11-13 사용자가 기본 운영 주소 사용과 Production 변수3개 등록을 명시 승인했다. 기존 로컬 설정의 해당3개를 등록했으며, 복호화하지 않은 메타데이터에서 Production URL/public key는 plain, 서버 키는 sensitive임을 확인했다. 기존 Preview 변수3개도 유지되어 있다. 키 값은 문서에 기록하지 않았다. 출시/병합/보호 설정 변경은 아직 실행하지 않았다. 변수만 등록했으므로 기존503 응답이 해결되었다고 판정하지 않는다.

운영 주소는 `https://dreaming-good-church.vercel.app`로 확정했다. 앱의 운영 Origin 허용 목록과 Supabase Auth redirect 반영은 다음 출시 준비 단계에서 수행한다. 현재 Auth Site URL은 검수 주소를 유지한다.

이 준비만으로 WBS42 전체나 WBS43 출시를 완료 처리하지 않는다. 백업 주기·보존/암호 별도 보관, 비상 연락체계, 실제 Production 검수/롤백 등 남은 조건은 각 작업에 유지한다.

참고: [Vercel 롤백](https://vercel.com/docs/instant-rollback), [배포 승격](https://vercel.com/docs/deployments/promoting-a-deployment), [배포 보호 범위](https://vercel.com/docs/deployment-protection).
