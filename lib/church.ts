export const churchLabels: Record<string, string> = { name: "교회 이름", address: "주소", phone: "연락처", worship: "예배 시간", introduction: "교회 소개", directions: "오시는 길" };
import type { Tables } from "./database.types";
export type ChurchField = Tables<"church_info">;
export type BulletinImage = Omit<Tables<"bulletin_images">, "created_at">;
