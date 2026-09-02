import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fulfillOrder } from './_shared';

const SUPABASE_URL = 'https://hxfccpadsbunynignbwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE';

async function verifyAdminToken(token: string): Promise<{ ok: boolean; reason?: string }> {
  // Get the user from Supabase Auth using their JWT
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!userRes.ok) return { ok: false, reason: 'Not authenticated' };

  const user = await userRes.json();
  if (!user?.id) return { ok: false, reason: 'Not authenticated' };

  // Check admins table
  const adminRes = await fetch(
    `${SUPABASE_URL}/rest/v1/admins?id=eq.${user.id}&select=id&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!adminRes.ok) return { ok: false, reason: 'Admin check failed' };
  const rows = await adminRes.json();
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, reason: 'Not an admin' };

  return { ok: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { orderId, token } = req.body as { orderId?: string; token?: string };
    if (!orderId || !token) {
      return res.status(400).json({ error: 'Missing orderId or token' });
    }

    const auth = await verifyAdminToken(token);
    if (!auth.ok) {
      return res.status(403).json({ error: auth.reason ?? 'Forbidden' });
    }

    await fulfillOrder(orderId);
    return res.status(200).json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin-fulfill] error:', message);
    return res.status(500).json({ error: message });
  }
}
