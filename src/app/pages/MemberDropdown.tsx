import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useCustomerAuth } from '@/lib/customerAuth';

const GOLD = '#FFB400';
const GREEN = '#00E676';

interface Props {
  isReseller: boolean;
}

export default function MemberDropdown({ isReseller }: Props) {
  const navigate = useNavigate();
  const { user, signOut, tokenBalance } = useCustomerAuth();
  const accent = isReseller ? GREEN : GOLD;
  const basePath = isReseller ? '/reseller' : '/vip';
  const tokenCount = isReseller ? (tokenBalance?.resellerTokens ?? 0) : (tokenBalance?.vipTokens ?? 0);

  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => setDropOpen(d => !d)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: '#c8d0f0' }}
      >
        <span style={{ color: '#7b88c0' }}>{user.email}</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: isReseller ? 'rgba(0,230,118,0.15)' : 'rgba(255,180,0,0.15)', color: accent }}>
          {isReseller ? '◆ RESELLER' : '✦ VIP'}
        </span>
        <span style={{ color: accent, fontSize: 10, fontWeight: 700 }}>🪙 {tokenCount}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3a4570' }}><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {dropOpen && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 210, background: '#111520', border: `1px solid ${isReseller ? 'rgba(0,230,118,0.2)' : 'rgba(255,180,0,0.2)'}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 100, overflow: 'hidden', animation: 'fadeInDrop 0.15s ease' }}>
          {[
            { label: 'My Dashboard', path: `${basePath}/dashboard`, icon: '👤' },
            { label: 'Token Wallet', path: `${basePath}/dashboard`, icon: '🪙' },
            { label: 'Leaderboard', path: `${basePath}/leaderboard`, icon: '🏆' },
            { label: 'Rewards Store', path: `${basePath}/rewards`, icon: '🎁' },
            { label: 'Top Up Tokens', path: `${basePath}/topup`, icon: '⚡' },
          ].map(item => (
            <button key={item.label} onClick={() => { setDropOpen(false); navigate(item.path); }}
              style={{ width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#c8d0f0', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              onMouseEnter={e => (e.currentTarget.style.background = isReseller ? 'rgba(0,230,118,0.06)' : 'rgba(255,180,0,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
          <button onClick={() => { setDropOpen(false); signOut(); navigate('/'); }}
            style={{ width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#FF6B6B', display: 'flex', alignItems: 'center', gap: 8 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,68,68,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <span>🚪</span>Logout
          </button>
        </div>
      )}
    </div>
  );
}
