# 관리자 제작·공개 조회 수용 기준 점검

로컬 Supabase와 실제 브라우저에서 구현된 동작을 완료 기준과 대조한다. 인쇄/PDF는 구현·자동 검증 범위에 포함한다. 운영 배포·공식 아이콘·실물 인쇄·실제 휴대폰·HWP·예약 공개는 별도로 구분한다.

| WBS | 검증 기준 | 근거 |
| --- | --- | --- |
| 31 | 초대·비밀번호 설정·로그인/아웃·초대 재사용 거절 | account.spec.ts |
| 31 | 미등록 계정 편집 거절 | admin-acceptance.spec.ts |
| 31 | 세션 종료/만료·동일 계정 미저장 내용 복구 | autosave.spec.ts, community.spec.ts, church.spec.ts |
| 31 | 익명/미등록 쓰기 및 직접 게시 차단 | drafts.integration.mjs, publication.integration.mjs |
| 32 | 날짜/호수/상태 목록·새 작성·복사·재열기 | drafts.spec.ts |
| 32 | 중복 날짜 한국어 오류·입력 유지 | admin-acceptance.spec.ts, drafts.integration.mjs |
| 33 | 블록 입력·추가·삭제·이동·공개 설정 유지 | drafts.spec.ts, autosave.spec.ts |
| 33 | 저장 중 입력 보존·충돌 거절·실패 재시도 | autosave.spec.ts, drafts.integration.mjs |
| 33 | 미저장 이탈 취소·입력 유지 | admin-acceptance.spec.ts |
| 공개 흐름 | 검토 후 게시·공개 항목 조회·비공개 제외·게시 취소 | publication.spec.ts |

현재 운영자 권한은 church_editors 멤버십이다. 별도 admin/editor 등급 두 가지를 구현했다는 의미가 아니다. 익명·로그인했지만 미등록·등록 운영자로 허용/차단을 검증한다.

브라우저 전체 실행은 scripts/test-e2e.ps1, DB 검증은 scripts/test-db.ps1, 단위 검증은 npm test로 수행한다. 로컬 DB 주소를 검사하고 임시 계정/데이터를 생성·정리한다. 실제 운영 프로젝트로 테스트를 실행하지 않는다.

이전 점검(0ad9cfe)에서 개발 표시창이 320px 모바일 공지 탭 클릭을 가로막는 문제를 발견했다. Next.js 문서에 따라 devIndicators:false로 표시창을 숨겼다. 컴파일/실행 오류 표시는 유지된다. 당시 전체 브라우저 검증17건·DB13건·단위13건·타입·ESLint·빌드가 통과했다. 이후 인쇄면 저장 및 공개 PDF를 추가했으므로 당시 결과를 현재 전체 회귀 검증으로 간주하지 않는다.

후속 검증: 배포 URL의 인증 복귀·실제 기기 설치/오프라인·메신저 미리보기·프린터 양면/여백/접지. 구현이 남은 기능: HWP 원본 기반 가져오기, 주별 자동 규칙·예약 공개, 실제 교회 콘텐츠/지도/새가족 안내.

## WBS36 수용 시나리오

시나리오는 실행 전 조건 → 행동 → 기대 결과를 갖는다. 근거 파일이 있다는 사실과 이번 실행 통과를 구분한다. 모의 응답 UI 테스트는 DB/RLS 검증을 대체하지 않는다.

### 권한 기준

| 행위 | 익명 | 로그인했지만 운영자 미등록 | 등록 운영자 | service-role 테스트 도구 |
| --- | --- | --- | --- | --- |
| 공개 홈페이지/API/PDF | 게시·웹 공개 내용만 | 같은 공개 내용만 | 같은 공개 내용만 | 공개 수용 검증에 사용하지 않음 |
| DB 직접 읽기 | 허용된 공개 열·행만 | 운영자 전용 행 접근 불가 | 초안·비공개 포함 | 임시 데이터 준비/정리 |
| 초안 저장·복사·게시·취소 | 차단 | 차단 | 검토/상태/revision 조건 충족 시 허용 | 준비/정리 이외 성공 근거로 사용하지 않음 |
| 원본 이미지 읽기 | 게시된 웹 공개 참조만 | 운영자용 이미지 접근 불가 | 보관 이미지 읽기 | 임시 이미지 준비/정리 |
| 운영자 명단 변경 | 차단 | 차단 | 브라우저에서 자신/타인 추가 차단 | 관리 도구 전용 |

