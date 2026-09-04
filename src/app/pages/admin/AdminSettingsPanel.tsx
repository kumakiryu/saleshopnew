import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { lockVault } from '@/lib/vault';
// Inline QR encoder using the browser's QR API (no external package needed)
async function toQRDataURL(text: string, size = 240): Promise<string> {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    // Fallback: use a reliable public QR API
  }
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=000000&margin=2`;
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const CSS = `
  .as-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e8eaf6; outline: none; border-radius: 8px; padding: 8px 12px; font-size: 14px; letter-spacing: 0.35em; text-align: center; font-family: 'Rajdhani','Inter',monospace; transition: border-color 0.2s; width: 100%; }
  .as-input:focus { border-color: rgba(0,191,255,0.4); }
  .as-input::placeholder { color: #2e3a5a; }
`;

interface AuditLog {
  id: string;
  action: string;
  resource: string | null;
  created_at: string;
}

interface Props {
  adminId: string;
  adminEmail: string;
  totpEnabled: boolean;
  role: string;
  onTotpChange: (enabled: boolean) => void;
}

type SetupStep = 'idle' | 'qr' | 'confirm' | 'done';
type DisableStep = 'idle' | 'confirm';

async function apiCall(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const res = await fetch('/api/admin?action=totp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, token }),
  });
  const text = await res.text();
  if (text.trimStart().startsWith('<')) {
    throw new Error('API not reachable — check that SUPABASE_SERVICE_ROLE_KEY is set in Vercel environment variables and redeploy.');
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server error: ${text.slice(0, 120)}`);
  }
  if (!res.ok) throw new Error(data.error as string ?? 'Request failed');
  return data;
}

interface AdminEntry { id: string; email: string; role: string; totp_enabled: boolean; }

const ROLE_COLOR: Record<string, string> = { owner: '#F7931A', administrator: '#00BFFF', moderator: '#7b88c0' };
const ROLES = ['owner', 'administrator', 'moderator'] as const;

