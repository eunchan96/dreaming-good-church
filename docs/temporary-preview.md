# 일회성 검수 DB

사용자 조건: 잠깐 검수한 뒤 삭제하는 경우만 허용. 상시 검수 프로젝트는 생성·유지하지 않는다.

## 임시 대상과 상태

- 상태: 사용자 삭제 후 프로젝트 목록으로 소멸 확인. 현재 기존 운영 프로젝트 한 개만 유지.
- 조직: 기존 Dreaming-good-church, Free.
- 프로젝트: dreaming-good-church-preview, ref `pfzqqnjmpswtathnhbzt`, 서울.
- 생성 비용 조회: 월$0. 추가 유료 플랜/브랜치는 신청하지 않음.
- 운영 프로젝트 `zefnxczgwpsmfcixonpb`의 스키마/데이터/계정 변경 없음.
- 기존 마이그레이션6개를 임시 프로젝트에만 적용하고 개인정보 없는 로컬 가상 샘플3주분을 넣음.
- 가상 표지2개 추가: 초록색 공개 이미지·보라색 인쇄 전용 이미지. 실제 교회 사진/재정 자료 아님.
- Vercel Preview 변수3개만 임시 DB의 일치하는URL/공개키/서버Sensitive키로 교체. 로컬.env.local과Production 변수는 변경하지 않음.
- 소스5b6d074, 검수배포 dpl_3qS29FrsYAhJyAfYEQmHQepPf7Q7 READY.
- 고정주소: https://dreaming-good-church-git-codex-bulle-a36b08-eunchan96s-projects.vercel.app

임시 DB를 운영자의 상시 로그인 환경으로 사용하지 않는다. 운영 계정/비밀번호는 복사하지 않았다. 이번 휴대폰 검수는 공개 주보·이미지·PDF·오프라인 본문이다.

## 확인 결과

- 익명 DB 읽기에서 공개 주보2개·초안1개 비노출, 최신 공개 주보 항목4개·인쇄 전용 제외.
- 익명 Storage/API에서 공개 사진허용·비공개 사진차단.
- 고정URL의주보목록/상세API200, 공개이미지200 image/webp, 비공개이미지404, 공개PDF200 application/pdf. 모두no-store.
-2026-11-13 사용자가 ‘사진·PDF·오프라인 본문 모두 정상’으로 확인했다. 실제 기기 사용자 보고이며 자동 테스트와 구분한다.

## 검수 직후 정리 절차 — 클라우드 정리 완료

1. 사용자 사진/PDF/오프라인 본문 확인 결과 기록.
2. Vercel Preview 변수3개를 기존 운영 프로젝트의 값으로 원복하고 재배포. 원래 값은 변경하지 않은 로컬.env.local에서 읽되 출력하지 않음.
3. 고정주소의기존DB연결복구·정상응답확인.
4. 공식CLI로 **이번에 만든 임시 ref만** 삭제: `npx --no-install supabase projects delete pfzqqnjmpswtathnhbzt --yes`.
5. 프로젝트 목록에서임시ref소멸·운영ref유지확인. 로컬의검수준비임시파일과세션키참조정리.
6. 사용자휴대폰의오프라인저장본은DB삭제와별개로최대24시간남을수있으므로저장지우기안내.

임시 자원 삭제까지 확인했으며 상시 검수 프로젝트는 남기지 않았다. 휴대폰에 이미 저장한 가상 자료는 서버 삭제와 별개이므로 사용자에게 오프라인 저장 지우기를 안내한다.

2026-11-13 결과: 사용자가 사진·PDF·오프라인 본문 모두 정상으로 확인했다. Preview변수3개를원래DB로원복하고884fd07의dpl_E8mUpBSssepCoWQrw3y8Vihh2vLC 재배포READY. 고정주소의API2개200·샘플없음·게시주보0개를확인해기존연결복구완료.

임시프로젝트삭제명령은프로젝트삭제권한부족으로실패했고대시보드자동화도초기화오류로실행불가해사용자에게수동삭제를요청했다. 사용자가삭제완료를알린뒤프로젝트목록을재조회하여임시pfzqqnjmpswtathnhbzt소멸과기존zefnxczgwpsmfcixonpb ACTIVE_HEALTHY유지를확인했다. 로컬검수준비파일과세션키참조도정리했다. 기존연결원복·검수후임시프로젝트삭제조건을이행했다.
