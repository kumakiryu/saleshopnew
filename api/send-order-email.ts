import type { VercelRequest, VercelResponse } from './_types';

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
  download_url: string | null;
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

function buildEmailHtml(order: Order, items: OrderItem[]): string {
  const hasDownloads = items.some(i => i.download_url);

  const itemRows = items.map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #1a2040;color:#c8d0f0;font-size:14px;">${i.product_name}</td>
      <td style="padding:10px 0;border-bottom:1px solid #1a2040;color:#7b88c0;font-size:14px;text-align:center;">×${i.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #1a2040;color:#ffffff;font-size:14px;text-align:right;font-weight:700;">₱${(i.price * i.quantity).toLocaleString()}</td>
    </tr>
  `).join('');

  const downloadLinks = hasDownloads ? `
    <div style="margin-top:28px;padding:20px;background:rgba(0,230,118,0.06);border:1px solid rgba(0,230,118,0.2);border-radius:12px;">
      <p style="margin:0 0 14px;color:#00E676;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Your Products Are Ready</p>
      ${items.filter(i => i.download_url).map(i => `
        <a href="${i.download_url}" style="display:block;margin-bottom:8px;padding:10px 16px;background:rgba(0,230,118,0.08);border:1px solid rgba(0,230,118,0.2);border-radius:8px;color:#00E676;text-decoration:none;font-size:13px;font-weight:600;">
          ↓ ${i.product_name}
        </a>
      `).join('')}
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050816;font-family:'Inter',sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:0 20px 60px;">

    <!-- Header -->
    <div style="padding:32px 0 24px;border-bottom:1px solid #1a2040;">
      <p style="margin:0;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#3a4570;">Sale Shop</p>
      <h1 style="margin:8px 0 0;font-size:24px;font-weight:800;color:#c8d0f0;letter-spacing:0.05em;">ORDER DELIVERED</h1>
    </div>

    <!-- Greeting -->
    <div style="padding:28px 0;">
      <p style="margin:0 0 10px;color:#7b88c0;font-size:15px;">Hey ${order.customer_name},</p>
      <p style="margin:0;color:#c8d0f0;font-size:15px;line-height:1.6;">
        ${hasDownloads
          ? 'Your payment has been confirmed and your digital products are ready. Download links are below.'
          : 'Your order has been confirmed. Our team will be in touch shortly via Discord to complete delivery.'
        }
      </p>
    </div>

    <!-- Order info -->
    <div style="padding:20px;background:rgba(255,255,255,0.03);border:1px solid #1a2040;border-radius:12px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:0 0 14px;color:#3a4570;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Order ID</td>
          <td style="padding:0 0 14px;color:#7b88c0;font-size:12px;font-family:monospace;text-align:right;">${order.id}</td>
        </tr>
        <tr>
          <td style="padding:0 0 14px;color:#3a4570;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Status</td>
          <td style="padding:0 0 14px;text-align:right;">
            <span style="display:inline-block;padding:2px 10px;background:rgba(0,230,118,0.1);border:1px solid rgba(0,230,118,0.3);border-radius:6px;color:#00E676;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">${order.status}</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Items -->
    <div style="padding:20px;background:rgba(255,255,255,0.03);border:1px solid #1a2040;border-radius:12px;margin-bottom:4px;">
      <p style="margin:0 0 14px;color:#3a4570;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Items</p>
      <table style="width:100%;border-collapse:collapse;">
        ${itemRows}
        <tr>
          <td colspan="2" style="padding:14px 0 0;color:#3a4570;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Total</td>
          <td style="padding:14px 0 0;color:#ffffff;font-size:18px;font-weight:800;text-align:right;">₱${Number(order.total).toLocaleString()}</td>
        </tr>
      </table>
    </div>

    ${downloadLinks}

    <!-- Footer -->
    <div style="margin-top:36px;padding-top:20px;border-top:1px solid #1a2040;">
      <p style="margin:0;color:#2e3a5a;font-size:12px;line-height:1.6;">
        Questions? Reach us on Discord. Keep this email as your purchase receipt.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  const { order, items } = req.body as { order: Order; items: OrderItem[] };

  if (!order?.customer_email || !order?.id) {
    return res.status(400).json({ error: 'Missing order data' });
  }

  const html = buildEmailHtml(order, items ?? []);
  const subject = `Order ${order.id.slice(0, 8).toUpperCase()} — Delivered`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? 'orders@yourdomain.com',
        to: [order.customer_email],
        subject,
        html,
      }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message ?? 'Resend API error', detail: data });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
