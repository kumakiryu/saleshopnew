import type { VercelRequest, VercelResponse } from './_types';
import { sendHourlyStockReport, verifyAdminToken } from './_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = String(req.headers.authorization ?? '');
  const cronSecret = process.env.CRON_SECRET ?? '';

  // Allow Vercel cron (Bearer CRON_SECRET) OR an authenticated admin (Bearer <jwt>)
  const isCron = cronSecret ? authHeader === `Bearer ${cronSecret}` : false;
  let isAdmin = false;
  if (!isCron && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const check = await verifyAdminToken(token).catch(() => ({ ok: false }));
    isAdmin = check.ok;
  }

  if (!isCron && !isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await sendHourlyStockReport();
    return res.status(200).json({ ok: true, sent: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'Failed' });
  }
}
