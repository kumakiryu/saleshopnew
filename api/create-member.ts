import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminToken } from './_shared';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, tier, adminToken } = req.body as {
    email: string; password: string; tier: string; adminToken: string;
  };
  if (!email || !password || !tier || !adminToken) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const { ok, userId: adminId, reason } = await verifyAdminToken(adminToken);
  if (!ok) return res.status(401).json({ error: reason ?? 'Unauthorized' });

  // Create user via admin API — auto-confirms email, no verification email sent
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    }),
  });

  const createData = await createRes.json();
  if (!createRes.ok) {
    return res.status(400).json({
      error: createData?.msg ?? createData?.message ?? createData?.error_description ?? 'Account creation failed',
    });
  }

  const userId = createData?.id;
  if (!userId) return res.status(500).json({ error: 'User created but no ID returned' });

  // Assign membership tier
  if (tier !== 'normal') {
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/user_memberships`, {
      method: 'POST',
      headers: {
        ...serviceHeaders(),
        Prefer: 'return=representation,resolution=merge-duplicates,on_conflict=user_id',
      },
      body: JSON.stringify({
        user_id: userId,
        tier,
        assigned_by: adminId,
        assigned_at: new Date().toISOString(),
      }),
    });
    if (!upsertRes.ok) {
      const err = await upsertRes.json().catch(() => ({}));
      return res.status(500).json({
        error: err?.message ?? 'Account created but tier assignment failed. Use Assign Tier to fix.',
      });
    }
  }

  return res.status(200).json({ ok: true, userId, email: email.trim().toLowerCase(), tier });
}
