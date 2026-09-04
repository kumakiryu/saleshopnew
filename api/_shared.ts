// Server-side Supabase helper using plain fetch — no @supabase/supabase-js
// (avoids ESM/CJS issues in Vercel Node.js serverless)

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';

function getServiceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return key;
}

function serviceHeaders() {
  const key = getServiceKey();
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

async function dbGet<T>(table: string, filters: Record<string, unknown>, extra?: string): Promise<T | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) qs.append(k, `eq.${v}`);
  qs.set('select', '*');
  if (extra) extra.split('&').forEach(p => { const eq = p.indexOf('='); if (eq >= 0) qs.set(p.slice(0, eq), p.slice(eq + 1)); });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers: serviceHeaders() });
  if (!res.ok) return null;
  const rows = await res.json() as T[];
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function dbGetMany<T>(table: string, filters: Record<string, unknown>): Promise<T[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) qs.append(k, `eq.${v}`);
  qs.set('select', '*');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers: serviceHeaders() });
  if (!res.ok) return [];
  return (await res.json()) as T[];
}

async function dbGetSelect<T>(table: string, filters: Record<string, unknown>, select: string, extra?: string): Promise<T | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) qs.append(k, `eq.${v}`);
  qs.set('select', select);
  if (extra) extra.split('&').forEach(p => { const eq = p.indexOf('='); if (eq >= 0) qs.set(p.slice(0, eq), p.slice(eq + 1)); });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers: serviceHeaders() });
  if (!res.ok) return null;
  const rows = await res.json() as T[];
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function dbUpdate(table: string, filters: Record<string, unknown>, data: Record<string, unknown>): Promise<void> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) qs.append(k, `eq.${v}`);
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method: 'PATCH',
    headers: serviceHeaders(),
    body: JSON.stringify(data),
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
  download_url: string | null;
  assigned_code: string | null;
  assigned_username: string | null;
  assigned_password: string | null;
}

interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_discord: string | null;
  notes: string | null;
  total: number;
  status: string;
  created_at: string;
}

interface AssignedDelivery {
  productName: string;
  type: 'download' | 'code' | 'account';
  downloadUrl?: string;
  code?: string;
  username?: string;
  password?: string;
}

// ── Email builder ─────────────────────────────────────────────────────────────

