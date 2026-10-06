import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useCustomerAuth } from '@/lib/customerAuth';
import TokenIcon from '@/app/components/TokenIcon';

const GOLD  = '#F5B000';
const GREEN = '#00E676';

/* Width of the open card — trigger AND dropdown share this exact width */
const CARD_W = 300;

interface Props { isReseller: boolean; }

/* ─────────────────────────────────────────────────────────────────
   CSS lives here so it's scoped to this component only.
   .pm-wrapper  — the single parent that sizes both trigger + panel.
   .pm-trigger  — the header row of the card.
   .pm-panel    — the body of the card (absolutely below trigger).
   .pm-item     — each nav row inside the panel.
───────────────────────────────────────────────────────────────── */
const CSS = `
  .pm-wrapper {
    position: relative;
    /* z-index higher than the navbar backdrop (z-index:-1) so the
       open card sits ON TOP of the backdrop's bottom border line   */
    z-index: 10;
  }

  .pm-trigger {
    display: flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    outline: none;
    white-space: nowrap;
    /* size / border transitions — border-radius, border-color */
    transition: border-color .15s, border-radius .15s, width .15s, background .15s;
  }

  .pm-panel {
    position: absolute;
    top: 100%;          /* zero gap — starts at trigger's exact bottom edge */
    left: 0;            /* left edge = wrapper left edge                    */
    right: 0;           /* right edge = wrapper right edge                  */
    overflow: hidden;
    /* Reveal: scale from top so the top edge NEVER moves away from the trigger */
    transform-origin: top center;
    animation: pm-reveal .17s cubic-bezier(.22,1,.36,1) both;
  }

  @keyframes pm-reveal {
    from { opacity: 0; transform: scaleY(.9); }
    to   { opacity: 1; transform: scaleY(1);  }
  }

  .pm-item {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 10px 16px;
    border: none; background: transparent; cursor: pointer;
    font-size: 12px; font-family: 'Inter', sans-serif; text-align: left;
    border-bottom: 1px solid rgba(255,255,255,.04);
    color: #8892B0;
    transition: background .1s, color .1s;
  }
  .pm-item:hover { background: rgba(255,255,255,.04); color: #F0F2FF; }
  .pm-item .pm-ic { opacity: .5; display: flex; align-items: center; transition: opacity .1s; }
  .pm-item:hover .pm-ic { opacity: 1; }
  .pm-danger { color: rgba(255,107,107,.55); }
  .pm-danger:hover { background: rgba(255,68,68,.07); color: #FF6B6B; }
`;

