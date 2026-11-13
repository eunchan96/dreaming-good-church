# 배포 관리자 계정과 설정 링크

## 확인한 운영 계정·URL

2026-11-13 사용자가 고정 검수 주소의 `/admin/bulletins`에서 기존 운영 계정으로 로그인 → 목록 확인 → 새로고침 → 로그아웃을 정상 확인했다. 원격 DB에서도 운영자1명·이메일 확인1명·비밀번호 설정1명임을 값 노출 없이 확인했다. 비밀번호를 전달받거나 변경하지 않았다.

고정 검수 Origin:

```text
https://dreaming-good-church-git-codex-bulle-a36b08-eunchan96s-projects.vercel.app
```

원격 Auth의 Site URL과 추가 Redirect URL이 localhost에만 연결되어 있던 문제를 확인했다. CLI 인증 설정 변경은 서비스 권한403으로 거절됐다. 사용자가 대시보드에서 직접 저장한 뒤 읽기 전용 CLI dry-run으로 다음 값을 재확인했다.

- Site URL: 위 고정 Origin.
- Redirect URLs: 기존 `http://localhost:3000/auth/callback` 유지, 위 Origin의 `/admin/account` 추가.
- 공개 Auth settings의 `disable_signup=true` 유지. 새 계정을 만드는 가입 요청은 실행하지 않았다.

로컬 개발은 별도 `supabase/config.toml`의 localhost/127.0.0.1 포트3000/3001 계정 경로를 허용한다. 이 로컬 설정 전체를 원격에 push하지 않는다. 앞으로 정식 도메인이 생기면 승인된 Origin 목록과 원격 허용 주소를 함께 갱신한다.

## 계정 설정 링크 만들기

초대가 필요한 새 운영자만 `invite`를 사용한다. 기존 운영자의 필요 없는 재초대나 비밀번호 초기화를 자동으로 실행하지 않는다. 아래 명령은 운영자가 실행하는 관리 도구이며 메일을 발송하지 않는다.

```powershell
node --env-file=.env.local scripts/invite-editor.mjs 담당이메일 --origin https://dreaming-good-church-git-codex-bulle-a36b08-eunchan96s-projects.vercel.app --type invite
```

기존 운영자의 비밀번호 재설정이 실제로 필요한 경우에만 다음 모드를 쓴다.

```powershell
node --env-file=.env.local scripts/invite-editor.mjs 담당이메일 --origin https://dreaming-good-church-git-codex-bulle-a36b08-eunchan96s-projects.vercel.app --type recovery
```

`--origin`은 필수다. localhost로 자동 폴백하지 않으며 고정 검수 Origin과 명시된 로컬 개발 Origin만 허용한다. `invite`는 초대된 사용자의 운영자 멤버십을 등록하고 `recovery`는 기존 멤버십을 확인할 뿐 새 권한을 부여하지 않는다.

SDK generateLink에 `/admin/account` 복귀 주소를 명시하고, 반환된 해시로 직접 계정 페이지의 `#token_hash=...&type=invite|recovery` 링크를 만든다. 토큰을 서버 쿼리·콘솔·문서에 출력하지 않는다. 링크 HTML은 Git 제외 `.local/admin-invite-UUID.html` 또는 `.local/admin-recovery-UUID.html`에만 저장한다. 파일 이름만 터미널에 출력한다.

이 HTML에는 일회용 계정 토큰이 있으므로 GitHub·Notion·Drive 백업 폴더에 올리지 않는다. 신뢰할 수 있는 경로로 해당 운영자에게만 전달한다. 생성만으로 비밀번호가 바뀌지는 않지만 재설정 링크를 불필요하게 여러 번 만들지 않는다. 기본 Supabase 메일 템플릿/implicit access-token 링크는 이번 관리 도구의 token_hash 흐름과 구분하며 자동 메일 발송을 검증한 것은 아니다.

## 계정 페이지 동작

‘계정 링크 확인’을 눌러 초대/재설정 토큰을 확인한다. 레거시 type 없는 token_hash는 초대로 해석한다. 다른 타입·중복 타입·중복 토큰·잘못된 토큰을 거절한다. 확인 요청 전에 주소에서 토큰을 제거한다.

운영자 멤버십을 확인한 뒤 비밀번호 입력란을 연다. 확인 당시 사용자와 현재 로그인 사용자가 같고 멤버십이 유지되는지 저장 직전에 다시 검사한다. 다른 탭 로그아웃/계정 변경은 입력란과 암호를 초기화한다. 비밀번호 설정 성공 후 같은 사이트의 `/admin/bulletins`로 이동한다. 외부 next URL을 따르지 않는다.

## 검증 범위

- 실제 배포 계정 로그인·새로고침·로그아웃: 사용자 확인 완료.
- 원격 Site/Redirect URL과 가입 제한: 직접 재조회 완료.
- Origin·토큰·타입·쿼리 미노출 검증 단위2건과 전체 단위25건, 코드/타입 검사·빌드 통과.
- 추가 브라우저 검증은 로컬 가상 계정으로 초대·재설정/재사용 차단·권한 회수·다른 탭 로그아웃과 기존 관리자 동작을 확인한다.
- 실제 운영 계정의 초대 토큰 소비·비밀번호 변경·메일 발송은 실행하지 않았다. 운영 DB에 가상 계정/주보를 추가하지 않는다.

Docker 초기화로 로컬 컨테이너와 이미지가 사라져 로컬 검수 스택을 재구성 중이다. 원격 DB·기존 백업에는 영향을 주지 않는다. 실제 브라우저 결과와 Preview 배포 결과는 완료 후 기록한다.
