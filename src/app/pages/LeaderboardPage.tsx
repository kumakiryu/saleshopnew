import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useCustomerAuth } from '@/lib/customerAuth';
import MemberDropdown from './MemberDropdown';
import TokenIcon from '@/app/components/TokenIcon';

const GOLD = '#FFB400';
const GREEN = '#00E676';

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, tokenBalance } = useCustomerAuth();
  const isReseller = pathname.startsWith('/reseller');
  const accent = isReseller ? GREEN : GOLD;
  const basePath = isReseller ? '/reseller' : '/vip';

  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [isReseller]);

  async function load() {
    try {
      const type = isReseller ? 'reseller' : 'vip';
      const res = await fetch(`/api/leaderboard?type=${type}`);
      if (res.ok) setEntries(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  const myTokens = isReseller ? (tokenBalance?.resellerTokens ?? 0) : (tokenBalance?.vipTokens ?? 0);
  const myRank = entries.findIndex(e => e.email === user?.email) + 1;

  const RANK_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <div className="min-h-screen" style={{ background: '#050816', fontFamily: "'Inter', sans-serif" }}>
      <div className="pointer-events-none fixed inset-0" style={{ background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${isReseller ? 'rgba(0,230,118,0.06)' : 'rgba(255,180,0,0.06)'} 0%, transparent 60%)` }} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <div className="flex items-center justify-between mb-8 gap-3">
          <button onClick={() => navigate(`${basePath}/dashboard`)} className="flex items-center gap-2 text-sm flex-shrink-0" style={{ color: '#7b88c0', background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex gap-2">
              <button onClick={() => navigate('/vip/leaderboard')} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: !isReseller ? 'rgba(255,180,0,0.15)' : 'rgba(255,255,255,0.04)', color: !isReseller ? GOLD : '#7b88c0', border: `1px solid ${!isReseller ? 'rgba(255,180,0,0.3)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer' }}>✦ VIP</button>
              <button onClick={() => navigate('/reseller/leaderboard')} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: isReseller ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.04)', color: isReseller ? GREEN : '#7b88c0', border: `1px solid ${isReseller ? 'rgba(0,230,118,0.3)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer' }}>◆ RESELLER</button>
            </div>
            <MemberDropdown isReseller={isReseller} />
          </div>
        </div>

        <div className="text-center mb-8">
          <p className="text-5xl mb-3">🏆</p>
          <h1 className="text-3xl font-black tracking-wider" style={{ color: accent, fontFamily: "'Rajdhani','Inter',sans-serif" }}>
            {isReseller ? 'RESELLER' : 'VIP'} LEADERBOARD
          </h1>
          <p className="text-xs uppercase tracking-widest mt-1" style={{ color: '#3a4570' }}>Top 10 by current balance · updates every 30s</p>
        </div>

        {user && myRank > 0 && (
          <div className="mb-4 p-3 rounded-xl flex items-center justify-between" style={{ background: `${accent}08`, border: `1px solid ${accent}25` }}>
            <span className="text-xs font-bold" style={{ color: accent }}>Your Rank: #{myRank}</span>
            <span className="text-xs font-bold" style={{ color: accent }}>{myTokens} <TokenIcon size={13} /></span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-xs uppercase tracking-widest" style={{ color: '#3a4570' }}>Loading...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-xs" style={{ color: '#3a4570' }}>No entries yet. Make a purchase to earn tokens!</div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${accent}18` }}>
            {entries.map((entry, i) => {
              const isMe = entry.email === user?.email;
              return (
                <div key={entry.user_id} className="flex items-center gap-4 px-5 py-4" style={{ background: isMe ? `${accent}06` : i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="w-8 text-center">
                    {RANK_ICONS[entry.rank] ? (
                      <span className="text-xl">{RANK_ICONS[entry.rank]}</span>
                    ) : (
                      <span className="text-sm font-bold" style={{ color: '#3a4570' }}>#{entry.rank}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: isMe ? accent : '#c8d0f0' }}>
                      {entry.email} {isMe && <span className="text-[10px]">(you)</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-black" style={{ color: accent, fontFamily: "'Rajdhani','Inter',sans-serif" }}>{entry.tokens} <TokenIcon size={14} /></p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
