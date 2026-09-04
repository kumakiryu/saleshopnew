import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useCustomerAuth } from '@/lib/customerAuth';
import MemberDropdown from './MemberDropdown';

const GOLD = '#FFB400';
const GREEN = '#00E676';

const PACKAGES = [
  { tokens: 50, price: 50, label: 'Starter' },
  { tokens: 100, price: 95, label: 'Popular', highlight: true },
  { tokens: 250, price: 225, label: 'Pro' },
  { tokens: 500, price: 420, label: 'Elite' },
];

const PAYMENT_METHODS = [
  { id: 'paymongo', label: 'GCash / Maya', icon: '💳' },
  { id: 'coinbase', label: 'Crypto (USDC)', icon: '🔷' },
  { id: 'coinsph', label: 'Coins.ph', icon: '🪙' },
];

export default function TopupPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, tokenBalance } = useCustomerAuth();
  const isReseller = pathname.startsWith('/reseller');
  const accent = isReseller ? GREEN : GOLD;
  const basePath = isReseller ? '/reseller' : '/vip';
  const tokenType = isReseller ? 'reseller' : 'vip';
  const myTokens = isReseller ? (tokenBalance?.resellerTokens ?? 0) : (tokenBalance?.vipTokens ?? 0);

  const [selectedPkg, setSelectedPkg] = useState(1);
  const [selectedPay, setSelectedPay] = useState('paymongo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user || user.tier === 'normal') { navigate('/'); return null; }

  const pkg = PACKAGES[selectedPkg];

  async function handlePurchase() {
    setError(''); setLoading(true);
    try {
      const cs = JSON.parse(localStorage.getItem('cs_session') ?? '{}');
      const notes = JSON.stringify({ tokenTopup: true, tokenAmount: pkg.tokens, tokenType, userId: user!.id });
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: user!.email.split('@')[0],
          customerEmail: user!.email,
          customerDiscord: null,
          notes,
          items: [{ productId: null, productName: `${pkg.tokens} ${tokenType.toUpperCase()} Token Pack`, quantity: 1, price: pkg.price }],
          total: pkg.price,
          paymentMethod: selectedPay,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Payment failed'); return; }
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
      else if (data.orderId) navigate(`/order-status/${data.orderId}`);
    } catch (e: any) {
      setError(e?.message ?? 'Request failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen" style={{ background: '#050816', fontFamily: "'Inter', sans-serif" }}>
      <div className="pointer-events-none fixed inset-0" style={{ background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${isReseller ? 'rgba(0,230,118,0.06)' : 'rgba(255,180,0,0.06)'} 0%, transparent 60%)` }} />

      <div className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(`${basePath}/dashboard`)} className="flex items-center gap-2 text-sm" style={{ color: '#7b88c0', background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <MemberDropdown isReseller={isReseller} />
        </div>

        <div className="text-center mb-8">
          <p className="text-5xl mb-3">⚡</p>
          <h1 className="text-3xl font-black tracking-wider" style={{ color: accent, fontFamily: "'Rajdhani','Inter',sans-serif" }}>TOP UP TOKENS</h1>
          <p className="text-xs uppercase tracking-widest mt-1" style={{ color: '#3a4570' }}>Add {tokenType} tokens to your wallet</p>
        </div>

        {/* Packages */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {PACKAGES.map((p, i) => (
            <button key={i} onClick={() => setSelectedPkg(i)}
              className="p-4 rounded-xl text-left"
              style={{ background: selectedPkg === i ? `${accent}12` : 'rgba(255,255,255,0.02)', border: `1px solid ${selectedPkg === i ? accent + '40' : 'rgba(255,255,255,0.07)'}`, cursor: 'pointer', position: 'relative' }}>
              {p.highlight && <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: `${accent}25`, color: accent }}>Best Value</span>}
              <p className="text-2xl font-black" style={{ color: selectedPkg === i ? accent : '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>{p.tokens} 🪙</p>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: '#3a4570' }}>{p.label}</p>
              <p className="text-sm font-bold mt-1" style={{ color: selectedPkg === i ? accent : '#7b88c0' }}>₱{p.price}</p>
            </button>
          ))}
        </div>

        {/* Payment method */}
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: '#3a4570' }}>Payment Method</p>
          <div className="flex flex-col gap-2">
            {PAYMENT_METHODS.map(pm => (
              <button key={pm.id} onClick={() => setSelectedPay(pm.id)}
                className="flex items-center gap-3 p-3 rounded-xl text-left"
                style={{ background: selectedPay === pm.id ? `${accent}08` : 'rgba(255,255,255,0.02)', border: `1px solid ${selectedPay === pm.id ? accent + '30' : 'rgba(255,255,255,0.07)'}`, cursor: 'pointer' }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: selectedPay === pm.id ? accent : 'rgba(255,255,255,0.1)', border: selectedPay === pm.id ? 'none' : '1px solid rgba(255,255,255,0.15)' }}>
                  {selectedPay === pm.id && <div className="w-2 h-2 rounded-full" style={{ background: '#000' }} />}
                </div>
                <span className="text-lg">{pm.icon}</span>
                <span className="text-sm font-medium" style={{ color: '#c8d0f0' }}>{pm.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Summary + buy */}
        <div className="p-5 rounded-2xl mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${accent}20` }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm" style={{ color: '#7b88c0' }}>{pkg.tokens} {tokenType} tokens</span>
            <span className="text-sm font-bold" style={{ color: '#c8d0f0' }}>₱{pkg.price}</span>
          </div>
          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-xs uppercase tracking-widest" style={{ color: '#3a4570' }}>Total</span>
            <span className="text-xl font-black" style={{ color: accent, fontFamily: "'Rajdhani','Inter',sans-serif" }}>₱{pkg.price}</span>
          </div>
        </div>

        {error && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)', color: '#FF6B6B' }}>{error}</div>}

        <button onClick={handlePurchase} disabled={loading} className="w-full py-4 rounded-xl text-sm font-bold tracking-wider" style={{
          background: loading ? 'rgba(255,255,255,0.04)' : `linear-gradient(135deg, ${accent}25 0%, ${accent}15 100%)`,
          border: `1px solid ${accent}40`, color: loading ? '#3a4570' : accent,
          fontFamily: "'Rajdhani','Inter',sans-serif", cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? 'Processing...' : `BUY ${pkg.tokens} TOKENS — ₱${pkg.price}`}
        </button>
        <p className="text-center text-[11px] mt-3" style={{ color: '#3a4570' }}>Tokens are credited automatically after payment is confirmed.</p>
      </div>
    </div>
  );
}
