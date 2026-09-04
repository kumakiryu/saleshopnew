import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CustomerTier } from '@/lib/types';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

interface Member {
  user_id: string;
  tier: CustomerTier;
  assigned_at: string;
  email?: string;
}

const TIER_COLOR: Record<CustomerTier, string> = {
  normal: '#7b88c0', vip: '#FFB400', reseller: '#00E676',
};
const TIER_BG: Record<CustomerTier, string> = {
  normal: 'rgba(123,136,192,0.1)', vip: 'rgba(255,180,0,0.12)', reseller: 'rgba(0,230,118,0.1)',
};
const TIER_LABEL: Record<CustomerTier, string> = {
  normal: 'Normal', vip: '✦ VIP', reseller: '◆ Reseller',
};

const INPUT_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#e8eaf6', outline: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, width: '100%',
};

export default function MembersPanel({ adminId }: { adminId: string }) {
  const [mode, setMode] = useState<'create'|'assign'|'list'>('list');
  const [members, setMembers]   = useState<Member[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<CustomerTier | 'all'>('all');
  const [saving, setSaving]     = useState<string | null>(null);

  // Assign tier form
  const [addEmail, setAddEmail] = useState('');
  const [addTier, setAddTier]   = useState<CustomerTier>('vip');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addMsg, setAddMsg]     = useState('');

  // Create account form
  const [newEmail, setNewEmail]     = useState('');
  const [newPass, setNewPass]       = useState('');
  const [newTier, setNewTier]       = useState<CustomerTier>('vip');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError]     = useState('');
  const [createMsg, setCreateMsg]         = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('user_memberships').select('*').order('assigned_at', { ascending: false });
    if (data) setMembers(data as Member[]);
    setLoading(false);
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
      const res = await fetch('/api/manage-membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: addEmail.trim().toLowerCase(),
          tier: addTier,
          adminToken: (JSON.parse(localStorage.getItem('sb_session') ?? 'null'))?.access_token,
        }),
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
      // Create the Supabase auth account using the public API
      const BASE = `https://${projectId}.supabase.co`;
      const KEY  = publicAnonKey;
      const signupRes = await fetch(`${BASE}/auth/v1/signup`, {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim().toLowerCase(), password: newPass }),
      });
      const signupJson = await signupRes.json();
      if (!signupRes.ok) {
        setCreateError(signupJson?.msg ?? signupJson?.error_description ?? 'Account creation failed');
        setCreateLoading(false); return;
      }
      const userId = signupJson?.user?.id ?? signupJson?.id;
      if (!userId) { setCreateError('Account created but user ID not returned. Assign tier manually.'); setCreateLoading(false); return; }

      // Assign tier if not normal
      if (newTier !== 'normal') {
        await supabase.from('user_memberships').upsert(
          { user_id: userId, tier: newTier, assigned_by: adminId, assigned_at: new Date().toISOString(), email: newEmail.trim().toLowerCase() },
          { onConflict: 'user_id' }
        );
      }

      setCreateMsg(`✓ Account created for ${newEmail} with ${newTier.toUpperCase()} tier. Share the password with the customer.`);
      setNewEmail(''); setNewPass(''); setNewTier('vip');
      load();
    } catch (e: any) { setCreateError(e.message); }
    setCreateLoading(false);
  }

  const filtered = members.filter(m => {
    if (filter !== 'all' && m.tier !== filter) return false;
    if (search && !m.user_id.toLowerCase().includes(search.toLowerCase()) && !(m.email ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const tabStyle = (active: boolean) => ({
    padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600 as const, cursor: 'pointer' as const,
    background: active ? 'rgba(0,191,255,0.12)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? 'rgba(0,191,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
    color: active ? '#00BFFF' : '#7b88c0',
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

      {/* ── Create new account ── */}
      {mode === 'create' && (
        <div className="p-5 rounded-2xl flex flex-col gap-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,191,255,0.15)' }}>
          <div>
            <p className="text-sm font-bold mb-0.5" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>Create Customer Account</p>
            <p className="text-xs" style={{ color: '#3a4570' }}>Creates a new login for the customer and assigns their tier immediately.</p>
          </div>
          {createError && <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,68,68,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.2)' }}>{createError}</div>}
          {createMsg && <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(0,200,100,0.08)', color: '#00C864', border: '1px solid rgba(0,200,100,0.2)' }}>{createMsg}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Customer Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="customer@email.com" style={INPUT_STYLE} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Password (share with customer)</label>
              <input type="text" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min 8 characters" style={INPUT_STYLE} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Membership Tier</label>
            <div className="flex gap-2">
              {(['vip', 'reseller', 'normal'] as CustomerTier[]).map(t => (
                <button key={t} onClick={() => setNewTier(t)} style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: newTier === t ? `${TIER_COLOR[t]}18` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${newTier === t ? TIER_COLOR[t] + '55' : 'rgba(255,255,255,0.08)'}`,
                  color: newTier === t ? TIER_COLOR[t] : '#7b88c0',
                }}>
                  {TIER_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <button onClick={createAccount} disabled={createLoading} style={{
            background: createLoading ? 'rgba(0,191,255,0.05)' : 'linear-gradient(135deg,rgba(0,191,255,0.18),rgba(138,43,226,0.18))',
            border: '1px solid rgba(0,191,255,0.35)', color: createLoading ? '#3a4570' : '#fff',
            padding: '11px 24px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: createLoading ? 'not-allowed' : 'pointer',
            fontFamily: "'Rajdhani','Inter',sans-serif", letterSpacing: '0.06em', alignSelf: 'flex-start',
          }}>
            {createLoading ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      )}

      {/* ── Assign tier by email ── */}
      {mode === 'assign' && (
        <div className="p-5 rounded-2xl flex flex-col gap-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <p className="text-sm font-bold mb-0.5" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>Assign Tier to Existing Account</p>
            <p className="text-xs" style={{ color: '#3a4570' }}>Looks up an existing customer and changes their membership tier.</p>
          </div>
          {addError && <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,68,68,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.2)' }}>{addError}</div>}
          {addMsg && <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(0,200,100,0.08)', color: '#00C864', border: '1px solid rgba(0,200,100,0.2)' }}>{addMsg}</div>}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Customer Email</label>
              <input value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="customer@email.com" style={INPUT_STYLE} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Tier</label>
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

      {/* ── Members list ── */}
      {mode === 'list' && (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or user ID..."
              style={{ flex: 1, minWidth: 200, ...INPUT_STYLE }} />
            <div className="flex gap-2">
              {(['all', 'vip', 'reseller', 'normal'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: filter === f ? 'rgba(0,191,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${filter === f ? 'rgba(0,191,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  color: filter === f ? '#00BFFF' : '#7b88c0',
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  {f === 'all' ? 'All' : TIER_LABEL[f as CustomerTier]}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-4 py-3 grid grid-cols-12 gap-3 text-[10px] uppercase tracking-widest"
              style={{ background: 'rgba(255,255,255,0.03)', color: '#3a4570', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="col-span-5">User / Email</div>
              <div className="col-span-3">Tier</div>
              <div className="col-span-2">Since</div>
              <div className="col-span-2">Actions</div>
            </div>
            {loading ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: '#3a4570' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: '#3a4570' }}>No members found</div>
            ) : filtered.map(m => (
              <div key={m.user_id} className="px-4 py-3 grid grid-cols-12 gap-3 items-center"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="col-span-5 min-w-0">
                  <p className="text-xs font-mono truncate" style={{ color: '#c8d0f0' }}>{m.email || m.user_id}</p>
                  {m.email && <p className="text-[10px] font-mono truncate" style={{ color: '#3a4570' }}>{m.user_id}</p>}
                </div>
                <div className="col-span-3">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{
                    background: TIER_BG[m.tier], color: TIER_COLOR[m.tier], border: `1px solid ${TIER_COLOR[m.tier]}33`,
                  }}>
                    {TIER_LABEL[m.tier]}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px]" style={{ color: '#3a4570' }}>{new Date(m.assigned_at).toLocaleDateString()}</p>
                </div>
                <div className="col-span-2 flex gap-1.5 flex-wrap">
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
          <p className="text-[11px]" style={{ color: '#3a4570' }}>{filtered.length} member{filtered.length !== 1 ? 's' : ''} shown</p>
        </>
      )}
    </div>
  );
}
