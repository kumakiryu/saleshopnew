import type { VercelRequest, VercelResponse } from './_types';
import { verifyAdminToken } from './_shared';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const adminToken = req.headers['x-admin-token'] as string;
  if (!adminToken) return res.status(401).json({ error: 'Missing token' });

  const { ok, reason } = await verifyAdminToken(adminToken);
  if (!ok) return res.status(401).json({ error: reason ?? 'Unauthorized' });

  const [membershipsRes, usersRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/user_memberships?select=*&order=assigned_at.desc`, {
      headers: serviceHeaders(),
    }),
    fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
      headers: serviceHeaders(),
    }),
  ]);

  if (!membershipsRes.ok) return res.status(500).json({ error: 'Failed to fetch memberships' });
  if (!usersRes.ok) return res.status(500).json({ error: 'Failed to fetch users' });

  const memberships = (await membershipsRes.json()) as any[];
  const usersData = (await usersRes.json()) as { users: { id: string; email?: string }[] };
  const users = usersData.users ?? [];

  const emailMap: Record<string, string> = {};
  for (const u of users) {
    if (u.id && u.email) emailMap[u.id] = u.email;
  }

  const result = (Array.isArray(memberships) ? memberships : []).map((m: any) => ({
    ...m,
    email: emailMap[m.user_id] ?? m.email ?? null,
  }));

  return res.status(200).json(result);
}