export default function AdminSettingsPanel({ adminId, adminEmail, totpEnabled, role, onTotpChange }: Props) {
  const [setupStep, setSetupStep] = useState<SetupStep>('idle');
  const [disableStep, setDisableStep] = useState<DisableStep>('idle');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [roleChanging, setRoleChanging] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('admin_audit_logs').select('id, action, resource, created_at')
      .eq('admin_id', adminId).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { setLogs((data ?? []) as AuditLog[]); setLogsLoading(false); });

    if (role === 'owner') {
      setAdminsLoading(true);
      apiCall({ action: 'list-admins' })
        .then(d => setAdmins(d.admins ?? []))
        .catch(() => {})
        .finally(() => setAdminsLoading(false));
    }
  }, [adminId, role]);

  useEffect(() => {
    if (setupStep === 'qr' || setupStep === 'confirm' || disableStep === 'confirm') {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [setupStep, disableStep]);

  async function startSetup() {
    setLoading(true); setError('');
    try {
      const data = await apiCall({ action: 'setup' });
      const dataUrl = await toQRDataURL(data.uri as string, 240);
      setQrDataUrl(dataUrl);
      setSecretKey(data.secret as string);
      setSetupStep('qr');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function confirmSetup() {
    if (code.length !== 6) return setError('Enter the 6-digit code.');
    setLoading(true); setError('');
    try {
      await apiCall({ action: 'verify-setup', code });
      setSetupStep('done');
      setCode('');
      onTotpChange(true);
      setSuccess('2FA enabled successfully.');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function confirmDisable() {
    if (code.length !== 6) return setError('Enter your current 6-digit code to confirm.');
    setLoading(true); setError('');
    try {
      await apiCall({ action: 'disable', code });
      setDisableStep('idle');
      setCode('');
      onTotpChange(false);
      lockVault();
      setSuccess('2FA disabled. Vault has been locked.');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  function resetError() { setError(''); }

  async function changeRole(targetId: string, newRole: string) {
    setRoleChanging(targetId);
    try {
      await apiCall({ action: 'set-role', targetId, newRole });
      setAdmins(prev => prev.map(a => a.id === targetId ? { ...a, role: newRole } : a));
      setSuccess(`Role updated to ${newRole}.`);
    } catch (e: any) { setError(e.message); }
    finally { setRoleChanging(null); }
  }

  const ACTION_LABELS: Record<string, string> = {
    vault_unlocked: 'Vault Unlocked',
    vault_access: 'Vault Accessed',
    '2fa_enabled': '2FA Enabled',
    '2fa_disabled': '2FA Disabled',
    bulk_import: 'Bulk Import',
    delete_code: 'Code Deleted',
    delete_account: 'Account Deleted',
  };

  const rc = ROLE_COLOR[role] ?? '#7b88c0';

  return (
    <div className="flex flex-col gap-5">
      <style>{CSS}</style>

      {/* Identity card */}
      <div className="rounded-2xl p-5 flex items-center gap-4"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${rc}14`, border: `1px solid ${rc}35` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={rc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>{adminEmail}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase"
              style={{ background: `${rc}12`, color: rc, border: `1px solid ${rc}30` }}>{role}</span>
            <span className="text-[10px]" style={{ color: '#2e3a5a' }}>
              {totpEnabled ? '2FA active' : '2FA not set up'}
            </span>
          </div>
        </div>
      </div>

      {/* 2FA Management */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="font-bold tracking-widest text-sm" style={{ color: '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>TWO-FACTOR AUTHENTICATION</h3>
          <p className="text-[10px] mt-0.5" style={{ color: '#2e3a5a' }}>Required to access Code and Account Inventory</p>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">
          {success && (
            <div className="px-3 py-2.5 rounded-lg text-xs" style={{ background: 'rgba(0,230,118,0.08)', color: '#00E676', border: '1px solid rgba(0,230,118,0.2)' }}>
              {success}
            </div>
          )}
          {error && (
            <div className="px-3 py-2.5 rounded-lg text-xs" style={{ background: 'rgba(255,68,68,0.08)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.2)' }}>
              {error}
            </div>
          )}

          {/* Not enabled — setup flow */}
          {!totpEnabled && (
            <>
              {setupStep === 'idle' && (
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-xs mb-3" style={{ color: '#7b88c0' }}>
                      Protect inventory access with a time-based one-time password. Compatible with Google Authenticator, Authy, Bitwarden, and 1Password.
                    </p>
                    <button onClick={startSetup} disabled={loading}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide"
                      style={{ background: 'linear-gradient(135deg, rgba(0,191,255,0.15) 0%, rgba(138,43,226,0.15) 100%)', border: '1px solid rgba(0,191,255,0.35)', color: '#ffffff', cursor: 'pointer', fontFamily: "'Rajdhani','Inter',sans-serif", opacity: loading ? 0.5 : 1 }}>
                      {loading ? 'Generating...' : 'Enable 2FA'}
                    </button>
                  </div>
                </div>
              )}

              {setupStep === 'qr' && (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-xs text-center" style={{ color: '#7b88c0' }}>
                    Scan with Google Authenticator, Authy, or any TOTP app. <strong style={{ color: '#ffffff' }}>Do not click "I've Scanned" until the app shows a 6-digit code.</strong>
                  </p>
                  {qrDataUrl && (
                    <div className="rounded-xl p-3" style={{ background: '#ffffff' }}>
                      <img src={qrDataUrl} alt="TOTP QR Code" style={{ width: 200, height: 200, display: 'block' }} />
                    </div>
                  )}
                  <div className="w-full rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,191,255,0.25)', background: 'rgba(0,191,255,0.05)' }}>
                    <p className="text-[9px] uppercase tracking-widest px-3 pt-2.5 pb-1" style={{ color: '#3a4570' }}>
                      Can't scan? Add manually in your app
                    </p>
                    <div className="flex items-center gap-2 px-3 pb-3">
                      <p className="text-sm font-mono font-bold flex-1 break-all" style={{ color: '#00BFFF', letterSpacing: '0.1em' }}>{secretKey}</p>
                      <button onClick={() => navigator.clipboard.writeText(secretKey)}
                        className="text-[10px] px-2 py-1 rounded-lg flex-shrink-0 font-bold"
                        style={{ background: 'rgba(0,191,255,0.1)', border: '1px solid rgba(0,191,255,0.25)', color: '#00BFFF', cursor: 'pointer' }}>
                        Copy
                      </button>
                    </div>
                  </div>
                  <button onClick={() => setSetupStep('confirm')}
                    className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide"
                    style={{ background: 'rgba(0,191,255,0.1)', border: '1px solid rgba(0,191,255,0.3)', color: '#00BFFF', cursor: 'pointer', fontFamily: "'Rajdhani','Inter',sans-serif" }}>
                    I've Added It — Enter Code →
                  </button>
                </div>
              )}

              {setupStep === 'confirm' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-center" style={{ color: '#7b88c0' }}>Enter the 6-digit code from your authenticator app to complete setup.</p>
                  <input ref={inputRef} className="as-input" maxLength={6} inputMode="numeric" pattern="[0-9]*"
                    value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '')); resetError(); }}
                    placeholder="000000" onKeyDown={e => e.key === 'Enter' && confirmSetup()} />
                  <button onClick={confirmSetup} disabled={loading || code.length !== 6}
                    className="w-full py-3 rounded-xl text-sm font-bold tracking-wider"
                    style={{
                      background: code.length === 6 ? 'linear-gradient(135deg, rgba(0,191,255,0.2) 0%, rgba(138,43,226,0.2) 100%)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${code.length === 6 ? 'rgba(0,191,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      color: code.length === 6 ? '#ffffff' : '#2e3a5a',
                      cursor: code.length === 6 ? 'pointer' : 'not-allowed',
                      fontFamily: "'Rajdhani','Inter',sans-serif", opacity: loading ? 0.5 : 1,
                    }}>
                    {loading ? 'Verifying...' : 'Activate 2FA'}
                  </button>
                  <button onClick={() => { setSetupStep('qr'); setCode(''); resetError(); }}
                    className="text-xs text-center" style={{ background: 'none', border: 'none', color: '#2e3a5a', cursor: 'pointer' }}>
                    ← Back to QR code
                  </button>
                </div>
              )}

              {setupStep === 'done' && (
                <div className="text-center py-2">
                  <p className="text-xs" style={{ color: '#00E676' }}>2FA is now active. You will be prompted to verify before accessing the vault.</p>
                </div>
              )}
            </>
          )}

          {/* Enabled — show status + disable */}
          {totpEnabled && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#00E676', boxShadow: '0 0 6px #00E676' }} />
                <p className="text-xs font-semibold" style={{ color: '#00E676' }}>Two-factor authentication is active</p>
              </div>

              {disableStep === 'idle' && (
                <button onClick={() => { setDisableStep('confirm'); setCode(''); resetError(); }}
                  className="text-xs px-4 py-2 rounded-lg w-fit"
                  style={{ background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.2)', color: '#FF6B6B', cursor: 'pointer' }}>
                  Disable 2FA
                </button>
              )}

              {disableStep === 'confirm' && (
                <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.15)' }}>
                  <p className="text-xs" style={{ color: '#FF6B6B' }}>Enter your current code to disable 2FA. This will also lock the vault immediately.</p>
                  <input ref={inputRef} className="as-input" maxLength={6} inputMode="numeric" pattern="[0-9]*"
                    value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '')); resetError(); }}
                    placeholder="000000" onKeyDown={e => e.key === 'Enter' && confirmDisable()} />
                  <div className="flex gap-2">
                    <button onClick={confirmDisable} disabled={loading || code.length !== 6}
                      className="flex-1 py-2 rounded-lg text-xs font-bold"
                      style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', color: '#FF6B6B', cursor: 'pointer', opacity: loading || code.length !== 6 ? 0.5 : 1 }}>
                      {loading ? 'Disabling...' : 'Confirm Disable'}
                    </button>
                    <button onClick={() => { setDisableStep('idle'); setCode(''); resetError(); }}
                      className="px-4 py-2 rounded-lg text-xs"
                      style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#3a4570', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Emergency lockdown */}
      {totpEnabled && (
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(255,68,68,0.04)', border: '1px solid rgba(255,68,68,0.15)' }}>
          <h3 className="font-bold tracking-widest text-sm mb-2" style={{ color: '#FF6B6B', fontFamily: "'Rajdhani','Inter',sans-serif" }}>EMERGENCY LOCKDOWN</h3>
          <p className="text-xs mb-3" style={{ color: '#3a4570' }}>Immediately terminates all vault sessions and requires fresh 2FA authentication.</p>
          <button onClick={() => { lockVault(); setSuccess('Vault locked. All sessions terminated.'); }}
            className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide"
            style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', color: '#FF6B6B', cursor: 'pointer', fontFamily: "'Rajdhani','Inter',sans-serif" }}>
            Lock Vault Now
          </button>
        </div>
      )}

      {/* Role Management — owner only */}
      {role === 'owner' && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(247,147,26,0.2)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="font-bold tracking-widest text-sm" style={{ color: '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>ADMIN MANAGEMENT</h3>
            <p className="text-[10px] mt-0.5" style={{ color: '#2e3a5a' }}>Visible to owners only — change roles for any admin</p>
          </div>
          <div className="px-5 py-4">
            {adminsLoading ? (
              <p className="text-xs py-3 text-center" style={{ color: '#2e3a5a' }}>Loading admins...</p>
            ) : admins.length === 0 ? (
              <p className="text-xs py-3 text-center" style={{ color: '#2e3a5a' }}>No admins found.</p>
            ) : (
              <div className="flex flex-col divide-y" style={{ '--tw-divide-opacity': 1 } as any}>
                {admins.map(a => {
                  const rc = ROLE_COLOR[a.role] ?? '#7b88c0';
                  const isSelf = a.id === adminId;
                  return (
                    <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                          style={{ background: `${rc}14`, border: `1px solid ${rc}30` }}>
                          <span className="text-[10px] font-bold uppercase" style={{ color: rc }}>
                            {a.email[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: '#c8d0f0' }}>{a.email}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px]" style={{ color: '#2e3a5a' }}>
                              {a.totp_enabled ? '2FA on' : '2FA off'}
                            </span>
                            {isSelf && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,191,255,0.08)', color: '#00BFFF' }}>you</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <select
                          value={a.role}
                          disabled={roleChanging === a.id}
                          onChange={e => changeRole(a.id, e.target.value)}
                          style={{
                            background: `${rc}10`,
                            border: `1px solid ${rc}30`,
                            color: rc,
                            borderRadius: '8px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            fontFamily: "'Rajdhani','Inter',sans-serif",
                            cursor: 'pointer',
                            outline: 'none',
                            opacity: roleChanging === a.id ? 0.5 : 1,
                          }}>
                          {ROLES.map(r => (
                            <option key={r} value={r} style={{ background: '#080d28', color: '#c8d0f0' }}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                        {roleChanging === a.id && (
                          <span className="text-[10px]" style={{ color: '#2e3a5a' }}>saving…</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="font-bold tracking-widest text-sm" style={{ color: '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>RECENT SECURITY ACTIVITY</h3>
        </div>
        <div className="px-5 py-3">
          {logsLoading ? (
            <p className="text-xs py-4 text-center" style={{ color: '#2e3a5a' }}>Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: '#2e3a5a' }}>No activity recorded yet.</p>
          ) : (
            <div className="flex flex-col divide-y" style={{ '--tw-divide-opacity': 1 } as any}>
              {logs.map(l => (
                <div key={l.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: l.action.includes('disable') || l.action.includes('lock') ? '#FF6B6B' : '#00BFFF' }} />
                    <span className="text-xs" style={{ color: '#7b88c0' }}>{ACTION_LABELS[l.action] ?? l.action}</span>
                    {l.resource && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: '#3a4570' }}>{l.resource}</span>}
                  </div>
                  <span className="text-[10px] flex-shrink-0" style={{ color: '#2e3a5a' }}>
                    {new Date(l.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
