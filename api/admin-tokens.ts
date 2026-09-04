import type { VercelRequest, VercelResponse } from './_types';
import { verifyAdminToken } from './_shared';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = String(req.headers['x-admin-token'] ?? req.body?.token ?? '');
  const auth = await verifyAdminToken(token);
  if (!auth.ok) return res.status(403).json({ error: 'Forbidden' });

  const { action, target_user_id, token_type, amount } = req.body ?? {};
  if (!action || !target_user_id || !token_type) return res.status(400).json({ error: 'Missing fields' });
  if (!['add', 'remove', 'reset'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  if (!['vip', 'reseller'].includes(token_type)) return res.status(400).json({ error: 'Invalid token_type' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const svcHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
  const col = token_type === 'vip' ? 'vip_tokens' : 'reseller_tokens';

  const existing = await fetch(`${SUPABASE_URL}/rest/v1/user_tokens?user_id=eq.${target_user_id}&select=*&limit=1`, { headers: svcHeaders });
  const rows = existing.ok ? await existing.json() : [];
  const row = rows?.[0];

  let newVal: number;
  if (action === 'reset') {
    newVal = 0;
  } else {
    const current = row?.[col] ?? 0;
    const delta = Number(amount ?? 0);
    newVal = action === 'add' ? current + delta : Math.max(0, current - delta);
  }

  if (row) {
    await fetch(`${SUPABASE_URL}/rest/v1/user_tokens?user_id=eq.${target_user_id}`, {
      method: 'PATCH', headers: svcHeaders,
      body: JSON.stringify({ [col]: newVal, updated_at: new Date().toISOString() }),
    });
  } else {
    await fetch(`${SUPABASE_URL}/rest/v1/user_tokens`, {
      method: 'POST', headers: svcHeaders,
      body: JSON.stringify({ user_id: target_user_id, vip_tokens: 0, reseller_tokens: 0, [col]: newVal, updated_at: new Date().toISOString() }),
    });
  }

  await fetch(`${SUPABASE_URL}/rest/v1/token_transactions`, {
    method: 'POST', headers: { ...svcHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: target_user_id, transaction_type: 'adjust', amount: action === 'remove' ? -Number(amount ?? 0) : newVal, reason: `Admin ${action} — by ${auth.userId}`, created_at: new Date().toISOString() }),
  });

  return res.status(200).json({ ok: true, new_balance: newVal });
}
