# Production 롤백 훈련 결과 · 2026-11-13

## 결과

사용자가 승인한 동일 소스 훈련을 **A → 새 Production B → A로 롤백 → B를 Promote** 순서로 완료했다. 현재 운영 도메인은 B이며 이전 정상 기준점 A를 보존한다. 초기503 배포로 이동하지 않았다. 소스는 모두 ff5cb986a57ce7184118f17825de695528ca0dbe다.

| 단계 | 실제 대상 | 확인 시각 KST | 확인 |
| --- | --- | --- | --- |
| 최초 정상 A | dpl_EMpcY533KjrfQ8M7LE43niidLKqb | 시작 전 재조회 | READY·Production·고정 소스 |
| 새 정상 B | dpl_ASfp6HvCMXUz79hSuyEb6ssPwbAv | 13:11:18 | READY·Production·icn1·운영 별칭 B |
| A 롤백 | dpl_EMpcY533KjrfQ8M7LE43niidLKqb | 요청13:11:54 / 대상 확인13:12:09 | 운영 별칭 A 및 응답 정상 |
| B Promote 복귀 | dpl_ASfp6HvCMXUz79hSuyEb6ssPwbAv | 요청13:12:39 / 대상 확인13:12:56 | 운영 별칭 B·매핑 completed·응답 정상 |

위 시간 차이는 요청부터 관찰 시점까지이며 실제 무중단 시간이나 복구 SLA 측정값으로 사용하지 않는다. B 고유 주소는 https://dreaming-good-church-gabvbf4g4-eunchan96s-projects.vercel.app 이다. 운영 주소는 https://dreaming-good-church.vercel.app 이다.

## 배포 전 백업

사용자가 기존 복구 암호를 기기에 직접 입력해 새 백업 생성·검증을 완료했다. 암호는 전달받지 않았다.

- PC 원본: .local/backups/church-zefnxczgwpsmfcixonpb-2026-11-13T04-07-17-045Z-86437ec6-1fc8-4980-ac0b-f6bbe046b9c9.dgcb.
- 40,815바이트,12개 항목,현재 사진0개.
- SHA-256: d2f30f1b79ee8475341740b65a83011096160d9e15e194198ff1ef996ed675c0.
- [기존 개인 Drive 폴더](https://drive.google.com/drive/folders/1EMVqTfnEl--CmFS0KdR9BEqyWHrpmWfz)의 [암호화 사본](https://drive.google.com/file/d/1aiyH9nYKV_s71HZl2fWnSJ0u1242FXvW/view)과 [검증 영수증](https://drive.google.com/file/d/1j416UD0B2Kf7dAbllbgzuRFWDQDk7fwu/view).
- 실제 Drive 재다운로드 사본 .local/backups/drive-1aiyH9nYKV_s71HZl2fWnSJ0u1242FXvW.dgcb의 SHA-256/바이트 수 일치 및 파일/폴더의 owner만 있는 권한 메타데이터 확인. 공유 변경 없음.

이번 새 사본의 복호화 검증은 사용자 PC 생성 과정에서 완료했고, Drive 사본은 바이트 동일성으로 확인했다. 새 사본 SQL 복구를 다시 실행한 것은 아니다. 기존 실제 백업 SQL 격리 복구 검수는 별도 완료 근거를 유지한다. 이 훈련 보고서는 Drive에 추가 업로드하지 않았다.

## 단계별 검수

B 최초 연결, A 롤백 후, B 최종 복귀 후 **각각** 같은 읽기 전용 검수를 실행했다.

- API11건: 주보·교회·공지·일정200, 주보/공지/일정 빈 목록 확인. 없는 주보/PDF/이미지404, 잘못된 날짜/월400, 미인증 이미지 POST/DELETE401, no-store.
- 별도 Edge에서 PC1440px·모바일390px 각각 홈·주보·공지·일정·교회 안내·주보 관리·계정7개 화면200. 가로 넘침·처리되지 않은 JS 오류 없음, 관리자 화면은 비로그인 비밀번호 입력 화면.
- get_alias로 각 실제 도메인 대상 ID를 확인해 같은 화면이라는 이유만으로 전환 성공을 판정하지 않았다.
- A가 바로 이전 정상 Production이며 isRollbackCandidate=true임을 일반 Production 목록에서 확인했다. rollbackCandidate 필터 호출은 도구 오류여서 성공 근거로 쓰지 않고 일반 목록으로 확인했다.
- request_rollback(A), request_promote(B) 순차 요청 후 매핑/HTTP를 검증했다. 복귀 후 list_promote_aliases에서 기본 도메인 completed를 확인했다.

프로젝트 get_project 도구는 rollbackInfo 옵션을 노출하지 않아 lastAliasRequest 상태 직접 조회는 하지 않았다. Promote 성공과 실제 별칭 매핑/응답으로 복귀를 검증했다. 향후 Git push에 대한 자동 배포/도메인 할당까지 실험한 것은 아니다.

## 보존 확인과 범위

- 운영 DB 전후 주보0·이미지0·Storage0·운영자1·마이그레이션6개 유지. 훈련에서 DB 자료/설정 쓰기나 마이그레이션은 실행하지 않았다.
- 기존 Preview 고정 별칭은 Cwg를 유지한다. 프로젝트 Node24, 보호 all_except_custom_domains 유지.
- Auth Site URL은 기존 고정 검수 주소, redirect는 기존 localhost/검수/운영 account3개 유지. 키·보호·PR 병합·메일·백업 삭제·자동 일정 변경 없음.
- 기존 실제 관리자의 운영 로그인 검수는 첫 A 배포 때 완료한 근거다. 이번 훈련에서 비밀번호를 전달받거나 실제 관리자 로그인을 다시 수행했다고 기록하지 않는다.

같은 코드/DB 구조 사이의 전환 검증이다. 다른 코드·파괴적 스키마·키 회전·실제 운영 자료 손실 복구의 호환성을 보증하지 않는다. 실제 운영 주보/사진/PDF·인쇄·최종 출시 및 Auth Site URL 전환은 WBS43에서 이어간다.

WBS42의 운영 반영·권한/키/리전·백업 보관/복구 연습·배포 되돌리기·장애 연락체계 기준은 기존 근거와 이번 결과로 충족했다. 수동 백업 정책의 반복 실행은 운영자 책임이며 자동 백업/자동 삭제를 만든 것은 아니다.
