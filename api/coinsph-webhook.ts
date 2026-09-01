import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fulfillOrder } from './_shared';

/**
 * POST /api/coinsph-webhook
 * Coins.ph sends Authorization: Token <merchant_token> for verification.
 * Event handled: invoice.fully_paid
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // ── Verify token ─────────────────────────────────────────────────
  const token = process.env.COINSPH_MERCHANT_TOKEN;
  if (!token) return res.status(500).json({ error: 'COINSPH_MERCHANT_TOKEN not configured' });

  const authHeader = req.headers['authorization'] ?? '';
  const expectedAuth = `Token ${token}`;

  if (authHeader !== expectedAuth) {
    console.warn('[coinsph-webhook] Invalid authorization header');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── Parse body ───────────────────────────────────────────────────
  const body = req.body as {
    event?: {
      name?: string;
      data?: {
        id?: string;
        external_transaction_id?: string;
        amount?: string;
        currency?: string;
      };
    };
  };

  const eventName = body?.event?.name;
  const eventData = body?.event?.data;

  // Only process fully_paid events
  if (eventName !== 'invoice.fully_paid') {
    return res.status(200).json({ received: true, skipped: true });
  }

  const orderId = eventData?.external_transaction_id;
  if (!orderId) {
    console.warn('[coinsph-webhook] No external_transaction_id in payload');
    return res.status(400).json({ error: 'Missing external_transaction_id' });
  }

  console.log(`[coinsph-webhook] Fulfilling order ${orderId} (invoice: ${eventData?.id})`);

  try {
    await fulfillOrder(orderId);
    return res.status(200).json({ success: true, orderId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[coinsph-webhook] fulfillOrder error:', message);
    return res.status(500).json({ error: message });
  }
}
