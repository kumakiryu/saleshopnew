import { useEffect, useState } from 'react';
import type { RewardProduct, LeaderboardEntry } from '@/lib/types';
import TokenIcon from '@/app/components/TokenIcon';

interface Props { adminToken: string; }

function getAdminToken() {
  try { const s = localStorage.getItem('sb_session'); return s ? JSON.parse(s).access_token : ''; } catch { return ''; }
}

type SubTab = 'overview' | 'manage' | 'rewards' | 'leaderboard' | 'logs';

export default function TokenEconomyPanel({ adminToken }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [vipLeaders, setVipLeaders] = useState<LeaderboardEntry[]>([]);
  const [resellerLeaders, setResellerLeaders] = useState<LeaderboardEntry[]>([]);
  const [rewards, setRewards] = useState<RewardProduct[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [tokenOp, setTokenOp] = useState<{ userId: string; type: 'vip' | 'reseller'; action: 'add' | 'remove' | 'reset'; amount: string }>({ userId: '', type: 'vip', action: 'add', amount: '' });
  const [tokenOpMsg, setTokenOpMsg] = useState('');
  const [tokenOpErr, setTokenOpErr] = useState('');
  const [tokenOpLoading, setTokenOpLoading] = useState(false);

  const [rewardForm, setRewardForm] = useState<Partial<RewardProduct & { id?: string }>>({});
  const [rewardMsg, setRewardMsg] = useState('');
  const [rewardErr, setRewardErr] = useState('');
  const [rewardLoading, setRewardLoading] = useState(false);
  const [editingReward, setEditingReward] = useState<RewardProduct | null>(null);

  const [codeCounts, setCodeCounts] = useState<Record<string, { total: number; available: number }>>({});
  const [importingFor, setImportingFor] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const [redemptionLogs, setRedemptionLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (subTab === 'logs') loadRedemptionLogs(); }, [subTab]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadLeaders(), loadRewards(), loadMembers(), loadCodeCounts()]);
    setLoading(false);
  }

  async function loadCodeCounts() {
    try {
      const r = await fetch('/api/reward-products?codes=true', { headers: { 'x-admin-token': getAdminToken() } });
      if (!r.ok) return;
      const codes: any[] = await r.json();
      const counts: Record<string, { total: number; available: number }> = {};
      for (const c of codes) {
        if (!counts[c.reward_id]) counts[c.reward_id] = { total: 0, available: 0 };
        counts[c.reward_id].total++;
        if (!c.redeemed_by) counts[c.reward_id].available++;
      }
      setCodeCounts(counts);
    } catch { /* ignore */ }
  }

  async function importBulkCodes(rewardId: string) {
    const codes = importText.split('\n').map((c: string) => c.trim()).filter(Boolean);
    if (!codes.length) return;
    setImportLoading(true); setImportMsg('');
    try {
      const r = await fetch('/api/reward-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
        body: JSON.stringify({ action: 'import-codes', reward_id: rewardId, codes }),
      });
      const d = await r.json();
      if (r.ok) { setImportMsg(`✓ Imported ${d.imported} codes`); setImportText(''); await loadCodeCounts(); }
      else setImportMsg(`Error: ${d.error}`);
    } catch { setImportMsg('Request failed'); } finally { setImportLoading(false); }
  }

  async function loadRedemptionLogs() {
    setLogsLoading(true);
    try {
      const r = await fetch('/api/admin?action=redemption-logs', { headers: { 'x-admin-token': getAdminToken() } });
      if (r.ok) setRedemptionLogs(await r.json());
    } catch { /* ignore */ } finally { setLogsLoading(false); }
  }

  async function loadLeaders() {
    try {
      const [vR, rsR] = await Promise.all([
        fetch('/api/leaderboard?type=vip'),
        fetch('/api/leaderboard?type=reseller'),
      ]);
      if (vR.ok) setVipLeaders(await vR.json());
      if (rsR.ok) setResellerLeaders(await rsR.json());
    } catch { /* ignore */ }
  }

  async function loadRewards() {
    try {
      const r = await fetch('/api/reward-products?active=false', { headers: { 'x-admin-token': getAdminToken() } });
      if (r.ok) setRewards(await r.json());
    } catch { /* ignore */ }
  }

  async function loadMembers() {
    try {
      const r = await fetch('/api/admin?action=list-members', { headers: { 'x-admin-token': getAdminToken() } });
      if (r.ok) { const d = await r.json(); setMembers(d.members ?? d ?? []); }
    } catch { /* ignore */ }
  }

  async function submitTokenOp() {
    setTokenOpMsg(''); setTokenOpErr(''); setTokenOpLoading(true);
    try {
      const res = await fetch('/api/admin?action=tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
        body: JSON.stringify({ action: tokenOp.action, email: tokenOp.userId, token_type: tokenOp.type, amount: Number(tokenOp.amount) }),
      });
      const d = await res.json();
      if (res.ok) { setTokenOpMsg(`Done! New balance: ${d.new_balance}`); await loadLeaders(); }
      else setTokenOpErr(d.error ?? 'Failed');
    } catch { setTokenOpErr('Request failed'); } finally { setTokenOpLoading(false); }
  }

  async function saveReward() {
    setRewardMsg(''); setRewardErr(''); setRewardLoading(true);
    try {
      const method = editingReward ? 'PATCH' : 'POST';
      const body = editingReward ? { id: editingReward.id, ...rewardForm } : rewardForm;
      const res = await fetch('/api/reward-products', {
        method,
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (res.ok) { setRewardMsg(editingReward ? 'Updated!' : 'Created!'); setEditingReward(null); setRewardForm({}); await loadRewards(); }
      else setRewardErr(d.error ?? 'Failed');
    } catch { setRewardErr('Request failed'); } finally { setRewardLoading(false); }
  }

  async function toggleRewardActive(r: RewardProduct) {
    await fetch('/api/reward-products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
      body: JSON.stringify({ id: r.id, active: !r.active }),
    });
    await loadRewards();
  }

  async function deleteReward(id: string) {
    if (!window.confirm('Delete this reward?')) return;
    await fetch(`/api/reward-products?id=${id}`, { method: 'DELETE', headers: { 'x-admin-token': getAdminToken() } });
    await loadRewards();
  }

  const inp = (label: string, key: string, type = 'text', placeholder = '') => (
    <div key={key}>
      <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: '#7b88c0' }}>{label}</label>
      <input type={type} value={(rewardForm as any)[key] ?? ''} onChange={e => setRewardForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} placeholder={placeholder}
        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8eaf6', outline: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13 }} />
    </div>
  );

  const TABS: { key: SubTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'manage', label: 'Manage Tokens' },
    { key: 'rewards', label: 'Reward Products' },
    { key: 'leaderboard', label: 'Leaderboards' },
    { key: 'logs', label: 'Redemption Logs' },
  ];

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)} className="px-4 py-2 rounded-lg text-xs font-bold"
            style={{ background: subTab === t.key ? 'rgba(255,180,0,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${subTab === t.key ? 'rgba(255,180,0,0.35)' : 'rgba(255,255,255,0.08)'}`, color: subTab === t.key ? '#FFB400' : '#7b88c0', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {subTab === 'overview' && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'VIP Top Balance', value: vipLeaders[0]?.tokens ?? 0, color: '#FFB400' },
              { label: 'Reseller Top Balance', value: resellerLeaders[0]?.tokens ?? 0, color: '#00E676' },
              { label: 'Reward Products', value: rewards.length, color: '#00BFFF' },
              { label: 'Active Members', value: members.length, color: '#8A2BE2' },
            ].map(s => (
              <div key={s.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${s.color}20` }}>
                <p className="text-2xl font-black mb-0.5" style={{ color: s.color, fontFamily: "'Rajdhani','Inter',sans-serif" }}>{s.value}</p>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: '#3a4570' }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[{ title: 'VIP Top Holders', entries: vipLeaders, color: '#FFB400' }, { title: 'Reseller Top Holders', entries: resellerLeaders, color: '#00E676' }].map(({ title, entries, color }) => (
              <div key={title} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}18` }}>
                <p className="px-5 py-3 text-xs font-bold uppercase tracking-widest" style={{ color, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{title}</p>
                {entries.length === 0 ? <p className="px-5 py-6 text-xs" style={{ color: '#3a4570' }}>No data yet</p> : entries.slice(0, 5).map(e => (
                  <div key={e.user_id} className="flex items-center justify-between px-5 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <span className="text-xs" style={{ color: '#7b88c0' }}>#{e.rank} {e.email}</span>
                    <span className="text-xs font-bold" style={{ color }}>{e.tokens} <TokenIcon size={12} /></span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manage Tokens */}
      {subTab === 'manage' && (
        <div className="max-w-md">
          <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-sm font-bold mb-4 uppercase tracking-widest" style={{ color: '#c8d0f0' }}>Adjust Member Tokens</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: '#7b88c0' }}>Member</label>
                <select value={tokenOp.userId} onChange={e => setTokenOp(o => ({ ...o, userId: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8eaf6', outline: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                  <option value="">— Select member —</option>
                  {members.map((m: any) => <option key={m.email} value={m.email}>{m.email} ({m.tier})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: '#7b88c0' }}>Token Type</label>
                  <select value={tokenOp.type} onChange={e => setTokenOp(o => ({ ...o, type: e.target.value as 'vip' | 'reseller' }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8eaf6', outline: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                    <option value="vip">VIP</option>
                    <option value="reseller">Reseller</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: '#7b88c0' }}>Action</label>
                  <select value={tokenOp.action} onChange={e => setTokenOp(o => ({ ...o, action: e.target.value as 'add' | 'remove' | 'reset' }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8eaf6', outline: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                    <option value="add">Add</option>
                    <option value="remove">Remove</option>
                    <option value="reset">Reset to 0</option>
                  </select>
                </div>
              </div>
              {tokenOp.action !== 'reset' && (
                <div>
                  <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: '#7b88c0' }}>Amount</label>
                  <input type="number" min="1" value={tokenOp.amount} onChange={e => setTokenOp(o => ({ ...o, amount: e.target.value }))} placeholder="0"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8eaf6', outline: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13 }} />
                </div>
              )}
              {tokenOpMsg && <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(0,230,118,0.08)', color: '#00E676' }}>{tokenOpMsg}</p>}
              {tokenOpErr && <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(255,68,68,0.08)', color: '#FF6B6B' }}>{tokenOpErr}</p>}
              <button onClick={submitTokenOp} disabled={!tokenOp.userId || tokenOpLoading} className="py-2.5 rounded-lg text-sm font-bold"
                style={{ background: 'rgba(0,191,255,0.1)', border: '1px solid rgba(0,191,255,0.3)', color: '#00BFFF', cursor: !tokenOp.userId || tokenOpLoading ? 'not-allowed' : 'pointer' }}>
                {tokenOpLoading ? 'Processing...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reward Products */}
      {subTab === 'rewards' && (
        <div>
          <div className="p-5 rounded-2xl mb-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-sm font-bold mb-4 uppercase tracking-widest" style={{ color: '#c8d0f0' }}>{editingReward ? 'Edit Reward' : 'New Reward'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {inp('Name', 'name', 'text', 'Reward name')}
              {inp('Token Cost', 'token_cost', 'number', '100')}
              {inp('Stock (-1 = unlimited)', 'stock', 'number', '-1')}
              <div>
                <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: '#7b88c0' }}>For Membership</label>
                <select value={(rewardForm as any).membership_type ?? 'both'} onChange={e => setRewardForm(f => ({ ...f, membership_type: e.target.value as any }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8eaf6', outline: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                  <option value="both">Both VIP & Reseller</option>
                  <option value="vip">VIP Only</option>
                  <option value="reseller">Reseller Only</option>
                </select>
              </div>
            </div>
            {inp('Description', 'description', 'text', 'Optional')}
            <div className="mt-3">
              <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: '#7b88c0' }}>Delivery Content <span style={{ color: '#FF8C00' }}>★ Shown to member after redeeming</span></label>
              <textarea value={(rewardForm as any).delivery_content ?? ''} onChange={e => setRewardForm(f => ({ ...f, delivery_content: e.target.value }))} placeholder="e.g. product key, account details, instructions..."
                rows={3} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,140,0,0.25)', color: '#e8eaf6', outline: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, resize: 'vertical', fontFamily: 'monospace' }} />
            </div>
            <div className="mt-3">{inp('Image URL', 'image_url', 'text', 'https://...')}</div>
            {rewardMsg && <p className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(0,230,118,0.08)', color: '#00E676' }}>{rewardMsg}</p>}
            {rewardErr && <p className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(255,68,68,0.08)', color: '#FF6B6B' }}>{rewardErr}</p>}
            <div className="flex gap-3 mt-4">
              {editingReward && <button onClick={() => { setEditingReward(null); setRewardForm({}); }} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#7b88c0', cursor: 'pointer' }}>Cancel</button>}
              <button onClick={saveReward} disabled={rewardLoading} className="px-6 py-2 rounded-lg text-xs font-bold" style={{ background: 'rgba(255,180,0,0.12)', border: '1px solid rgba(255,180,0,0.3)', color: '#FFB400', cursor: 'pointer' }}>
                {rewardLoading ? 'Saving...' : editingReward ? 'Save Changes' : 'Create Reward'}
              </button>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {rewards.length === 0 ? <p className="px-5 py-8 text-xs" style={{ color: '#3a4570' }}>No reward products yet.</p> : rewards.map(r => {
              const cc = codeCounts[r.id];
              const isImporting = importingFor === r.id;
              return (
                <div key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: r.active ? '#c8d0f0' : '#3a4570' }}>{r.name}</p>
                      <p className="text-[10px]" style={{ color: '#3a4570' }}>
                        {r.token_cost} <TokenIcon size={11} /> · {r.membership_type} · stock: {r.stock < 0 ? '∞' : r.stock}
                        {cc ? <span style={{ color: cc.available > 0 ? '#00E676' : '#FF6B6B' }}> · codes: {cc.available}/{cc.total} avail</span> : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: r.active ? 'rgba(0,230,118,0.1)' : 'rgba(255,68,68,0.1)', color: r.active ? '#00E676' : '#FF6B6B' }}>{r.active ? 'Active' : 'Hidden'}</span>
                      <button onClick={() => { setEditingReward(r); setRewardForm({ name: r.name, description: r.description ?? '', image_url: r.image_url ?? '', delivery_content: r.delivery_content ?? '', token_cost: r.token_cost, membership_type: r.membership_type, stock: r.stock }); }} className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.2)', color: '#00BFFF', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => { setImportingFor(isImporting ? null : r.id); setImportText(''); setImportMsg(''); }} className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(138,43,226,0.1)', border: '1px solid rgba(138,43,226,0.25)', color: '#B06EFF', cursor: 'pointer' }}>Codes</button>
                      <button onClick={() => toggleRewardActive(r)} className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.2)', color: '#FF8C00', cursor: 'pointer' }}>{r.active ? 'Hide' : 'Show'}</button>
                      <button onClick={() => deleteReward(r.id)} className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', color: '#FF6B6B', cursor: 'pointer' }}>Del</button>
                    </div>
                  </div>
                  {isImporting && (
                    <div className="px-5 pb-4" style={{ borderTop: '1px solid rgba(138,43,226,0.15)', background: 'rgba(138,43,226,0.04)' }}>
                      <p className="text-[10px] uppercase tracking-widest mt-3 mb-2" style={{ color: '#B06EFF' }}>Bulk Import Codes — one per line</p>
                      <textarea
                        value={importText}
                        onChange={e => setImportText(e.target.value)}
                        placeholder={"CODE001\nCODE002\nCODE003"}
                        rows={5}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(138,43,226,0.3)', color: '#e8eaf6', outline: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, resize: 'vertical', fontFamily: 'monospace' }}
                      />
                      <div className="flex items-center gap-3 mt-2">
                        <button onClick={() => importBulkCodes(r.id)} disabled={importLoading || !importText.trim()} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ background: 'rgba(138,43,226,0.15)', border: '1px solid rgba(138,43,226,0.35)', color: '#B06EFF', cursor: importLoading || !importText.trim() ? 'not-allowed' : 'pointer' }}>
                          {importLoading ? 'Importing...' : `Import ${importText.split('\n').filter(l => l.trim()).length} codes`}
                        </button>
                        {importMsg && <span className="text-xs" style={{ color: importMsg.startsWith('✓') ? '#00E676' : '#FF6B6B' }}>{importMsg}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Redemption Logs */}
      {subTab === 'logs' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold uppercase tracking-widest" style={{ color: '#c8d0f0' }}>Redemption History</p>
            <button onClick={loadRedemptionLogs} disabled={logsLoading} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.2)', color: '#00BFFF', cursor: 'pointer' }}>
              {logsLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          {redemptionLogs.length === 0 ? (
            <div className="rounded-2xl py-12 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-3xl mb-2">📋</p>
              <p className="text-xs" style={{ color: '#3a4570' }}>No redemptions yet. Click Refresh to load.</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="grid px-5 py-2" style={{ gridTemplateColumns: '1fr 1fr 80px 1fr', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Date', 'Member', 'Tokens', 'Reward / Code'].map(h => (
                  <span key={h} className="text-[10px] uppercase tracking-widest" style={{ color: '#3a4570' }}>{h}</span>
                ))}
              </div>
              {redemptionLogs.map((log: any, i: number) => (
                <div key={log.id ?? i} className="grid items-start px-5 py-3 gap-2" style={{ gridTemplateColumns: '1fr 1fr 80px 1fr', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-[11px]" style={{ color: '#7b88c0' }}>{new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-[11px] truncate" style={{ color: '#c8d0f0' }}>{log.user_email ?? log.user_id}</span>
                  <span className="text-[11px] font-bold" style={{ color: '#FFB400' }}>{log.tokens_spent} <TokenIcon size={10} /></span>
                  <div>
                    <p className="text-[11px] font-semibold" style={{ color: '#e8eaf6' }}>{log.reward_name}</p>
                    {log.code_delivered && <p className="text-[10px] mt-0.5 font-mono break-all" style={{ color: '#B06EFF' }}>{log.code_delivered}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leaderboards */}
      {subTab === 'leaderboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[{ title: 'VIP Leaderboard', entries: vipLeaders, color: '#FFB400' }, { title: 'Reseller Leaderboard', entries: resellerLeaders, color: '#00E676' }].map(({ title, entries, color }) => (
            <div key={title} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}18` }}>
              <p className="px-5 py-3 text-xs font-bold uppercase tracking-widest" style={{ color, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{title}</p>
              {entries.length === 0 ? <p className="px-5 py-6 text-xs" style={{ color: '#3a4570' }}>No data yet</p> : entries.map(e => (
                <div key={e.user_id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span className="text-sm w-6 text-center font-bold" style={{ color: e.rank <= 3 ? color : '#3a4570' }}>#{e.rank}</span>
                  <span className="flex-1 text-xs truncate" style={{ color: '#7b88c0' }}>{e.email}</span>
                  <span className="text-sm font-black" style={{ color, fontFamily: "'Rajdhani','Inter',sans-serif" }}>{e.tokens} <TokenIcon size={12} /></span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
