# 관리자 제작·공개 조회 수용 기준 점검

로컬 Supabase와 실제 브라우저에서 구현된 동작을 완료 기준과 대조한다. 운영 배포 검증·공식 아이콘·인쇄/PDF·HWP·예약 공개는 별도 범위다.

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

이번 점검에서 개발 표시창이 320px 모바일 공지 탭 클릭을 가로막는 문제를 발견했다. Next.js 문서에 따라 devIndicators:false로 표시창을 숨겼다. 컴파일/실행 오류 표시는 유지된다. 수정 후 전체 브라우저 검증 17건을 한 번의 실행에서 통과했다. DB 통합 검증13건, 단위 검증13건, 타입 검사·ESLint·프로덕션 빌드도 통과했다.

후속 검증: 배포 URL의 인증 복귀·실제 기기 설치/오프라인·메신저 미리보기. 구현이 남은 기능: 인쇄/PDF, HWP 원본 기반 가져오기, 주별 자동 규칙·예약 공개, 실제 교회 콘텐츠/지도/새가족 안내.
