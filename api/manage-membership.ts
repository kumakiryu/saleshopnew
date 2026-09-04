import type { VercelRequest, VercelResponse } from './_types';
import { verifyAdminToken } from './_shared';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, tier, adminToken } = req.body as { email: string; tier: string; adminToken: string };
  if (!email || !tier || !adminToken) return res.status(400).json({ error: 'Missing fields' });

  const { ok, userId: adminId, reason } = await verifyAdminToken(adminToken);
  if (!ok) return res.status(401).json({ error: reason ?? 'Unauthorized' });

  // Look up user by email using service role
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: serviceHeaders(),
  });

  if (!listRes.ok) return res.status(500).json({ error: 'Failed to look up user' });
  const listData = await listRes.json();
  const users: any[] = listData?.users ?? (Array.isArray(listData) ? listData : []);
  const targetUser = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
  if (!targetUser) return res.status(404).json({ error: `No account found for ${email}` });

  const userId = targetUser.id;

  if (tier === 'normal') {
    await fetch(`${SUPABASE_URL}/rest/v1/user_memberships?user_id=eq.${userId}`, {
      method: 'DELETE', headers: serviceHeaders(),
    });
  } else {
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/user_memberships`, {
      method: 'POST',
      headers: { ...serviceHeaders(), Prefer: 'return=representation,resolution=merge-duplicates,on_conflict=user_id' },
      body: JSON.stringify({ user_id: userId, tier, assigned_by: adminId, assigned_at: new Date().toISOString() }),
    });
    if (!upsertRes.ok) {
      const err = await upsertRes.json().catch(() => ({}));
      return res.status(500).json({ error: err?.message ?? 'Failed to set membership' });
    }
  }

  return res.status(200).json({ ok: true, userId, tier });
}
