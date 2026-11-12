export const churchLabels: Record<string, string> = { name: "교회 이름", address: "주소", phone: "연락처", worship: "예배 시간", introduction: "교회 소개", directions: "오시는 길" };
export type ChurchField = { key: string; body: string; web_visible: boolean; revision: number };
export type BulletinImage = { id: string; title: string; alt: string; width: number; height: number; bytes: number };
