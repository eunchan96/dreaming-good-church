# 운영·인수인계 안내

홈페이지를 맡는 기술 담당자가 가장 먼저 보는 문서다. 목사님·편집자용 사용법은 [관리 화면 사용 안내](user-guide.md)(관리 화면 `/admin/guide`)에 있다.
비밀번호·키·복구 암호의 **값**은 이 문서와 저장소 어디에도 적지 않는다. 각 서비스에 로그인해서 본다.

마지막 정리: 2026-11-27

## 1. 한눈에 보기

- 공개 주소: <https://towbchurch.com> · 관리자: <https://towbchurch.com/admin/bulletins>
- 구조: Next.js(Vercel) + Supabase(DB·로그인·파일). 코드는 GitHub 저장소, 배포는 `main`에 합치면 Vercel이 자동으로 한다.
- 담당·비상 연락·복구 판단: [운영 정책](operating-policy-and-rollback.md)의 '확정한 운영 정책'을 따른다(현재 담당 1명, 대체 담당 미지정).

## 2. 쓰는 서비스

| 서비스 | 쓰는 곳 | 메모 |
| --- | --- | --- |
| Vercel | 배포·도메인 연결 | 프로젝트 `dreaming-towb-church`(팀 eunchan96s-projects). 브랜치를 푸시하면 미리보기 주소가 생긴다. |
| Supabase | DB·로그인·사진·특별 순서지 PDF | 운영 프로젝트 ref `zefnxczgwpsmfcixonpb`(서울). Edge Function `invite-church-editor`(관리자 초대). |
| 가비아 | 도메인 `towbchurch.com` | 2026-11-25 1년 구매, **2027-11 만료**. 현재 담당자 개인 명의. |
| Notion | 곡 목록(찬양 곡 DB)·업무 관리(WBS) | 관리자 '곡 목록'이 Notion 연동 토큰으로 읽는다. |
| Google Drive | 암호화 백업 보관 | 담당자 개인 Drive의 백업 폴더. [암호화 백업](encrypted-backups.md) 참고. |
| 네이버 서치어드바이저·구글 Search Console | 검색 노출 | 사이트맵 `https://towbchurch.com/sitemap.xml` 제출 완료. robots는 `/admin`·`/api/`·`/legal/`만 막는다. |

### 환경변수(Vercel Production·Preview)

이름만 적는다. 값은 Vercel 대시보드에 있다(`.env.default` 참고).

| 이름 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 화면·관리 화면의 Supabase 연결 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용(공개 변수로 옮기지 않는다) |
| `ADMIN_INVITER_USER_IDS` | 관리자 초대 권한이 있는 계정 |
| `NOTION_TOKEN` | 곡 목록 읽기 |

## 3. 계정과 권한

- 관리자 계정은 초대로만 만든다(공개 가입 막힘). 초대·비밀번호 재설정: [배포 계정 안내](deployed-accounts.md).
- 편집 권한은 DB `church_editors`에 등록된 계정만 갖는다. 사람이 바뀌면 초대 권한이 있는 계정으로 관리 화면 아래 **관리자 초대**에서 새 담당자를 초대하고, 떠나는 사람은 같은 곳에서 **권한 해제**한다(계정 정보도 지워지며 되돌릴 수 없다). 초대 권한 자체는 환경변수 `ADMIN_INVITER_USER_IDS`로 정한다.
- 서비스 계정(Vercel·Supabase·가비아·Notion·Google)의 소유자와 로그인 수단을 넘길 때는 2단계 인증 기기까지 함께 옮긴다.

## 4. 정기 점검

| 언제 | 할 일 |
| --- | --- |
| 편집한 날 작업이 끝난 뒤, 배포·대량 수정 직전 | 암호화 백업(`npm run backup:create`) → PC·Drive 두 곳 보관과 해시 확인. 보존: 최근 7개 + 주별 4개([운영 정책](operating-policy-and-rollback.md)). |
| 매주(주일 전) | 그 주 주보가 '게시됨' 또는 '예약'인지, 공개 주보·PDF가 열리는지 확인. |
| 매월 | Vercel 배포 실패·런타임 오류, Supabase 보안·성능 알림(Advisors) 확인. 백업 보존 정리(검증한 새 사본이 있을 때만). |
| 분기 | 백업 하나를 골라 격리 복구 연습(`npm run backup:restore-check`, [복구 확인](production-restore-check.md)). 네이버·구글 색인 상태 확인. |
| 매년 | 도메인 연장(아래), 관리자 계정 목록 점검, 서비스 요금제·무료 한도 확인. |

