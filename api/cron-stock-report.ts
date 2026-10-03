import type { VercelRequest, VercelResponse } from './_types';
import { sendHourlyStockReport } from './_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel cron jobs send a GET with Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.authorization ?? '';
  const cronSecret = process.env.CRON_SECRET ?? '';
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await sendHourlyStockReport();
    return res.status(200).json({ ok: true, sent: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'Failed' });
  }
}
