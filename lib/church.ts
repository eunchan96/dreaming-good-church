export const churchLabels: Record<string, string> = { name: "교회 이름", address: "주소", phone: "연락처", worship: "예배 추가 안내", introduction: "교회 소개", directions: "오시는 길", pastor_name: "담임목사 이름", page_lead: "교회 소개 머리 문구", greeting_title: "인사말 제목", greeting_closing: "인사말 맺음 문구", map_caption: "약도 설명", offering_title: "헌금 안내 제목", offering_note: "헌금 안내 문구" };
import type { Tables } from "./database.types";
export type ChurchField = Tables<"church_info">;
export type BulletinImage = Omit<Tables<"bulletin_images">, "created_at">;
