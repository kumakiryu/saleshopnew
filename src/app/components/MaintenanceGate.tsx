import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

function MaintenancePage() {
  return (
    <div style={{
      minHeight: '100vh', background: '#050816', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", padding: '24px',
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(0,100,255,0.08) 0%, transparent 65%)',
      }} />

      <div style={{ position: 'relative', textAlign: 'center', maxWidth: 480 }}>
        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 28px',
          background: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00BFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        <p style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#3a4570' }}>
          Sale Shop
        </p>
        <h1 style={{ margin: '0 0 16px', fontSize: 28, fontWeight: 800, color: '#c8d0f0', letterSpacing: '0.04em', fontFamily: "'Rajdhani','Inter',sans-serif" }}>
          UNDER MAINTENANCE
        </h1>
        <p style={{ margin: '0 0 32px', fontSize: 15, color: '#7b88c0', lineHeight: 1.7 }}>
          We're making some improvements. We'll be back shortly — check back in a few minutes.
        </p>

        <div style={{
          padding: '16px 20px', borderRadius: 12,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          display: 'inline-flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF8C00', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 13, color: '#7b88c0' }}>Maintenance in progress</span>
        </div>

        {/* Redirect to backup shop */}
        <div style={{ marginTop: 28 }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#3a4570' }}>
            In the meantime, visit our other shop:
          </p>
          <a
            href="https://trustsaleshop.xyz/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 10,
              background: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.25)',
              color: '#00BFFF', fontSize: 14, fontWeight: 700, textDecoration: 'none',
              letterSpacing: '0.03em', transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,191,255,0.16)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,191,255,0.08)')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            trustsaleshop.xyz
          </a>
        </div>

        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      </div>
    </div>
  );
}

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'maintenance' | 'ok'>('loading');

  useEffect(() => {
    // Admin path is always accessible regardless of maintenance mode
    if (window.location.pathname.startsWith('/admin')) {
      setStatus('ok');
      return;
    }

    async function check() {
      try {
        const { data: config } = await supabase
          .from('site_config')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single();

        const isMaintenance = config?.value === 'true';
        if (!isMaintenance) { setStatus('ok'); return; }

        // Maintenance is on — check if the visitor is a logged-in admin
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: admin } = await supabase
            .from('admins')
            .select('id')
            .eq('id', user.id)
            .single();
          if (admin) { setStatus('ok'); return; }
        }

        setStatus('maintenance');
      } catch {
        // If check fails (e.g. table doesn't exist yet), show site normally
        setStatus('ok');
      }
    }

    check();
  }, []);

  if (status === 'loading') return null;
  if (status === 'maintenance') return <MaintenancePage />;
  return <>{children}</>;
}
