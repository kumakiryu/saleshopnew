import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { useAnnouncements } from '@/lib/useAnnouncements';
import { useStore } from '@/lib/store';
import type { Announcement } from '@/lib/types';
import logoImage from '@/imports/image-1.png';

/* ── category config ─────────────────────────────── */
export const CATEGORY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  'News':        { color: '#00BFFF', bg: 'rgba(0,191,255,0.09)',    border: 'rgba(0,191,255,0.22)' },
  'Update':      { color: '#8A2BE2', bg: 'rgba(138,43,226,0.09)',   border: 'rgba(138,43,226,0.22)' },
  'Promotion':   { color: '#00E676', bg: 'rgba(0,230,118,0.09)',    border: 'rgba(0,230,118,0.22)' },
  'Maintenance': { color: '#FF8C00', bg: 'rgba(255,140,0,0.09)',    border: 'rgba(255,140,0,0.22)' },
  'Event':       { color: '#FF69B4', bg: 'rgba(255,105,180,0.09)',  border: 'rgba(255,105,180,0.22)' },
  'Release':     { color: '#FFD700', bg: 'rgba(255,215,0,0.09)',    border: 'rgba(255,215,0,0.22)' },
  'Important':   { color: '#FF4444', bg: 'rgba(255,68,68,0.09)',    border: 'rgba(255,68,68,0.22)' },
};

const CATEGORIES = ['All', 'News', 'Update', 'Promotion', 'Maintenance', 'Event', 'Release', 'Important'];

/* ── content renderer (simple markdown) ─────────── */
export function renderContent(raw: string): string {
  return raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#00BFFF;text-decoration:underline;text-underline-offset:2px">$1</a>')
    .replace(/^## (.+)$/gm, '<div style="color:#F5F7FF;font-weight:700;font-size:1rem;margin:12px 0 5px;font-family:Exo 2,Inter,sans-serif;letter-spacing:0.03em">$1</div>')
    .replace(/^# (.+)$/gm,  '<div style="color:#F5F7FF;font-weight:800;font-size:1.15rem;margin:14px 0 5px;font-family:Exo 2,Inter,sans-serif;letter-spacing:0.04em">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#F5F7FF;font-weight:700">$1</strong>')
    .replace(/\*(.+?)\*/g,    '<em>$1</em>')
    .replace(/^- (.+)$/gm,   '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#00BFFF;flex-shrink:0;margin-top:2px">•</span><span>$1</span></div>')
    .replace(/\n/g, '<br/>');
}

const PAGE_CSS = `
  .ann-search::placeholder { color: #626C80; }
  .ann-search { outline: none; }
  .ann-search:focus { border-color: rgba(0,191,255,0.4) !important; box-shadow: 0 0 0 3px rgba(0,191,255,0.06) !important; }
  .cat-filter-btn { transition: all 0.18s; cursor: pointer; white-space: nowrap; }
  .cat-filter-btn:hover { color: #F5F7FF !important; background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.12) !important; }
  .cat-filter-btn.active { color: #00BFFF !important; background: rgba(0,191,255,0.09) !important; border-color: rgba(0,191,255,0.28) !important; }
  .ann-card {
    transition: border-color 0.22s, box-shadow 0.22s, transform 0.2s;
  }
  .ann-card:hover {
    border-color: rgba(255,255,255,0.12) !important;
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.3);
  }
  .ann-card.pinned:hover {
    border-color: rgba(0,191,255,0.3) !important;
    box-shadow: 0 12px 32px rgba(0,0,0,0.3), 0 0 24px rgba(0,191,255,0.06);
  }
  .nav-back-btn {
    border: 1px solid rgba(255,255,255,0.08);
    transition: border-color 0.2s, background 0.2s;
  }
  .nav-back-btn:hover { border-color: rgba(0,191,255,0.28); background: rgba(0,191,255,0.05); }
`;

/* ── announcement card ───────────────────────────── */
function AnnouncementCard({ a, index }: { a: Announcement; index: number }) {
  const cat = CATEGORY_STYLE[a.category] ?? CATEGORY_STYLE['News'];
  const dateStr = format(new Date(a.created_at), 'MMM d, yyyy');

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className={`ann-card ${a.pinned ? 'pinned' : ''} rounded-2xl overflow-hidden`}
      style={{
        background: a.pinned
          ? 'rgba(0,191,255,0.04)'
          : 'rgba(11,16,32,0.55)',
        border: a.pinned ? '1px solid rgba(0,191,255,0.18)' : '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {a.image_url && (
        <div className="w-full overflow-hidden" style={{ maxHeight: '220px' }}>
          <img src={a.image_url} alt={a.title} className="w-full object-cover" style={{ maxHeight: '220px' }} />
        </div>
      )}

      <div className="p-5 sm:p-6">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3.5">
          {a.pinned && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase"
              style={{ background: 'rgba(0,191,255,0.1)', color: '#00BFFF', border: '1px solid rgba(0,191,255,0.22)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00BFFF', boxShadow: '0 0 5px #00BFFF' }} />
              PINNED
            </span>
          )}
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase"
            style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}>
            {a.category}
          </span>
        </div>

        {/* Title */}
        <h2 className="leading-snug mb-2.5"
          style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 800, fontSize: 'clamp(16px, 3vw, 20px)', color: '#F5F7FF', letterSpacing: '0.02em' }}>
          {a.title}
        </h2>

        {/* Content */}
        <div
          className="leading-relaxed mb-4"
          style={{ color: '#98A2B8', fontSize: '14px' }}
          dangerouslySetInnerHTML={{ __html: renderContent(a.content) }}
        />

        {/* Meta */}
        <div className="flex items-center gap-3 pt-3.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {a.created_by && (
            <>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: 'rgba(0,191,255,0.12)', color: '#00BFFF', border: '1px solid rgba(0,191,255,0.2)' }}>
                {a.created_by[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#98A2B8' }}>{a.created_by}</span>
              <span style={{ color: '#626C80' }}>·</span>
            </>
          )}
          <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono','Inter',monospace", color: '#626C80' }}>{dateStr}</span>
        </div>
      </div>
    </motion.article>
  );
}

