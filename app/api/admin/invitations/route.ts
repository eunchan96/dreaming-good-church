import { accountUrl, makeAccountLink, PRODUCTION_ORIGIN } from '@/lib/account-links.mjs';
import type { Database } from '@/lib/database.types';
import { getEditor, noStore } from '@/lib/server-access';
import { createClient, type User } from '@supabase/supabase-js';

const productionSupabase = 'https://zefnxczgwpsmfcixonpb.supabase.co';
const localHosts = ['localhost', '127.0.0.1'];

function reply(data: object, status = 200) {
  return Response.json(data, { status, headers: noStore });
}

function inviterIds() {
  return process.env.ADMIN_INVITER_USER_IDS?.split(',').map(id => id.trim().toLowerCase()).filter(Boolean) ?? [];
}

// Local test servers may also name inviters by e-mail domain, so e2e tests can create one; never on a hosted project.
function localInviterDomain() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const domain = process.env.ADMIN_INVITER_TEST_DOMAIN?.trim().toLowerCase();
  return url && domain && localHosts.includes(new URL(url).hostname) ? domain : null;
}

function isInviter(user: Pick<User, 'id' | 'email'>) {
  const domain = localInviterDomain();
  return inviterIds().includes(user.id.toLowerCase()) || (!!domain && !!user.email?.toLowerCase().endsWith(`@${domain}`));
}

async function inviter(request: Request) {
  const editor = await getEditor(request);
  return editor && isInviter(editor.user) ? editor.user : null;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    url,
    admin: createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    }),
  };
}

function accountOrigin(request: Request, supabaseUrl: string) {
  if (supabaseUrl === productionSupabase) return PRODUCTION_ORIGIN;
  const host = new URL(supabaseUrl).hostname;
  const target = new URL(request.url);
  if (localHosts.includes(host) && localHosts.includes(target.hostname)) {
    accountUrl(target.origin);
    return target.origin;
  }
  throw new Error('Unsupported invitation environment');
}

// An invited editor counts as active once they have signed in (set a password and logged in) at least once.
async function listEditors(admin: NonNullable<ReturnType<typeof serviceClient>>['admin'], selfId: string) {
  const members = await admin.from('church_editors').select('user_id');
  if (members.error) throw members.error;
  const ids = new Set(members.data.map(row => row.user_id));
  const users: User[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) break;
  }
  return users.filter(user => ids.has(user.id)).map(user => ({
    id: user.id,
    email: user.email ?? '',
    status: user.last_sign_in_at ? 'active' : 'pending',
    self: user.id === selfId,
    inviter: isInviter(user),
  })).sort((a, b) => Number(b.self) - Number(a.self) || a.email.localeCompare(b.email));
}

export async function GET(request: Request) {
  try {
    const user = await inviter(request);
    if (!user) return reply({ allowed: false });
    const service = serviceClient();
    if (!service) return reply({ allowed: true, editors: null });
    return reply({ allowed: true, editors: await listEditors(service.admin, user.id) });
  } catch {
    return reply({ allowed: false }, 503);
  }
}

export async function POST(request: Request) {
  try {
    if (!(await inviter(request))) return reply({ error: 'forbidden' }, 403);

    const input = await request.json().catch(() => null);
    const email = typeof input?.email === 'string' ? input.email.trim() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply({ error: 'invalid_email' }, 400);
    }

    const service = serviceClient();
    if (!service) return reply({ error: 'unavailable' }, 503);
    const origin = accountOrigin(request, service.url);

    const { data, error } = await service.admin.auth.admin.generateLink({
      type: 'invite', email, options: { redirectTo: accountUrl(origin) },
    });
    if (error?.code === 'email_exists' || error?.code === 'user_already_exists') {
      return reply({ error: 'already_confirmed' }, 409);
    }
    if (error) return reply({ error: 'unavailable' }, 502);

    const inviteUrl = makeAccountLink(origin, data.properties.hashed_token);
    const membership = await service.admin.from('church_editors').upsert({ user_id: data.user.id }, {
      onConflict: 'user_id', ignoreDuplicates: true,
    });
    if (membership.error) return reply({ error: 'unavailable' }, 502);

    return reply({ inviteUrl });
  } catch {
    return reply({ error: 'unavailable' }, 503);
  }
}

// Removes an editor's access. A never-used invitation also deletes the account, so its link stops working.
export async function DELETE(request: Request) {
  try {
    const user = await inviter(request);
    if (!user) return reply({ error: 'forbidden' }, 403);
    const id = new URL(request.url).searchParams.get('id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) return reply({ error: 'invalid_id' }, 400);
    if (id === user.id) return reply({ error: 'self' }, 400);

    const service = serviceClient();
    if (!service) return reply({ error: 'unavailable' }, 503);
    const target = await service.admin.auth.admin.getUserById(id);
    if (target.error || !target.data.user) return reply({ error: 'not_found' }, 404);
    if (isInviter(target.data.user)) return reply({ error: 'inviter' }, 400);

    const removed = await service.admin.from('church_editors').delete().eq('user_id', id);
    if (removed.error) return reply({ error: 'unavailable' }, 502);
    // 개인정보 처리방침: 관리자 권한을 해제하면 계정(이메일) 정보도 바로 삭제한다.
    const deleted = await service.admin.auth.admin.deleteUser(id);
    if (deleted.error) return reply({ error: 'unavailable' }, 502);
    return reply({ removed: true });
  } catch {
    return reply({ error: 'unavailable' }, 503);
  }
}