주일 오전에는 배포하지 않는다. 운영 DB 변경·Edge Function 배포·운영 환경변수 변경은 미리 백업하고 진행한다.

## 5. 정해진 일정

| 시기 | 할 일 | 근거 |
| --- | --- | --- |
| 2026-12 중순 이후 | 옛 서비스 워커 정리 파일 `public/sw.js`와 `next.config`의 `/sw.js` 헤더 삭제 | 오프라인 저장 제거(2026-11-23) 후 성도 휴대폰의 옛 워커가 정리될 시간 |
| 2027 초 이후 | 이미 보낸 초대·재설정 링크가 모두 만료된 뒤, `lib/account-links.mjs`의 옛 vercel.app 주소 허용과 Supabase Redirect URLs의 옛 주소 삭제. vercel.app → towbchurch.com 이동은 유지 | 도메인 이전 |
| 2027-10 | 가비아 자동 연장과 결제 카드 확인. 교회 고유번호증이 준비되면 도메인 소유자를 교회 명의로 변경 | 2027-11 만료 |

## 6. 장애 때 처음 할 일

1. 무엇이 안 되는지 정리한다: 공개 화면 전체인지, 관리 화면 저장만인지, 특정 주보만인지. 시각과 화면을 기록한다.
2. Vercel 최근 배포 상태와 런타임 오류를 본다. 방금 배포가 원인이면 Vercel **Instant Rollback**으로 이전 정상 배포로 되돌린다(DB는 그대로다).
3. 로그인·저장 문제면 Supabase 상태(프로젝트 일시 정지·요금 한도)와 로그를 본다.
4. 자료가 사라졌거나 잘못 바뀌었으면 쓰기를 멈추고, 마지막 백업을 격리 환경에서 먼저 열어 본 뒤 복구한다. 운영 DB를 덮어쓰기 전에 현재 상태도 백업한다.
5. 고친 뒤 공개 주보·PDF·관리자 저장·게시를 확인하고, 원인과 조치를 기록한다.

자세한 절차: [운영 준비와 복구](operations-recovery.md)(DB·사진 복구, Vercel 되돌리기 주의점), [롤백 훈련 결과](rollback-drill-2026-11-13.md).

## 7. 자주 하는 기술 작업

| 작업 | 방법 |
| --- | --- |
| 새 특별 순서지 올리기 | [특별 순서지](special-programs.md)의 '새 순서지 올리기'. 성도 이름은 DB에만 넣고 저장소에는 넣지 않는다. |
| 코드 수정·배포 | [README](../README.md)의 '브랜치와 배포'. 브랜치 미리보기도 운영 DB에 연결되어 있으니 게시·삭제·예약을 누르지 않는다. |
| DB 구조 변경 | `supabase/migrations`에 추가 → 로컬 검사 → `supabase db push --remote=zefnxczgwpsmfcixonpb --dry-run`으로 확인 후 적용. |
| 사용 안내 캡처 다시 찍기 | 로컬 Supabase와 `npm run dev:local`을 켠 뒤, 같은 화면을 1280×860으로 찍어 `public/admin/guide`의 같은 이름으로 바꾼다. 샘플 자료만 보이게 한다. |
| 아이콘 교체 | [홈 화면 설치](app-installation.md)의 `npm run icons:generate`. |

## 8. 문서 지도

- 사용법: [관리 화면 사용 안내](user-guide.md)
- 주보: [작성](bulletin-drafts.md) · [게시·예약·삭제](bulletin-publication.md) · [인쇄](bulletin-printing.md) · [특별 순서지](special-programs.md)
- 홈페이지: [공개 사이트](public-site.md) · [홈페이지 콘텐츠](homepage-content-management.md) · [예배 영상](worship-video-management.md) · [공지·일정](community.md) · [교회 사진](church-images.md)
- 운영: [배포 계정](deployed-accounts.md) · [암호화 백업](encrypted-backups.md) · [운영 정책](operating-policy-and-rollback.md) · [운영 준비와 복구](operations-recovery.md) · [Vercel 배포](vercel-deployment.md) · [CI](ci.md)
- 로컬 개발: [로컬 샘플](local-samples.md) · [README](../README.md)

## 9. 아직 남은 확인

- 아이폰 실기기에서 공개 화면·홈 화면 추가 확인([모바일 검증](mobile-verification.md)).
- 실제 프린터로 주보 양면 출력 확인([주보 인쇄](bulletin-printing.md)).
- 네이버·구글 색인 결과(사이트맵 제출 완료, 색인 대기 중).
