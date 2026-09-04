import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCustomerToken } from './_shared';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  const auth = await verifyCustomerToken(token);
  if (!auth.ok || !auth.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { reward_id } = req.body ?? {};
  if (!reward_id) return res.status(400).json({ error: 'reward_id required' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const svcHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

  const [rewardRes, membershipRes, tokensRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/reward_products?id=eq.${reward_id}&select=*&limit=1`, { headers: svcHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/user_memberships?user_id=eq.${auth.userId}&select=tier&limit=1`, { headers: svcHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/user_tokens?user_id=eq.${auth.userId}&select=*&limit=1`, { headers: svcHeaders }),
  ]);

  const reward = rewardRes.ok ? (await rewardRes.json())?.[0] : null;
  if (!reward || !reward.active) return res.status(404).json({ error: 'Reward not found or inactive' });
  if (reward.stock === 0) return res.status(400).json({ error: 'Out of stock' });

  const tier = membershipRes.ok ? (await membershipRes.json())?.[0]?.tier ?? 'normal' : 'normal';
  if (tier === 'normal') return res.status(403).json({ error: 'Members only' });
  if (reward.membership_type !== 'both' && reward.membership_type !== tier) return res.status(403).json({ error: `This reward is for ${reward.membership_type} members only` });

  const tokensRow = tokensRes.ok ? (await tokensRes.json())?.[0] : null;
  const col = tier === 'vip' ? 'vip_tokens' : 'reseller_tokens';
  const balance = tokensRow?.[col] ?? 0;
  if (balance < reward.token_cost) return res.status(400).json({ error: `Insufficient tokens. Need ${reward.token_cost}, have ${balance}` });

  const newBalance = balance - reward.token_cost;
  await fetch(`${SUPABASE_URL}/rest/v1/user_tokens?user_id=eq.${auth.userId}`, {
    method: 'PATCH', headers: svcHeaders,
    body: JSON.stringify({ [col]: newBalance, updated_at: new Date().toISOString() }),
  });

  if (reward.stock > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/reward_products?id=eq.${reward_id}`, {
      method: 'PATCH', headers: svcHeaders,
      body: JSON.stringify({ stock: reward.stock - 1 }),
    });
  }

  await fetch(`${SUPABASE_URL}/rest/v1/token_transactions`, {
    method: 'POST', headers: { ...svcHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: auth.userId, transaction_type: 'spend', amount: reward.token_cost, reason: `Redeemed: ${reward.name}`, created_at: new Date().toISOString() }),
  });

  return res.status(200).json({ ok: true, reward_name: reward.name, tokens_spent: reward.token_cost, new_balance: newBalance });
}
