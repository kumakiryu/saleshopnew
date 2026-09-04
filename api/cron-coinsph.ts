import type { VercelRequest, VercelResponse } from './_types';
import crypto from 'crypto';
import { fulfillOrder, verifyAdminToken } from './_shared';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';
const COINSPH_BASE = 'https://api.pro.coins.ph';

// ── Supabase REST helpers (service role) ─────────────────────────────────────

function svcKey() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return k;
}
function svcH() {
  const k = svcKey();
  return { 'apikey': k, 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
}

async function svcQuery<T>(table: string, filters: Record<string, unknown>, select: string, extra?: string): Promise<T[]> {
  const qs = new URLSearchParams({ select });
  for (const [k, v] of Object.entries(filters)) qs.append(k, `eq.${v}`);
  if (extra) qs.set('order', extra);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers: svcH() });
  if (!r.ok) return [];
  return r.json();
}

async function svcGetOne<T>(table: string, filters: Record<string, unknown>, select: string): Promise<T | null> {
  const rows = await svcQuery<T>(table, filters, select, undefined);
  return rows[0] ?? null;
}

async function svcInsert<T>(table: string, data: unknown): Promise<{ data: T | null; error: { message: string } | null }> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: svcH(),
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ message: `HTTP ${r.status}` }));
    return { data: null, error: err };
  }
  const rows = await r.json();
  return { data: Array.isArray(rows) ? (rows[0] ?? null) : rows, error: null };
}

// ── Coins.ph signed request ───────────────────────────────────────────────────

function buildSignedUrl(path: string, params: Record<string, string | number>, apiKey: string, secret: string) {
  const timestamp = Date.now();
  const allParams: Record<string, string> = { timestamp: String(timestamp) };
  for (const [k, v] of Object.entries(params)) allParams[k] = String(v);
  const qs = new URLSearchParams(allParams).toString();
  const sig = crypto.createHmac('sha256', secret).update(qs).digest('hex');
  return {
    url: `${COINSPH_BASE}${path}?${qs}&signature=${sig}`,
    headers: { 'X-COINS-APIKEY': apiKey },
  };
}

// ── Poller ───────────────────────────────────────────────────────────────────

async function pollCoinsph(): Promise<{ checked: number; processed: number; debug?: unknown }> {
  const apiKey = process.env.COINSPH_API_KEY;
  const apiSecret = process.env.COINSPH_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('COINSPH_API_KEY or COINSPH_API_SECRET not configured');

  const pendingOrders = await svcQuery<{ id: string; total: number; created_at: string }>(
    'orders',
    { status: 'pending', payment_method: 'coinsph' },
    'id,total,created_at',
    'created_at.asc',
  );

  if (pendingOrders.length === 0) return { checked: 0, processed: 0 };

  const startTime = Date.now() - 20 * 60 * 1000;
  const { url, headers } = buildSignedUrl('/openapi/fiat/v2/history', { startTime }, apiKey, apiSecret);
  const cpRes = await fetch(url, { headers });

  if (!cpRes.ok) {
    const txt = await cpRes.text();
    throw new Error(`Coins.ph API returned ${cpRes.status}: ${txt.slice(0, 200)}`);
  }

  const cpData = await cpRes.json();
  const deposits: Record<string, unknown>[] = Array.isArray(cpData)
    ? cpData
    : Array.isArray(cpData.data) ? cpData.data
    : Array.isArray(cpData.orders) ? cpData.orders
    : [];

  const succeeded = deposits.filter(d => {
    const currency = String(d.fiatCurrency ?? d.currency ?? d.fiat_currency ?? '');
    const status   = String(d.status ?? '');
    return currency === 'PHP' && /^(SUCCEEDED|SUCCESS|COMPLETED)$/i.test(status);
  });

  let processed = 0;

  for (const deposit of succeeded) {
    const txid = String(deposit.id ?? deposit.transactionId ?? deposit.orderId ?? deposit.txId ?? '');
    if (!txid) continue;

    const existing = await svcGetOne<{ txid: string }>('coinsph_processed', { txid }, 'txid');
    if (existing) continue;

    const amount = parseFloat(String(deposit.fiatAmount ?? deposit.amount ?? 0));
    const reference = String(
      deposit.narration ?? deposit.remarks ?? deposit.description ??
      deposit.reference ?? deposit.note ?? deposit.memo ?? ''
    ).toLowerCase();

    let matchedOrder = pendingOrders.find(o => reference.includes(o.id.slice(0, 8).toLowerCase()));
    if (!matchedOrder) matchedOrder = pendingOrders.find(o => Math.abs(Number(o.total) - amount) < 0.01);
    if (!matchedOrder) continue;

    const { error: insertErr } = await svcInsert('coinsph_processed', { txid, order_id: matchedOrder.id, amount });
    if (insertErr) {
      console.warn('[cron-coinsph] insert conflict for txid', txid, insertErr.message);
      continue;
    }

    try {
      await fulfillOrder(matchedOrder.id);
      processed++;
    } catch (err) {
      console.error(`[cron-coinsph] fulfillOrder error for ${matchedOrder.id}:`, err);
    }
  }

  return { checked: succeeded.length, processed, debug: { rawShape: Object.keys(cpData ?? {}), depositCount: deposits.length } };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const isCronCall = req.method === 'GET' && cronSecret && req.headers.authorization === `Bearer ${cronSecret}`;
  const isAdminCall = req.method === 'POST' && req.body?.token;

  if (!isCronCall && !isAdminCall) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (isAdminCall) {
    try {
      const auth = await verifyAdminToken(req.body.token);
      if (!auth.ok) return res.status(403).json({ error: auth.reason ?? 'Forbidden' });
    } catch (e) {
      return res.status(500).json({ error: 'Auth check failed' });
    }
  }

  try {
    const result = await pollCoinsph();
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cron-coinsph]', message);
    return res.status(500).json({ error: message });
  }
}
