import { timingSafeEqual } from 'node:crypto';
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const encoder = new TextEncoder();
const accountUrl = 'https://dreaming-good-church.vercel.app/admin/account';
const headers = { 'Cache-Control': 'no-store' };

function matchesKey(provided, expected) {
  if (!provided || !expected) return false;
  const actual = encoder.encode(provided);
  const secret = encoder.encode(expected);
  return actual.length === secret.length && timingSafeEqual(actual, secret);
}

Deno.serve(async (request) => {
  const { default: secretKey } = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  if (!matchesKey(request.headers.get('apikey'), secretKey)) {
    return Response.json({ error: 'admin_key_required' }, { status: 403, headers });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'post_required' }, { status: 405, headers });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'valid_email_required' }, { status: 400, headers });
  }

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL'), secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const invite = await admin.auth.admin.generateLink({
      type: 'invite', email, options: { redirectTo: accountUrl },
    });
    if (invite.error) {
      const status = invite.error.status >= 400 && invite.error.status < 500 ? invite.error.status : 502;
      return Response.json({ error: invite.error.code ?? 'invite_failed' }, { status, headers });
    }

    const token = invite.data.properties.hashed_token;
    if (!/^[A-Za-z0-9_-]{16,512}$/.test(token)) {
      return Response.json({ error: 'invalid_invite_token' }, { status: 502, headers });
    }

    const membership = await admin.from('church_editors').upsert({ user_id: invite.data.user.id });
    if (membership.error) {
      return Response.json({ error: 'editor_membership_failed' }, { status: 502, headers });
    }

    const fragment = new URLSearchParams({ token_hash: token, type: 'invite' });
    return Response.json({ invite_url: `${accountUrl}#${fragment}` }, { headers });
  } catch {
    return Response.json({ error: 'invite_failed' }, { status: 502, headers });
  }
});
