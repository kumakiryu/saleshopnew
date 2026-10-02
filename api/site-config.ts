import type { VercelRequest, VercelResponse } from './_types';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';

const DEFAULTS: Record<string, unknown> = {
  topup_pkg_500: { price: 500, tokens: 500 },
  topup_pkg_1000: { price: 1000, tokens: 1000 },
  bg_music_url: '',
  music_name: '',
  music_artist: '',
  music_youtube_url: '',
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
