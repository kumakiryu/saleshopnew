import type { VercelRequest, VercelResponse } from './_types';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const type = req.query.type === 'reseller' ? 'reseller' : 'vip';
  const col = type === 'vip' ? 'vip_tokens' : 'reseller_tokens';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const svcHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  const tokensRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_tokens?${col}=gt.0&order=${col}.desc&limit=10&select=user_id,${col}`,
    { headers: svcHeaders }
  );
  if (!tokensRes.ok) return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  const rows: { user_id: string; [k: string]: number | string }[] = await tokensRes.json();

  const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const usersData = usersRes.ok ? await usersRes.json() : { users: [] };
  const emailMap: Record<string, string> = {};
  for (const u of usersData.users ?? []) emailMap[u.id] = u.email ?? u.id;

  const entries = rows.map((r, i) => ({
    rank: i + 1,
    user_id: r.user_id,
    email: emailMap[r.user_id] ?? r.user_id,
    tokens: r[col] as number,
    token_type: type,
  }));

  return res.status(200).json(entries);
}