function buildEmailHtml(order: Order, items: OrderItem[], deliveries: AssignedDelivery[]): string {
  const itemRows = items.map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #1a2040;color:#c8d0f0;font-size:14px;">${i.product_name}</td>
      <td style="padding:10px 0;border-bottom:1px solid #1a2040;color:#7b88c0;font-size:14px;text-align:center;">×${i.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #1a2040;color:#ffffff;font-size:14px;text-align:right;font-weight:700;">₱${(i.price * i.quantity).toLocaleString()}</td>
    </tr>`).join('');

  const deliveryBlocks = deliveries.map(d => {
    if (d.type === 'download') {
      return `
        <div style="margin-bottom:12px;padding:14px 18px;background:rgba(0,230,118,0.06);border:1px solid rgba(0,230,118,0.2);border-radius:10px;">
          <p style="margin:0 0 8px;color:#3a4570;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;">${d.productName}</p>
          <a href="${d.downloadUrl}" style="color:#00E676;font-size:13px;font-weight:600;text-decoration:none;">↓ Download your product</a>
        </div>`;
    }
    if (d.type === 'code') {
      return `
        <div style="margin-bottom:12px;padding:14px 18px;background:rgba(0,191,255,0.06);border:1px solid rgba(0,191,255,0.2);border-radius:10px;">
          <p style="margin:0 0 8px;color:#3a4570;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;">${d.productName} — Your Code</p>
          <p style="margin:0;font-family:monospace;font-size:16px;font-weight:800;color:#00BFFF;letter-spacing:0.1em;">${d.code}</p>
          <p style="margin:8px 0 0;color:#2e3a5a;font-size:11px;">Please keep this code secure.</p>
        </div>`;
    }
    if (d.type === 'account') {
      return `
        <div style="margin-bottom:12px;padding:14px 18px;background:rgba(138,43,226,0.06);border:1px solid rgba(138,43,226,0.2);border-radius:10px;">
          <p style="margin:0 0 10px;color:#3a4570;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;">${d.productName} — Account Details</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:3px 0;color:#7b88c0;font-size:12px;width:80px;">Username</td><td style="padding:3px 0;color:#c8d0f0;font-size:13px;font-weight:600;">${d.username}</td></tr>
            <tr><td style="padding:3px 0;color:#7b88c0;font-size:12px;">Password</td><td style="padding:3px 0;color:#c8d0f0;font-size:13px;font-weight:600;">${d.password}</td></tr>
          </table>
          <p style="margin:10px 0 0;color:#2e3a5a;font-size:11px;">Please store these details securely.</p>
        </div>`;
    }
    return '';
  }).join('');

  const hasDeliveries = deliveries.length > 0;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050816;font-family:'Inter',sans-serif;">
<div style="max-width:520px;margin:40px auto;padding:0 20px 60px;">
  <div style="padding:32px 0 24px;border-bottom:1px solid #1a2040;">
    <p style="margin:0;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#3a4570;">Sale Shop</p>
    <h1 style="margin:8px 0 0;font-size:24px;font-weight:800;color:#c8d0f0;letter-spacing:0.05em;">YOUR PURCHASE IS READY</h1>
  </div>
  <div style="padding:28px 0;">
    <p style="margin:0 0 10px;color:#7b88c0;font-size:15px;">Hello ${order.customer_name},</p>
    <p style="margin:0;color:#c8d0f0;font-size:15px;line-height:1.6;">
      ${hasDeliveries ? 'Your payment has been confirmed. Your purchase details are below.' : 'Your payment has been confirmed. Our team will be in touch shortly.'}
    </p>
  </div>
  ${hasDeliveries ? `
  <div style="margin-bottom:24px;">
    <p style="margin:0 0 12px;color:#3a4570;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Delivery</p>
    ${deliveryBlocks}
  </div>` : ''}
  <div style="padding:20px;background:rgba(255,255,255,0.03);border:1px solid #1a2040;border-radius:12px;margin-bottom:20px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:0 0 14px;color:#3a4570;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Order ID</td>
        <td style="padding:0 0 14px;color:#7b88c0;font-size:12px;font-family:monospace;text-align:right;">${order.id}</td>
      </tr>
    </table>
  </div>
  <div style="padding:20px;background:rgba(255,255,255,0.03);border:1px solid #1a2040;border-radius:12px;">
    <p style="margin:0 0 14px;color:#3a4570;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Items</p>
    <table style="width:100%;border-collapse:collapse;">
      ${itemRows}
      <tr>
        <td colspan="2" style="padding:14px 0 0;color:#3a4570;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Total Paid</td>
        <td style="padding:14px 0 0;color:#ffffff;font-size:18px;font-weight:800;text-align:right;">₱${Number(order.total).toLocaleString()}</td>
      </tr>
    </table>
  </div>
  <div style="margin-top:36px;padding-top:20px;border-top:1px solid #1a2040;">
    <p style="margin:0;color:#2e3a5a;font-size:12px;line-height:1.6;">Questions? Reach us on Discord. Keep this email as your receipt.</p>
  </div>
</div></body></html>`;
}

async function sendEmail(order: Order, items: OrderItem[], deliveries: AssignedDelivery[]) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const subject = `Your Purchase Is Ready — Order ${order.id.slice(0, 8).toUpperCase()}`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? 'orders@yourdomain.com',
      to: [order.customer_email],
      subject,
      html: buildEmailHtml(order, items, deliveries),
    }),
  });
}

// ── Shared auth helper ────────────────────────────────────────────────────────

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE';

export async function verifyAdminToken(token: string): Promise<{ ok: boolean; userId?: string; reason?: string }> {
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` },
  });
  if (!userRes.ok) return { ok: false, reason: 'Not authenticated' };
  const user = await userRes.json();
  if (!user?.id) return { ok: false, reason: 'Not authenticated' };

  const adminRes = await fetch(`${SUPABASE_URL}/rest/v1/admins?id=eq.${user.id}&select=id&limit=1`, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` },
  });
  if (!adminRes.ok) return { ok: false, reason: 'Admin check failed' };
  const rows = await adminRes.json();
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, reason: 'Not an admin' };
  return { ok: true, userId: user.id };
}

// ── Main fulfillment ──────────────────────────────────────────────────────────

