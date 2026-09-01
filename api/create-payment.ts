import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/create-payment
 * Body: { orderId, method: 'paymongo' | 'coinbase', total, customerEmail, customerName, redirectOrigin }
 * Returns: { url: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { orderId, method, total, customerEmail, customerName, redirectOrigin } = req.body as {
    orderId: string;
    method: 'paymongo' | 'coinbase' | 'coinsph';
    total: number;
    customerEmail: string;
    customerName: string;
    redirectOrigin: string;
  };

  if (!orderId || !method || !total) return res.status(400).json({ error: 'Missing required fields' });

  const successUrl = `${redirectOrigin}/order-status/${orderId}?payment=success`;
  const cancelUrl  = `${redirectOrigin}/order-status/${orderId}?payment=cancelled`;

  try {
    if (method === 'paymongo') {
      const apiKey = process.env.PAYMONGO_SECRET_KEY;
      if (!apiKey) return res.status(500).json({ error: 'PAYMONGO_SECRET_KEY not configured' });

      const encoded = Buffer.from(apiKey + ':').toString('base64');
      const pmRes = await fetch('https://api.paymongo.com/v1/links', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${encoded}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            attributes: {
              amount: Math.round(total * 100), // centavos
              description: `Order ${orderId.slice(0, 8).toUpperCase()}`,
              remarks: orderId,
              redirect: { success: successUrl, failed: cancelUrl },
            },
          },
        }),
      });

      const pmData = await pmRes.json();
      if (!pmRes.ok) {
        const msg = pmData?.errors?.[0]?.detail ?? 'PayMongo error';
        return res.status(pmRes.status).json({ error: msg });
      }

      const url: string = pmData.data.attributes.checkout_url;
      return res.status(200).json({ url });
    }

    if (method === 'coinbase') {
      const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'COINBASE_COMMERCE_API_KEY not configured' });

      const cbRes = await fetch('https://api.commerce.coinbase.com/charges', {
        method: 'POST',
        headers: {
          'X-CC-Api-Key': apiKey,
          'X-CC-Version': '2018-03-22',
          'Content-Type': 'application/json',
        },
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

      const cbData = await cbRes.json();
      if (!cbRes.ok) {
        const msg = cbData?.error?.message ?? 'Coinbase Commerce error';
        return res.status(cbRes.status).json({ error: msg });
      }

      const url: string = cbData.data.hosted_url;
      return res.status(200).json({ url });
    }

    if (method === 'coinsph') {
      const token = process.env.COINSPH_MERCHANT_TOKEN;
      if (!token) return res.status(500).json({ error: 'COINSPH_MERCHANT_TOKEN not configured' });

      const cpRes = await fetch('https://api.coins.asia/v3/invoices/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json;charset=UTF-8',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          amount: total,
          currency: 'PHP',
          external_transaction_id: orderId,
          description: `Order ${orderId.slice(0, 8).toUpperCase()} — ${customerName}`,
        }),
      });

      const cpData = await cpRes.json();
      if (!cpRes.ok) {
        const msg = cpData?.detail ?? cpData?.message ?? 'Coins.ph error';
        return res.status(cpRes.status).json({ error: msg });
      }

      const url: string = cpData.invoice?.payment_url ?? cpData.payment_url;
      if (!url) return res.status(500).json({ error: 'No payment_url in Coins.ph response' });
      return res.status(200).json({ url });
    }

    return res.status(400).json({ error: 'Unknown payment method' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
