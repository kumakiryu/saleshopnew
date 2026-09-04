import type { VercelRequest, VercelResponse } from './_types';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
}

async function createOrder(params: {
  customerName: string;
  customerEmail: string;
  customerDiscord?: string | null;
  notes?: string | null;
  total: number;
  paymentMethod: string;
  items: { productId?: string | null; productName: string; quantity: number; price: number }[];
}): Promise<string> {
  const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({
      customer_name: params.customerName,
      customer_email: params.customerEmail,
      customer_discord: params.customerDiscord ?? null,
      notes: params.notes ?? null,
      total: params.total,
      status: 'pending',
      payment_method: params.paymentMethod,
      created_at: new Date().toISOString(),
    }),
  });
  if (!orderRes.ok) {
    const err = await orderRes.json().catch(() => ({})) as any;
    throw new Error(err?.message ?? 'Failed to create order');
  }
  const orderRows = await orderRes.json() as any[];
  const orderId: string = orderRows[0]?.id;
  if (!orderId) throw new Error('Order created but no ID returned');

  if (params.items.length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/order_items`, {
      method: 'POST',
      headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify(params.items.map(item => ({
        order_id: orderId,
        product_id: item.productId ?? null,
        product_name: item.productName,
        quantity: item.quantity,
        price: item.price,
      }))),
    });
  }

  return orderId;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body as any;

  // Support both "method" (checkout page) and "paymentMethod" (topup page)
  const method: string = body.method ?? body.paymentMethod ?? '';
  const total: number = Number(body.total ?? 0);
  const customerEmail: string = body.customerEmail ?? '';
  const customerName: string = body.customerName ?? '';

  if (!method || !total || !customerEmail) return res.status(400).json({ error: 'Missing required fields' });

  // If no orderId, create the order first (used by token top-up flow)
  let orderId: string = body.orderId ?? '';
  if (!orderId) {
    try {
      orderId = await createOrder({
        customerName,
        customerEmail,
        customerDiscord: body.customerDiscord ?? null,
        notes: body.notes ?? null,
        total,
        paymentMethod: method,
        items: body.items ?? [],
      });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create order' });
    }
  }

  const redirectOrigin: string = body.redirectOrigin ?? `https://${req.headers.host}`;
  const successUrl = `${redirectOrigin}/order-status/${orderId}?payment=success`;
  const cancelUrl = `${redirectOrigin}/order-status/${orderId}?payment=cancelled`;

  try {
    if (method === 'paymongo') {
      const apiKey = process.env.PAYMONGO_SECRET_KEY;
      if (!apiKey) return res.status(500).json({ error: 'PAYMONGO_SECRET_KEY not configured' });

      const encoded = Buffer.from(apiKey + ':').toString('base64');
      const pmRes = await fetch('https://api.paymongo.com/v1/links', {
        method: 'POST',
        headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            attributes: {
              amount: Math.round(total * 100),
              description: `Order ${orderId}`,
              remarks: orderId,
              redirect: { success: successUrl, failed: cancelUrl },
            },
          },
        }),
      });

      const pmData = await pmRes.json() as any;
      if (!pmRes.ok) return res.status(pmRes.status).json({ error: pmData?.errors?.[0]?.detail ?? 'PayMongo error' });

      const url: string = pmData.data.attributes.checkout_url;
      return res.status(200).json({ url, checkoutUrl: url, orderId });
    }

    if (method === 'coinbase') {
      const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'COINBASE_COMMERCE_API_KEY not configured' });

      const cbRes = await fetch('https://api.commerce.coinbase.com/charges', {
        method: 'POST',
        headers: { 'X-CC-Api-Key': apiKey, 'X-CC-Version': '2018-03-22', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Order ${orderId.slice(0, 8).toUpperCase()}`,
          description: `Digital products for ${customerName}`,
          pricing_type: 'fixed_price',
          local_price: { amount: total.toFixed(2), currency: 'PHP' },
          redirect_url: successUrl,
          cancel_url: cancelUrl,
          metadata: { order_id: orderId, customer_email: customerEmail },
        }),
      });

      const cbData = await cbRes.json() as any;
      if (!cbRes.ok) return res.status(cbRes.status).json({ error: cbData?.error?.message ?? 'Coinbase Commerce error' });

      const url: string = cbData.data.hosted_url;
      return res.status(200).json({ url, checkoutUrl: url, orderId });
    }

    if (method === 'coinsph') {
      const token = process.env.COINSPH_MERCHANT_TOKEN;
      if (!token) return res.status(500).json({ error: 'COINSPH_MERCHANT_TOKEN not configured' });

      const cpRes = await fetch('https://api.coins.asia/v3/invoices/', {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json;charset=UTF-8', Accept: 'application/json' },
        body: JSON.stringify({
          amount: total,
          currency: 'PHP',
          external_transaction_id: orderId,
          description: `Order ${orderId.slice(0, 8).toUpperCase()} — ${customerName}`,
        }),
      });

      const cpData = await cpRes.json() as any;
      if (!cpRes.ok) return res.status(cpRes.status).json({ error: cpData?.detail ?? cpData?.message ?? 'Coins.ph error' });

      const url: string = cpData.invoice?.payment_url ?? cpData.payment_url;
      if (!url) return res.status(500).json({ error: 'No payment_url in Coins.ph response' });
      return res.status(200).json({ url, checkoutUrl: url, orderId });
    }

    return res.status(400).json({ error: 'Unknown payment method' });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
