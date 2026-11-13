import type { Database } from "@/lib/database.types";
import { createClient } from "@supabase/supabase-js";

export const noStore = { "Cache-Control": "no-store, max-age=0", "Vary": "Authorization" };
export function publicClient(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("SERVICE_UNAVAILABLE");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: {
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  } });
}
export async function requireEditor(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;
  const client = publicClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const member = await client.from("church_editors").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return !member.error && member.data ? client : null;
}
/** Used only after requireEditor, for normalized file creation and unused-file deletion. */
export function imageWriter() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SERVICE_UNAVAILABLE");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
