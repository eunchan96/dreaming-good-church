# 홈 화면 설치

매니페스트 `/manifest.webmanifest`는 꿈꾸는좋은교회/좋은교회 이름, 루트 시작 주소, standalone 표시 모드, 테마 색과 192/512px 아이콘을 제공한다. 아이폰용 180px 아이콘과 브라우저 favicon도 포함한다.

현재 아이콘은 임시 십자가·교회 그림이다. 공식 아이콘은 사용자에게 파일을 받은 뒤 교체한다. 원본 `public/icons/church-source.svg`와 생성 스크립트 `scripts/generate-app-icons.mjs`를 사용하며 `npm run icons:generate`로 크기별 PNG와 favicon을 재생성한다. 공식 원본 형식이 다르면 스크립트의 입력 경로도 바꾼다. 설치된 기존 앱의 아이콘 갱신 시점은 기기·브라우저에 따라 다르다.

공개 페이지 하단의 설치 안내를 열면 iOS Safari 공유 메뉴, Android Chrome, PC Chrome/Edge 방법을 볼 수 있다. `beforeinstallprompt`가 실제 제공될 때만 직접 설치 버튼을 표시한다. 취소·오류 후 안내로 복귀하고 `appinstalled`/standalone으로 실행 중임을 감지한다. 알림 권한을 요청하지 않는다.

설치는 HTTPS 또는 localhost 환경에서 브라우저의 지원·설치 조건에 따른다. 로컬 네트워크의 HTTP IP 주소에서는 설치 메뉴가 보이지 않을 수 있다. 실제 iOS/Android/PC 홈 화면 설치는 외부 HTTPS 배포 후 확인한다.

이번 범위는 온라인 설치이다. 서비스 워커와 오프라인 응답 캐시는 아직 추가하지 않았다. WBS30의 공개 콘텐츠만 선택 캐싱·게시 취소 후 캐시 한계·관리자/비공개 제외 검증은 후속이다.

검증: 매니페스트 이름/시작 주소/standalone과 실제 PNG 크기, 설치 이벤트/취소/완료 상태 및 320px 넘침 E2E2건. 네이티브 설치 대화상자는 브라우저 이벤트를 모의해 상태 처리를 검증했으며 실제 OS 설치를 완료했다는 뜻은 아니다.