앱의 `admin` 경로와 테스트 변수 `admin`은 별도 앱 관리자 등급이 아니다. 앱은 church_editors 멤버십 한 종류다. service-role은 RLS를 우회하므로 두 번째 사용자 역할의 증거가 될 수 없다. 로그인한 미등록 계정의 직접 DB 읽기와 공개 API 읽기는 경로가 달라 기대 결과도 다르다. 자기 수정 가능한 user_metadata의 admin/editor 값은 권한 근거가 아니다.

| ID | 사전 조건 → 행동 | 기대 결과 | 검증 근거/구분 |
| --- | --- | --- | --- |
| A01 | 초대받은 운영자 → 비밀번호 불일치/정상 설정·로그인·초대 재사용 | 불일치 안내, 정상 접근, 사용한 초대 거절 | e2e/account.spec.ts |
| A02 | 운영자 미등록 로그인 → 관리자 화면·직접 저장·자기 명단 추가 | 편집 UI 미표시, RPC/명단 추가 차단 | e2e/admin-acceptance.spec.ts, drafts.integration.mjs |
| A03 | 미등록 계정 → user_metadata에 admin/editor 설정 후 새 토큰 발급 | 비공개 읽기·저장 권한을 얻지 못함 | access.integration.mjs, 이번 보완 |
| A04 | 로그인 유지 중 운영자 명단 해제 → 같은 토큰으로 읽기/저장/복사/게시 | 비공개 읽기 및 모든 해당 변경 차단, revision/상태 유지 | access.integration.mjs, 이번 보완 |
| A05 | 편집 중 세션 종료/인증 오류 → 재로그인 | 저장 중지·입력 유지·동일 계정 복구 | e2e/autosave.spec.ts, community.spec.ts, church.spec.ts; 실제 장시간 JWT 만료는 별도 |
| B01 | 새 주보·새 항목 → 생성·첫 수동 저장·자동 저장·재열기 | 새 항목 기본 공개, 내용·순서·공개 설정 보존 | bulletins.test.mjs, e2e/drafts.spec.ts, autosave.spec.ts |
| B02 | 공개/비공개가 섞인 이전 주 → 다음 날짜로 복사 | 새ID·초안·순서/내용/공개/인쇄면 보존, 주별 검토 초기화, 원본 독립 | drafts.integration.mjs, publication.integration.mjs, e2e/drafts.spec.ts |
| B03 | 복사된 비공개 항목 → 문구 수정 후 저장/재열기 | 비공개 유지, 공개 응답에서 제목/본문/구조화 내용 모두 제외 | copy-visibility.integration.mjs의 복사→수정→새 기본공개 항목 추가→게시 단일 흐름 |
| B04 | 동일 날짜·잘못된 행/금액/인쇄면 → 저장/복사 | 중복/유효성 오류, 내용과 revision 전체 롤백 | drafts.integration.mjs, e2e/admin-acceptance.spec.ts |
| B05 | 이전 revision·저장 중 추가 입력·통신 실패 → 저장 | 새 저장 덮어쓰기 차단, 입력 보존, 재시도 가능 | drafts.integration.mjs, e2e/autosave.spec.ts |
| P01 | 미검토 또는 공개 내용 없는 초안 → 게시 | REVIEW_REQUIRED/PUBLIC_CONTENT_REQUIRED, 직접 상태 변경도 차단 | publication.integration.mjs |
| P02 | 검토 완료 → 게시 → 공개 API/화면/PDF → 게시 취소 | 공개 항목만 노출, 인쇄면·검토 정보 제외, 취소 후 새 조회/다운로드 차단 | publication.integration.mjs, e2e/publication.spec.ts |
| P03 | PDF 생성 실패 → 다운로드 재시도 | 오류 표시·버튼 복구; 사진/한글·A4 다중 쪽 유지 | public-pdf.test.mjs, e2e/publication.spec.ts, church.spec.ts; 렌더링 검수9909e64 |
| F01 | 미참조·초안·게시 비공개·게시 공개 이미지 → 직접 Storage 다운로드 | 운영자는 허용, 익명은 게시 공개 참조만 허용 | church.integration.mjs |
| F02 | 게시 취소·원본 항목 삭제·복사본 참조 유지 → 읽기/파일 교체/삭제 | 익명 읽기 차단, 원본 덮어쓰기 차단, 참조 중 삭제 차단 | church.integration.mjs, e2e/church.spec.ts |
| C01 | 주보 비공개 공지 → 별도 공지로 가져오기·문구 수정 | 비공개 초안 생성, 명시적 게시만 공개, 원본 불변 | community.integration.mjs, e2e/community.spec.ts |
| C02 | 공지 공개 시작 전·종료 후·민감/비공개·보관 → 익명 조회 | 모두 제외; 시작 전/만료 후에도 운영자는 관리 가능 | community.integration.mjs, community-boundaries.sql의 시작 포함·종료 제외 및 전후1마이크로초 검증 |
| C03 | 한국 시간 자정 전후 일정 → 주보에 포함 후 원본 수정 | KST 날짜/시간 정확, 독립 스냅샷·공개값·검토 상태 유지 | community.integration.mjs, e2e/community.spec.ts |
| U01 | 주보105개·초안1개 → 월/페이지 탐색·날짜 링크·공유 | 중복/누락 없는 공개 목록, 초안 제외, 날짜별 주소/메타데이터 | e2e/bulletin-history.spec.ts, publication.spec.ts |
| U02 |320/390/768/1440px → 탐색·읽기·빈 목록/조회 실패 | 가로 넘침 없음·포커스 이동·빈 상태와 오류 구분/복구 | e2e/public-home.spec.ts, public-content.spec.ts, bulletin-reader.spec.ts |
| U03 | 명시적 공개 저장 → 오프라인·저장 제거 | 공개 텍스트만 TTL24h, 관리자/API/이미지/PDF 캐시 제외 | e2e/offline.spec.ts; 실제 단말은WBS39 |
| I01 | 비공개 포함 주보 → 인쇄4면·면 변경·넘침 | 비공개 포함,4·1/2·3 배치, 넘침 시 본문 인쇄 차단 | e2e/drafts.spec.ts, church.spec.ts; 실물 검수 대기 |

