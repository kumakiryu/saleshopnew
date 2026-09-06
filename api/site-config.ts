import type { VercelRequest, VercelResponse } from './_types';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';

const DEFAULTS: Record<string, unknown> = {
  topup_packages: [
    { id: 'starter', label: 'Starter', tokens: 50, price: 50, highlight: false },
    { id: 'popular', label: 'Popular', tokens: 100, price: 95, highlight: true },
    { id: 'pro', label: 'Pro', tokens: 250, price: 225, highlight: false },
    { id: 'elite', label: 'Elite', tokens: 500, price: 420, highlight: false },
  ],
  topup_custom_rate: 1,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const key = String(req.query.key ?? '');
  if (!key) return res.status(400).json({ error: 'key required' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const svcHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/site_config?key=eq.${encodeURIComponent(key)}&select=value&limit=1`, { headers: svcHeaders });
    if (r.ok) {
      const rows = await r.json() as any[];
      if (rows?.[0]?.value !== undefined) return res.status(200).json(rows[0].value);
    }
  } catch { /* fall through to default */ }

  if (key in DEFAULTS) return res.status(200).json(DEFAULTS[key]);
  return res.status(404).json({ error: 'Not found' });
}
