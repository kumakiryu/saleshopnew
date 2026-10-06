import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, ProductCode } from '@/lib/types';

const CSS = `
  .ci-input { background: var(--as3); border: 1px solid var(--ab2); color: var(--at); outline: none; border-radius: 8px; padding: 8px 12px; font-size: 13px; transition: border-color 0.2s; font-family: 'Inter', sans-serif; width: 100%; }
  .ci-input:focus { border-color: rgba(0,191,255,0.4); }
  .ci-input::placeholder { color: #2e3a5a; }
  .ci-row { transition: background 0.15s; }
  .ci-row:hover { background: var(--as1); }
  .ci-checkbox { width: 14px; height: 14px; accent-color: #00BFFF; cursor: pointer; flex-shrink: 0; }
`;

interface Props { products: Product[]; }

type CodeFilter = 'all' | 'available' | 'delivered';

export default function CodeInventoryPanel({ products }: Props) {
  const codeProducts = products.filter(p => p.product_type === 'digital_code');
  const [selectedProductId, setSelectedProductId] = useState<string>(codeProducts[0]?.id ?? '');
  const [codes, setCodes] = useState<ProductCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<CodeFilter>('available');
  const [newCode, setNewCode] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    if (!selectedProductId) return;
    setLoading(true);
    setSelected(new Set());
    supabase.from('product_codes').select('*').eq('product_id', selectedProductId).order('assigned_at', { ascending: false })
      .then(({ data }) => { setCodes((data ?? []) as ProductCode[]); setLoading(false); });

    const ch = supabase.channel(`codes-${selectedProductId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_codes', filter: `product_id=eq.${selectedProductId}` }, async (payload) => {
        if (payload.eventType === 'DELETE') {
          setCodes(prev => prev.filter(c => c.id !== (payload.old as { id: string }).id));
          setSelected(prev => { const n = new Set(prev); n.delete((payload.old as { id: string }).id); return n; });
        } else {
          const incoming = payload.new as ProductCode;
          // Auto-delete codes that become delivered — they're already in the order receipt
          if (incoming.status === 'delivered') {
            await supabase.from('product_codes').delete().eq('id', incoming.id);
            // The DELETE event above will remove it from the list
            return;
          }
          setCodes(prev => prev.some(c => c.id === incoming.id)
            ? prev.map(c => c.id === incoming.id ? incoming : c)
            : [incoming, ...prev]);
        }
      }).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [selectedProductId]);

  async function addCode() {
    const trimmed = newCode.trim();
    if (!trimmed || !selectedProductId) return;
    setSaving(true);
    const { data } = await supabase.from('product_codes').insert({ product_id: selectedProductId, code: trimmed, status: 'available' }).select().single();
    if (data) setCodes(prev => [data as ProductCode, ...prev]);
    setNewCode('');
    setSaving(false);
  }

  async function bulkImport() {
    if (!bulkText.trim() || !selectedProductId) return;
    setSaving(true);
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    const rows = lines.map(code => ({ product_id: selectedProductId, code, status: 'available' }));
    const { data } = await supabase.from('product_codes').insert(rows).select();
    if (data) setCodes(prev => [...(data as ProductCode[]), ...prev]);
    setBulkText('');
    setShowBulk(false);
    setSaving(false);
  }

  async function deleteCode(id: string) {
    setDeleting(id);
    await supabase.from('product_codes').delete().eq('id', id);
    setCodes(prev => prev.filter(c => c.id !== id));
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    setDeleting(null);
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    const ids = [...selected];
    await supabase.from('product_codes').delete().in('id', ids);
    setCodes(prev => prev.filter(c => !ids.includes(c.id)));
    setSelected(new Set());
    setBulkDeleting(false);
  }

  const filtered = codes.filter(c => filter === 'all' || c.status === filter);
  const available = codes.filter(c => c.status === 'available').length;
  const delivered = codes.filter(c => c.status === 'delivered').length;

  const filteredAvailable = filtered.filter(c => c.status === 'available');
  const allSelected = filteredAvailable.length > 0 && filteredAvailable.every(c => selected.has(c.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); filteredAvailable.forEach(c => n.delete(c.id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); filteredAvailable.forEach(c => n.add(c.id)); return n; });
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const statusColor = (s: string) => s === 'available' ? '#00E676' : s === 'delivered' ? '#8A2BE2' : '#FF8C00';

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid var(--ab)' }}>
      <style>{CSS}</style>

      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={{ borderBottom: '1px solid var(--ab)' }}>
        <div>
          <h2 className="font-bold tracking-widest text-sm" style={{ color: '#ffffff', fontFamily: "'Exo 2','Inter',sans-serif" }}>CODE INVENTORY</h2>
          <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--atg)' }}>
            {available} available · {delivered} delivered · Auto-removes on delivery
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {available < 5 && available > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: 'rgba(255,140,0,0.12)', color: '#FF8C00', border: '1px solid rgba(255,140,0,0.3)' }}>
              Low Stock — {available} left
            </span>
          )}
          {available === 0 && codes.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: 'rgba(255,68,68,0.12)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.3)' }}>
              Out of Codes
            </span>
          )}
          {/* Bulk delete when items selected */}
          {selected.size > 0 && (
            <button onClick={bulkDelete} disabled={bulkDeleting}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5"
              style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', color: '#FF6B6B', cursor: 'pointer', opacity: bulkDeleting ? 0.5 : 1 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
              {bulkDeleting ? 'Deleting…' : `Delete ${selected.size}`}
            </button>
          )}
          <button onClick={() => setShowBulk(v => !v)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide"
            style={{ background: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.25)', color: '#00BFFF', cursor: 'pointer' }}>
            Bulk Import
          </button>
        </div>
      </div>

      <div className="px-6 py-4 flex flex-col gap-4">

        {codeProducts.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: 'var(--atg)' }}>No Digital Code products found. Set a product type to "Digital Code" in the Products tab first.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <select className="ci-input flex-1 min-w-0" style={{ maxWidth: '260px' }}
                value={selectedProductId} onChange={e => { setSelectedProductId(e.target.value); setSelected(new Set()); }}>
                {codeProducts.map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#080d28' }}>{p.name}</option>
                ))}
              </select>

              <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--as2)', border: '1px solid var(--ab)' }}>
                {(['all', 'available', 'delivered'] as CodeFilter[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      background: filter === f ? 'rgba(0,191,255,0.1)' : 'transparent',
                      color: filter === f ? '#00BFFF' : 'var(--atg)',
                      border: `1px solid ${filter === f ? 'rgba(0,191,255,0.3)' : 'transparent'}`,
                      cursor: 'pointer',
                    }}>{f}</button>
                ))}
              </div>
            </div>

            {/* Add single code */}
            <div className="flex gap-2">
              <input className="ci-input flex-1" value={newCode} onChange={e => setNewCode(e.target.value)}
                placeholder="Enter a code e.g. CODE-12345"
                onKeyDown={e => e.key === 'Enter' && addCode()} />
              <button onClick={addCode} disabled={saving || !newCode.trim()}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide flex-shrink-0"
                style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.25)', color: '#00E676', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                Add
              </button>
            </div>

            {/* Bulk import */}
            {showBulk && (
              <div className="flex flex-col gap-2 p-4 rounded-xl" style={{ background: 'rgba(0,191,255,0.04)', border: '1px solid rgba(0,191,255,0.15)' }}>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: '#00BFFF' }}>Bulk Import — one code per line</p>
                <textarea className="ci-input resize-none" rows={5} value={bulkText} onChange={e => setBulkText(e.target.value)}
                  placeholder={"CODE-12345\nCODE-67890\nCODE-ABCDE"} style={{ fontFamily: 'monospace', fontSize: '12px' }} />
                <div className="flex gap-2">
                  <button onClick={bulkImport} disabled={saving || !bulkText.trim()}
                    className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide"
                    style={{ background: 'rgba(0,191,255,0.1)', border: '1px solid rgba(0,191,255,0.3)', color: '#00BFFF', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                    {saving ? 'Importing...' : `Import ${bulkText.split('\n').filter(l => l.trim()).length} codes`}
                  </button>
                  <button onClick={() => setShowBulk(false)}
                    className="px-3 py-2 rounded-lg text-xs"
                    style={{ background: 'transparent', border: '1px solid var(--ab2)', color: 'var(--atg)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Code list */}
            {loading ? (
              <div className="py-8 text-center text-xs uppercase tracking-widest" style={{ color: 'var(--atg)' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-xs" style={{ color: 'var(--atg)' }}>
                {filter === 'all' ? 'No codes yet. Add codes above.' : `No ${filter} codes.`}
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ab)' }}>
                {/* Col headers */}
                <div className="grid px-4 py-2 text-[10px] uppercase tracking-widest items-center"
                  style={{ gridTemplateColumns: '20px 1fr 90px 1fr 60px', background: 'var(--as1)', color: 'var(--atg)', gap: '10px' }}>
                  {/* Select-all checkbox — only makes sense for available codes */}
                  <input type="checkbox" className="ci-checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    title="Select all available"
                  />
                  <span>Code</span>
                  <span>Status</span>
                  <span>Assigned To</span>
                  <span></span>
                </div>

                {filtered.map(c => {
                  const isAvailable = c.status === 'available';
                  const isSelected = selected.has(c.id);
                  return (
                    <div key={c.id} className="ci-row grid px-4 py-3 items-center"
                      style={{
                        gridTemplateColumns: '20px 1fr 90px 1fr 60px',
                        gap: '10px',
                        borderTop: '1px solid var(--ab)',
                        background: isSelected ? 'rgba(255,68,68,0.04)' : undefined,
                      }}>
                      <input type="checkbox" className="ci-checkbox"
                        checked={isSelected}
                        disabled={!isAvailable}
                        onChange={() => isAvailable && toggleSelect(c.id)}
                        style={{ opacity: isAvailable ? 1 : 0.2 }}
                      />
                      <span className="text-xs font-mono font-semibold" style={{ color: 'var(--at2)' }}>{c.code}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded w-fit font-bold uppercase"
                        style={{ background: `${statusColor(c.status)}12`, color: statusColor(c.status), border: `1px solid ${statusColor(c.status)}30` }}>
                        {c.status}
                      </span>
                      <span className="text-[10px] truncate" style={{ color: 'var(--atg)' }}>
                        {c.assigned_to ? c.assigned_to.slice(0, 8).toUpperCase() : '—'}
                      </span>
                      {isAvailable && (
                        <button onClick={() => deleteCode(c.id)} disabled={deleting === c.id}
                          className="text-[10px] px-2 py-1 rounded justify-self-end"
                          style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', color: '#FF6B6B', cursor: 'pointer', opacity: deleting === c.id ? 0.4 : 1 }}>
                          Del
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Footer with selection count */}
                {selected.size > 0 && (
                  <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'rgba(255,68,68,0.05)', borderTop: '1px solid rgba(255,68,68,0.15)' }}>
                    <span className="text-[10px]" style={{ color: '#FF6B6B' }}>
                      {selected.size} code{selected.size > 1 ? 's' : ''} selected
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => setSelected(new Set())}
                        className="text-[10px] px-2.5 py-1 rounded"
                        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--atg)', cursor: 'pointer' }}>
                        Clear
                      </button>
                      <button onClick={bulkDelete} disabled={bulkDeleting}
                        className="text-[10px] px-2.5 py-1 rounded font-bold"
                        style={{ background: 'rgba(255,68,68,0.12)', border: '1px solid rgba(255,68,68,0.3)', color: '#FF6B6B', cursor: 'pointer', opacity: bulkDeleting ? 0.5 : 1 }}>
                        {bulkDeleting ? 'Deleting…' : `Delete ${selected.size}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