### 재현용 테스트 데이터

실제 성도·목사님 자료와 이메일을 테스트에 사용하지 않는다. 계정은 무작위 UUID@example.test, 비밀번호는 매 실행 무작위 생성한다. 서비스 키/토큰/비밀번호를 출력하지 않는다. 테스트 종료의 finally에서 생성 계정·주보·공지·Storage를 정리하고, 교회 정보는 실행 전 값을 복구한다.

| 데이터 묶음 | 날짜/내용 | 준비·정리 |
| --- | --- | --- |
| 로컬 수동 샘플 |2026-11-01/08 게시·15 초안, 공지 공개/민감/초안, 첫째/셋째 주 일정 | supabase/seed.sql; 가상 샘플 유지, 자동 규칙 구현 근거 아님 |
| 권한 회귀 |2088-11-07 비공개 초안, 운영자1·미등록1 | access.integration.mjs; UUID로 생성·삭제 |
| DB 초안/복사 |2098-11-02/09/16 공개·비공개·검토·헌금·인쇄면 | drafts.integration.mjs; 생성ID로 삭제 |
| DB 게시/파일/공지 |2095-11-06/13,2090-11-05/12,2092-11-02 | publication/church/community.integration.mjs |
| 브라우저 편집 |2097-11-03/10 복사,2096-11-04 자동 저장,2090-05-07 중복 날짜 | drafts/autosave/admin-acceptance.spec.ts |
| 브라우저 게시/이미지/공지 |2094-11-07,2089-11-06,2091-11-04 | publication/church/community.spec.ts |
| 목록 페이지 경계 |2091-01-01부터105개 게시 +04-20 초안 | bulletin-history.spec.ts; 매 실행 UUID·생성ID 일괄 삭제 |
| 기간/시간대 | 시작2199년·종료2000년,2092-11-01T15:30Z=KST11-02 00:30 | community.integration.mjs; 현재 시각 근접값 대신 안정적 고정값 |
| 이미지/PDF | sharp 가상 단색 이미지, 긴 한글·표·공개/비공개 표식 | 실제 사진/재정 데이터 없음; PDF QA 파일은 Git 제외 .local |

