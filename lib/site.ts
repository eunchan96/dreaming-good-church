import { PRODUCTION_ORIGIN } from './account-links.mjs';

/** 검색 엔진과 공유 미리보기에 쓰는 사이트 기본 정보. 도메인을 바꾸면 NEXT_PUBLIC_SITE_URL만 바꾸면 된다. */
export const SITE_NAME = '꿈꾸는좋은교회';
export const SITE_DESCRIPTION = '경기도 고양시 덕양구 충장로에 있는 꿈꾸는좋은교회입니다. 예배 시간과 예배 영상, 주보, 교회 소식과 오시는 길을 안내합니다.';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || PRODUCTION_ORIGIN).replace(/\/+$/, '');

/** 운영 배포에서만 검색 엔진에 노출한다(브랜치 미리보기·로컬은 수집 금지). */
export const SITE_INDEXABLE = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === 'production' : process.env.SITE_INDEXABLE === '1';

/** 검색 엔진 소유권 확인 값. 구글 서치 콘솔·네이버 서치어드바이저에서 받은 content 값을 환경 변수에 넣는다. */
export const SITE_VERIFICATION = {
  google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  naver: process.env.NAVER_SITE_VERIFICATION || undefined,
};

/** 공개 화면 하나의 제목·설명·대표 주소(공유 미리보기 포함). 제목 뒤 '| 꿈꾸는좋은교회'는 레이아웃이 붙인다. */
export const SITE_IMAGE = { url: '/opengraph-image.png', width: 1200, height: 630, alt: `${SITE_NAME} 로고` };
export function pageMeta(title: string, description: string, path: string) {
  return { title, description, alternates: { canonical: path }, openGraph: { type: 'website' as const, locale: 'ko_KR', siteName: SITE_NAME, title: `${title} | ${SITE_NAME}`, description, url: path, images: [SITE_IMAGE] } };
}

/** 검색 결과에 교회 정보(이름·주소·전화·유튜브)를 알리는 구조화 데이터(schema.org Church). */
export function churchJsonLd(address: string, phone: string, youtube: string) {
  return {
    '@context': 'https://schema.org', '@type': 'Church', '@id': `${SITE_URL}/#church`,
    name: SITE_NAME, alternateName: '좋은교회', url: `${SITE_URL}/`, description: SITE_DESCRIPTION,
    logo: `${SITE_URL}/brand/church-logo-wide-print.png`, image: `${SITE_URL}/opengraph-image.png`,
    telephone: phone,
    address: { '@type': 'PostalAddress', streetAddress: address.replace(/^경기도 고양시 덕양구 /, ''), addressLocality: '고양시 덕양구', addressRegion: '경기도', addressCountry: 'KR' },
    sameAs: [youtube],
  };
}