export async function fulfillOrder(orderId: string): Promise<void> {
  console.log('[FULFILLMENT] Starting fulfillment for order', orderId);

  const order = await dbGet<Order>('orders', { id: orderId });
  if (!order) {
    console.error('[FULFILLMENT] FAILED — Order not found:', orderId);
    throw new Error(`Order not found: ${orderId}`);
  }
  console.log('[FULFILLMENT] Order found | status:', order.status);

  if (order.status === 'delivered') {
    console.log('[FULFILLMENT] Already delivered — skipping (idempotent)');
    return;
  }

  await dbUpdate('orders', { id: orderId }, { status: 'paid', updated_at: new Date().toISOString() });
  console.log('[FULFILLMENT] Order marked paid');

  const orderItems = await dbGetMany<OrderItem>('order_items', { order_id: orderId });
  console.log('[FULFILLMENT] Items to fulfill:', orderItems.length);
  const deliveries: AssignedDelivery[] = [];

  for (const item of orderItems) {
    if (!item.product_id) continue;

    const product = await dbGetSelect<{ product_type: string; stock: number; download_url: string | null }>(
      'products', { id: item.product_id }, 'product_type,stock,download_url'
    );
    if (!product) {
      console.warn('[FULFILLMENT] Product not found for item', item.id, '— skipping');
      continue;
    }

    const ptype = product.product_type ?? 'physical';
    console.log('[FULFILLMENT] Item:', item.product_name, '| type:', ptype);

    if (ptype === 'digital_code') {
      for (let q = 0; q < item.quantity; q++) {
        const code = await dbGet<{ id: string; code: string }>(
          'product_codes', { product_id: item.product_id, status: 'available' }, 'limit=1'
        );
        if (code) {
          console.log('[FULFILLMENT] Inventory item selected:', code.id);
          await dbUpdate('product_codes', { id: code.id }, {
            status: 'delivered',
            assigned_to: orderId,
            assigned_at: new Date().toISOString(),
          });
          if (q === 0) {
            await dbUpdate('order_items', { id: item.id }, { assigned_code: code.code });
          }
          deliveries.push({ productName: item.product_name, type: 'code', code: code.code });
        } else {
          console.warn('[FULFILLMENT] No available inventory for', item.product_name);
        }
      }
    } else if (ptype === 'account_product') {
      const account = await dbGet<{ id: string; username: string; password: string }>(
        'product_accounts', { product_id: item.product_id, status: 'available' }, 'limit=1'
      );
      if (account) {
        console.log('[FULFILLMENT] Account selected:', account.id);
        await dbUpdate('product_accounts', { id: account.id }, {
          status: 'delivered',
          assigned_order_id: orderId,
          assigned_email: order.customer_email,
          assigned_at: new Date().toISOString(),
        });
        await dbUpdate('order_items', { id: item.id }, {
          assigned_username: account.username,
          assigned_password: account.password,
        });
        deliveries.push({
          productName: item.product_name,
          type: 'account',
          username: account.username,
          password: account.password,
        });
      } else {
        console.warn('[FULFILLMENT] No available account inventory for', item.product_name);
        await dbUpdate('orders', { id: orderId }, {
          status: 'waiting_for_inventory',
          updated_at: new Date().toISOString(),
        });
        return;
      }
    } else if (ptype === 'digital_download' && (item.download_url || product.download_url)) {
      const url = item.download_url ?? product.download_url ?? '';
      deliveries.push({ productName: item.product_name, type: 'download', downloadUrl: url });
      console.log('[FULFILLMENT] Download URL attached for', item.product_name);
    } else {
      console.log('[FULFILLMENT] Product type', ptype, '— no automated delivery');
    }

    const newStock = Math.max(0, product.stock - item.quantity);
    await dbUpdate('products', { id: item.product_id }, { stock: newStock, updated_at: new Date().toISOString() });
  }

  await sendEmail(order, orderItems, deliveries).catch((e) => console.warn('[FULFILLMENT] Email error:', e));
  await dbUpdate('orders', { id: orderId }, { status: 'delivered', updated_at: new Date().toISOString() });
  console.log('[FULFILLMENT] Order marked completed');
  console.log('[FULFILLMENT] SUCCESS — order', orderId, '| deliveries:', deliveries.length);
}
