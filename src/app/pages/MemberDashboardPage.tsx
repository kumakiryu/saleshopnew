import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useCustomerAuth } from '@/lib/customerAuth';
import MemberDropdown from './MemberDropdown';
import TokenIcon from '@/app/components/TokenIcon';

function toRawGithubUrl(url: string): string {
  if (!url) return url;
  // Convert github.com/user/repo/blob/branch/file → raw.githubusercontent.com/user/repo/branch/file
  return url.replace(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)$/, 'https://raw.githubusercontent.com/$1/$2');
}

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

  const audioRef = useRef<HTMLAudioElement>(null);
  const [musicSrc, setMusicSrc] = useState('');
  const [musicName, setMusicName] = useState('');
  const [musicArtist, setMusicArtist] = useState('');
  const [musicLoaded, setMusicLoaded] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicMuted, setMusicMuted] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [musicMinimized, setMusicMinimized] = useState(false);
  const [musicNeedsClick, setMusicNeedsClick] = useState(false);

  useEffect(() => {
    if (!user) { navigate(basePath); return; }
    const tier = user.tier;
    if (tier === 'normal') { navigate('/'); return; }
    refreshTokens();
    loadTransactions();
    loadOrders();
    fetchMusicConfig();
  }, [user]);

  function fetchMusicConfig() {
    const session = (() => { try { const r = localStorage.getItem('cs_session'); return r ? JSON.parse(r) : null; } catch { return null; } })();
    if (!session?.access_token) { setMusicLoaded(true); return; }
    fetch(`/api/get-tokens?_t=${Date.now()}`, { cache: 'no-store', headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { setMusicLoaded(true); return; }
        // Prefer fallback raw audio; YouTube URL used only as display info
        const raw = typeof d.bg_music_url === 'string' ? toRawGithubUrl(d.bg_music_url.trim()) : '';
        setMusicSrc(raw);
        setMusicName(d.music_name ?? '');
        setMusicArtist(d.music_artist ?? '');
        setMusicLoaded(true);
      })
      .catch(() => setMusicLoaded(true));
  }

  // Auto-play on src load: try unmuted first (works when user navigated via a click),
  // fall back to muted (browser allows), last resort shows tap-to-play.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !musicSrc) return;
    el.volume = musicVolume;
    el.muted = false;
    el.play()
      .then(() => { setMusicPlaying(true); setMusicMuted(false); setMusicNeedsClick(false); })
      .catch(() => {
        // Unmuted blocked — try muted (always allowed)
        el.muted = true;
        el.play()
          .then(() => { setMusicPlaying(true); setMusicMuted(true); setMusicNeedsClick(false); })
          .catch(() => { setMusicNeedsClick(true); });
      });
  }, [musicSrc]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = musicVolume;
  }, [musicVolume]);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (musicPlaying) {
      el.pause();
      setMusicPlaying(false);
    } else {
      el.play().then(() => setMusicPlaying(true)).catch(() => setMusicNeedsClick(true));
    }
  }

  function handleUnmute() {
    const el = audioRef.current;
    if (!el) return;
    el.muted = false;
    setMusicMuted(false);
    if (!musicPlaying) {
      el.play().then(() => setMusicPlaying(true)).catch(() => {});
    }
    setMusicNeedsClick(false);
  }

  const hasMusic = !!musicSrc;

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
      {musicSrc && (
        <audio ref={audioRef} src={musicSrc} loop preload="auto" />
      )}
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
      <div className="relative z-20 max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between">
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

      {/* Floating music player */}
      {musicLoaded && hasMusic && !musicMinimized && (
        <div className="fixed bottom-5 right-5 z-50 rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: 'rgba(8,10,24,0.97)', border: `1px solid ${accent}30`, backdropFilter: 'blur(20px)', width: 228 }}>
          <style>{`@keyframes eq-bar { 0%{transform:scaleY(0.3)} 100%{transform:scaleY(1)} }`}</style>
          {/* Top bar */}
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span style={{ color: accent, fontSize: 11 }}>♪</span>
              <span className="text-[9px] uppercase tracking-[0.2em] font-bold" style={{ color: accent }}>
                {musicPlaying && !musicMuted ? 'Now Playing' : musicPlaying ? 'Playing (muted)' : 'Paused'}
              </span>
            </div>
            <button onClick={() => setMusicMinimized(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a4570', fontSize: 13, lineHeight: 1, padding: '0 2px' }}>−</button>
          </div>

          {/* Track info */}
          <div className="px-3 pb-1">
            <p className="text-xs font-semibold truncate" style={{ color: '#e8eaf6' }}>{musicName || 'Background Music'}</p>
            {musicArtist && <p className="text-[10px] truncate" style={{ color: '#7b88c0' }}>{musicArtist}</p>}
          </div>

          {/* Equaliser */}
          <div className="flex items-end gap-[3px] px-3 py-2" style={{ height: 28 }}>
            {[0.4,0.7,1,0.6,0.9,0.5,0.8,0.65,0.45].map((h, i) => (
              <div key={i} style={{ width: 3, borderRadius: 2, background: accent,
                opacity: (!musicPlaying || musicMuted) ? 0.2 : 0.85,
                height: `${h * 18}px`,
                animation: musicPlaying && !musicMuted ? `eq-bar ${0.45 + i * 0.06}s ease-in-out infinite alternate` : 'none',
                transformOrigin: 'bottom',
              }} />
            ))}
          </div>

          {/* Unmute CTA — shown when playing muted or blocked */}
          {(musicMuted || musicNeedsClick) && (
            <button onClick={handleUnmute}
              className="mx-3 mb-2 w-[calc(100%-24px)] flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold"
              style={{ background: `${accent}22`, border: `1px solid ${accent}50`, color: accent, cursor: 'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
              {musicNeedsClick ? 'Tap to Play Music' : 'Tap to Unmute'}
            </button>
          )}

          {/* Controls row */}
          <div className="flex items-center gap-2 px-3 pb-3">
            {/* Play/Pause */}
            <button onClick={togglePlay}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: `${accent}18`, border: `1px solid ${accent}40`, color: accent, cursor: 'pointer' }}>
              {musicPlaying
                ? <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                : <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
              }
            </button>
            {/* Volume */}
            <input type="range" min="0" max="1" step="0.05" value={musicVolume}
              onChange={e => setMusicVolume(Number(e.target.value))}
              style={{ flex: 1, accentColor: accent, height: 3, cursor: 'pointer' }} />
            {/* Mute toggle */}
            {musicPlaying && !musicNeedsClick && (
              <button onClick={() => {
                const el = audioRef.current; if (!el) return;
                el.muted = !musicMuted; setMusicMuted(m => !m);
              }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: musicMuted ? '#4a5580' : accent, padding: '2px', flexShrink: 0 }}>
                {musicMuted
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                }
              </button>
            )}
          </div>
        </div>
      )}

      {/* Minimized pill */}
      {musicLoaded && hasMusic && musicMinimized && (
        <button onClick={() => setMusicMinimized(false)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-2xl"
          style={{ background: 'rgba(8,10,24,0.97)', border: `1px solid ${accent}35`, cursor: 'pointer' }}>
          <div className="flex items-end gap-[2px]" style={{ height: 14 }}>
            {[0.6,1,0.7,0.9,0.5].map((h, i) => (
              <div key={i} style={{ width: 2, borderRadius: 1, background: accent,
                height: `${h * 12}px`, opacity: musicPlaying && !musicMuted ? 0.9 : 0.3,
                animation: musicPlaying && !musicMuted ? `eq-bar ${0.4 + i * 0.08}s ease-in-out infinite alternate` : 'none',
                transformOrigin: 'bottom',
              }} />
            ))}
          </div>
          {musicName && <span className="text-[10px] font-semibold max-w-[100px] truncate" style={{ color: '#c8d0f0' }}>{musicName}</span>}
        </button>
      )}
    </div>
  );
}
