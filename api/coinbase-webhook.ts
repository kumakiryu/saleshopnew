import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';
import { fulfillOrder } from './_shared';

function verifySignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  try {
    const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(signatureHeader, 'hex');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
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
  const webhookSecret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;

  if (webhookSecret) {
    const sig = req.headers['x-cc-webhook-signature'] as string;
    if (!sig || !verifySignature(rawBody, sig, webhookSecret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const type: string = event?.event?.type ?? '';

  // charge:confirmed = payment received and confirmed on-chain
  // charge:resolved  = manually resolved by merchant (treat as paid too)
  if (type === 'charge:confirmed' || type === 'charge:resolved') {
    const orderId: string | undefined = event?.event?.data?.metadata?.order_id;

    if (orderId) {
      try {
        await fulfillOrder(orderId);
      } catch (err) {
        console.error('[coinbase-webhook] fulfillOrder failed:', err);
        return res.status(500).json({ error: String(err) });
      }
    }
  }

  return res.status(200).json({ received: true });
}
