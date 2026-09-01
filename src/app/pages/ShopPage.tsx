import { useEffect, useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router';
import { format } from 'date-fns';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import logoImage from '@/imports/image-1.png';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useAnnouncements } from '@/lib/useAnnouncements';
import { CATEGORY_STYLE, renderContent } from './AnnouncementsPage';
import type { Product } from '@/lib/types';

/* ── Cart Bubble ─────────────────────────────────────────────── */
function CartBubble() {
  const navigate = useNavigate();
  const { cartCount } = useStore();
  const count = cartCount();
  if (count === 0) return null;
  return (
    <motion.button
      onClick={() => navigate('/cart')}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-2xl select-none"
      style={{
        background: 'linear-gradient(135deg, rgba(0,191,255,0.18) 0%, rgba(138,43,226,0.18) 100%)',
        border: '1px solid rgba(0,191,255,0.4)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 0 24px rgba(0,191,255,0.2)',
        color: '#ffffff',
      }}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      <span className="text-sm font-bold" style={{ fontFamily: "'Rajdhani','Inter',sans-serif", letterSpacing: '0.04em' }}>
        Cart · {count}
      </span>
    </motion.button>
  );
}

const DISCORD_INVITE_URL = 'https://discord.gg/2n5UZj56Nk';

const PARTICLES = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 1,
  duration: Math.random() * 8 + 6,
  delay: -(Math.random() * 10),
  blue: Math.random() > 0.5,
}));

const CATEGORY_CONFIG: Record<string, { icon: string; accent: string }> = {
  'Rockstar Games':   { icon: '🎮', accent: '#FF4500' },
  'Discord Accounts': { icon: '💬', accent: '#5865F2' },
  'Steam Accounts':   { icon: '🎲', accent: '#1b9ddb' },
};

