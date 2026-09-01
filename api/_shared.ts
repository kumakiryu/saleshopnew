import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';

export function getAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

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

/**
 * Called by webhook handlers when payment is confirmed.
 * 1. Marks order paid
 * 2. For each item: assigns code or account (based on product_type), deducts stock
 * 3. Sends delivery email with all assigned items
 * 4. Auto-marks delivered when all items are fulfilled
 */
export async function fulfillOrder(orderId: string): Promise<void> {
  const supabase = getAdminSupabase();

  const { data: order, error: oErr } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (oErr || !order) throw new Error(`Order not found: ${orderId}`);

  // Idempotency — skip if already fulfilled
  if (order.status === 'delivered' || order.status === 'paid') return;

  // Mark paid immediately to prevent duplicate processing
  await supabase.from('orders').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', orderId);

  const { data: rawItems } = await supabase.from('order_items').select('*').eq('order_id', orderId);
  const orderItems: OrderItem[] = rawItems ?? [];

  const deliveries: AssignedDelivery[] = [];

  for (const item of orderItems) {
    if (!item.product_id) continue;

    // Get product type
    const { data: product } = await supabase
      .from('products')
      .select('product_type, stock, download_url')
      .eq('id', item.product_id)
      .single();

    if (!product) continue;

    const ptype = product.product_type ?? 'physical';

    if (ptype === 'digital_code') {
      // Assign one code per quantity
      for (let q = 0; q < item.quantity; q++) {
        const { data: code } = await supabase
          .from('product_codes')
          .select('*')
          .eq('product_id', item.product_id)
          .eq('status', 'available')
          .limit(1)
          .single();

        if (code) {
          await supabase.from('product_codes').update({
            status: 'delivered',
            assigned_to: orderId,
            assigned_at: new Date().toISOString(),
          }).eq('id', code.id);

          // Store first code in order_item (subsequent codes sent via email)
          if (q === 0) {
            await supabase.from('order_items').update({ assigned_code: code.code }).eq('id', item.id);
          }

          deliveries.push({ productName: item.product_name, type: 'code', code: code.code });
        }
      }
    } else if (ptype === 'account_product') {
      const { data: account } = await supabase
        .from('product_accounts')
        .select('*')
        .eq('product_id', item.product_id)
        .eq('status', 'available')
        .limit(1)
        .single();

      if (account) {
        await supabase.from('product_accounts').update({
          status: 'delivered',
          assigned_order_id: orderId,
          assigned_email: order.customer_email,
          assigned_at: new Date().toISOString(),
        }).eq('id', account.id);

        await supabase.from('order_items').update({
          assigned_username: account.username,
          assigned_password: account.password,
        }).eq('id', item.id);

        deliveries.push({
          productName: item.product_name,
          type: 'account',
          username: account.username,
          password: account.password,
        });
      } else {
        // No inventory available — flag the order
        await supabase.from('orders').update({
          status: 'waiting_for_inventory',
          updated_at: new Date().toISOString(),
        }).eq('id', orderId);
        // Skip further processing; admin must restock then manually trigger
        return;
      }
    } else if (ptype === 'digital_download' && (item.download_url || product.download_url)) {
      const url = item.download_url ?? product.download_url;
      deliveries.push({ productName: item.product_name, type: 'download', downloadUrl: url });
    }

    // Deduct stock for all types
    const newStock = Math.max(0, product.stock - item.quantity);
    await supabase.from('products').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', item.product_id);
  }

  // Send delivery email
  await sendEmail(order as Order, orderItems, deliveries).catch(() => null);

  // Mark delivered
  await supabase.from('orders').update({ status: 'delivered', updated_at: new Date().toISOString() }).eq('id', orderId);
}
