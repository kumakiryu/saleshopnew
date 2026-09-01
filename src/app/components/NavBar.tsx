import { useNavigate, useLocation } from 'react-router';
import { useStore } from '@/lib/store';

const NAV_CSS = `
  .nav-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    font-family: 'Inter', sans-serif;
    border: 1px solid transparent;
    cursor: pointer;
    color: #4a5578;
    background: transparent;
    transition: color 0.18s, background 0.18s, border-color 0.18s;
    white-space: nowrap;
    position: relative;
    text-transform: uppercase;
  }
  .nav-pill:hover {
    color: #8a95b8;
    background: rgba(255,255,255,0.03);
  }
  .nav-pill.active {
    color: #c8d0f0;
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.09);
  }
  .nav-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #FF3333;
    box-shadow: 0 0 6px #FF3333;
  }
  .nav-divider {
    width: 1px;
    height: 14px;
    background: rgba(255,255,255,0.07);
    flex-shrink: 0;
  }
`;

export function NavBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { announcements, lastSeenAt } = useStore();

  const newCount = announcements.filter(
    a => !lastSeenAt || a.created_at > lastSeenAt
  ).length;

  const isHome          = pathname === '/';
  const isStock         = pathname === '/stock';
  const isAnnouncements = pathname === '/announcements';

  return (
    <>
      <style>{NAV_CSS}</style>
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center"
        style={{
          height: '48px',
          background: 'rgba(5,8,22,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('/')}
            className={`nav-pill${isHome ? ' active' : ''}`}
          >
            Home
          </button>

          <div className="nav-divider" />

          <button
            onClick={() => navigate('/stock')}
            className={`nav-pill${isStock ? ' active' : ''}`}
          >
            Stock
          </button>

          <div className="nav-divider" />

          <button
            onClick={() => navigate('/announcements')}
            className={`nav-pill${isAnnouncements ? ' active' : ''}`}
          >
            Announcements
            {newCount > 0 && <span className="nav-badge" />}
          </button>
        </div>
      </nav>
    </>
  );
}