const CSS = `
  @keyframes particle-float {
    0%, 100% { transform: translateY(0);     opacity: var(--p-lo); }
    50%       { transform: translateY(-28px); opacity: var(--p-hi); }
  }
  @keyframes glow-pulse {
    0%, 100% { filter: drop-shadow(0 0 28px rgba(0,191,255,0.32)) drop-shadow(0 0 56px rgba(138,43,226,0.18)); }
    50%       { filter: drop-shadow(0 0 48px rgba(0,191,255,0.55)) drop-shadow(0 0 88px rgba(138,43,226,0.36)); }
  }
  @keyframes aura-pulse {
    0%, 100% { transform: scale(1.3); opacity: 0.55; }
    50%       { transform: scale(1.65); opacity: 0.85; }
  }
  @keyframes scan {
    from { transform: translateY(0); }
    to   { transform: translateY(100vh); }
  }
  .logo-glow { animation: glow-pulse 3s ease-in-out infinite; will-change: filter; }
  .aura      { animation: aura-pulse 3s ease-in-out infinite; will-change: transform, opacity; }
  .scan-line { animation: scan 8s linear infinite; will-change: transform; }
  .btn-primary {
    background: linear-gradient(135deg, rgba(0,191,255,0.12) 0%, rgba(138,43,226,0.12) 100%);
    border: 1px solid rgba(0,191,255,0.35);
    backdrop-filter: blur(12px);
    box-shadow: 0 0 12px rgba(0,191,255,0.15), inset 0 1px 0 rgba(255,255,255,0.05);
    transition: background 0.3s, border-color 0.3s, box-shadow 0.3s, transform 0.3s;
    will-change: transform;
  }
  .btn-primary:hover {
    background: linear-gradient(135deg, rgba(0,191,255,0.22) 0%, rgba(138,43,226,0.22) 100%);
    border-color: rgba(0,191,255,0.7);
    box-shadow: 0 0 24px rgba(0,191,255,0.45), 0 0 48px rgba(138,43,226,0.25), inset 0 1px 0 rgba(255,255,255,0.08);
    transform: translateY(-2px);
  }
  .btn-primary:hover .btn-icon  { color: #00BFFF; }
  .btn-primary:hover .btn-arrow { color: #00BFFF; transform: translateX(3px); }
  .btn-icon  { color: #a0aec0; transition: color 0.3s; }
  .btn-arrow { color: #7b88c0; transform: translateX(0); transition: transform 0.3s, color 0.3s; }
  .btn-ghost {
    border: 1px solid rgba(255,255,255,0.1);
    transition: border-color 0.3s, background 0.3s, transform 0.3s;
    will-change: transform;
  }
  .btn-ghost:hover {
    border-color: rgba(0,191,255,0.3);
    background: rgba(0,191,255,0.05);
    transform: translateY(-1px);
  }
  .product-card {
    background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%);
    border: 1px solid rgba(255,255,255,0.07);
    backdrop-filter: blur(8px);
    transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s;
    will-change: transform;
  }
  .product-card:hover {
    border-color: rgba(0,191,255,0.25);
    box-shadow: 0 0 24px rgba(0,191,255,0.07);
    transform: translateY(-3px);
  }
  .btn-cart {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    font-family: 'Rajdhani','Inter',sans-serif;
    border: 1px solid rgba(255,255,255,0.1);
    color: #7b88c0;
    background: transparent;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-cart:hover:not(:disabled) {
    border-color: rgba(0,191,255,0.35);
    background: rgba(0,191,255,0.07);
    color: #c8d0f0;
  }
  .btn-cart:disabled { opacity: 0.35; cursor: not-allowed; }
  .btn-buynow {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    font-family: 'Rajdhani','Inter',sans-serif;
    border: 1px solid rgba(0,191,255,0.3);
    color: #e8eaf6;
    background: linear-gradient(135deg, rgba(0,191,255,0.12) 0%, rgba(138,43,226,0.12) 100%);
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-buynow:hover:not(:disabled) {
    border-color: rgba(0,191,255,0.6);
    background: linear-gradient(135deg, rgba(0,191,255,0.2) 0%, rgba(138,43,226,0.2) 100%);
    box-shadow: 0 0 16px rgba(0,191,255,0.2);
  }
  .btn-buynow:disabled { opacity: 0.35; cursor: not-allowed; }
  .ann-widget {
    transition: border-color 0.3s, box-shadow 0.3s, transform 0.2s;
  }
  .ann-widget:hover {
    border-color: rgba(0,191,255,0.25) !important;
    box-shadow: 0 0 20px rgba(0,191,255,0.06);
    transform: translateY(-1px);
  }
`;

const pageVariants = {
  enter:  (dir: number) => ({ opacity: 0, x: dir * 60 }),
  center: { opacity: 1, x: 0 },
  exit:   (dir: number) => ({ opacity: 0, x: dir * -60 }),
};

const DISCORD_PATH = 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z';

function StockBadge({ stock }: { stock: number }) {
  const out = stock === 0;
  const low = !out && stock < 5;
  const color = out ? '#FF4444' : low ? '#FF8C00' : '#00E676';
  const bg    = out ? 'rgba(255,68,68,0.12)' : low ? 'rgba(255,140,0,0.12)' : 'rgba(0,230,118,0.12)';
  const label = out ? 'OUT OF STOCK' : low ? `ONLY ${stock} LEFT` : 'IN STOCK';
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-widest uppercase"
      style={{ background: bg, color, border: `1px solid ${color}33` }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {label}
    </span>
  );
}

function Background() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0" style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,100,255,0.12) 0%, transparent 65%), radial-gradient(ellipse 60% 50% at 30% 70%, rgba(138,43,226,0.10) 0%, transparent 60%)',
      }} />
      <div className="pointer-events-none fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(0,191,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,191,255,1) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {PARTICLES.map((p) => (
          <div key={p.id} className="absolute rounded-full" style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            background: p.blue ? '#00BFFF' : '#8A2BE2',
            boxShadow: `0 0 ${p.size * 4}px ${p.blue ? '#00BFFF' : '#8A2BE2'}`,
            '--p-lo': p.blue ? '0.15' : '0.12',
            '--p-hi': p.blue ? '0.45' : '0.38',
            animation: `particle-float ${p.duration}s ${p.delay}s ease-in-out infinite`,
            willChange: 'transform, opacity',
          } as CSSProperties} />
        ))}
      </div>
      <div className="scan-line pointer-events-none fixed top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(0,191,255,0.4), transparent)' }} />
    </>
  );
}

