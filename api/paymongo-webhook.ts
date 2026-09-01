import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import { fulfillOrder } from './_shared';

/**
 * PayMongo sends a signature in the header:
 * paymongo-signature: t=<timestamp>,te=<test_hmac>,li=<live_hmac>
 * We verify the HMAC-SHA256 against our webhook secret.
 */
function verifyPayMongoSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  try {
    const parts = Object.fromEntries(
      signatureHeader.split(',').map(p => p.split('=') as [string, string])
    );
    const timestamp = parts['t'];
    const sig = parts['li'] ?? parts['te'];
    if (!timestamp || !sig) return false;

    const payload = `${timestamp}.${rawBody}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    return expected === sig;
  } catch {
    return false;
  }
}

export const config = { api: { bodyParser: false } };

async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

  if (webhookSecret) {
    const sig = req.headers['paymongo-signature'] as string;
    if (!sig || !verifyPayMongoSignature(rawBody, sig, webhookSecret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const type: string = event?.data?.attributes?.type ?? '';

  // payment.paid fires when a payment link is paid
  if (type === 'payment.paid') {
    const payment = event.data?.attributes?.data?.attributes;
    const orderId: string | undefined =
      payment?.description?.match(/[0-9a-f-]{36}/i)?.[0] ??
      event.data?.attributes?.data?.attributes?.remarks;

    if (orderId) {
      try {
        await fulfillOrder(orderId);
      } catch (err) {
        console.error('[paymongo-webhook] fulfillOrder failed:', err);
        return res.status(500).json({ error: String(err) });
      }
    }
  }

  return res.status(200).json({ received: true });
}
