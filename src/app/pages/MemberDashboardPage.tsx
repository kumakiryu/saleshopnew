import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useCustomerAuth } from '@/lib/customerAuth';
import MemberDropdown from './MemberDropdown';
import TokenIcon from '@/app/components/TokenIcon';

const GOLD = '#FFB400';
const GREEN = '#00E676';

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

  const STATUS_COLOR: Record<string, string> = { delivered: '#00E676', paid: '#00BFFF', pending: '#FF8C00', cancelled: '#FF4444', failed: '#FF4444', processing: '#00BFFF', delivering: '#8A2BE2', waiting_for_inventory: '#FF8C00' };
  const TX_ICON: Record<string, string> = { earn: '⬆️', spend: '⬇️', topup: '⚡', adjust: '🔧' };
  const TX_COLOR: Record<string, string> = { earn: '#00E676', spend: '#FF6B6B', topup: GOLD, adjust: '#00BFFF' };

  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: '#050816', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes token-spin {
          from { transform: rotateY(0deg); }
          to   { transform: rotateY(360deg); }
        }
        @keyframes theme-color-cycle {
          0%   { --tw-gradient-stops: rgba(138,43,226,0.55), rgba(0,191,255,0.3); filter: hue-rotate(0deg); }
          33%  { filter: hue-rotate(60deg); }
          66%  { filter: hue-rotate(180deg); }
          100% { filter: hue-rotate(360deg); }
        }
        @keyframes border-glow-cycle {
          0%   { border-color: rgba(138,43,226,0.5); box-shadow: 0 0 18px rgba(138,43,226,0.25), 0 0 48px rgba(138,43,226,0.1); }
          25%  { border-color: rgba(0,191,255,0.5);  box-shadow: 0 0 18px rgba(0,191,255,0.25),  0 0 48px rgba(0,191,255,0.1); }
          50%  { border-color: rgba(0,229,255,0.5);  box-shadow: 0 0 18px rgba(0,229,255,0.25),  0 0 48px rgba(0,229,255,0.1); }
          75%  { border-color: rgba(180,0,255,0.5);  box-shadow: 0 0 18px rgba(180,0,255,0.25),  0 0 48px rgba(180,0,255,0.1); }
          100% { border-color: rgba(138,43,226,0.5); box-shadow: 0 0 18px rgba(138,43,226,0.25), 0 0 48px rgba(138,43,226,0.1); }
        }
        @keyframes bg-glow-cycle {
          0%   { background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(138,43,226,0.14) 0%, transparent 60%); }
          25%  { background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,191,255,0.14)  0%, transparent 60%); }
          50%  { background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,229,255,0.14)  0%, transparent 60%); }
          75%  { background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(180,0,255,0.14)  0%, transparent 60%); }
          100% { background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(138,43,226,0.14) 0%, transparent 60%); }
        }
        @keyframes text-color-cycle {
          0%   { color: #8A2BE2; }
          25%  { color: #00BFFF; }
          50%  { color: #00E5FF; }
          75%  { color: #B400FF; }
          100% { color: #8A2BE2; }
        }
        @keyframes token-glow-cycle {
          0%   { filter: drop-shadow(0 0 12px rgba(138,43,226,0.7)) drop-shadow(0 0 28px rgba(138,43,226,0.35)); }
          25%  { filter: drop-shadow(0 0 12px rgba(0,191,255,0.7))  drop-shadow(0 0 28px rgba(0,191,255,0.35)); }
          50%  { filter: drop-shadow(0 0 12px rgba(0,229,255,0.7))  drop-shadow(0 0 28px rgba(0,229,255,0.35)); }
          75%  { filter: drop-shadow(0 0 12px rgba(180,0,255,0.7))  drop-shadow(0 0 28px rgba(180,0,255,0.35)); }
          100% { filter: drop-shadow(0 0 12px rgba(138,43,226,0.7)) drop-shadow(0 0 28px rgba(138,43,226,0.35)); }
        }
        .theme-border-glow { animation: border-glow-cycle 6s linear infinite; }
        .theme-text-cycle  { animation: text-color-cycle 6s linear infinite; }
        .theme-token-glow  { animation: token-glow-cycle 6s linear infinite; }
      `}</style>

      <div className="pointer-events-none fixed inset-0" style={{ animation: 'bg-glow-cycle 6s linear infinite' }} />

      {/* Header */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm" style={{ color: '#7b88c0', background: 'none', border: 'none', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back to Shop
        </button>
        <MemberDropdown isReseller={isReseller} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        {/* Profile card */}
        <div className="mb-6 p-6 rounded-2xl theme-border-glow" style={{ background: 'linear-gradient(135deg, rgba(138,43,226,0.07) 0%, rgba(255,255,255,0.02) 100%)' }}>
          <div className="flex items-center gap-5">
            {/* Spinning token coin */}
            <div style={{ perspective: 600, flexShrink: 0 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                animation: 'token-spin 4s linear infinite',
              }} className="theme-token-glow">
                <TokenIcon size={64} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: '#e8eaf6' }}>{user.email}</p>
              <p className="text-xs uppercase tracking-widest font-bold mt-0.5 theme-text-cycle">{isReseller ? '◆ RESELLER' : '✦ VIP'} MEMBER</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest" style={{ color: '#3a4570' }}>Lifetime Earned</p>
              <p className="text-xl font-black" style={{ color: accent, fontFamily: "'Rajdhani','Inter',sans-serif" }}>{tokenBalance?.lifetimeEarned ?? 0} <TokenIcon size={16} /></p>
            </div>
          </div>
        </div>

        {/* Token wallet + quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-5 rounded-2xl theme-border-glow" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#3a4570' }}>Current Balance</p>
            <p className="text-3xl font-black theme-text-cycle" style={{ fontFamily: "'Rajdhani','Inter',sans-serif" }}>{tokenCount} <TokenIcon size={22} /></p>
          </div>
          <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#3a4570' }}>Lifetime Spent</p>
            <p className="text-3xl font-black" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>{tokenBalance?.lifetimeSpent ?? 0} <TokenIcon size={22} /></p>
          </div>
          <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#3a4570' }}>Earn Rate</p>
            <p className="text-2xl font-black" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>{isReseller ? '2×' : '1×'} <span className="text-sm font-normal" style={{ color: '#3a4570' }}>per ₱100</span></p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Top Up', icon: '⚡', path: `${basePath}/topup` },
            { label: 'Rewards', icon: '🎁', path: `${basePath}/rewards` },
            { label: 'Leaderboard', icon: '🏆', path: `${basePath}/leaderboard` },
            { label: 'Shop', icon: '🛍️', path: '/stock' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)}
              className="p-4 rounded-xl flex flex-col items-center gap-2 text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.06)`, cursor: 'pointer', color: '#c8d0f0', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${accent}10`; (e.currentTarget as HTMLElement).style.borderColor = `${accent}30`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}>
              <span className="text-2xl">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent transactions */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7b88c0' }}>Token Activity</p>
            </div>
            {loadingTx ? (
              <div className="px-5 py-8 text-center text-xs" style={{ color: '#3a4570' }}>Loading...</div>
            ) : transactions.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs" style={{ color: '#3a4570' }}>No token activity yet. Make a purchase to earn tokens!</div>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div className="flex items-center gap-3">
                    <span>{TX_ICON[tx.transaction_type] ?? '•'}</span>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: '#c8d0f0' }}>{tx.reason ?? tx.transaction_type}</p>
                      <p className="text-[10px]" style={{ color: '#3a4570' }}>{new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold" style={{ color: TX_COLOR[tx.transaction_type] ?? '#c8d0f0' }}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount} <TokenIcon size={13} />
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Recent orders */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7b88c0' }}>Recent Orders</p>
            </div>
            {orders.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs" style={{ color: '#3a4570' }}>No orders yet.</div>
            ) : (
              orders.map(o => (
                <div key={o.id} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }} onClick={() => navigate(`/order-status/${o.id}`)}>
                  <div>
                    <p className="text-xs font-mono font-semibold" style={{ color: '#c8d0f0' }}>#{o.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-[10px]" style={{ color: '#3a4570' }}>{new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: '#fff' }}>₱{Number(o.total).toLocaleString()}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: `${STATUS_COLOR[o.status] ?? '#7b88c0'}18`, color: STATUS_COLOR[o.status] ?? '#7b88c0' }}>{o.status}</span>
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
