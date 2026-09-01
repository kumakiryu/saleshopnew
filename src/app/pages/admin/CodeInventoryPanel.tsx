import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, ProductCode } from '@/lib/types';

const CSS = `
  .ci-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e8eaf6; outline: none; border-radius: 8px; padding: 8px 12px; font-size: 13px; transition: border-color 0.2s; font-family: 'Inter', sans-serif; width: 100%; }
  .ci-input:focus { border-color: rgba(0,191,255,0.4); }
  .ci-input::placeholder { color: #2e3a5a; }
  .ci-row { transition: background 0.15s; }
  .ci-row:hover { background: rgba(255,255,255,0.02); }
`;

interface Props { products: Product[]; }

type CodeFilter = 'all' | 'available' | 'delivered';

export default function CodeInventoryPanel({ products }: Props) {
  const codeProducts = products.filter(p => p.product_type === 'digital_code');
  const [selectedProductId, setSelectedProductId] = useState<string>(codeProducts[0]?.id ?? '');
  const [codes, setCodes] = useState<ProductCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<CodeFilter>('all');
  const [newCode, setNewCode] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProductId) return;
    setLoading(true);
    supabase.from('product_codes').select('*').eq('product_id', selectedProductId).order('assigned_at', { ascending: false })
      .then(({ data }) => { setCodes((data ?? []) as ProductCode[]); setLoading(false); });

    const ch = supabase.channel(`codes-${selectedProductId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_codes', filter: `product_id=eq.${selectedProductId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setCodes(prev => prev.filter(c => c.id !== (payload.old as { id: string }).id));
        } else {
          const incoming = payload.new as ProductCode;
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
    setDeleting(null);
  }

  const filtered = codes.filter(c => filter === 'all' || c.status === filter);
  const available = codes.filter(c => c.status === 'available').length;
  const delivered = codes.filter(c => c.status === 'delivered').length;

  const statusColor = (s: string) => s === 'available' ? '#00E676' : s === 'delivered' ? '#8A2BE2' : '#FF8C00';

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <style>{CSS}</style>

      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <h2 className="font-bold tracking-widest text-sm" style={{ color: '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>CODE INVENTORY</h2>
          <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: '#2e3a5a' }}>{available} available · {delivered} delivered</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Stats pills */}
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
          <button onClick={() => setShowBulk(v => !v)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide"
            style={{ background: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.25)', color: '#00BFFF', cursor: 'pointer' }}>
            Bulk Import
          </button>
        </div>
      </div>

      <div className="px-6 py-4 flex flex-col gap-4">

        {/* Product selector */}
        {codeProducts.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: '#2e3a5a' }}>No Digital Code products found. Set a product type to "Digital Code" in the Products tab first.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <select className="ci-input flex-1 min-w-0" style={{ maxWidth: '260px' }}
                value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                {codeProducts.map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#080d28' }}>{p.name}</option>
                ))}
              </select>

              {/* Filter */}
              <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {(['all', 'available', 'delivered'] as CodeFilter[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      background: filter === f ? 'rgba(0,191,255,0.1)' : 'transparent',
                      color: filter === f ? '#00BFFF' : '#3a4570',
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
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#3a4570', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Code list */}
            {loading ? (
              <div className="py-8 text-center text-xs uppercase tracking-widest" style={{ color: '#2e3a5a' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-xs" style={{ color: '#2e3a5a' }}>
                {filter === 'all' ? 'No codes yet. Add codes above.' : `No ${filter} codes.`}
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Col headers */}
                <div className="grid px-4 py-2 text-[10px] uppercase tracking-widest"
                  style={{ gridTemplateColumns: '1fr 90px 1fr 60px', background: 'rgba(255,255,255,0.02)', color: '#2e3a5a' }}>
                  <span>Code</span><span>Status</span><span>Assigned To</span><span></span>
                </div>
                {filtered.map(c => (
                  <div key={c.id} className="ci-row grid px-4 py-3 items-center"
                    style={{ gridTemplateColumns: '1fr 90px 1fr 60px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-xs font-mono font-semibold" style={{ color: '#c8d0f0' }}>{c.code}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded w-fit font-bold uppercase"
                      style={{ background: `${statusColor(c.status)}12`, color: statusColor(c.status), border: `1px solid ${statusColor(c.status)}30` }}>
                      {c.status}
                    </span>
                    <span className="text-[10px] truncate" style={{ color: '#3a4570' }}>
                      {c.assigned_to ? c.assigned_to.slice(0, 8).toUpperCase() : '—'}
                    </span>
                    {c.status === 'available' && (
                      <button onClick={() => deleteCode(c.id)} disabled={deleting === c.id}
                        className="text-[10px] px-2 py-1 rounded justify-self-end"
                        style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', color: '#FF6B6B', cursor: 'pointer', opacity: deleting === c.id ? 0.4 : 1 }}>
                        Del
                      </button>
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