export default function MemberDropdown({ isReseller }: Props) {
  const navigate = useNavigate();
  const { user, signOut, tokenBalance } = useCustomerAuth();

  const accent   = isReseller ? GREEN : GOLD;
  const basePath = isReseller ? '/reseller' : '/vip';
  const count    = isReseller ? (tokenBalance?.resellerTokens ?? 0)
                              : (tokenBalance?.vipTokens      ?? 0);
  const initial  = user?.email?.[0]?.toUpperCase() ?? '?';

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!user) return null;

  /* Same colour for both trigger border and panel border — ONE outline */
  const borderColor = open ? `${accent}55` : `${accent}30`;
  const border      = `1px solid ${borderColor}`;
  /* Solid dark background — same on trigger (open) and panel so the join is invisible */
  const cardBg      = 'rgba(6,8,20,.97)';

  const navItems = [
    { label: 'Dashboard',   path: `${basePath}/dashboard`,   Icon: IcGrid   },
    { label: 'Leaderboard', path: `${basePath}/leaderboard`, Icon: IcPulse  },
    { label: 'Rewards',     path: `${basePath}/rewards`,     Icon: IcGift   },
    { label: 'Top Up',      path: `${basePath}/topup`,       Icon: IcPlus   },
  ];

  return (
    <div
      ref={wrapRef}
      className="pm-wrapper"
      style={{
        /*
         * KEY: the WRAPPER controls the width.
         * When open  → CARD_W px wide: trigger fills it, panel fills it.
         *              Both share the exact same left + right edges.
         *              One continuous border outline.
         * When closed → auto: compact pill sized by content.
         */
        width: open ? CARD_W : 'auto',
      }}
    >
      <style>{CSS}</style>

      {/* ══════════════════════════════════════════════════════════
          TRIGGER — the top "header row" of the card when open.

          Border rules:
            open  →  top + left + right border, NO bottom border.
            closed→  full border, pill shape.

          The trigger background when open is the SAME as the panel
          background (cardBg) so there is zero visible seam.
      ══════════════════════════════════════════════════════════ */}
      <button
        className="pm-trigger"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          justifyContent: 'space-between',
          padding: open ? '8px 14px' : '5px 10px 5px 6px',
          background: open ? cardBg : `linear-gradient(135deg, ${accent}10, rgba(6,8,18,.92))`,
          borderTop:    border,
          borderLeft:   border,
          borderRight:  border,
          borderBottom: open ? 'none' : border,
          borderRadius: open ? '12px 12px 0 0' : '999px',
          boxShadow: open ? `0 0 24px ${accent}1a` : 'none',
        }}
      >
        {open ? (
          /* ── Open state: minimal close bar — email + chevron up ── */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Avatar letter={initial} accent={accent} size={22} />
              <span style={{ fontSize: 12, color: `${accent}cc`, fontFamily: "'Inter',sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </span>
            </div>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={`${accent}70`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="18 15 12 9 6 15"/>
            </svg>
          </>
        ) : (
          /* ── Closed state: compact pill — avatar + balance + tier badge ── */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Avatar letter={initial} accent={accent} size={26} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'JetBrains Mono','Inter',monospace", fontWeight: 700, fontSize: 13, color: accent }}>
                <TokenIcon size={13} />{count.toLocaleString()}
              </span>
              <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 800, fontSize: 9, letterSpacing: '.14em', color: accent, background: `${accent}16`, border: `1px solid ${accent}28`, borderRadius: 5, padding: '2px 5px', textTransform: 'uppercase' }}>
                {isReseller ? '◆ REL' : '★ VIP'}
              </span>
            </div>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={`${accent}80`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </>
        )}
      </button>

      {/* ══════════════════════════════════════════════════════════
          PANEL — the body of the card.

          position: absolute + top: 100%  →  zero gap, always.
          left: 0 + right: 0             →  same width as wrapper = CARD_W.

          Border rules:
            left + right + bottom border, NO top border.

          The shared border colour + no top/bottom seam
          makes trigger + panel read as ONE component.
      ══════════════════════════════════════════════════════════ */}
      {open && (
        <div
          className="pm-panel"
          style={{
            background: cardBg,
            /* ── Border: same colour, no top (trigger carries that edge) ── */
            borderTop:    'none',
            borderLeft:   border,
            borderRight:  border,
            borderBottom: border,
            borderRadius: '0 0 12px 12px',
            boxShadow: `0 20px 48px rgba(0,0,0,.7), 0 0 32px ${accent}08`,
          }}
        >
          {/* User identity + balance */}
          <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Avatar letter={initial} accent={accent} size={32} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 11, color: '#525C75', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </p>
                <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 800, fontSize: 9, letterSpacing: '.14em', color: accent, textTransform: 'uppercase', marginTop: 2 }}>
                  {isReseller ? '◆ Reseller' : '★ VIP'} Member
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: `${accent}08`, border: `1px solid ${accent}18`,
              borderRadius: 8, padding: '7px 12px',
            }}>
              <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '.12em', color: '#525C75', textTransform: 'uppercase' }}>
                Balance
              </span>
              <span style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: 15, fontWeight: 700, color: accent, display: 'flex', alignItems: 'center', gap: 5 }}>
                <TokenIcon size={13} />{count.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Nav links */}
          {navItems.map(({ label, path, Icon }) => (
            <button key={label} className="pm-item" onClick={() => { setOpen(false); navigate(path); }}>
              <span className="pm-ic" style={{ color: accent }}><Icon /></span>
              {label}
            </button>
          ))}

          {/* Sign out */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
            <button className="pm-item pm-danger" onClick={() => { setOpen(false); signOut(); navigate('/'); }}>
              <span className="pm-ic"><IcSignOut /></span>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Avatar ──────────────────────────────────────────────── */
function Avatar({ letter, accent, size }: { letter: string; accent: string; size: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${accent}28, ${accent}0e)`,
      border: `1px solid ${accent}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Exo 2','Inter',sans-serif",
      fontWeight: 800, fontSize: Math.round(size * .44), color: accent,
    }}>{letter}</span>
  );
}

/* ── Icons ───────────────────────────────────────────────── */
const Ic = ({ ch }: { ch: React.ReactNode }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ch}</svg>
);
const IcGrid    = () => <Ic ch={<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>} />;
const IcPulse   = () => <Ic ch={<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>} />;
const IcGift    = () => <Ic ch={<><path d="M20 12v10H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></>} />;
const IcPlus    = () => <Ic ch={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>} />;
const IcSignOut = () => <Ic ch={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>} />;