### 실행과 판정

1. 로컬 Docker/Supabase 및 localhost:3001의 `npm run dev:local`을 준비한다. 실행 절차는 local-samples.md를 따른다. 검증을 위해 DB reset을 자동 실행하지 않는다.
2. `npm test`로 단위 검증, `powershell -NoProfile -File scripts/test-db.ps1`로 DB 검증을 실행한다. DB 실행기는 로컬 주소 확인 후 순차 실행한다.
3. DB 검증이 끝난 뒤 `powershell -NoProfile -File scripts/test-e2e.ps1`로 브라우저 검증을 실행한다. DB와 브라우저의 데이터 변경 테스트를 동시에 실행하지 않는다. 고정 날짜를 사용하는 테스트의 중복 실행도 피한다.
4. 실패하면 기대 결과/실제 결과·해당 시나리오·화면/로그를 기록하고 수정 후 영향 범위를 재검증한다. 예외는 오류 또는0행 반환일 수 있으므로 변경 전후 상태도 확인한다.
5. WBS36 완료는 위 기준·데이터·근거·미검증 범위의 작성 완료다. WBS37 DB 통합,38 전체 제작 흐름,39 실제 기기,40 목사님/성도 베타의 완료를 의미하지 않는다.

WBS36 실행(4a1d802): 새 권한 회귀2개 하위 시나리오를 포함한 DB17건 통과. 주보 예약 공개는 미구현이므로 통과로 표시하지 않으며, 공지 게시 기간과 구별한다. 기존 인쇄/PDF 검증과 실제 프린터 검증도 구분한다.

## WBS37 DB 통합 검증 결과

- 익명·미등록 계정의 주보/항목 직접 INSERT·UPDATE·DELETE 차단을 검사하고, 등록 운영자로 다시 읽어 내용·공개값·revision이 변하지 않았는지 확인했다. 등록 운영자의 명단 추가도 차단된다. 기존 metadata 위조·운영자 해제 회귀와 함께 access.integration.mjs에서 검증한다.
- 공개/비공개가 섞인 게시 주보를 복사해 새ID·초안·검토 상태를 확인했다. 비공개 문구를 바꾸고 기본 공개 새 항목을 추가·저장·재열기·게시한 뒤, 익명 중첩 응답에 비공개 제목/본문이 없고 새 항목만 공개되는지 검사한다. 원본 비공개 내용은 유지된다. copy-visibility.integration.mjs의2087-11-02/09 임시 주보를 사용한다.
- 익명·미등록·등록 운영자 모두 원본 Storage 직접 업로드·교체·삭제가 차단된다. 각 시도 후 운영자 다운로드 바이트가 원본과 같은지 확인했다. 업로드/삭제는 서버의 검증된 관리 경로에서 수행하며, 기존 게시/취소/비공개 전환별 다운로드 및 참조 삭제 보호 검증도 유지한다.
- 공지 기간11개 상태를 단일 SQL 트랜잭션의 고정 now()로 검증했다. 시작=현재는 포함, 시작이1마이크로초 뒤면 제외, 종료=현재/직전은 제외, 종료가1마이크로초 뒤면 포함한다. 무기한·기간 내부·초안·보관·비공개·민감 비공개도 확인한다. 실제 anon 역할/RLS로 조회하며 전부ROLLBACK하므로 데이터나 스키마를 남기지 않는다.
- DB 실행기는 Node19건 성공 후 정확한 경계SQL11개를 실행한다. CLI db query는 다중 문장을 준비문으로 실행할 수 없어, 경계 검증만 이 프로젝트의 고정 로컬 컨테이너에서psql로 실행한다. 외부 DB 접속을 받지 않는다. 실패 시 종료 코드를 반환하고 트랜잭션은 연결 종료와 함께 롤백된다.
- 이번 검증은 DB19건+기간11조건·단위15건·lint 통과. 앱 기능·운영 스키마 변경은 없으며 브라우저 전체 검증은WBS38에서 이어간다. 앱에 별도 admin/editor 등급을 추가한 것은 아니다.
