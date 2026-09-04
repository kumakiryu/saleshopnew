import type { VercelRequest, VercelResponse } from './_types';
import { createHmac, timingSafeEqual } from 'crypto';
import { fulfillOrder } from './_shared';

export const config = { api: { bodyParser: false } };

async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      if (chunks.length > 0) resolve(Buffer.concat(chunks).toString('utf8'));
      else if (req.body != null) resolve(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      else resolve('');
    });
    req.on('error', reject);
  });
}

// ── PayMongo ──────────────────────────────────────────────────────────────────

function verifyPayMongoSig(rawBody: string, sigHeader: string, secret: string): boolean {
  try {
    const parts: Record<string, string> = {};
    for (const part of sigHeader.split(',')) {
      const i = part.indexOf('=');
      if (i > 0) parts[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    const timestamp = parts['t'];
    if (!timestamp) return false;
    const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    return (!!parts['li'] && expected === parts['li']) || (!!parts['te'] && expected === parts['te']);
  } catch { return false; }
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extractOrderId(event: any): string | undefined {
  const dataAttrs = event?.data?.attributes?.data?.attributes ?? {};
  if (dataAttrs.remarks && UUID_RE.test(dataAttrs.remarks)) return dataAttrs.remarks.match(UUID_RE)![0];
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

async function handlePaymongo(req: VercelRequest, res: VercelResponse, rawBody: string) {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (webhookSecret) {
    const sig = req.headers['paymongo-signature'] as string;
    if (!sig) return res.status(401).json({ error: 'Missing signature' });
    if (!verifyPayMongoSig(rawBody, sig, webhookSecret)) {
      console.warn('[webhook/paymongo] sig mismatch — proceeding anyway');
    }
  }
  let event: any;
  if (req.body && typeof req.body === 'object') event = req.body;
  else { try { event = JSON.parse(rawBody); } catch { return res.status(400).json({ error: 'Invalid JSON' }); } }
  const type: string = event?.data?.attributes?.type ?? '';
  if (type === 'payment.paid' || type === 'link.payment.paid') {
    const orderId = extractOrderId(event);
    if (orderId) {
      try { await fulfillOrder(orderId); }
      catch (err) { return res.status(200).json({ received: true, fulfillError: String(err) }); }
    }
  }
  return res.status(200).json({ received: true });
}

// ── Coinbase Commerce ─────────────────────────────────────────────────────────

function verifyCoinbaseSig(rawBody: string, sigHeader: string, secret: string): boolean {
  try {
    const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(sigHeader, 'hex');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch { return false; }
}

async function handleCoinbase(req: VercelRequest, res: VercelResponse, rawBody: string) {
  const webhookSecret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const sig = req.headers['x-cc-webhook-signature'] as string;
    if (!sig || !verifyCoinbaseSig(rawBody, sig, webhookSecret)) return res.status(401).json({ error: 'Invalid signature' });
  }
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  const type: string = event?.event?.type ?? '';
  if (type === 'charge:confirmed' || type === 'charge:resolved') {
    const orderId: string | undefined = event?.event?.data?.metadata?.order_id;
    if (orderId) {
      try { await fulfillOrder(orderId); }
      catch (err) { return res.status(500).json({ error: String(err) }); }
    }
  }
  return res.status(200).json({ received: true });
}

// ── Coins.ph ──────────────────────────────────────────────────────────────────

async function handleCoinsph(req: VercelRequest, res: VercelResponse, rawBody: string) {
  const token = process.env.COINSPH_MERCHANT_TOKEN;
  if (!token) return res.status(500).json({ error: 'COINSPH_MERCHANT_TOKEN not configured' });
  if (req.headers['authorization'] !== `Token ${token}`) return res.status(401).json({ error: 'Unauthorized' });
  let body: any;
  try { body = (req.body && typeof req.body === 'object') ? req.body : JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  const eventName = body?.event?.name;
  const eventData = body?.event?.data;
  if (eventName !== 'invoice.fully_paid') return res.status(200).json({ received: true, skipped: true });
  const orderId = eventData?.external_transaction_id;
  if (!orderId) return res.status(400).json({ error: 'Missing external_transaction_id' });
  try {
    await fulfillOrder(orderId);
    return res.status(200).json({ success: true, orderId });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const provider = String(req.query.p ?? '');
  const rawBody = await getRawBody(req);
  switch (provider) {
    case 'paymongo': return handlePaymongo(req, res, rawBody);
    case 'coinbase': return handleCoinbase(req, res, rawBody);
    case 'coinsph': return handleCoinsph(req, res, rawBody);
    default: return res.status(400).json({ error: 'Unknown provider' });
  }
}
