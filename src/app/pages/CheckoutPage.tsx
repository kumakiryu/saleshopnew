import { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useCustomerAuth, tierPrice } from '@/lib/customerAuth';
import logoImage from '@/imports/image-1.png';

type PayMethod = 'paymongo' | 'coinbase' | 'coinsph';

const CSS = `
  .co-input {
    background: rgba(11,16,32,0.7);
    border: 1px solid rgba(255,255,255,0.09);
    color: #F5F7FF;
    outline: none;
    border-radius: 12px;
    padding: 11px 14px;
    font-size: 14px;
    width: 100%;
    transition: border-color 0.2s, box-shadow 0.2s;
    font-family: 'Inter', sans-serif;
    box-sizing: border-box;
  }
  .co-input::placeholder { color: #626C80; }
  .co-input:focus {
    border-color: rgba(0,191,255,0.45);
    box-shadow: 0 0 0 3px rgba(0,191,255,0.07);
  }
  .co-label {
    font-size: 10px; text-transform: uppercase;
    letter-spacing: 0.18em; color: #626C80;
    margin-bottom: 7px; display: block;
    font-family: 'Exo 2', 'Inter', sans-serif;
    font-weight: 700;
  }
  .pm-card {
    border-radius: 16px; padding: 16px 18px; cursor: pointer;
    transition: all 0.2s; display: flex; align-items: center; gap: 14px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(11,16,32,0.5);
  }
  .pm-card:hover { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.12); }
  .pm-card.selected { border-color: rgba(0,191,255,0.4); background: rgba(0,191,255,0.05); }
  .pm-radio {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.15); flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.2s;
  }
  .pm-card.selected .pm-radio { border-color: #00BFFF; }
  .pm-dot { width: 8px; height: 8px; border-radius: 50%; background: #00BFFF; opacity: 0; transform: scale(0); transition: all 0.2s; }
  .pm-card.selected .pm-dot { opacity: 1; transform: scale(1); }
  .place-order-btn {
    background: linear-gradient(135deg, rgba(0,191,255,0.18) 0%, rgba(138,43,226,0.18) 100%);
    border: 1px solid rgba(0,191,255,0.4);
    color: #F5F7FF;
    transition: all 0.22s;
  }
  .place-order-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(0,191,255,0.28) 0%, rgba(138,43,226,0.28) 100%);
    border-color: rgba(0,191,255,0.65);
    box-shadow: 0 0 32px rgba(0,191,255,0.2);
    transform: translateY(-1px);
  }
  .place-order-btn:disabled { opacity: 0.4; cursor: not-allowed; }
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(11,16,32,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, fontSize: '11px', letterSpacing: '0.15em', color: '#00BFFF', textTransform: 'uppercase' }}>{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

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
    if (!form.name.trim()) return setError('Full name is required.');
    if (!form.email.trim() || !form.email.includes('@')) return setError('Valid email is required.');
    if (cartItems.length === 0) return setError('Your cart is empty.');
    setLoading(true); setError('');

    try {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          customer_name: form.name.trim(),
          customer_email: form.email.trim().toLowerCase(),
          customer_discord: form.discord.trim() || null,
          notes: form.notes.trim() || null,
          total,
          status: 'pending',
          payment_method: payMethod,
          customer_tier: cusTier,
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      const items = cartItems.map(ci => ({
        order_id: order.id,
        product_id: ci.product.id,
        product_name: ci.product.name,
        quantity: ci.quantity,
        price: tierPrice(ci.product.price, ci.product.vip_price, ci.product.reseller_price, cusTier),
        download_url: ci.product.download_url ?? null,
      }));
      const { error: itemsErr } = await supabase.from('order_items').insert(items);
      if (itemsErr) throw itemsErr;

      upsertOrder(order);
      clearCart();

      if (payMethod === 'coinsph') {
        navigate(`/order-status/${order.id}`);
        return;
      }

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
      if (!res.ok) { console.error('Payment session error:', data.error); navigate(`/order-status/${order.id}`); return; }
      if (data.url) localStorage.setItem(`pm_url_${order.id}`, data.url);
      navigate(`/order-status/${order.id}`);
    } catch (err: unknown) {
      const e = err as any;
      setError(e?.message || JSON.stringify(err) || 'Failed to place order. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#060812', fontFamily: "'Inter', sans-serif" }}>
      <style>{CSS}</style>

      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute rounded-full" style={{ width: '60vw', height: '60vw', top: '-15vw', left: '-15vw', background: 'radial-gradient(ellipse, rgba(0,100,255,0.08) 0%, transparent 65%)', filter: 'blur(40px)' }} />
        <div className="absolute rounded-full" style={{ width: '50vw', height: '50vw', top: '-8vw', right: '-12vw', background: 'radial-gradient(ellipse, rgba(138,43,226,0.07) 0%, transparent 65%)', filter: 'blur(40px)' }} />
      </div>

      {/* Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-5" style={{ background: 'rgba(6,8,18,0.75)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => navigate('/cart')} className="inline-flex items-center gap-2" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: '0.1em', background: 'linear-gradient(90deg, #F5F7FF 0%, #00BFFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>SALE SHOP</span>
        </button>
        <div style={{ flex: 1 }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-24">

        <motion.div className="mb-8" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 900, fontSize: 'clamp(24px, 5vw, 36px)', letterSpacing: '0.06em', color: '#F5F7FF', lineHeight: 1 }}>CHECKOUT</h1>
          <div className="h-px mt-4" style={{ background: 'linear-gradient(90deg, rgba(0,191,255,0.4), transparent)' }} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left: Form */}
          <motion.div className="lg:col-span-3 flex flex-col gap-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>

            <SectionCard title="Customer Information">
              {error && (
                <div className="mb-4 px-3 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(255,68,68,0.09)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.2)' }}>
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="co-label">Full Name *</label>
                  <input className="co-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" />
                </div>
                <div>
                  <label className="co-label">Email Address *</label>
                  <input type="email" className="co-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.com" />
                </div>
              </div>
              <div className="mb-4">
                <label className="co-label">Discord Username <span style={{ color: '#626C80', fontWeight: 400 }}>(optional)</span></label>
                <input className="co-input" value={form.discord} onChange={e => set('discord', e.target.value)} placeholder="username or @handle" />
              </div>
              <div>
                <label className="co-label">Notes <span style={{ color: '#626C80', fontWeight: 400 }}>(optional)</span></label>
                <textarea className="co-input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Special instructions..." />
              </div>
            </SectionCard>

            <SectionCard title="Payment Method">
              <div className="flex flex-col gap-3">
                {PAYMENT_METHODS.map(m => (
                  <div
                    key={m.id}
                    className={`pm-card ${payMethod === m.id ? 'selected' : ''}`}
                    style={payMethod === m.id ? { borderColor: `${m.color}66`, background: `${m.color}06` } : {}}
                    onClick={() => setPayMethod(m.id)}
                  >
                    <div className="pm-radio" style={payMethod === m.id ? { borderColor: m.color } : {}}>
                      <div className="pm-dot" style={{ background: m.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, fontSize: '14px', color: '#F5F7FF' }}>{m.label}</p>
                        {m.badge && (
                          <span style={{
                            fontSize: '9px', padding: '2px 6px', borderRadius: '5px', fontWeight: 700, letterSpacing: '0.08em',
                            background: m.badge === 'INSTANT' ? 'rgba(0,200,100,0.12)' : 'rgba(255,180,0,0.1)',
                            color: m.badge === 'INSTANT' ? '#00C864' : '#FFB400',
                            border: `1px solid ${m.badge === 'INSTANT' ? 'rgba(0,200,100,0.25)' : 'rgba(255,180,0,0.2)'}`,
                          }}>
                            {m.badge}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '11px', color: '#626C80', marginBottom: '8px' }}>{m.sublabel}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {m.tags.map(tag => (
                          <span key={tag} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, background: `${m.color}10`, color: m.color, border: `1px solid ${m.color}28` }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '10px', color: '#626C80', marginTop: '12px', lineHeight: '1.6' }}>
                INSTANT methods deliver codes automatically when payment clears. MANUAL (InstaPay/Bank) requires admin verification and may take longer.
              </p>
            </SectionCard>

            <button
              onClick={placeOrder}
              disabled={loading || cartItems.length === 0}
              className="place-order-btn w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ fontFamily: "'Exo 2','Inter',sans-serif", letterSpacing: '0.1em', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Redirecting to payment…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  Pay ₱{total.toLocaleString()}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </>
              )}
            </button>

          </motion.div>

          {/* Right: Summary */}
          <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <div className="sticky top-20 rounded-2xl overflow-hidden" style={{ background: 'rgba(11,16,32,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, fontSize: '11px', letterSpacing: '0.15em', color: '#00BFFF', textTransform: 'uppercase' }}>Order Summary</p>
              </div>

              {cusTier !== 'normal' && (
                <div className="mx-4 mt-4 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2" style={{
                  background: cusTier === 'vip' ? 'rgba(245,176,0,0.07)' : 'rgba(0,230,118,0.07)',
                  border: `1px solid ${cusTier === 'vip' ? 'rgba(245,176,0,0.18)' : 'rgba(0,230,118,0.18)'}`,
                  color: cusTier === 'vip' ? '#F5B000' : '#00E676',
                }}>
                  {cusTier === 'vip' ? '★ VIP pricing applied' : '◆ Reseller pricing applied'}
                </div>
              )}

              <div className="px-5 py-4 flex flex-col gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {cartItems.map(ci => {
                  const itemPrice = tierPrice(ci.product.price, ci.product.vip_price, ci.product.reseller_price, cusTier);
                  return (
                    <div key={ci.product.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p style={{ fontSize: '12px', color: '#98A2B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ci.product.name}</p>
                        <p style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '10px', color: '#626C80' }}>×{ci.quantity}</p>
                      </div>
                      <p style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '13px', fontWeight: 600, color: '#F5F7FF', flexShrink: 0 }}>
                        ₱{(itemPrice * ci.quantity).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="px-5 py-4 flex items-center justify-between">
                <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, fontSize: '12px', color: '#98A2B8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total</span>
                <span style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '24px', fontWeight: 600, color: '#F5F7FF' }}>₱{total.toLocaleString()}</span>
              </div>

              <div className="px-5 pb-4 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(0,191,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <p style={{ fontSize: '10px', color: '#626C80' }}>Secure checkout — your data is encrypted</p>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
