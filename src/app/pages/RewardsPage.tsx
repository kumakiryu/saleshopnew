import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useCustomerAuth } from '@/lib/customerAuth';
import MemberDropdown from './MemberDropdown';

const GOLD = '#FFB400';
const GREEN = '#00E676';

export default function RewardsPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, tokenBalance, refreshTokens } = useCustomerAuth();
  const isReseller = pathname.startsWith('/reseller');
  const accent = isReseller ? GREEN : GOLD;
  const basePath = isReseller ? '/reseller' : '/vip';
  const myTokens = isReseller ? (tokenBalance?.resellerTokens ?? 0) : (tokenBalance?.vipTokens ?? 0);

  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!user || user.tier === 'normal') { navigate('/'); return; }
    loadRewards();
  }, [user]);

  async function loadRewards() {
    try {
      const res = await fetch('/api/reward-products?active=true');
      if (res.ok) setRewards(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  async function redeem(rewardId: string) {
    setMsg(null);
    setRedeeming(rewardId);
    try {
      const cs = JSON.parse(localStorage.getItem('cs_session') ?? '{}');
      const res = await fetch('/api/redeem-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cs?.access_token}` },
        body: JSON.stringify({ reward_id: rewardId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: `🎉 Redeemed "${data.reward_name}"! ${data.tokens_spent} tokens used. New balance: ${data.new_balance}`, ok: true });
        await refreshTokens();
      } else {
        setMsg({ text: data.error ?? 'Redemption failed', ok: false });
      }
    } catch { setMsg({ text: 'Request failed', ok: false }); } finally { setRedeeming(null); }
  }

  const tier = user?.tier ?? 'normal';
  const visibleRewards = rewards.filter(r => r.membership_type === 'both' || r.membership_type === tier);

  return (
    <div className="min-h-screen" style={{ background: '#050816', fontFamily: "'Inter', sans-serif" }}>
      <div className="pointer-events-none fixed inset-0" style={{ background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${isReseller ? 'rgba(0,230,118,0.06)' : 'rgba(255,180,0,0.06)'} 0%, transparent 60%)` }} />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(`${basePath}/dashboard`)} className="flex items-center gap-2 text-sm" style={{ color: '#7b88c0', background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <MemberDropdown isReseller={isReseller} />
        </div>

        <div className="text-center mb-8">
          <p className="text-5xl mb-3">🎁</p>
          <h1 className="text-3xl font-black tracking-wider" style={{ color: accent, fontFamily: "'Rajdhani','Inter',sans-serif" }}>REWARDS STORE</h1>
          <p className="text-xs uppercase tracking-widest mt-1" style={{ color: '#3a4570' }}>Redeem your tokens for exclusive prizes</p>
        </div>

        {msg && (
          <div className="mb-6 px-4 py-3 rounded-xl text-sm" style={{ background: msg.ok ? 'rgba(0,230,118,0.08)' : 'rgba(255,68,68,0.08)', border: `1px solid ${msg.ok ? 'rgba(0,230,118,0.25)' : 'rgba(255,68,68,0.25)'}`, color: msg.ok ? '#00E676' : '#FF6B6B' }}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-xs uppercase tracking-widest" style={{ color: '#3a4570' }}>Loading rewards...</div>
        ) : visibleRewards.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-4xl mb-3">🎁</p>
            <p className="text-sm" style={{ color: '#3a4570' }}>No rewards available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleRewards.map(r => {
              const canAfford = myTokens >= r.token_cost;
              const outOfStock = r.stock === 0;
              const isRedeeming = redeeming === r.id;
              return (
                <div key={r.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${canAfford && !outOfStock ? accent + '25' : 'rgba(255,255,255,0.06)'}` }}>
                  {r.image_url && <img src={r.image_url} alt={r.name} className="w-full h-36 object-cover" />}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-bold" style={{ color: '#e8eaf6' }}>{r.name}</p>
                      <span className="flex-shrink-0 text-xs font-black px-2 py-1 rounded-lg" style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}>{r.token_cost} 🪙</span>
                    </div>
                    {r.description && <p className="text-xs mb-3" style={{ color: '#7b88c0' }}>{r.description}</p>}
                    <div className="flex items-center justify-between">
                      {r.stock > 0 ? <span className="text-[10px]" style={{ color: '#3a4570' }}>{r.stock} left</span> : r.stock === -1 ? <span className="text-[10px]" style={{ color: '#3a4570' }}>Unlimited</span> : <span className="text-[10px]" style={{ color: '#FF4444' }}>Out of stock</span>}
                      <button
                        disabled={!canAfford || outOfStock || isRedeeming}
                        onClick={() => redeem(r.id)}
                        className="text-xs px-4 py-2 rounded-lg font-bold"
                        style={{ background: canAfford && !outOfStock ? `${accent}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${canAfford && !outOfStock ? accent + '35' : 'rgba(255,255,255,0.08)'}`, color: canAfford && !outOfStock ? accent : '#3a4570', cursor: canAfford && !outOfStock ? 'pointer' : 'not-allowed' }}>
                        {isRedeeming ? '...' : outOfStock ? 'Out of Stock' : !canAfford ? `Need ${r.token_cost - myTokens} more` : 'Redeem'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <button onClick={() => navigate(`${basePath}/topup`)} className="px-6 py-3 rounded-xl text-sm font-bold" style={{ background: `${accent}10`, border: `1px solid ${accent}25`, color: accent, cursor: 'pointer' }}>
            ⚡ Top Up Tokens to Unlock More Rewards
          </button>
        </div>
      </div>
    </div>
  );
}
