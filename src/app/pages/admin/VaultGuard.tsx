import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { isVaultUnlocked, lockVault, unlockVault, vaultMinutesLeft } from '@/lib/vault';

const CSS = `
  .vg-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e8eaf6; outline: none; border-radius: 10px; font-size: 20px; font-weight: 700; letter-spacing: 0.4em; text-align: center; padding: 12px 16px; width: 100%; font-family: 'Rajdhani','Inter',monospace; transition: border-color 0.2s; }
  .vg-input:focus { border-color: rgba(0,191,255,0.5); box-shadow: 0 0 0 2px rgba(0,191,255,0.08); }
  .vg-input::placeholder { color: #2e3a5a; letter-spacing: 0.3em; }
`;

interface Props {
  totpEnabled: boolean;
  children: React.ReactNode;
  onAudit?: (action: string) => void;
}

export default function VaultGuard({ totpEnabled, children, onAudit }: Props) {
  const [unlocked, setUnlocked] = useState(isVaultUnlocked());
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Poll timer every 10s to refresh countdown / detect expiry
  useEffect(() => {
    if (!unlocked) return;
    const id = setInterval(() => {
      if (!isVaultUnlocked()) { setUnlocked(false); }
      else setTimer(vaultMinutesLeft());
    }, 10_000);
    setTimer(vaultMinutesLeft());
    return () => clearInterval(id);
  }, [unlocked]);

  useEffect(() => {
    if (showModal) setTimeout(() => inputRef.current?.focus(), 80);
  }, [showModal]);

  async function verify() {
    if (code.length !== 6) return setError('Enter the 6-digit code from your authenticator app.');
    setLoading(true); setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/admin-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', code, token }),
      });
      const text = await res.text();
      if (text.trimStart().startsWith('<')) {
        throw new Error('API not reachable — ensure SUPABASE_SERVICE_ROLE_KEY is set in Vercel and redeploy.');
      }
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error ?? 'Verification failed');

      unlockVault();
      setUnlocked(true);
      setShowModal(false);
      setCode('');
      onAudit?.('vault_access');
    } catch (e: any) {
      setError(e.message ?? 'Failed');
    } finally {
      setLoading(false);
    }
  }

  // 2FA not set up yet
  if (!totpEnabled) {
    return (
      <div className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
        style={{ background: 'rgba(255,140,0,0.05)', border: '1px solid rgba(255,140,0,0.2)' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.3)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div>
          <p className="font-bold text-sm mb-1" style={{ color: '#FF8C00', fontFamily: "'Rajdhani','Inter',sans-serif", letterSpacing: '0.05em' }}>2FA REQUIRED</p>
          <p className="text-xs" style={{ color: '#3a4570' }}>Enable Two-Factor Authentication in the Settings tab to access this section.</p>
        </div>
      </div>
    );
  }

  // Locked — show lock screen
  if (!unlocked) {
    return (
      <>
        <div className="rounded-2xl p-10 flex flex-col items-center gap-5 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(0,191,255,0.15)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.25)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00BFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <p className="font-bold text-lg mb-1" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif", letterSpacing: '0.08em' }}>VAULT LOCKED</p>
            <p className="text-xs" style={{ color: '#3a4570' }}>Verify your identity to access this section.</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="px-8 py-3 rounded-xl font-bold text-sm tracking-wider"
            style={{ background: 'linear-gradient(135deg, rgba(0,191,255,0.18) 0%, rgba(138,43,226,0.18) 100%)', border: '1px solid rgba(0,191,255,0.4)', color: '#ffffff', cursor: 'pointer', fontFamily: "'Rajdhani','Inter',sans-serif", letterSpacing: '0.08em', boxShadow: '0 0 20px rgba(0,191,255,0.1)' }}>
            Verify Identity
          </button>
        </div>

        {showModal && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(5,8,22,0.92)', backdropFilter: 'blur(12px)' }}>
            <style>{CSS}</style>
            <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(15,20,50,0.98) 0%, rgba(8,13,40,0.98) 100%)', border: '1px solid rgba(0,191,255,0.2)', boxShadow: '0 0 60px rgba(0,191,255,0.08)' }}>

              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,191,255,0.1)', border: '1px solid rgba(0,191,255,0.25)' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00BFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif", letterSpacing: '0.06em' }}>VERIFY IDENTITY</p>
                    <p className="text-[10px]" style={{ color: '#2e3a5a' }}>Vault requires 2FA confirmation</p>
                  </div>
                </div>
                <button onClick={() => { setShowModal(false); setCode(''); setError(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2e3a5a' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="px-6 py-6 flex flex-col gap-4">
                <p className="text-xs text-center" style={{ color: '#7b88c0' }}>
                  Open your authenticator app and enter the 6-digit code.
                </p>

                <input ref={inputRef} className="vg-input" maxLength={6} inputMode="numeric" pattern="[0-9]*"
                  value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                  placeholder="000000" onKeyDown={e => e.key === 'Enter' && verify()} />

                {error && (
                  <p className="text-xs text-center" style={{ color: '#FF6B6B' }}>{error}</p>
                )}

                <button onClick={verify} disabled={loading || code.length !== 6}
                  className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wider"
                  style={{
                    background: code.length === 6 && !loading ? 'linear-gradient(135deg, rgba(0,191,255,0.2) 0%, rgba(138,43,226,0.2) 100%)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${code.length === 6 && !loading ? 'rgba(0,191,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: code.length === 6 && !loading ? '#ffffff' : '#2e3a5a',
                    cursor: code.length === 6 && !loading ? 'pointer' : 'not-allowed',
                    fontFamily: "'Rajdhani','Inter',sans-serif",
                    letterSpacing: '0.08em',
                    transition: 'all 0.2s',
                  }}>
                  {loading ? 'Verifying...' : 'Unlock Vault'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  // Unlocked — show content with timer badge
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#00E676', boxShadow: '0 0 6px #00E676' }} />
          <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#00E676' }}>
            Vault Unlocked — {timer} remaining
          </span>
        </div>
        <button onClick={() => { lockVault(); setUnlocked(false); }}
          className="text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-wide"
          style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', color: '#FF6B6B', cursor: 'pointer' }}>
          Lock Vault
        </button>
      </div>
      {children}
    </div>
  );
}
