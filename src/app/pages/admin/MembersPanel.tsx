import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CustomerTier } from '@/lib/types';

interface Member {
  user_id: string;
  tier: CustomerTier;
  assigned_at: string;
  email?: string | null;
}

const TIER_COLOR: Record<CustomerTier, string> = {
  normal: '#7b88c0', vip: '#FFB400', reseller: '#00E676',
};
const TIER_BG: Record<CustomerTier, string> = {
  normal: 'rgba(123,136,192,0.1)', vip: 'rgba(255,180,0,0.12)', reseller: 'rgba(0,230,118,0.1)',
};
const TIER_LABEL: Record<CustomerTier, string> = {
  normal: 'Normal', vip: '★ VIP', reseller: '◆ Reseller',
};

const INPUT_STYLE: React.CSSProperties = {
  background: 'var(--as3)', border: '1px solid var(--ab2)',
  color: 'var(--at)', outline: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, width: '100%',
};

function getAdminToken(): string {
  try { return JSON.parse(localStorage.getItem('sb_session') ?? 'null')?.access_token ?? ''; }
  catch { return ''; }
}

export default function MembersPanel({ adminId }: { adminId: string }) {
  const [mode, setMode] = useState<'create' | 'assign' | 'list'>('list');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<CustomerTier | 'all'>('all');
  const [saving, setSaving]   = useState<string | null>(null);

  // Password reset modal
  const [pwModal, setPwModal]   = useState<{ userId: string; email: string } | null>(null);
  const [newPw, setNewPw]       = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  // Assign tier form
  const [addEmail, setAddEmail]     = useState('');
  const [addTier, setAddTier]       = useState<CustomerTier>('vip');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError]     = useState('');
  const [addMsg, setAddMsg]         = useState('');

  // Create account form
  const [newEmail, setNewEmail]               = useState('');
  const [newPass, setNewPass]                 = useState('');
  const [newTier, setNewTier]                 = useState<CustomerTier>('vip');
  const [createLoading, setCreateLoading]     = useState(false);
  const [createError, setCreateError]         = useState('');
  const [createMsg, setCreateMsg]             = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin?action=list-members', {
        headers: { 'x-admin-token': getAdminToken() },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setMembers(data as Member[]);
    } catch { /* silent */ }
    setLoading(false);
  }

  async function setPassword() {
    if (!pwModal || !newPw.trim()) return;
    setPwSaving(true); setPwMsg(null);
    try {
      const r = await fetch('/api/admin?action=set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
        body: JSON.stringify({ user_id: pwModal.userId, password: newPw }),
      });
      const d = await r.json();
      if (r.ok) {
        setPwMsg({ ok: true, text: 'Password updated successfully.' });
        setNewPw('');
      } else {
        setPwMsg({ ok: false, text: d.error ?? 'Failed to update password' });
      }
    } catch {
      setPwMsg({ ok: false, text: 'Network error' });
    } finally { setPwSaving(false); }
  }

  async function setTier(userId: string, tier: CustomerTier) {
    setSaving(userId);
    if (tier === 'normal') {
      await supabase.from('user_memberships').delete().eq('user_id', userId);
    } else {
      await supabase.from('user_memberships').upsert(
        { user_id: userId, tier, assigned_by: adminId, assigned_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    }
    setSaving(null);
    load();
  }

  async function assignMemberByEmail() {
    if (!addEmail.trim()) return;
    setAddLoading(true); setAddError(''); setAddMsg('');
    try {
      const res = await fetch('/api/admin?action=manage-membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addEmail.trim().toLowerCase(), tier: addTier, adminToken: getAdminToken() }),
      });
      const json = await res.json();
      if (!res.ok) setAddError(json.error ?? 'Failed');
      else { setAddMsg(`${addEmail} set to ${addTier}`); setAddEmail(''); load(); }
    } catch (e: any) { setAddError(e.message); }
    setAddLoading(false);
  }

  async function createAccount() {
    if (!newEmail.trim() || !newPass.trim()) { setCreateError('Email and password are required.'); return; }
    if (newPass.length < 8) { setCreateError('Password must be at least 8 characters.'); return; }
    setCreateLoading(true); setCreateError(''); setCreateMsg('');
    try {
      const res = await fetch('/api/admin?action=create-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          password: newPass,
          tier: newTier,
          adminToken: getAdminToken(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error ?? 'Account creation failed');
      } else {
        setCreateMsg(`✓ Account created for ${newEmail} with ${newTier.toUpperCase()} tier. Share the password with the customer.`);
        setNewEmail(''); setNewPass(''); setNewTier('vip');
        load();
      }
    } catch (e: any) { setCreateError(e.message); }
    setCreateLoading(false);
  }

  const filtered = members.filter(m => {
    if (filter !== 'all' && m.tier !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.user_id.toLowerCase().includes(q) && !(m.email ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const tabStyle = (active: boolean) => ({
    padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600 as const, cursor: 'pointer' as const,
    background: active ? 'rgba(0,191,255,0.12)' : 'var(--as3)',
    border: `1px solid ${active ? 'rgba(0,191,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
    color: active ? '#00BFFF' : 'var(--atm)',
  });

  return (
    <div className="flex flex-col gap-5">

      {/* Mode tabs */}
      <div className="flex gap-2">
        <button style={tabStyle(mode === 'create')} onClick={() => { setMode('create'); setCreateError(''); setCreateMsg(''); }}>
          + Create Account
        </button>
        <button style={tabStyle(mode === 'assign')} onClick={() => { setMode('assign'); setAddError(''); setAddMsg(''); }}>
          Assign Tier
        </button>
        <button style={tabStyle(mode === 'list')} onClick={() => setMode('list')}>
          Members List
        </button>
      </div>

      {/* Create new account */}
      {mode === 'create' && (
        <div className="p-5 rounded-2xl flex flex-col gap-4" style={{ background: 'var(--as2)', border: '1px solid rgba(0,191,255,0.15)' }}>
          <div>
            <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--at2)', fontFamily: "'Exo 2','Inter',sans-serif" }}>Create Customer Account</p>
            <p className="text-xs" style={{ color: 'var(--atg)' }}>Creates a new login for the customer and assigns their tier immediately.</p>
          </div>
          {createError && <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,68,68,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.2)' }}>{createError}</div>}
          {createMsg && <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(0,200,100,0.08)', color: '#00C864', border: '1px solid rgba(0,200,100,0.2)' }}>{createMsg}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Customer Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="customer@email.com" style={INPUT_STYLE} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Password (share with customer)</label>
              <input type="text" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min 8 characters" style={INPUT_STYLE} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Membership Tier</label>
            <div className="flex gap-2">
              {(['vip', 'reseller', 'normal'] as CustomerTier[]).map(t => (
                <button key={t} onClick={() => setNewTier(t)} style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: newTier === t ? `${TIER_COLOR[t]}18` : 'var(--as3)',
                  border: `1px solid ${newTier === t ? TIER_COLOR[t] + '55' : 'rgba(255,255,255,0.08)'}`,
                  color: newTier === t ? TIER_COLOR[t] : 'var(--atm)',
                }}>
                  {TIER_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <button onClick={createAccount} disabled={createLoading} style={{
            background: createLoading ? 'rgba(0,191,255,0.05)' : 'linear-gradient(135deg,rgba(0,191,255,0.18),rgba(138,43,226,0.18))',
            border: '1px solid rgba(0,191,255,0.35)', color: createLoading ? 'var(--atg)' : '#fff',
            padding: '11px 24px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: createLoading ? 'not-allowed' : 'pointer',
            fontFamily: "'Exo 2','Inter',sans-serif", letterSpacing: '0.06em', alignSelf: 'flex-start',
          }}>
            {createLoading ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      )}

      {/* Assign tier by email */}
      {mode === 'assign' && (
        <div className="p-5 rounded-2xl flex flex-col gap-4" style={{ background: 'var(--as2)', border: '1px solid var(--ab)' }}>
          <div>
            <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--at2)', fontFamily: "'Exo 2','Inter',sans-serif" }}>Assign Tier to Existing Account</p>
            <p className="text-xs" style={{ color: 'var(--atg)' }}>Looks up an existing customer and changes their membership tier.</p>
          </div>
          {addError && <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,68,68,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.2)' }}>{addError}</div>}
          {addMsg && <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(0,200,100,0.08)', color: '#00C864', border: '1px solid rgba(0,200,100,0.2)' }}>{addMsg}</div>}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Customer Email</label>
              <input value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="customer@email.com" style={INPUT_STYLE} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Tier</label>
              <select value={addTier} onChange={e => setAddTier(e.target.value as CustomerTier)}
                style={{ ...INPUT_STYLE, width: 'auto' }}>
                <option value="vip">VIP</option>
                <option value="reseller">Reseller</option>
                <option value="normal">Normal (remove)</option>
              </select>
            </div>
            <button onClick={assignMemberByEmail} disabled={addLoading}
              style={{ background: 'rgba(0,191,255,0.12)', border: '1px solid rgba(0,191,255,0.3)', color: '#00BFFF', padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: addLoading ? 'not-allowed' : 'pointer' }}>
              {addLoading ? '...' : 'Assign'}
            </button>
          </div>
        </div>
      )}

      {/* Members list */}
      {mode === 'list' && (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or user ID..."
              style={{ flex: 1, minWidth: 200, ...INPUT_STYLE }} />
            <div className="flex gap-2">
              {(['all', 'vip', 'reseller', 'normal'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: filter === f ? 'rgba(0,191,255,0.12)' : 'var(--as3)',
                  border: `1px solid ${filter === f ? 'rgba(0,191,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  color: filter === f ? '#00BFFF' : 'var(--atm)',
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  {f === 'all' ? 'All' : TIER_LABEL[f as CustomerTier]}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--ab)' }}>
            <div className="px-4 py-3 grid grid-cols-12 gap-3 text-[10px] uppercase tracking-widest"
              style={{ background: 'var(--as2)', color: 'var(--atg)', borderBottom: '1px solid var(--ab)' }}>
              <div className="col-span-5">User / Email</div>
              <div className="col-span-3">Tier</div>
              <div className="col-span-2">Since</div>
              <div className="col-span-2">Actions</div>
            </div>
            {loading ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--atg)' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--atg)' }}>No members found</div>
            ) : filtered.map(m => (
              <div key={m.user_id} className="px-4 py-3 grid grid-cols-12 gap-3 items-center"
                style={{ borderBottom: '1px solid var(--ab)' }}>
                <div className="col-span-5 min-w-0">
                  <p className="text-xs font-mono truncate" style={{ color: 'var(--at2)' }}>{m.email || m.user_id}</p>
                  {m.email && <p className="text-[10px] font-mono truncate" style={{ color: 'var(--atg)' }}>{m.user_id}</p>}
                </div>
                <div className="col-span-3">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{
                    background: TIER_BG[m.tier], color: TIER_COLOR[m.tier], border: `1px solid ${TIER_COLOR[m.tier]}33`,
                  }}>
                    {TIER_LABEL[m.tier]}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px]" style={{ color: 'var(--atg)' }}>{new Date(m.assigned_at).toLocaleDateString()}</p>
                </div>
                <div className="col-span-2 flex gap-1.5 flex-wrap">
                  {m.email && (
                    <button onClick={() => { setPwModal({ userId: m.user_id, email: m.email! }); setNewPw(''); setPwMsg(null); }}
                      style={{ background: 'rgba(138,43,226,0.08)', border: '1px solid rgba(138,43,226,0.25)', color: '#B06EFF', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                      Set Pwd
                    </button>
                  )}
                  {m.tier !== 'vip' && (
                    <button onClick={() => setTier(m.user_id, 'vip')} disabled={saving === m.user_id}
                      style={{ background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.25)', color: '#FFB400', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      VIP
                    </button>
                  )}
                  {m.tier !== 'reseller' && (
                    <button onClick={() => setTier(m.user_id, 'reseller')} disabled={saving === m.user_id}
                      style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', color: '#00E676', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      RES
                    </button>
                  )}
                  {m.tier !== 'normal' && (
                    <button onClick={() => setTier(m.user_id, 'normal')} disabled={saving === m.user_id}
                      style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', color: '#FF6B6B', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--atg)' }}>{filtered.length} member{filtered.length !== 1 ? 's' : ''} shown</p>
        </>
      )}

      {/* Password reset modal */}
      {pwModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={() => setPwModal(null)}>
          <div style={{ background: '#0d0f1e', border: '1px solid rgba(138,43,226,0.35)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 380, boxShadow: '0 0 48px rgba(138,43,226,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: "'Exo 2','Inter',sans-serif", letterSpacing: '0.08em' }}>SET NEW PASSWORD</p>
                <p style={{ fontSize: 11, color: 'var(--atm)', marginTop: 2 }}>{pwModal.email}</p>
              </div>
              <button onClick={() => setPwModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--atg)', fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--atm)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>New Password</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setPassword(); }}
                  placeholder="Min. 6 characters"
                  autoFocus
                  style={{ flex: 1, background: 'var(--as4)', border: '1px solid rgba(138,43,226,0.3)', borderRadius: 8, padding: '10px 12px', color: 'var(--at)', fontSize: 14, outline: 'none' }}
                />
                <button onClick={() => setShowPw(v => !v)} style={{ background: 'var(--as4)', border: '1px solid var(--ab2)', borderRadius: 8, padding: '10px 12px', color: 'var(--atm)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {pwMsg && (
              <p style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, marginBottom: 12, background: pwMsg.ok ? 'rgba(0,230,118,0.08)' : 'rgba(255,68,68,0.08)', color: pwMsg.ok ? '#00E676' : '#FF6B6B', border: `1px solid ${pwMsg.ok ? 'rgba(0,230,118,0.2)' : 'rgba(255,68,68,0.2)'}` }}>
                {pwMsg.text}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPwModal(null)} style={{ flex: 1, padding: '10px', background: 'var(--as3)', border: '1px solid var(--ab2)', borderRadius: 8, color: 'var(--atm)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={setPassword} disabled={pwSaving || newPw.length < 6}
                style={{ flex: 1, padding: '10px', background: pwSaving || newPw.length < 6 ? 'rgba(138,43,226,0.05)' : 'rgba(138,43,226,0.15)', border: '1px solid rgba(138,43,226,0.4)', borderRadius: 8, color: pwSaving || newPw.length < 6 ? '#4a3570' : '#B06EFF', fontSize: 13, cursor: pwSaving || newPw.length < 6 ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
                {pwSaving ? 'Saving...' : 'Set Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
