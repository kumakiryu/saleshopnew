import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import { fulfillOrder } from './_shared';

function verifyPayMongoSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  try {
    console.log('[paymongo-webhook] sig header:', signatureHeader?.slice(0, 100));
    const parts: Record<string, string> = {};
    for (const part of signatureHeader.split(',')) {
      const i = part.indexOf('=');
      if (i > 0) parts[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    const timestamp = parts['t'];
    if (!timestamp) return false;
    const payload = `${timestamp}.${rawBody}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    // Check both li (live) and te (test) — whichever the secret matches
    const ok = (!!parts['li'] && expected === parts['li']) || (!!parts['te'] && expected === parts['te']);
    if (!ok) console.error('[paymongo-webhook] sig mismatch. keys present:', Object.keys(parts).join(','));
    return ok;
  } catch (e) {
    console.error('[paymongo-webhook] sig error:', e);
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

function extractOrderId(event: any): string | undefined {
  const attrs = event?.data?.attributes?.data?.attributes ?? {};

  // remarks is set to the full orderId when we create the payment link
  if (attrs.remarks && /^[0-9a-f-]{36}$/i.test(attrs.remarks)) {
    return attrs.remarks;
  }

  // fallback: scan description for a UUID
  const desc: string = attrs.description ?? '';
  const match = desc.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (match) return match[0];

  return undefined;
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
  try { event = JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const type: string = event?.data?.attributes?.type ?? '';
  console.log('[paymongo-webhook] event type:', type);

  // payment.paid   → direct payment (Payment Intent flow)
  // link.payment.paid → payment via a Payment Link (what we use)
  if (type === 'payment.paid' || type === 'link.payment.paid') {
    const orderId = extractOrderId(event);
    console.log('[paymongo-webhook] orderId:', orderId);

    if (orderId) {
      try {
        await fulfillOrder(orderId);
      } catch (err) {
        console.error('[paymongo-webhook] fulfillOrder failed:', err);
        return res.status(500).json({ error: String(err) });
      }
    } else {
      console.warn('[paymongo-webhook] could not extract orderId from event');
    }
  }

  return res.status(200).json({ received: true });
}
