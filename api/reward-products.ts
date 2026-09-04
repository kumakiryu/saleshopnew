import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE';

async function verifyAdmin(token: string): Promise<boolean> {
  if (!token) return false;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return false;
  const user = await userRes.json();
  if (!user?.id) return false;
  const adminRes = await fetch(`${SUPABASE_URL}/rest/v1/admins?id=eq.${user.id}&select=id&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  const rows = adminRes.ok ? await adminRes.json() : [];
  return Array.isArray(rows) && rows.length > 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const svcHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

  if (req.method === 'GET') {
    const activeOnly = req.query.active !== 'false';
    const filter = activeOnly ? '&active=eq.true' : '';
    const r = await fetch(`${SUPABASE_URL}/rest/v1/reward_products?order=token_cost.asc&select=*${filter}`, { headers: svcHeaders });
    const data = r.ok ? await r.json() : [];
    return res.status(200).json(data);
  }

  const adminToken = String(req.headers['x-admin-token'] ?? '');
  const isAdmin = await verifyAdmin(adminToken);
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

  if (req.method === 'POST') {
    const { name, description, image_url, token_cost, membership_type, stock } = req.body ?? {};
    if (!name || !token_cost || !membership_type) return res.status(400).json({ error: 'Missing required fields' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/reward_products`, {
      method: 'POST', headers: svcHeaders,
      body: JSON.stringify({ name, description: description ?? null, image_url: image_url ?? null, token_cost: Number(token_cost), membership_type, stock: stock ?? -1, active: true, created_at: new Date().toISOString() }),
    });
    const data = r.ok ? await r.json() : null;
    return res.status(r.ok ? 201 : 500).json(data ?? { error: 'Failed to create' });
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/reward_products?id=eq.${id}`, {
      method: 'PATCH', headers: svcHeaders, body: JSON.stringify(updates),
    });
    return res.status(r.ok ? 200 : 500).json(r.ok ? await r.json() : { error: 'Failed to update' });
  }

  if (req.method === 'DELETE') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id required' });
    await fetch(`${SUPABASE_URL}/rest/v1/reward_products?id=eq.${id}`, { method: 'DELETE', headers: svcHeaders });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
