export const YOUTUBE_CHANNEL = 'https://www.youtube.com/@%EA%BF%88%EA%BE%B8%EB%8A%94%EC%A2%8B%EC%9D%80%EA%B5%90%ED%9A%8C';
export const CHURCH_ADDRESS = '경기도 고양시 덕양구 충장로 118-35, 선아빌딩 5층';
// Building address/coordinates cross-checked on 2026-11-13; avoid ambiguous free-text geocoding.
export const CHURCH_LOCATION = { latitude: 37.6223746, longitude: 126.8354385 };
export const CHURCH_VISIT = '샘터마을2단지아파트 앞 · 행신초등학교에서 도보 2분';
export const CHURCH_PHONE = '010-3012-9192';
export const worshipTypes = [
  { key: 'sunday', name: '주일예배', english: 'SUNDAY WORSHIP', time: '주일 오전 10:45', playlist: 'PLN8Or4tXpI5BB8cgcrX6p6pY12EIVM6d5' },
  { key: 'afternoon', name: '주일오후예배', english: 'AFTERNOON WORSHIP', time: '첫째·셋째 주일 오후 1:00', playlist: 'PLN8Or4tXpI5AW8UwAXghUghYcNlrZGSM3' },
  { key: 'friday', name: '금요예배', english: 'FRIDAY WORSHIP', time: '금요일 저녁 8:45', playlist: 'PLN8Or4tXpI5CT12uRnqPDRcqvzQbgOxO4' },
  { key: 'dawn', name: '새벽예배', english: 'DAWN WORSHIP', time: '새벽 5:25', playlist: 'PLN8Or4tXpI5CrsEEhqK1WqiTnsJsVpugb' },
] as const;
export type WorshipType = typeof worshipTypes[number]['key'];
export const additionalWorshipTimes = [
  { key: 'students', name: '학생 예배', english: 'STUDENT WORSHIP', time: '주일 오전 09:30' },
  { key: 'monthly', name: '월삭새벽예배', english: 'FIRST DAY PRAYER', time: '매월 첫날 오전 05:25' },
] as const;
export const siteNavigation = [
  { name: '교회 소개', href: '/church', links: [
    { label: '인사말', href: '/church' }, { label: '오시는 길', href: '/church/directions' },
    { label: '예배시간 안내', href: '/church/worship-times' }, { label: '온라인 헌금', href: '/church/offering' },
  ] },
  { name: '예배', href: '/worship', links: worshipTypes.map(w => ({ label: w.name, href: w.key === 'sunday' ? '/worship' : `/worship/${w.key}` })) },
  { name: '소식', href: '/notices', links: [ { label: '교회 소식', href: '/notices' }, { label: '주보', href: '/bulletins' }, { label: '교회 일정', href: '/events' }, { label: '토라&토브', href: '/torah-tov' } ] },
];
export const offeringAccounts = [
  { name: '일반 헌금', bank: '농협', number: '301-0223-0182-71', holder: '좋은교회' },
  { name: '건축 헌금', bank: '농협', number: '301-0220-0484-81', holder: '좋은교회' },
] as const;
