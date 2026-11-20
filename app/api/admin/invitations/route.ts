import { accountUrl, makeAccountLink, PRODUCTION_ORIGIN } from '@/lib/account-links.mjs';
import type { Database } from '@/lib/database.types';
import { getEditor, noStore } from '@/lib/server-access';
import { createClient } from '@supabase/supabase-js';

const productionSupabase = 'https://zefnxczgwpsmfcixonpb.supabase.co';

function reply(data: object, status = 200) {
  return Response.json(data, { status, headers: noStore });
}

async function canInvite(request: Request) {
  const allowedIds = process.env.ADMIN_INVITER_USER_IDS?.split(',').map(id => id.trim().toLowerCase()) ?? [];
  if (!allowedIds.some(Boolean)) return false;
  const editor = await getEditor(request);
  return !!editor && allowedIds.includes(editor.user.id.toLowerCase());
}

function accountOrigin(request: Request, supabaseUrl: string) {
  if (supabaseUrl === productionSupabase) return PRODUCTION_ORIGIN;
  const host = new URL(supabaseUrl).hostname;
  const target = new URL(request.url);
  if (['localhost', '127.0.0.1'].includes(host) && ['localhost', '127.0.0.1'].includes(target.hostname)) {
    accountUrl(target.origin);
    return target.origin;
  }
  throw new Error('Unsupported invitation environment');
}

export async function GET(request: Request) {
  try {
    return reply({ allowed: await canInvite(request) });
  } catch {
    return reply({ allowed: false }, 503);
  }
}

export async function POST(request: Request) {
  try {
    if (!(await canInvite(request))) return reply({ error: 'forbidden' }, 403);

    const input = await request.json().catch(() => null);
    const email = typeof input?.email === 'string' ? input.email.trim() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply({ error: 'invalid_email' }, 400);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return reply({ error: 'unavailable' }, 503);
    const origin = accountOrigin(request, url);
    const admin = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    });

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'invite', email, options: { redirectTo: accountUrl(origin) },
    });
    if (error?.code === 'email_exists' || error?.code === 'user_already_exists') {
      return reply({ error: 'already_confirmed' }, 409);
    }
    if (error) return reply({ error: 'unavailable' }, 502);

    const inviteUrl = makeAccountLink(origin, data.properties.hashed_token);
    const membership = await admin.from('church_editors').upsert({ user_id: data.user.id }, {
      onConflict: 'user_id', ignoreDuplicates: true,
    });
    if (membership.error) return reply({ error: 'unavailable' }, 502);

    return reply({ inviteUrl });
  } catch {
    return reply({ error: 'unavailable' }, 503);
  }
}
