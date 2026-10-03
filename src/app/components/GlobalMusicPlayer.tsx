import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useCustomerAuth } from '@/lib/customerAuth';

function toRawGithubUrl(url: string): string {
  if (!url) return url;
  return url.replace(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)$/, 'https://raw.githubusercontent.com/$1/$2');
}

const GOLD = '#FFB400';
const GREEN = '#00E676';

export default function GlobalMusicPlayer() {
  const { user } = useCustomerAuth();
  const { pathname } = useLocation();

  const isMemberRoute = pathname.startsWith('/vip/') || pathname.startsWith('/reseller/');
  const isReseller = pathname.startsWith('/reseller');
  const accent = isReseller ? GREEN : GOLD;

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

  // Load music config once when user logs in as member
  useEffect(() => {
    if (!user || user.tier === 'normal') return;
    if (musicLoaded) return;
    const session = (() => { try { const r = localStorage.getItem('cs_session'); return r ? JSON.parse(r) : null; } catch { return null; } })();
    if (!session?.access_token) { setMusicLoaded(true); return; }
    fetch(`/api/get-tokens?_t=${Date.now()}`, { cache: 'no-store', headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { setMusicLoaded(true); return; }
        const raw = typeof d.bg_music_url === 'string' ? toRawGithubUrl(d.bg_music_url.trim()) : '';
        setMusicSrc(raw);
        setMusicName(d.music_name ?? '');
        setMusicArtist(d.music_artist ?? '');
        setMusicLoaded(true);
      })
      .catch(() => setMusicLoaded(true));
  }, [user]);

  // Auto-play when src is available
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !musicSrc) return;
    el.volume = musicVolume;
    el.muted = false;
    el.play()
      .then(() => { setMusicPlaying(true); setMusicMuted(false); setMusicNeedsClick(false); })
      .catch(() => {
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
    if (!musicPlaying) el.play().then(() => setMusicPlaying(true)).catch(() => {});
    setMusicNeedsClick(false);
  }

  const hasMusic = !!musicSrc;
  const showPlayer = isMemberRoute && musicLoaded && hasMusic;

  return (
    <>
      {musicSrc && <audio ref={audioRef} src={musicSrc} loop preload="auto" />}

      {showPlayer && !musicMinimized && (
        <div className="fixed bottom-5 right-5 z-50 rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: 'rgba(8,10,24,0.97)', border: `1px solid ${accent}30`, backdropFilter: 'blur(20px)', width: 228 }}>
          <style>{`@keyframes eq-bar { 0%{transform:scaleY(0.3)} 100%{transform:scaleY(1)} }`}</style>
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span style={{ color: accent, fontSize: 11 }}>♪</span>
              <span className="text-[9px] uppercase tracking-[0.2em] font-bold" style={{ color: accent }}>
                {musicPlaying && !musicMuted ? 'Now Playing' : musicPlaying ? 'Playing (muted)' : 'Paused'}
              </span>
            </div>
            <button onClick={() => setMusicMinimized(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a4570', fontSize: 13, lineHeight: 1, padding: '0 2px' }}>−</button>
          </div>

          <div className="px-3 pb-1">
            <p className="text-xs font-semibold truncate" style={{ color: '#e8eaf6' }}>{musicName || 'Background Music'}</p>
            {musicArtist && <p className="text-[10px] truncate" style={{ color: '#7b88c0' }}>{musicArtist}</p>}
          </div>

          <div className="flex items-end gap-[3px] px-3 py-2" style={{ height: 28 }}>
            {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.65, 0.45].map((h, i) => (
              <div key={i} style={{
                width: 3, borderRadius: 2, background: accent,
                opacity: (!musicPlaying || musicMuted) ? 0.2 : 0.85,
                height: `${h * 18}px`,
                animation: musicPlaying && !musicMuted ? `eq-bar ${0.45 + i * 0.06}s ease-in-out infinite alternate` : 'none',
                transformOrigin: 'bottom',
              }} />
            ))}
          </div>

          {(musicMuted || musicNeedsClick) && (
            <button onClick={handleUnmute}
              className="mx-3 mb-2 w-[calc(100%-24px)] flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold"
              style={{ background: `${accent}22`, border: `1px solid ${accent}50`, color: accent, cursor: 'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
              {musicNeedsClick ? 'Tap to Play Music' : 'Tap to Unmute'}
            </button>
          )}

          <div className="flex items-center gap-2 px-3 pb-3">
            <button onClick={togglePlay}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: `${accent}18`, border: `1px solid ${accent}40`, color: accent, cursor: 'pointer' }}>
              {musicPlaying
                ? <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                : <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
              }
            </button>
            <input type="range" min="0" max="1" step="0.05" value={musicVolume}
              onChange={e => setMusicVolume(Number(e.target.value))}
              style={{ flex: 1, accentColor: accent, height: 3, cursor: 'pointer' }} />
            {musicPlaying && !musicNeedsClick && (
              <button onClick={() => {
                const el = audioRef.current; if (!el) return;
                el.muted = !musicMuted; setMusicMuted(m => !m);
              }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: musicMuted ? '#4a5580' : accent, padding: '2px', flexShrink: 0 }}>
                {musicMuted
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                }
              </button>
            )}
          </div>
        </div>
      )}

      {showPlayer && musicMinimized && (
        <button onClick={() => setMusicMinimized(false)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-2xl"
          style={{ background: 'rgba(8,10,24,0.97)', border: `1px solid ${accent}35`, cursor: 'pointer' }}>
          <div className="flex items-end gap-[2px]" style={{ height: 14 }}>
            {[0.6, 1, 0.7, 0.9, 0.5].map((h, i) => (
              <div key={i} style={{
                width: 2, borderRadius: 1, background: accent,
                height: `${h * 12}px`, opacity: musicPlaying && !musicMuted ? 0.9 : 0.3,
                animation: musicPlaying && !musicMuted ? `eq-bar ${0.4 + i * 0.08}s ease-in-out infinite alternate` : 'none',
                transformOrigin: 'bottom',
              }} />
            ))}
          </div>
          {musicName && <span className="text-[10px] font-semibold max-w-[100px] truncate" style={{ color: '#c8d0f0' }}>{musicName}</span>}
        </button>
      )}
    </>
  );
}
