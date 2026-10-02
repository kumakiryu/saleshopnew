import type { VercelRequest, VercelResponse } from './_types';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Unauthorized' });
  const user = await userRes.json() as any;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const svcHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

  const tokensRes = await fetch(`${SUPABASE_URL}/rest/v1/user_tokens?user_id=eq.${user.id}&select=*&limit=1`, { headers: svcHeaders });
  const rows: { vip_tokens?: number; reseller_tokens?: number }[] = tokensRes.ok
    ? ((await tokensRes.json()) as { vip_tokens?: number; reseller_tokens?: number }[])
    : [];
  const row = rows?.[0] ?? { vip_tokens: 0, reseller_tokens: 0 };

  const earnRes = await fetch(`${SUPABASE_URL}/rest/v1/token_transactions?user_id=eq.${user.id}&transaction_type=eq.earn&select=amount`, { headers: svcHeaders });
  const earnRows: { amount: number }[] = earnRes.ok
    ? ((await earnRes.json()) as { amount: number }[])
    : [];
  const lifetime_earned = earnRows.reduce((s: number, r: { amount: number }) => s + (r.amount ?? 0), 0);

  const spendRes = await fetch(`${SUPABASE_URL}/rest/v1/token_transactions?user_id=eq.${user.id}&transaction_type=eq.spend&select=amount`, { headers: svcHeaders });
  const spendRows: { amount: number }[] = spendRes.ok
    ? ((await spendRes.json()) as { amount: number }[])
    : [];
  const lifetime_spent = spendRows.reduce((s: number, r: { amount: number }) => s + (r.amount ?? 0), 0);

  const cfgRes = await fetch(
    `${SUPABASE_URL}/rest/v1/site_config?key=in.(bg_music_url,music_name,music_artist,music_youtube_url)&select=key,value`,
    { headers: svcHeaders }
  );
  const cfgRows: { key: string; value: unknown }[] = cfgRes.ok ? await cfgRes.json() : [];
  const cfg: Record<string, string> = {};
  for (const r of cfgRows) { if (typeof r.value === 'string') cfg[r.key] = r.value; }

  return res.status(200).json({
    vip_tokens: row.vip_tokens ?? 0,
    reseller_tokens: row.reseller_tokens ?? 0,
    lifetime_earned,
    lifetime_spent,
    bg_music_url: cfg.bg_music_url ?? '',
    music_name: cfg.music_name ?? '',
    music_artist: cfg.music_artist ?? '',
    music_youtube_url: cfg.music_youtube_url ?? '',
  });
}
