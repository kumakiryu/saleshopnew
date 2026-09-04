import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  const user = await userRes.json();
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const limit = Math.min(parseInt(String(req.query.limit ?? '20')), 100);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const svcHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  const txRes = await fetch(
    `${SUPABASE_URL}/rest/v1/token_transactions?user_id=eq.${user.id}&order=created_at.desc&limit=${limit}&select=*`,
    { headers: svcHeaders }
  );
  const txs = txRes.ok ? await txRes.json() : [];
  return res.status(200).json(txs);
}
