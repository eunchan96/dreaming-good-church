/** 주보 테마: 레이아웃(layout)과 강조색 구성. 키는 DB의 bulletins.theme에 저장된다. */
export type BulletinTheme = {
  key: string;
  name: string;
  description: string;
  layout: "classic" | "modern";
  /** 관리자 선택 칸에 보여 줄 대표 색 */
  swatch: [string, string];
};

export const bulletinThemes: BulletinTheme[] = [
  { key: "classic", name: "기본", description: "지금의 워드 주보 모양(띠 제목, 점선 예배 순서)", layout: "classic", swatch: ["#8c9a4a", "#f7a81b"] },
  { key: "modern", name: "모던 · 숲", description: "선과 여백 중심의 정돈된 모양, 짙은 초록 강조", layout: "modern", swatch: ["#2f5d4e", "#c8a24a"] },
  { key: "modern-navy", name: "모던 · 바다", description: "같은 모던 모양, 짙은 남색 강조", layout: "modern", swatch: ["#25476a", "#b8863b"] },
  { key: "modern-warm", name: "모던 · 노을", description: "같은 모던 모양, 따뜻한 적갈색 강조", layout: "modern", swatch: ["#9a4a32", "#c79a4a"] },
  { key: "modern-ink", name: "모던 · 먹", description: "같은 모던 모양, 흑백 인쇄에 알맞은 먹색 강조", layout: "modern", swatch: ["#2b2b2b", "#8a8a8a"] },
  { key: "modern-christmas", name: "절기 · 성탄", description: "모던 모양에 짙은 초록과 붉은 포인트, 제목 아래 겹줄 장식(성탄절·대림절)", layout: "modern", swatch: ["#1f4d36", "#a8322d"] },
  { key: "modern-easter", name: "절기 · 부활", description: "모던 모양에 차분한 보라와 금색 포인트, 제목 아래 겹줄 장식(부활절·사순절)", layout: "modern", swatch: ["#5b4a8a", "#b08a1f"] },
];

export const defaultThemeKey = "classic";

/** 알지 못하는 키는 기본 테마로 보인다(옛 데이터·잘못된 값 보호). */
export function themeOf(key: string | null | undefined): BulletinTheme {
  return bulletinThemes.find(theme => theme.key === key) ?? bulletinThemes[0];
}
