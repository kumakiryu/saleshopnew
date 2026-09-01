import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { useAnnouncements } from '@/lib/useAnnouncements';
import { useStore } from '@/lib/store';
import type { Announcement } from '@/lib/types';
import { useEffect } from 'react';

/* ── category config ─────────────────────────────── */
export const CATEGORY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  'News':        { color: '#00BFFF', bg: 'rgba(0,191,255,0.1)',    border: 'rgba(0,191,255,0.25)' },
  'Update':      { color: '#8A2BE2', bg: 'rgba(138,43,226,0.1)',   border: 'rgba(138,43,226,0.25)' },
  'Promotion':   { color: '#00E676', bg: 'rgba(0,230,118,0.1)',    border: 'rgba(0,230,118,0.25)' },
  'Maintenance': { color: '#FF8C00', bg: 'rgba(255,140,0,0.1)',    border: 'rgba(255,140,0,0.25)' },
  'Event':       { color: '#FF69B4', bg: 'rgba(255,105,180,0.1)',  border: 'rgba(255,105,180,0.25)' },
  'Release':     { color: '#FFD700', bg: 'rgba(255,215,0,0.1)',    border: 'rgba(255,215,0,0.25)' },
  'Important':   { color: '#FF4444', bg: 'rgba(255,68,68,0.1)',    border: 'rgba(255,68,68,0.25)' },
};

const CATEGORIES = ['All', 'News', 'Update', 'Promotion', 'Maintenance', 'Event', 'Release', 'Important'];

/* ── content renderer (simple markdown) ─────────── */
export function renderContent(raw: string): string {
  return raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#00BFFF;text-decoration:underline;text-underline-offset:2px">$1</a>')
    .replace(/^## (.+)$/gm, '<div style="color:#c8d0f0;font-weight:700;font-size:1rem;margin:10px 0 4px;font-family:Rajdhani,Inter,sans-serif">$1</div>')
    .replace(/^# (.+)$/gm,  '<div style="color:#e8eaf6;font-weight:700;font-size:1.15rem;margin:12px 0 4px;font-family:Rajdhani,Inter,sans-serif">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8eaf6;font-weight:700">$1</strong>')
    .replace(/\*(.+?)\*/g,    '<em>$1</em>')
    .replace(/^- (.+)$/gm,   '<div style="display:flex;gap:6px;margin:2px 0"><span style="color:#00BFFF;flex-shrink:0">•</span><span>$1</span></div>')
    .replace(/\n/g, '<br/>');
}

/* ── announcement card ───────────────────────────── */
function AnnouncementCard({ a, index }: { a: Announcement; index: number }) {
  const cat = CATEGORY_STYLE[a.category] ?? CATEGORY_STYLE['News'];
  const dateStr = format(new Date(a.created_at), 'MMMM d, yyyy');

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: a.pinned
          ? 'linear-gradient(135deg, rgba(0,191,255,0.06) 0%, rgba(138,43,226,0.04) 100%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
        border: a.pinned ? '1px solid rgba(0,191,255,0.22)' : '1px solid rgba(255,255,255,0.07)',
        boxShadow: a.pinned ? '0 0 24px rgba(0,191,255,0.06)' : 'none',
      }}
    >
      {/* cover image */}
      {a.image_url && (
        <img src={a.image_url} alt={a.title} className="w-full object-cover" style={{ maxHeight: '220px' }} />
      )}

      <div className="p-5 sm:p-6">
        {/* badges row */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {a.pinned && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase"
              style={{ background: 'rgba(0,191,255,0.1)', color: '#00BFFF', border: '1px solid rgba(0,191,255,0.25)' }}>
              PINNED
            </span>
          )}
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase"
            style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}>
            {a.category}
          </span>
        </div>

        {/* title */}
        <h2 className="text-lg sm:text-xl font-bold mb-2 leading-snug"
          style={{ color: '#e8eaf6', fontFamily: "'Rajdhani', 'Inter', sans-serif", letterSpacing: '0.03em' }}>
          {a.title}
        </h2>

        {/* content */}
        <div
          className="text-sm leading-relaxed mb-4"
          style={{ color: '#7b88c0' }}
          dangerouslySetInnerHTML={{ __html: renderContent(a.content) }}
        />

        {/* meta */}
        <div className="flex items-center gap-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {a.created_by && (
            <>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: 'rgba(0,191,255,0.15)', color: '#00BFFF', border: '1px solid rgba(0,191,255,0.25)' }}>
                {a.created_by[0]?.toUpperCase()}
              </div>
              <span className="text-xs font-medium" style={{ color: '#c8d0f0' }}>
                {a.created_by}
              </span>
              <span style={{ color: '#2e3a5a' }}>·</span>
            </>
          )}
          <span className="text-xs" style={{ color: '#3a4570' }}>{dateStr}</span>
        </div>
      </div>
    </motion.article>
  );
}

