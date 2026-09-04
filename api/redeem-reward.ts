import type { VercelRequest, VercelResponse } from './_types';
import { verifyCustomerToken } from './_shared';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  const auth = await verifyCustomerToken(token);
  if (!auth.ok || !auth.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { reward_id } = req.body ?? {};
  if (!reward_id) return res.status(400).json({ error: 'reward_id required' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const svcHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
  const svcMin = { ...svcHeaders, Prefer: 'return=minimal' };

  const [rewardRes, membershipRes, tokensRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/reward_products?id=eq.${reward_id}&select=*&limit=1`, { headers: svcHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/user_memberships?user_id=eq.${auth.userId}&select=tier&limit=1`, { headers: svcHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/user_tokens?user_id=eq.${auth.userId}&select=*&limit=1`, { headers: svcHeaders }),
  ]);

  const reward = rewardRes.ok ? ((await rewardRes.json() as any[]))?.[0] : null;
  if (!reward || !reward.active) return res.status(404).json({ error: 'Reward not found or inactive' });

  const tier = membershipRes.ok ? ((await membershipRes.json() as any[]))?.[0]?.tier ?? 'normal' : 'normal';
  if (tier === 'normal') return res.status(403).json({ error: 'Members only' });
  if (reward.membership_type !== 'both' && reward.membership_type !== tier)
    return res.status(403).json({ error: `This reward is for ${reward.membership_type} members only` });

  const tokensRow = tokensRes.ok ? ((await tokensRes.json() as any[]))?.[0] : null;
  const col = tier === 'vip' ? 'vip_tokens' : 'reseller_tokens';
  const balance = tokensRow?.[col] ?? 0;
  if (balance < reward.token_cost)
    return res.status(400).json({ error: `Insufficient tokens. Need ${reward.token_cost}, have ${balance}` });

  // Check code pool
  const [availRes, anyRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/reward_codes?reward_id=eq.${reward_id}&redeemed_by=is.null&order=created_at.asc&limit=1&select=id,code`, { headers: svcHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/reward_codes?reward_id=eq.${reward_id}&select=id&limit=1`, { headers: svcHeaders }),
  ]);
  const availCodes = availRes.ok ? (await availRes.json() as any[]) : [];
  const anyCodes = anyRes.ok ? (await anyRes.json() as any[]) : [];
  const hasCodePool = anyCodes.length > 0;
  const codeEntry = availCodes[0];

  if (hasCodePool && !codeEntry) return res.status(400).json({ error: 'All codes have been redeemed — out of stock.' });
  if (!hasCodePool && reward.stock === 0) return res.status(400).json({ error: 'Out of stock' });

  // Deduct tokens
  const newBalance = balance - reward.token_cost;
  await fetch(`${SUPABASE_URL}/rest/v1/user_tokens?user_id=eq.${auth.userId}`, {
    method: 'PATCH', headers: svcHeaders,
    body: JSON.stringify({ [col]: newBalance, updated_at: new Date().toISOString() }),
  });

  // Determine delivery
  let deliveryContent: string | null = null;
  if (codeEntry) {
    // Claim code from pool
    await fetch(`${SUPABASE_URL}/rest/v1/reward_codes?id=eq.${codeEntry.id}`, {
      method: 'PATCH', headers: svcMin,
      body: JSON.stringify({ redeemed_by: auth.userId, redeemed_at: new Date().toISOString() }),
    });
    deliveryContent = codeEntry.code;
  } else {
    // No code pool — use delivery_content and decrement stock
    deliveryContent = reward.delivery_content ?? null;
    if (reward.stock > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/reward_products?id=eq.${reward_id}`, {
        method: 'PATCH', headers: svcMin,
        body: JSON.stringify({ stock: reward.stock - 1 }),
      });
    }
  }

  // Get user email for log
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  const userEmail = userRes.ok ? ((await userRes.json() as any)?.email ?? null) : null;

  // Write redemption log + token transaction in parallel
  await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/reward_redemptions`, {
      method: 'POST', headers: svcMin,
      body: JSON.stringify({ reward_id, reward_name: reward.name, user_id: auth.userId, user_email: userEmail, tokens_spent: reward.token_cost, code_delivered: deliveryContent }),
    }),
    fetch(`${SUPABASE_URL}/rest/v1/token_transactions`, {
      method: 'POST', headers: svcMin,
      body: JSON.stringify({ user_id: auth.userId, transaction_type: 'spend', amount: reward.token_cost, reason: `Redeemed: ${reward.name}`, created_at: new Date().toISOString() }),
    }),
  ]);

  return res.status(200).json({ ok: true, reward_name: reward.name, tokens_spent: reward.token_cost, new_balance: newBalance, delivery_content: deliveryContent });
}
