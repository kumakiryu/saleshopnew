import type { VercelRequest, VercelResponse } from './_types';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE';

async function verifyAdmin(token: string): Promise<boolean> {
  if (!token) return false;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return false;
  const user = await userRes.json() as any;
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

  // Admin: list codes for all rewards or a specific one
  if (req.method === 'GET' && req.query.codes === 'true') {
    const adminToken = String(req.headers['x-admin-token'] ?? '');
    if (!await verifyAdmin(adminToken)) return res.status(403).json({ error: 'Forbidden' });
    const rewardFilter = req.query.reward_id ? `&reward_id=eq.${req.query.reward_id}` : '';
    const r = await fetch(`${SUPABASE_URL}/rest/v1/reward_codes?order=created_at.asc&select=id,reward_id,code,redeemed_by,redeemed_at${rewardFilter}`, { headers: svcHeaders });
    return res.status(200).json(r.ok ? await r.json() : []);
  }

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
    const { action, name, description, image_url, delivery_content, token_cost, membership_type, stock, reward_id, codes } = req.body ?? {};
    // Bulk code import
    if (action === 'import-codes') {
      if (!reward_id || !Array.isArray(codes) || codes.length === 0)
        return res.status(400).json({ error: 'reward_id and codes required' });
      const rows = (codes as string[]).map(code => ({ reward_id, code: code.trim() }));
      const r = await fetch(`${SUPABASE_URL}/rest/v1/reward_codes`, {
        method: 'POST', headers: { ...svcHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(rows),
      });
      return res.status(r.ok ? 201 : 500).json(r.ok ? { imported: rows.length } : { error: 'Failed to import' });
    }
    if (!name || !token_cost || !membership_type) return res.status(400).json({ error: 'Missing required fields' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/reward_products`, {
      method: 'POST', headers: svcHeaders,
      body: JSON.stringify({ name, description: description ?? null, image_url: image_url ?? null, delivery_content: delivery_content ?? null, token_cost: Number(token_cost), membership_type, stock: stock ?? -1, active: true, created_at: new Date().toISOString() }),
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