/* ── page ────────────────────────────────────────── */
export default function AnnouncementsPage() {
  const announcements = useAnnouncements();
  const { markSeen } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => { markSeen(); }, []);

  const sorted = useMemo(() => {
    return [...announcements].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [announcements]);

  const filtered = useMemo(() => {
    return sorted.filter(a => {
      const matchCat = activeFilter === 'All' || a.category === activeFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [sorted, activeFilter, search]);

  return (
    <div className="min-h-screen" style={{ background: '#060812', fontFamily: "'Inter', sans-serif" }}>
      <style>{PAGE_CSS}</style>

      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute rounded-full" style={{ width: '60vw', height: '60vw', top: '-15vw', right: '-10vw', background: 'radial-gradient(ellipse, rgba(138,43,226,0.07) 0%, transparent 65%)', filter: 'blur(40px)' }} />
        <div className="absolute rounded-full" style={{ width: '50vw', height: '50vw', bottom: '-10vw', left: '-10vw', background: 'radial-gradient(ellipse, rgba(0,100,255,0.06) 0%, transparent 65%)', filter: 'blur(40px)' }} />
      </div>

      {/* Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-5" style={{ background: 'rgba(6,8,18,0.75)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => navigate('/')} className="inline-flex items-center gap-2" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: '0.1em', background: 'linear-gradient(90deg, #F5F7FF 0%, #00BFFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>SALE SHOP</span>
        </button>
        <div style={{ flex: 1 }} />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-20">

        {/* Hero */}
        <motion.div className="mb-10" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5" style={{ background: 'rgba(0,191,255,0.07)', border: '1px solid rgba(0,191,255,0.16)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00BFFF', boxShadow: '0 0 6px #00BFFF', animation: 'pulse 2s ease-in-out infinite' }} />
            <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: '#00BFFF', textTransform: 'uppercase' }}>Official Channel</span>
          </div>
          <h1 style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 900, fontSize: 'clamp(26px, 5vw, 40px)', color: '#F5F7FF', letterSpacing: '0.03em', lineHeight: 1.1, marginBottom: '10px' }}>
            News &amp; Announcements
          </h1>
          <p style={{ fontSize: '14px', color: '#626C80' }}>Stay updated with the latest releases, events, and important updates.</p>
          <div className="mt-5 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,191,255,0.28), transparent)' }} />
        </motion.div>

        {/* Search + Filters */}
        <motion.div className="mb-8 flex flex-col gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#626C80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search announcements…"
              className="ann-search w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(11,16,32,0.6)', border: '1px solid rgba(255,255,255,0.08)', color: '#F5F7FF', transition: 'border-color 0.2s, box-shadow 0.2s' }}
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`cat-filter-btn px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border`}
                style={{
                  fontFamily: "'Exo 2','Inter',sans-serif",
                  color: activeFilter === cat ? '#00BFFF' : '#626C80',
                  background: activeFilter === cat ? 'rgba(0,191,255,0.09)' : 'transparent',
                  borderColor: activeFilter === cat ? 'rgba(0,191,255,0.28)' : 'rgba(255,255,255,0.07)',
                  cursor: 'pointer',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Feed */}
        {filtered.length === 0 ? (
          <motion.div className="flex flex-col items-center justify-center py-24 gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#626C80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3z"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontSize: '12px', letterSpacing: '0.2em', color: '#626C80', textTransform: 'uppercase', fontWeight: 700 }}>
              {search || activeFilter !== 'All' ? 'No matching announcements' : 'No announcements yet'}
            </p>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((a, i) => <AnnouncementCard key={a.id} a={a} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}