function DiscordCTA({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer"
      className={`btn-primary inline-flex items-center gap-3 rounded-xl select-none focus-visible:outline-none ${lg ? 'px-9 py-4' : 'px-8 py-3.5'}`}
      style={{ color: '#ffffff' }}>
      <svg width={lg ? 22 : 18} height={lg ? 22 : 18} viewBox="0 0 24 24" fill="currentColor" className="btn-icon">
        <path d={DISCORD_PATH} />
      </svg>
      <span style={{ fontFamily: "'Rajdhani', 'Inter', sans-serif", fontSize: lg ? '1.05rem' : '1rem', fontWeight: 700, letterSpacing: '0.06em' }}>
        Join Our Discord Server
      </span>
      {lg && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="btn-arrow">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      )}
    </a>
  );
}

export default function ShopPage() {
  const { products, setProducts, upsertProduct, removeProduct } = useStore();
  const announcements = useAnnouncements();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { addToCart, cartItems } = useStore();
  const [page, setPage] = useState<'home' | 'stock'>(pathname === '/stock' ? 'stock' : 'home');
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showPayments, setShowPayments] = useState(false);

  useEffect(() => {
    supabase.from('products').select('*').order('category')
      .then(({ data }) => { if (data) setProducts(data); setLoading(false); });

    const ch = supabase.channel('products-public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        if (payload.eventType === 'DELETE') removeProduct((payload.old as { id: string }).id);
        else upsertProduct(payload.new as Product);
      }).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  // sync route → page state (handles browser back/forward)
  useEffect(() => {
    if (pathname === '/stock' && page !== 'stock') { setDir(1); setPage('stock'); }
    else if (pathname !== '/stock' && page !== 'home') { setDir(-1); setPage('home'); }
  }, [pathname]);

  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category ?? 'Other';
    return { ...acc, [cat]: [...(acc[cat] ?? []), p] };
  }, {});

  function goTo(target: 'home' | 'stock') {
    setDir(target === 'stock' ? 1 : -1);
    setPage(target);
    navigate(target === 'stock' ? '/stock' : '/');
  }

  // Latest non-expired announcement for widget
  const latestAnnouncement = announcements[0] ?? null;

  return (
    <div className="relative w-full min-h-screen overflow-hidden" style={{ background: '#050816', fontFamily: "'Inter', sans-serif" }}>
      <style>{CSS}</style>
      <Background />
      <CartBubble />

      <AnimatePresence mode="wait" custom={dir}>
        {page === 'home' ? (

          /* ── HOME ── */
          <motion.div key="home" custom={dir} variants={pageVariants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 min-h-screen flex items-center justify-center px-6"
          >
            <div className="flex flex-col items-center text-center w-full max-w-lg">
              {/* Logo */}
              <div className="logo-glow relative mb-8">
                <div className="aura absolute inset-0 rounded-full" style={{
                  background: 'radial-gradient(ellipse at center, rgba(0,191,255,0.18) 0%, rgba(138,43,226,0.12) 40%, transparent 70%)',
                }} />
                <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
                  <ImageWithFallback src={logoImage} alt="Sale Shop" className="relative z-10 h-auto object-contain"
                    style={{ width: 'min(480px, 85vw)' }} />
                </motion.div>
              </div>

              <motion.p className="mb-10 text-sm sm:text-base uppercase"
                style={{ color: '#7b88c0', letterSpacing: '0.22em' }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 }}>
                Digital Products&nbsp;&nbsp;•&nbsp;&nbsp;Fast Delivery&nbsp;&nbsp;•&nbsp;&nbsp;Trusted Service
              </motion.p>

              <motion.div className="flex flex-col items-center gap-3 w-full"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}>
                <DiscordCTA size="lg" />
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => goTo('stock')}
                      className="btn-ghost inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm select-none focus-visible:outline-none"
                      style={{ color: '#7b88c0', background: 'transparent' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" />
                        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                        <line x1="12" y1="12" x2="12" y2="16" /><line x1="10" y1="14" x2="14" y2="14" />
                      </svg>
                      <span style={{ fontFamily: "'Rajdhani', 'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.06em' }}>Browse Stock</span>
                    </button>
                    <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.08)' }} />
                    <button onClick={() => navigate('/announcements')}
                      className="btn-ghost inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm select-none focus-visible:outline-none"
                      style={{ color: '#7b88c0', background: 'transparent' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3z" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      <span style={{ fontFamily: "'Rajdhani', 'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.06em' }}>Announcements</span>
                    </button>
                    <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.08)' }} />
                    <button onClick={() => setShowPayments(p => !p)}
                      className="btn-ghost inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm select-none focus-visible:outline-none"
                      style={{ color: showPayments ? '#c8d0f0' : '#7b88c0', background: showPayments ? 'rgba(0,191,255,0.05)' : 'transparent', borderColor: showPayments ? 'rgba(0,191,255,0.2)' : undefined }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                      <span style={{ fontFamily: "'Rajdhani', 'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.06em' }}>Payments</span>
                    </button>
                  </div>

                  {/* Payment methods popover */}
                  {showPayments && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-col items-center gap-3 px-5 py-4 rounded-2xl"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(12px)',
                      }}
                    >
                      <div className="flex items-center gap-2 flex-wrap justify-center">
                        {[
                          { label: 'GCash',     color: '#007AFF', bg: 'rgba(0,122,255,0.1)',     border: 'rgba(0,122,255,0.25)' },
                          { label: 'Bitcoin',   color: '#F7931A', bg: 'rgba(247,147,26,0.1)',    border: 'rgba(247,147,26,0.25)' },
                          { label: 'Litecoin',  color: '#B8B8B8', bg: 'rgba(184,184,184,0.1)',   border: 'rgba(184,184,184,0.2)' },
                          { label: 'Ethereum',  color: '#627EEA', bg: 'rgba(98,126,234,0.1)',    border: 'rgba(98,126,234,0.25)' },
                        ].map(m => (
                          <span key={m.label}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase"
                            style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}`, fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>
                            {m.label}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-center" style={{ color: '#2e3a5a', letterSpacing: '0.04em' }}>
                        Inquire in the server for more payment methods
                      </p>
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* ── Latest Announcement Widget ── */}
              {latestAnnouncement && (
                <motion.div className="w-full mt-10"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.65 }}>
                  <p className="text-[10px] uppercase tracking-[0.3em] mb-3 text-center" style={{ color: '#2e3a5a' }}>Latest News</p>
                  <button onClick={() => navigate('/announcements')} className="ann-widget w-full text-left rounded-xl p-4"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      backdropFilter: 'blur(8px)',
                    }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* category badge */}
                        {(() => {
                          const cat = CATEGORY_STYLE[latestAnnouncement.category] ?? CATEGORY_STYLE['News'];
                          return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase mb-2"
                              style={{ background: cat.bg, color: cat.color }}>
                              {latestAnnouncement.category}
                            </span>
                          );
                        })()}
                        <h3 className="text-sm font-bold leading-tight mb-1 truncate"
                          style={{ color: '#c8d0f0', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>
                          {latestAnnouncement.title}
                        </h3>
                        <p className="text-xs line-clamp-1" style={{ color: '#3a4570' }}>
                          {latestAnnouncement.content.replace(/[#*\[\]()_`]/g, '').slice(0, 80)}
                        </p>
                        {latestAnnouncement.created_by && (
                          <p className="text-[10px] mt-1.5" style={{ color: '#2e3a5a' }}>
                            {latestAnnouncement.created_by} · {format(new Date(latestAnnouncement.created_at), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1 text-xs" style={{ color: '#00BFFF' }}>
                        <span style={{ fontFamily: "'Rajdhani', 'Inter', sans-serif", fontWeight: 600 }}>Read More</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                        </svg>
                      </div>
                    </div>
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>

        ) : (

          /* ── STOCK ── */
          <motion.div key="stock" custom={dir} variants={pageVariants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 min-h-screen flex flex-col px-4 sm:px-8 pt-10 pb-16"
          >
            <div className="w-full max-w-3xl mx-auto">
              <motion.button onClick={() => goTo('home')}
                className="btn-ghost inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm mb-10 select-none focus-visible:outline-none"
                style={{ color: '#7b88c0', background: 'transparent' }}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span style={{ fontFamily: "'Rajdhani', 'Inter', sans-serif", fontWeight: 600 }}>Back</span>
              </motion.button>

              <motion.div className="mb-10" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani', 'Inter', sans-serif", letterSpacing: '0.05em' }}>
                  STOCKS
                </h1>
                <p className="text-xs uppercase tracking-[0.25em]" style={{ color: '#3a4570' }}>Real-time inventory</p>
                <div className="mt-4 h-px" style={{ background: 'linear-gradient(90deg, rgba(0,191,255,0.4), transparent)' }} />
              </motion.div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <span className="text-xs uppercase tracking-widest" style={{ color: '#3a4570' }}>Loading inventory...</span>
                </div>
              ) : Object.keys(grouped).length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <span className="text-xs uppercase tracking-widest" style={{ color: '#3a4570' }}>No products available.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-10">
                  {Object.entries(grouped).map(([cat, items], ci) => {
                    const cfg = CATEGORY_CONFIG[cat] ?? { icon: '●', accent: '#00BFFF' };
                    return (
                      <motion.div key={cat} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + ci * 0.1 }}>
                        {/* Category header */}
                        <div className="flex items-center gap-3 mb-5">
                          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: cfg.accent }}>{cat}</span>
                          <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${cfg.accent}44, transparent)` }} />
                          <span className="text-[10px] uppercase tracking-widest" style={{ color: '#2e3a5a' }}>{items.length} items</span>
                        </div>
                        {/* Card grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {items.map((item, ii) => {
                            const inCart = cartItems.find(c => c.product.id === item.id);
                            const soldOut = item.stock === 0;
                            return (
                              <motion.div key={item.id} className="product-card rounded-2xl overflow-hidden flex flex-col"
                                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25 + ci * 0.08 + ii * 0.06 }}>
                                {/* Image */}
                                {item.image_url ? (
                                  <div className="w-full h-36 overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="w-full h-36 flex items-center justify-center" style={{ background: 'rgba(0,191,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(0,191,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                                    </svg>
                                  </div>
                                )}
                                {/* Body */}
                                <div className="flex flex-col flex-1 p-4 gap-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <h3 className="text-sm font-bold leading-tight" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>{item.name}</h3>
                                      {item.description && (
                                        <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: '#3a4570' }}>{item.description}</p>
                                      )}
                                    </div>
                                    <span className="text-base font-bold flex-shrink-0" style={{ color: '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>₱{item.price}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <StockBadge stock={item.stock} />
                                    {item.stock > 0 && (
                                      <span className="text-[10px]" style={{ color: '#2e3a5a' }}>{item.stock} left</span>
                                    )}
                                    {inCart && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,191,255,0.1)', color: '#00BFFF' }}>
                                        {inCart.quantity} in cart
                                      </span>
                                    )}
                                  </div>
                                  {/* Buttons */}
                                  <div className="flex gap-2 mt-auto pt-1">
                                    <button
                                      className="btn-cart"
                                      disabled={soldOut}
                                      onClick={() => addToCart(item)}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                      </svg>
                                      Add to Cart
                                    </button>
                                    <button
                                      className="btn-buynow"
                                      disabled={soldOut}
                                      onClick={() => { addToCart(item); navigate('/checkout'); }}
                                    >
                                      Buy Now
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