/* ── page ────────────────────────────────────────── */
const PAGE_CSS = `
  .ann-search::placeholder { color: #2e3a5a; }
  .ann-search { outline: none; }
  .ann-search:focus { border-color: rgba(0,191,255,0.4) !important; }
  .filter-tab { transition: all 0.2s; cursor: pointer; white-space: nowrap; }
  .filter-tab:hover { color: #c8d0f0 !important; background: rgba(255,255,255,0.04) !important; }
  .filter-tab.active { color: #00BFFF !important; background: rgba(0,191,255,0.1) !important; border-color: rgba(0,191,255,0.25) !important; }
  .btn-ghost {
    border: 1px solid rgba(255,255,255,0.1);
    transition: border-color 0.3s, background 0.3s, transform 0.3s;
  }
  .btn-ghost:hover {
    border-color: rgba(0,191,255,0.3);
    background: rgba(0,191,255,0.05) !important;
    transform: translateY(-1px);
  }
`;

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
    <div className="min-h-screen" style={{ background: '#050816', fontFamily: "'Inter', sans-serif" }}>
      <style>{PAGE_CSS}</style>

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0" style={{
        background: 'radial-gradient(ellipse 70% 50% at 50% 20%, rgba(0,100,255,0.1) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 60%, rgba(138,43,226,0.08) 0%, transparent 55%)',
      }} />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-20">

        {/* ── Back ── */}
        <motion.button
          onClick={() => navigate('/')}
          className="btn-ghost inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm mb-10 select-none focus-visible:outline-none"
          style={{ color: '#7b88c0', background: 'transparent' }}
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span style={{ fontFamily: "'Rajdhani', 'Inter', sans-serif", fontWeight: 600 }}>Back</span>
        </motion.button>

        {/* ── Hero ── */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
            style={{ background: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.18)' }}>
            <span style={{ fontSize: '12px' }}></span>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#00BFFF' }}>
              Official Channel
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3"
            style={{ color: '#e8eaf6', fontFamily: "'Rajdhani', 'Inter', sans-serif", letterSpacing: '0.04em' }}>
            Shop News &amp; Announcements
          </h1>
          <p className="text-sm" style={{ color: '#3a4570' }}>
            Stay updated with the latest releases, events, and important updates.
          </p>
          <div className="mt-5 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,191,255,0.3), transparent)' }} />
        </motion.div>

        {/* ── Search + Filters ── */}
        <motion.div
          className="mb-8 flex flex-col gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          {/* search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#3a4570" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search announcements..."
              className="ann-search w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#c8d0f0',
              }}
            />
          </div>

          {/* filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`filter-tab px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border`}
                style={{
                  color: activeFilter === cat ? '#00BFFF' : '#3a4570',
                  background: activeFilter === cat ? 'rgba(0,191,255,0.1)' : 'transparent',
                  borderColor: activeFilter === cat ? 'rgba(0,191,255,0.25)' : 'rgba(255,255,255,0.06)',
                  fontFamily: "'Rajdhani', 'Inter', sans-serif",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Feed ── */}
        {filtered.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center py-20 gap-3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          >
            <span style={{ fontSize: '32px' }}>📭</span>
            <p className="text-xs uppercase tracking-widest" style={{ color: '#2e3a5a' }}>
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
