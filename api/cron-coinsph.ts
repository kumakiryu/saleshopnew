import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { fulfillOrder, getAdminSupabase } from './_shared';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE';
const COINSPH_BASE = 'https://api.pro.coins.ph';

function buildSignedUrl(path: string, params: Record<string, string | number>, apiKey: string, secret: string): { url: string; headers: Record<string, string> } {
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

async function pollCoinsph(): Promise<{ checked: number; processed: number; debug?: unknown }> {
  const apiKey = process.env.COINSPH_API_KEY;
  const apiSecret = process.env.COINSPH_API_SECRET;

  if (!apiKey || !apiSecret) throw new Error('COINSPH_API_KEY or COINSPH_API_SECRET not configured');

  const supabase = getAdminSupabase();

  // Get pending coinsph orders, oldest first
  const { data: pendingOrders } = await supabase
    .from('orders')
    .select('id, total, created_at')
    .eq('status', 'pending')
    .eq('payment_method', 'coinsph')
    .order('created_at', { ascending: true });

  if (!pendingOrders || pendingOrders.length === 0) {
    return { checked: 0, processed: 0 };
  }

  // Fetch last 20 minutes of fiat deposit history
  const startTime = Date.now() - 20 * 60 * 1000;
  const { url, headers } = buildSignedUrl('/openapi/fiat/v2/history', { startTime }, apiKey, apiSecret);

  const cpRes = await fetch(url, { headers });

  if (!cpRes.ok) {
    const txt = await cpRes.text();
    console.error('[cron-coinsph] Coins.ph API error:', cpRes.status, txt);
    throw new Error(`Coins.ph API returned ${cpRes.status}: ${txt.slice(0, 200)}`);
  }

  const cpData = await cpRes.json();

  // Handle different response envelope shapes
  const deposits: Record<string, unknown>[] = Array.isArray(cpData)
    ? cpData
    : Array.isArray(cpData.data) ? cpData.data
    : Array.isArray(cpData.orders) ? cpData.orders
    : [];

  // Filter for successful PHP deposits
  const succeeded = deposits.filter(d => {
    const currency = String(d.fiatCurrency ?? d.currency ?? d.fiat_currency ?? '');
    const status   = String(d.status ?? '');
    return currency === 'PHP' && /^(SUCCEEDED|SUCCESS|COMPLETED)$/i.test(status);
  });

  let processed = 0;

  for (const deposit of succeeded) {
    const txid = String(
      deposit.id ?? deposit.transactionId ?? deposit.orderId ?? deposit.txId ?? ''
    );
    if (!txid) continue;

    // Skip already-processed transactions
    const { data: existing } = await supabase
      .from('coinsph_processed')
      .select('txid')
      .eq('txid', txid)
      .maybeSingle();

    if (existing) continue;

    const amount = parseFloat(String(deposit.fiatAmount ?? deposit.amount ?? 0));
    const reference = String(
      deposit.narration ?? deposit.remarks ?? deposit.description ??
      deposit.reference ?? deposit.note ?? deposit.memo ?? ''
    ).toLowerCase();

    // 1st priority: match by Order ID short code in the reference/narration
    let matchedOrder = pendingOrders.find(o =>
      reference.includes(o.id.slice(0, 8).toLowerCase())
    );

    // 2nd priority: match by exact amount (oldest order first)
    if (!matchedOrder) {
      matchedOrder = pendingOrders.find(o => Math.abs(Number(o.total) - amount) < 0.01);
    }

    if (!matchedOrder) continue;

    // Record the transaction so it is never processed twice
    const { error: insertErr } = await supabase.from('coinsph_processed').insert({
      txid,
      order_id: matchedOrder.id,
      amount,
    });

    if (insertErr) {
      // Likely a race condition duplicate — skip
      console.warn('[cron-coinsph] insert conflict for txid', txid, insertErr.message);
      continue;
    }

    try {
      await fulfillOrder(matchedOrder.id);
      processed++;
      console.log(`[cron-coinsph] fulfilled order ${matchedOrder.id} via txid ${txid}`);
    } catch (err) {
      console.error(`[cron-coinsph] fulfillOrder error for ${matchedOrder.id}:`, err);
    }
  }

  return { checked: succeeded.length, processed, debug: { rawShape: Object.keys(cpData ?? {}), depositCount: deposits.length } };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;

  // Accept calls from:
  // 1. Vercel cron scheduler (GET with Authorization: Bearer <CRON_SECRET>)
  // 2. Admin dashboard (POST with { token: <adminJwt> })
  const isCronCall = req.method === 'GET' &&
    cronSecret &&
    req.headers.authorization === `Bearer ${cronSecret}`;

  const isAdminCall = req.method === 'POST' && req.body?.token;

  if (!isCronCall && !isAdminCall) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // For admin calls, verify the caller is actually an admin
  if (isAdminCall) {
    const { token } = req.body as { token: string };
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return res.status(401).json({ error: 'Not authenticated' });

    const { data: admin } = await userClient.from('admins').select('id').eq('id', user.id).single();
    if (!admin) return res.status(403).json({ error: 'Not an admin' });
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
