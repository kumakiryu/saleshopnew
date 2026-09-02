import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fulfillOrder, verifyAdminToken } from './_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { orderId, token } = req.body as { orderId?: string; token?: string };
    if (!orderId || !token) {
      return res.status(400).json({ error: 'Missing orderId or token' });
    }

    const auth = await verifyAdminToken(token);
    if (!auth.ok) {
      return res.status(403).json({ error: auth.reason ?? 'Forbidden' });
    }

    await fulfillOrder(orderId);
    return res.status(200).json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin-fulfill] error:', message);
    return res.status(500).json({ error: message });
  }
}
