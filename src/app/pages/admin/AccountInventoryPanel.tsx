import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, ProductAccount } from '@/lib/types';

const CSS = `
  .ai-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e8eaf6; outline: none; border-radius: 8px; padding: 8px 12px; font-size: 13px; transition: border-color 0.2s; font-family: 'Inter', sans-serif; width: 100%; }
  .ai-input:focus { border-color: rgba(138,43,226,0.4); }
  .ai-input::placeholder { color: #2e3a5a; }
  .ai-row { transition: background 0.15s; }
  .ai-row:hover { background: rgba(255,255,255,0.02); }
`;

interface Props { products: Product[]; }

type AcctFilter = 'all' | 'available' | 'delivered';

const LOW_STOCK_THRESHOLD = 5;

export default function AccountInventoryPanel({ products }: Props) {
  const acctProducts = products.filter(p => p.product_type === 'account_product');
  const [selectedProductId, setSelectedProductId] = useState<string>(acctProducts[0]?.id ?? '');
  const [accounts, setAccounts] = useState<ProductAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<AcctFilter>('all');
  const [search, setSearch] = useState('');
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ username: '', password: '' });
  const [newAcct, setNewAcct] = useState({ username: '', password: '' });
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProductId) return;
    setLoading(true);
    setSearch('');
    setEditId(null);
    supabase.from('product_accounts').select('*').eq('product_id', selectedProductId).order('created_at', { ascending: false })
      .then(({ data }) => { setAccounts((data ?? []) as ProductAccount[]); setLoading(false); });

    const ch = supabase.channel(`accounts-${selectedProductId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_accounts', filter: `product_id=eq.${selectedProductId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setAccounts(prev => prev.filter(a => a.id !== (payload.old as { id: string }).id));
        } else {
          const incoming = payload.new as ProductAccount;
          setAccounts(prev => prev.some(a => a.id === incoming.id)
            ? prev.map(a => a.id === incoming.id ? incoming : a)
            : [incoming, ...prev]);
        }
      }).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [selectedProductId]);

  async function addAccount() {
    const u = newAcct.username.trim();
    const p = newAcct.password.trim();
    if (!u || !p || !selectedProductId) return;
    setSaving(true);
    const { data } = await supabase.from('product_accounts')
      .insert({ product_id: selectedProductId, username: u, password: p, status: 'available' })
      .select().single();
    if (data) setAccounts(prev => [data as ProductAccount, ...prev]);
    setNewAcct({ username: '', password: '' });
    setSaving(false);
  }

  async function saveEdit(id: string) {
    const u = editForm.username.trim();
    const p = editForm.password.trim();
    if (!u || !p) return;
    setSaving(true);
    const { data } = await supabase.from('product_accounts').update({ username: u, password: p }).eq('id', id).select().single();
    if (data) setAccounts(prev => prev.map(a => a.id === id ? data as ProductAccount : a));
    setEditId(null);
    setSaving(false);
  }

  async function bulkImport() {
    if (!bulkText.trim() || !selectedProductId) return;
    setSaving(true);
    const rows = bulkText.split('\n')
      .map(line => {
        const parts = line.split('|').map(s => s.trim());
        return parts.length >= 2 ? { product_id: selectedProductId, username: parts[0], password: parts[1], status: 'available' } : null;
      })
      .filter(Boolean) as { product_id: string; username: string; password: string; status: string }[];

    if (rows.length > 0) {
      const { data } = await supabase.from('product_accounts').insert(rows).select();
      if (data) setAccounts(prev => [...(data as ProductAccount[]), ...prev]);
    }
    setBulkText('');
    setShowBulk(false);
    setSaving(false);
  }

  async function deleteAccount(id: string) {
    setDeleting(id);
    await supabase.from('product_accounts').delete().eq('id', id);
    setAccounts(prev => prev.filter(a => a.id !== id));
    setDeleting(null);
  }

  const filtered = accounts
    .filter(a => filter === 'all' || a.status === filter)
    .filter(a => !search || a.username.toLowerCase().includes(search.toLowerCase()));

  const available = accounts.filter(a => a.status === 'available').length;
  const delivered = accounts.filter(a => a.status === 'delivered').length;
  const isLow = available > 0 && available <= LOW_STOCK_THRESHOLD;
  const isOut = available === 0 && accounts.length > 0;

  const statusColor = (s: string) => s === 'available' ? '#00E676' : s === 'delivered' ? '#8A2BE2' : '#FF8C00';

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <style>{CSS}</style>

      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <h2 className="font-bold tracking-widest text-sm" style={{ color: '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>ACCOUNT INVENTORY</h2>
          <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: '#2e3a5a' }}>{available} available · {delivered} delivered · {accounts.length} total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isLow && (
            <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: 'rgba(255,140,0,0.12)', color: '#FF8C00', border: '1px solid rgba(255,140,0,0.3)' }}>
              Low Inventory — {available} left
            </span>
          )}
          {isOut && (
            <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: 'rgba(255,68,68,0.12)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.3)' }}>
              Out of Accounts
            </span>
          )}
          <button onClick={() => setShowBulk(v => !v)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide"
            style={{ background: 'rgba(138,43,226,0.1)', border: '1px solid rgba(138,43,226,0.3)', color: '#8A2BE2', cursor: 'pointer' }}>
            Bulk Import
          </button>
        </div>
      </div>

      <div className="px-6 py-4 flex flex-col gap-4">

        {acctProducts.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: '#2e3a5a' }}>No Account Product products found. Set a product type to "Account Product" in the Products tab first.</p>
        ) : (
          <>
            {/* Product selector + filter + search */}
            <div className="flex items-center gap-3 flex-wrap">
              <select className="ai-input" style={{ maxWidth: '220px' }}
                value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                {acctProducts.map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#080d28' }}>{p.name}</option>
                ))}
              </select>

              <input className="ai-input flex-1" style={{ maxWidth: '200px' }} value={search}
                onChange={e => setSearch(e.target.value)} placeholder="Search username..." />

              <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {(['all', 'available', 'delivered'] as AcctFilter[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      background: filter === f ? 'rgba(138,43,226,0.1)' : 'transparent',
                      color: filter === f ? '#8A2BE2' : '#3a4570',
                      border: `1px solid ${filter === f ? 'rgba(138,43,226,0.3)' : 'transparent'}`,
                      cursor: 'pointer',
                    }}>{f}</button>
                ))}
              </div>
            </div>

            {/* Add single account */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className="ai-input" value={newAcct.username} onChange={e => setNewAcct(v => ({ ...v, username: e.target.value }))}
                placeholder="Username or email" />
              <div className="flex gap-2">
                <input className="ai-input flex-1" value={newAcct.password} onChange={e => setNewAcct(v => ({ ...v, password: e.target.value }))}
                  placeholder="Password" onKeyDown={e => e.key === 'Enter' && addAccount()} />
                <button onClick={addAccount} disabled={saving || !newAcct.username.trim() || !newAcct.password.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide flex-shrink-0"
                  style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.25)', color: '#00E676', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                  Add
                </button>
              </div>
            </div>

            {/* Bulk import */}
            {showBulk && (
              <div className="flex flex-col gap-2 p-4 rounded-xl" style={{ background: 'rgba(138,43,226,0.04)', border: '1px solid rgba(138,43,226,0.15)' }}>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: '#8A2BE2' }}>Bulk Import — format: username | password</p>
                <textarea className="ai-input resize-none" rows={5} value={bulkText} onChange={e => setBulkText(e.target.value)}
                  placeholder={"user1@example.com | Password123\nuser2@example.com | Password456"} style={{ fontFamily: 'monospace', fontSize: '12px' }} />
                <div className="flex gap-2">
                  <button onClick={bulkImport} disabled={saving || !bulkText.trim()}
                    className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide"
                    style={{ background: 'rgba(138,43,226,0.1)', border: '1px solid rgba(138,43,226,0.3)', color: '#8A2BE2', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                    {saving ? 'Importing...' : `Import ${bulkText.split('\n').filter(l => l.trim() && l.includes('|')).length} accounts`}
                  </button>
                  <button onClick={() => setShowBulk(false)}
                    className="px-3 py-2 rounded-lg text-xs"
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#3a4570', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Account list */}
            {loading ? (
              <div className="py-8 text-center text-xs uppercase tracking-widest" style={{ color: '#2e3a5a' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-xs" style={{ color: '#2e3a5a' }}>
                {search ? `No results for "${search}".` : filter === 'all' ? 'No accounts yet. Add accounts above.' : `No ${filter} accounts.`}
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="grid px-4 py-2 text-[10px] uppercase tracking-widest"
                  style={{ gridTemplateColumns: '1fr 1fr 90px 80px', background: 'rgba(255,255,255,0.02)', color: '#2e3a5a' }}>
                  <span>Username</span><span>Password</span><span>Status</span><span className="text-right">Actions</span>
                </div>
                {filtered.map(a => (
                  <div key={a.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    {editId === a.id ? (
                      // Inline edit row
                      <div className="grid px-4 py-2.5 items-center gap-2"
                        style={{ gridTemplateColumns: '1fr 1fr 90px 80px' }}>
                        <input className="ai-input" value={editForm.username} onChange={e => setEditForm(v => ({ ...v, username: e.target.value }))} />
                        <input className="ai-input" value={editForm.password} onChange={e => setEditForm(v => ({ ...v, password: e.target.value }))} />
                        <span />
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => saveEdit(a.id)} disabled={saving}
                            className="text-[10px] px-2 py-1 rounded font-bold"
                            style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.25)', color: '#00E676', cursor: 'pointer' }}>
                            Save
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="text-[10px] px-2 py-1 rounded"
                            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#3a4570', cursor: 'pointer' }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Normal row
                      <div className="ai-row grid px-4 py-3 items-center"
                        style={{ gridTemplateColumns: '1fr 1fr 90px 80px' }}>
                        <span className="text-xs font-mono truncate pr-2" style={{ color: '#c8d0f0' }}>{a.username}</span>
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          <span className="text-xs font-mono truncate" style={{ color: showPw[a.id] ? '#c8d0f0' : '#2e3a5a', letterSpacing: showPw[a.id] ? 'normal' : '0.15em' }}>
                            {showPw[a.id] ? a.password : '••••••••'}
                          </span>
                          <button onClick={() => setShowPw(p => ({ ...p, [a.id]: !p[a.id] }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2e3a5a', padding: '0', flexShrink: 0 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              {showPw[a.id]
                                ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                                : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                            </svg>
                          </button>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded w-fit font-bold uppercase"
                          style={{ background: `${statusColor(a.status)}12`, color: statusColor(a.status), border: `1px solid ${statusColor(a.status)}30` }}>
                          {a.status}
                        </span>
                        <div className="flex gap-1 justify-end">
                          {a.status === 'available' && (
                            <button onClick={() => { setEditId(a.id); setEditForm({ username: a.username, password: a.password }); }}
                              className="text-[10px] px-2 py-1 rounded"
                              style={{ background: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.2)', color: '#00BFFF', cursor: 'pointer' }}>
                              Edit
                            </button>
                          )}
                          {a.status === 'available' && (
                            <button onClick={() => deleteAccount(a.id)} disabled={deleting === a.id}
                              className="text-[10px] px-2 py-1 rounded"
                              style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', color: '#FF6B6B', cursor: 'pointer', opacity: deleting === a.id ? 0.4 : 1 }}>
                              Del
                            </button>
                          )}
                          {a.status === 'delivered' && a.assigned_order_id && (
                            <span className="text-[10px]" style={{ color: '#2e3a5a' }}>{a.assigned_order_id.slice(0, 8).toUpperCase()}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
