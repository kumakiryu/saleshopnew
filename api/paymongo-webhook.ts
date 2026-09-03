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

async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      if (chunks.length > 0) {
        const raw = Buffer.concat(chunks).toString('utf8');
        console.log('[paymongo-webhook] rawBody from stream, length:', raw.length);
        resolve(raw);
      } else if (req.body != null) {
        // Vercel already parsed the body — re-serialize to get back raw JSON
        const fallback = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        console.log('[paymongo-webhook] rawBody from req.body fallback, length:', fallback.length);
        resolve(fallback);
      } else {
        console.warn('[paymongo-webhook] rawBody is empty — sig check will fail');
        resolve('');
      }
    });
    req.on('error', reject);
  });
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extractOrderId(event: any): string | undefined {
  // Primary: remarks field on the link/payment object
  const dataAttrs = event?.data?.attributes?.data?.attributes ?? {};
  if (dataAttrs.remarks && UUID_RE.test(dataAttrs.remarks)) return dataAttrs.remarks.match(UUID_RE)![0];

  // Fallback: scan entire event payload recursively for any UUID
  function scan(obj: any, depth = 0): string | undefined {
    if (depth > 6 || !obj || typeof obj !== 'object') return undefined;
    for (const val of Object.values(obj)) {
      if (typeof val === 'string') { const m = val.match(UUID_RE); if (m) return m[0]; }
      else if (typeof val === 'object') { const found = scan(val, depth + 1); if (found) return found; }
    }
    return undefined;
  }
  return scan(event?.data?.attributes);
}

// Tell Vercel not to pre-parse the body so we can read raw bytes for HMAC
export const config = { api: { bodyParser: false } };

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
        console.log('[paymongo-webhook] fulfillOrder succeeded for', orderId);
      } catch (err) {
        console.error('[paymongo-webhook] fulfillOrder failed:', String(err));
        // Return 200 so PayMongo stops retrying — admin can fulfill manually
        return res.status(200).json({ received: true, fulfillError: String(err) });
      }
    } else {
      console.warn('[paymongo-webhook] could not extract orderId from event');
    }
  }

  return res.status(200).json({ received: true });
}
