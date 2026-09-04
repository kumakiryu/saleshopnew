import { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useCustomerAuth, tierPrice } from '@/lib/customerAuth';

type PayMethod = 'paymongo' | 'coinbase' | 'coinsph';

const CSS = `
  .co-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e8eaf6; outline: none; border-radius: 10px; padding: 10px 14px; font-size: 14px; width: 100%; transition: border-color 0.2s; font-family: 'Inter', sans-serif; }
  .co-input::placeholder { color: #2e3a5a; }
  .co-input:focus { border-color: rgba(0,191,255,0.4); }
  .co-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: #7b88c0; margin-bottom: 6px; display: block; }
  .pm-card { border-radius: 14px; padding: 16px 18px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 14px; }
  .pm-card:hover { background: rgba(255,255,255,0.04); }
  .pm-card.selected { background: rgba(0,191,255,0.06); border-color: rgba(0,191,255,0.4) !important; }
  .pm-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.15); flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
  .pm-card.selected .pm-radio { border-color: #00BFFF; }
  .pm-dot { width: 8px; height: 8px; border-radius: 50%; background: #00BFFF; opacity: 0; transform: scale(0); transition: all 0.2s; }
  .pm-card.selected .pm-dot { opacity: 1; transform: scale(1); }
`;

const PAYMENT_METHODS: { id: PayMethod; label: string; sublabel: string; tags: string[]; color: string; badge?: string }[] = [
  {
    id: 'paymongo',
    label: 'GCash / Maya / Cards',
    sublabel: 'Instant automatic delivery — pay with GCash, Maya, or any card',
    tags: ['GCash', 'Maya', 'Visa', 'Mastercard'],
    color: '#00BFFF',
    badge: 'INSTANT',
  },
  {
    id: 'coinbase',
    label: 'Cryptocurrency',
    sublabel: 'Instant automatic delivery via Coinbase Commerce',
    tags: ['BTC', 'ETH', 'LTC', 'USDC'],
    color: '#F7931A',
    badge: 'INSTANT',
  },
  {
    id: 'coinsph',
    label: 'InstaPay / Bank Transfer',
    sublabel: 'Scan the QR code with any bank app — delivery after manual verification',
    tags: ['InstaPay', 'BancNet', 'Bank Transfer'],
    color: '#00C896',
    badge: 'MANUAL',
  },
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cartItems, cartTotal, clearCart, upsertOrder } = useStore();
  const { user: cusUser } = useCustomerAuth();
  const cusTier = cusUser?.tier ?? 'normal';
  const [form, setForm] = useState({ name: '', email: cusUser?.email ?? '', discord: '', notes: '' });
  const [payMethod, setPayMethod] = useState<PayMethod>('paymongo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  const total = cartItems.reduce((sum, ci) =>
    sum + tierPrice(ci.product.price, ci.product.vip_price, ci.product.reseller_price, cusTier) * ci.quantity, 0
  );

  async function placeOrder() {
    if (!form.name.trim())  return setError('Full name is required.');
    if (!form.email.trim() || !form.email.includes('@')) return setError('Valid email is required.');
    if (cartItems.length === 0) return setError('Your cart is empty.');
    setLoading(true); setError('');

    try {
      // 1. Create order in Supabase
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          customer_name:    form.name.trim(),
          customer_email:   form.email.trim().toLowerCase(),
          customer_discord: form.discord.trim() || null,
          notes:            form.notes.trim() || null,
          total,
          status: 'pending',
          payment_method: payMethod,
          customer_tier: cusTier,
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Create order items
      const items = cartItems.map(ci => ({
        order_id:     order.id,
        product_id:   ci.product.id,
        product_name: ci.product.name,
        quantity:     ci.quantity,
        price:        tierPrice(ci.product.price, ci.product.vip_price, ci.product.reseller_price, cusTier),
        download_url: ci.product.download_url ?? null,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(items);
      if (itemsErr) throw itemsErr;

      upsertOrder(order);
      clearCart();

      // 3. For Coins.ph (personal/manual) — skip payment API, go to order status
      if (payMethod === 'coinsph') {
        navigate(`/order-status/${order.id}`);
        return;
      }

      // 4. For PayMongo / Coinbase — create payment session and redirect
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          method: payMethod,
          total,
          customerEmail: form.email.trim().toLowerCase(),
          customerName: form.name.trim(),
          redirectOrigin: window.location.origin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('Payment session error:', data.error);
        navigate(`/order-status/${order.id}`);
        return;
      }

      // Store payment URL then navigate to order status — PayMongo opens in new tab from there
      if (data.url) localStorage.setItem(`pm_url_${order.id}`, data.url);
      navigate(`/order-status/${order.id}`);
    } catch (err: unknown) {
      const e = err as any;
      setError(e?.message || JSON.stringify(err) || 'Failed to place order. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#050816', fontFamily: "'Inter', sans-serif" }}>
      <style>{CSS}</style>
      <div className="pointer-events-none fixed inset-0" style={{
        background: 'radial-gradient(ellipse 70% 50% at 30% 30%, rgba(0,100,255,0.09) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 70% 70%, rgba(138,43,226,0.07) 0%, transparent 55%)',
      }} />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-12 pb-24">

        {/* Back */}
        <motion.button onClick={() => navigate('/cart')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm mb-8 select-none"
          style={{ color: '#7b88c0', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,191,255,0.3)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span style={{ fontFamily: "'Rajdhani','Inter',sans-serif", fontWeight: 600 }}>Back to Cart</span>
        </motion.button>

        <motion.h1 className="text-2xl font-bold mb-1" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif", letterSpacing: '0.05em' }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          CHECKOUT
        </motion.h1>
        <div className="mb-8 h-px" style={{ background: 'linear-gradient(90deg, rgba(0,191,255,0.4), transparent)', marginTop: '12px' }} />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── Left: form ── */}
          <motion.div className="lg:col-span-3 flex flex-col gap-5"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>

            {/* Customer info */}
            <div className="rounded-2xl p-6 flex flex-col gap-5"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>

              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#00BFFF' }}>Customer Info</p>

              {error && (
                <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,68,68,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.2)' }}>
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="co-label">Full Name *</label>
                  <input className="co-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" />
                </div>
                <div>
                  <label className="co-label">Email Address *</label>
                  <input type="email" className="co-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.com" />
                </div>
              </div>

              <div>
                <label className="co-label">Discord Username <span style={{ color: '#2e3a5a' }}>(optional)</span></label>
                <input className="co-input" value={form.discord} onChange={e => set('discord', e.target.value)} placeholder="username or @handle" />
              </div>

              <div>
                <label className="co-label">Notes <span style={{ color: '#2e3a5a' }}>(optional)</span></label>
                <textarea className="co-input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Special instructions..." />
              </div>
            </div>

            {/* Payment method */}
            <div className="rounded-2xl p-5 flex flex-col gap-3"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>

              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#00BFFF' }}>Payment Method</p>

              {PAYMENT_METHODS.map(m => (
                <div key={m.id}
                  className={`pm-card ${payMethod === m.id ? 'selected' : ''}`}
                  style={{ border: `1px solid ${payMethod === m.id ? `${m.color}66` : 'rgba(255,255,255,0.08)'}`, background: payMethod === m.id ? `${m.color}08` : undefined }}
                  onClick={() => setPayMethod(m.id)}>
                  <div className="pm-radio" style={{ borderColor: payMethod === m.id ? m.color : undefined }}>
                    <div className="pm-dot" style={{ background: m.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>{m.label}</p>
                      {m.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider"
                          style={{
                            background: m.badge === 'INSTANT' ? 'rgba(0,200,100,0.15)' : 'rgba(255,180,0,0.12)',
                            color: m.badge === 'INSTANT' ? '#00C864' : '#FFB400',
                            border: `1px solid ${m.badge === 'INSTANT' ? 'rgba(0,200,100,0.3)' : 'rgba(255,180,0,0.25)'}`,
                          }}>
                          {m.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: '#3a4570' }}>{m.sublabel}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.tags.map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md font-bold"
                          style={{ background: `${m.color}12`, color: m.color, border: `1px solid ${m.color}30` }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              <p className="text-[10px] leading-relaxed mt-1" style={{ color: '#2e3a5a' }}>
                INSTANT methods deliver your codes automatically the moment payment clears. MANUAL (InstaPay/Bank) requires admin verification and may take longer.
              </p>
            </div>

            {/* Place order */}
            <button onClick={placeOrder} disabled={loading || cartItems.length === 0}
              className="w-full py-4 rounded-xl text-base font-bold tracking-wider"
              style={{
                background: loading ? 'rgba(0,191,255,0.05)' : 'linear-gradient(135deg, rgba(0,191,255,0.2) 0%, rgba(138,43,226,0.2) 100%)',
                border: '1px solid rgba(0,191,255,0.4)',
                color: loading ? '#3a4570' : '#ffffff',
                fontFamily: "'Rajdhani','Inter',sans-serif",
                letterSpacing: '0.08em',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 0 24px rgba(0,191,255,0.12)',
                transition: 'all 0.2s',
              }}>
              {loading ? 'Redirecting to payment...' : `Pay ₱${total.toLocaleString()} →`}
            </button>
          </motion.div>

          {/* ── Right: order summary ── */}
          <motion.div className="lg:col-span-2"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <div className="rounded-2xl overflow-hidden sticky top-6"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#00BFFF' }}>Order Summary</p>
              </div>
              <div className="px-5 py-4 flex flex-col gap-3">
                {cusTier !== 'normal' && (
                  <div className="px-2 py-1.5 rounded-lg text-[10px] font-bold mb-1" style={{
                    background: cusTier === 'vip' ? 'rgba(255,180,0,0.1)' : 'rgba(0,230,118,0.1)',
                    color: cusTier === 'vip' ? '#FFB400' : '#00E676',
                    border: `1px solid ${cusTier === 'vip' ? 'rgba(255,180,0,0.25)' : 'rgba(0,230,118,0.2)'}`,
                  }}>
                    {cusTier === 'vip' ? '✦ VIP pricing applied' : '◆ Reseller pricing applied'}
                  </div>
                )}
                {cartItems.map(ci => {
                  const itemPrice = tierPrice(ci.product.price, ci.product.vip_price, ci.product.reseller_price, cusTier);
                  return (
                    <div key={ci.product.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>{ci.product.name}</p>
                        <p className="text-[10px]" style={{ color: '#3a4570' }}>×{ci.quantity}</p>
                      </div>
                      <span className="text-xs font-bold flex-shrink-0" style={{ color: '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>
                        ₱{(itemPrice * ci.quantity).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xs uppercase tracking-widest" style={{ color: '#3a4570' }}>Total</span>
                <span className="text-xl font-bold" style={{ color: '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>₱{total.toLocaleString()}</span>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
