import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useCustomerAuth } from '@/lib/customerAuth';
import MemberDropdown from './MemberDropdown';
import TokenIcon from '@/app/components/TokenIcon';
import logoImage from '@/imports/image-1.png';

const GOLD = '#F5B000';
const GREEN = '#00E676';

const CSS = `
  @keyframes token-spin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
  @keyframes accent-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  .token-spin { animation: token-spin 4s linear infinite; }
`;

export default function MemberDashboardPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, tokenBalance, refreshTokens } = useCustomerAuth();
  const isReseller = pathname.startsWith('/reseller');
  const accent = isReseller ? GREEN : GOLD;
  const basePath = isReseller ? '/reseller' : '/vip';
  const tokenCount = isReseller ? (tokenBalance?.resellerTokens ?? 0) : (tokenBalance?.vipTokens ?? 0);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);

  useEffect(() => {
    if (!user) { navigate(basePath); return; }
    const tier = user.tier;
    if (tier === 'normal') { navigate('/'); return; }
    refreshTokens();
    loadTransactions();
    loadOrders();
  }, [user]);

  async function loadTransactions() {
    try {
      const cs = JSON.parse(localStorage.getItem('cs_session') ?? '{}');
      const token = cs?.access_token;
      if (!token) return;
      const res = await fetch('/api/token-transactions?limit=5', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTransactions(await res.json());
    } catch { /* ignore */ } finally { setLoadingTx(false); }
  }

  async function loadOrders() {
    try {
      const cs = JSON.parse(localStorage.getItem('cs_session') ?? '{}');
      if (!cs?.access_token || !user?.email) return;
      const email = encodeURIComponent(user.email);
      const res = await fetch(`https://hxfccpadsbunynignbwn.supabase.co/rest/v1/orders?customer_email=eq.${email}&order=created_at.desc&limit=5&select=id,total,status,created_at`, {
        headers: { apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE', Authorization: `Bearer ${cs.access_token}` },
      });
      if (res.ok) setOrders(await res.json());
    } catch { /* ignore */ }
  }

  const STATUS_COLOR: Record<string, string> = {
    delivered: '#00E676', paid: '#00BFFF', pending: '#FF8C00',
    cancelled: '#FF4444', failed: '#FF4444', processing: '#00BFFF',
    delivering: '#8A2BE2', waiting_for_inventory: '#FF8C00',
  };
  const TX_COLOR: Record<string, string> = { earn: '#00E676', spend: '#FF6B6B', topup: GOLD, adjust: '#00BFFF' };
  const TX_LABEL: Record<string, string> = { earn: '+', spend: '', topup: '+', adjust: '~' };

  if (!user) return null;

  const quickActions = [
    { label: 'Top Up', icon: '⚡', path: `${basePath}/topup` },
    { label: 'Rewards', icon: '🎁', path: `${basePath}/rewards` },
    { label: 'Leaderboard', icon: '🏆', path: `${basePath}/leaderboard` },
    { label: 'Shop', icon: '🛍️', path: '/stock' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#060812', fontFamily: "'Inter', sans-serif" }}>
      <style>{CSS}</style>

      {/* Accent background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute rounded-full" style={{ width: '70vw', height: '50vw', top: '-20vw', left: '-10vw', background: `radial-gradient(ellipse, ${accent}08 0%, transparent 65%)`, filter: 'blur(50px)' }} />
        <div className="absolute rounded-full" style={{ width: '50vw', height: '50vw', bottom: '-10vw', right: '-10vw', background: 'radial-gradient(ellipse, rgba(0,100,255,0.06) 0%, transparent 65%)', filter: 'blur(40px)' }} />
      </div>

      {/* Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-5" style={{ overflow: 'visible' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,8,18,0.78)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', zIndex: -1, pointerEvents: 'none' }} />
        <button onClick={() => navigate('/')} className="inline-flex items-center gap-2" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: '0.1em', background: 'linear-gradient(90deg, #F5F7FF 0%, #00BFFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>SALE SHOP</span>
        </button>
        <div style={{ flex: 1 }} />
        <MemberDropdown isReseller={isReseller} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-16">

        {/* Profile Card */}
        <div className="mb-6 p-5 rounded-2xl" style={{ background: 'rgba(11,16,32,0.7)', border: `1px solid ${accent}28`, boxShadow: `0 0 40px ${accent}08` }}>
          <div className="flex items-center gap-4">
            <div className="token-spin flex-shrink-0" style={{ width: 56, height: 56, filter: `drop-shadow(0 0 12px ${accent}60)` }}>
              <TokenIcon size={56} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#F5F7FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
              <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 800, fontSize: '11px', letterSpacing: '0.18em', color: accent, textTransform: 'uppercase', marginTop: '3px' }}>
                {isReseller ? '◆ RESELLER' : '★ VIP'} MEMBER
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', color: '#626C80', textTransform: 'uppercase', marginBottom: '3px' }}>Lifetime Earned</p>
              <p style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '20px', fontWeight: 600, color: accent, display: 'flex', alignItems: 'center', gap: '5px' }}>
                {tokenBalance?.lifetimeEarned ?? 0} <TokenIcon size={16} />
              </p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Current Balance', value: tokenCount, accent: true, mono: true, large: true },
            { label: 'Lifetime Spent', value: tokenBalance?.lifetimeSpent ?? 0, accent: false, mono: true, large: true },
            { label: 'Earn Rate', valueStr: `${isReseller ? '2×' : '1×'} per ₱100`, accent: false, mono: false, large: false },
          ].map((s, i) => (
            <div key={i} className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,32,0.55)', border: `1px solid ${s.accent ? `${accent}28` : 'rgba(255,255,255,0.07)'}` }}>
              <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', color: '#626C80', textTransform: 'uppercase', marginBottom: '8px' }}>{s.label}</p>
              {s.valueStr ? (
                <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 900, fontSize: '28px', color: '#98A2B8', letterSpacing: '0.05em' }}>{s.valueStr}</p>
              ) : (
                <p style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontWeight: 600, fontSize: '32px', color: s.accent ? accent : '#F5F7FF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {s.value} <TokenIcon size={22} />
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {quickActions.map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className="p-4 rounded-2xl flex flex-col items-center gap-2.5 text-xs font-bold"
              style={{ background: 'rgba(11,16,32,0.55)', border: 'rgba(255,255,255,0.07) solid 1px', cursor: 'pointer', color: '#98A2B8', transition: 'all 0.18s', fontFamily: "'Exo 2','Inter',sans-serif", letterSpacing: '0.06em' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${accent}0e`; (e.currentTarget as HTMLElement).style.borderColor = `${accent}28`; (e.currentTarget as HTMLElement).style.color = accent; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(11,16,32,0.55)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#98A2B8'; }}
            >
              <span style={{ fontSize: '22px' }}>{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>

        {/* Activity + Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Token Activity */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(11,16,32,0.55)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, fontSize: '11px', letterSpacing: '0.15em', color: accent, textTransform: 'uppercase' }}>Token Activity</p>
            </div>
            {loadingTx ? (
              <div className="px-5 py-8 text-center" style={{ color: '#626C80', fontSize: '12px' }}>Loading…</div>
            ) : transactions.length === 0 ? (
              <div className="px-5 py-8 text-center" style={{ color: '#626C80', fontSize: '12px' }}>No token activity yet. Make a purchase to earn tokens!</div>
            ) : (
              transactions.map((tx, i) => (
                <div key={tx.id} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: i < transactions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${TX_COLOR[tx.transaction_type] ?? '#98A2B8'}12` }}>
                      <TokenIcon size={14} />
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 500, color: '#F5F7FF' }}>{tx.reason ?? tx.transaction_type}</p>
                      <p style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '10px', color: '#626C80' }}>{new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '14px', fontWeight: 600, color: TX_COLOR[tx.transaction_type] ?? '#98A2B8' }}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Recent Orders */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(11,16,32,0.55)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, fontSize: '11px', letterSpacing: '0.15em', color: '#00BFFF', textTransform: 'uppercase' }}>Recent Orders</p>
            </div>
            {orders.length === 0 ? (
              <div className="px-5 py-8 text-center" style={{ color: '#626C80', fontSize: '12px' }}>No orders yet.</div>
            ) : (
              orders.map((o, i) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderBottom: i < orders.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer' }}
                  onClick={() => navigate(`/order-status/${o.id}`)}
                >
                  <div>
                    <p style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '12px', fontWeight: 600, color: '#F5F7FF' }}>#{o.id.slice(0, 8).toUpperCase()}</p>
                    <p style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '10px', color: '#626C80' }}>{new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '14px', fontWeight: 600, color: '#F5F7FF', marginBottom: '3px' }}>₱{Number(o.total).toLocaleString()}</p>
                    <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '6px', fontWeight: 700, background: `${STATUS_COLOR[o.status] ?? '#98A2B8'}14`, color: STATUS_COLOR[o.status] ?? '#98A2B8' }}>
                      {o.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
