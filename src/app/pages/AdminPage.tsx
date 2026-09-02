import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import type { Product, Announcement } from '@/lib/types';
import { CATEGORY_STYLE, renderContent } from './AnnouncementsPage';
import CodeInventoryPanel from './admin/CodeInventoryPanel';
import AccountInventoryPanel from './admin/AccountInventoryPanel';
import VaultGuard from './admin/VaultGuard';
import AdminSettingsPanel from './admin/AdminSettingsPanel';
import { isVaultUnlocked } from '@/lib/vault';

/* ─────────────────────────────────────────────────────── types */
type AuthState = 'checking' | 'login' | 'denied' | 'dashboard';
interface AdminUser { id: string; email: string; }

/* ─────────────────────────────────────────────────────── css */
const ADMIN_CSS = `
  .a-input {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    color: #e8eaf6;
    outline: none;
    transition: border-color 0.2s;
    width: 100%;
  }
  .a-input:focus { border-color: rgba(0,191,255,0.5); }
  .a-input::placeholder { color: #2e3a5a; }
  .a-row { transition: background 0.15s; }
  .a-row:hover { background: rgba(255,255,255,0.02); }
  .a-btn-edit {
    background: rgba(0,191,255,0.08);
    border: 1px solid rgba(0,191,255,0.2);
    color: #00BFFF;
    transition: all 0.2s;
  }
  .a-btn-edit:hover { background: rgba(0,191,255,0.16); }
  .a-btn-del {
    background: rgba(255,68,68,0.08);
    border: 1px solid rgba(255,68,68,0.2);
    color: #FF6B6B;
    transition: all 0.2s;
  }
  .a-btn-del:hover { background: rgba(255,68,68,0.16); }
  .a-stock-minus {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    transition: all 0.15s;
  }
  .a-stock-minus:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
  .a-stock-plus {
    background: rgba(0,191,255,0.08);
    border: 1px solid rgba(0,191,255,0.2);
    color: #00BFFF;
    transition: all 0.15s;
  }
  .a-stock-plus:hover:not(:disabled) { background: rgba(0,191,255,0.16); }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

/* ─────────────────────────────────────────────────────── helpers */
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 min-w-[120px] p-4 rounded-xl" style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
      border: `1px solid ${color}22`,
      backdropFilter: 'blur(8px)',
    }}>
      <div className="text-2xl font-bold mb-0.5" style={{ color, fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest" style={{ color: '#2e3a5a' }}>{label}</div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,68,68,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.2)' }}>
      {msg}
    </div>
  );
}

/* ─────────────────────────────────────────────────────── login */
function AdminLogin({ onSuccess }: { onSuccess: (u: AdminUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) onSuccess({ id: data.user.id, email: data.user.email! });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#050816' }}>
      <style>{ADMIN_CSS}</style>
      <motion.div className="w-full max-w-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-1 h-7 rounded-full" style={{ background: 'linear-gradient(to bottom, #00BFFF, #8A2BE2)' }} />
            <span className="text-2xl font-bold tracking-widest" style={{ color: '#fff', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>ADMIN</span>
          </div>
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: '#2e3a5a' }}>Sale Shop Control Panel</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6 rounded-2xl" style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
          border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)',
        }}>
          {error && <ErrorBox msg={error} />}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="a-input px-3 py-2.5 rounded-lg text-sm" placeholder="admin@example.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="a-input px-3 py-2.5 rounded-lg text-sm" placeholder="••••••••" />
          </div>

          <button type="submit" disabled={loading} className="mt-1 py-3 rounded-lg text-sm font-bold tracking-widest uppercase"
            style={{
              background: loading ? 'rgba(0,191,255,0.05)' : 'linear-gradient(135deg, rgba(0,191,255,0.18) 0%, rgba(138,43,226,0.18) 100%)',
              border: '1px solid rgba(0,191,255,0.35)', color: loading ? '#3a4570' : '#ffffff',
              fontFamily: "'Rajdhani', 'Inter', sans-serif", transition: 'all 0.2s',
            }}>
            {loading ? 'Verifying...' : 'Sign In'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────── product modal */
interface ModalProps { product: Product | null; onClose: () => void; categories: string[]; }

function ProductModal({ product, onClose, categories }: ModalProps) {
  const { upsertProduct } = useStore();
  const isEdit = !!product;
  const [form, setForm] = useState({
    name:         product?.name         ?? '',
    description:  product?.description  ?? '',
    image_url:    product?.image_url    ?? '',
    download_url: product?.download_url ?? '',
    price:        product?.price?.toString()  ?? '',
    category:     product?.category     ?? '',
    stock:        product?.stock?.toString()  ?? '0',
    product_type: product?.product_type ?? 'physical',
  });
  const [isNewCat, setIsNewCat] = useState(
    !!product?.category && !categories.includes(product.category)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(key: keyof typeof form, val: string) { setForm(f => ({ ...f, [key]: val })); }

  async function save() {
    if (!form.name.trim()) return setError('Name is required');
    setLoading(true); setError('');
    const payload = {
      name:         form.name.trim(),
      description:  form.description.trim()  || null,
      image_url:    form.image_url.trim()    || null,
      download_url: form.product_type === 'digital_download' ? (form.download_url.trim() || null) : null,
      price:        parseFloat(form.price)   || 0,
      category:     form.category.trim()     || null,
      stock:        parseInt(form.stock)     || 0,
      product_type: form.product_type,
      updated_at:   new Date().toISOString(),
    };
    try {
      if (isEdit) {
        const { data, error } = await supabase.from('products').update(payload).eq('id', product.id).select().single();
        if (error) throw error;
        if (data) upsertProduct(data as Product);
      } else {
        const { data, error } = await supabase.from('products').insert(payload).select().single();
        if (error) throw error;
        if (data) upsertProduct(data as Product);
      }
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Save failed');
    } finally { setLoading(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
      <motion.div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#080d28', border: '1px solid rgba(0,191,255,0.2)', boxShadow: '0 0 48px rgba(0,191,255,0.08)' }}
        initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2 }}
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="font-bold tracking-widest text-sm" style={{ color: '#ffffff', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>
            {isEdit ? 'EDIT PRODUCT' : 'ADD PRODUCT'}
          </h2>
          <button onClick={onClose} style={{ color: '#3a4570' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* body */}
        <div className="px-6 py-5 flex flex-col gap-4 max-h-[68vh] overflow-y-auto">
          {error && <ErrorBox msg={error} />}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Name *</label>
            <input className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Product name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Category</label>
              {isNewCat ? (
                <div className="flex gap-1.5">
                  <input
                    className="a-input px-3 py-2.5 rounded-lg text-sm flex-1"
                    value={form.category}
                    onChange={e => set('category', e.target.value)}
                    placeholder="New category name"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setIsNewCat(false); set('category', ''); }}
                    title="Back to list"
                    className="px-2 rounded-lg text-xs"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#7b88c0' }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <select
                  className="a-input px-3 py-2.5 rounded-lg text-sm"
                  value={form.category}
                  onChange={e => {
                    if (e.target.value === '__new__') { setIsNewCat(true); set('category', ''); }
                    else set('category', e.target.value);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="" style={{ background: '#080d28' }}>— Select —</option>
                  {categories.map(c => (
                    <option key={c} value={c} style={{ background: '#080d28' }}>{c}</option>
                  ))}
                  <option value="__new__" style={{ background: '#080d28', color: '#00BFFF' }}>＋ Add new category</option>
                </select>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Price (₱)</label>
              <input type="number" min="0" step="0.01" className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Stock Quantity</label>
            <input type="number" min="0" className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Description</label>
            <textarea rows={2} className="a-input px-3 py-2.5 rounded-lg text-sm resize-none" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Image URL</label>
            <input className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Product Type</label>
            <select className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.product_type} onChange={e => set('product_type', e.target.value)} style={{ cursor: 'pointer' }}>
              <option value="physical"         style={{ background: '#080d28' }}>Physical Product</option>
              <option value="digital_download" style={{ background: '#080d28' }}>Digital Download</option>
              <option value="digital_code"     style={{ background: '#080d28' }}>Digital Code</option>
              <option value="account_product"  style={{ background: '#080d28' }}>Account Product</option>
            </select>
          </div>

          {form.product_type === 'digital_download' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Download URL</label>
              <input className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.download_url} onChange={e => set('download_url', e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
          )}

          {(form.product_type === 'digital_code' || form.product_type === 'account_product') && (
            <div className="px-3 py-2.5 rounded-lg text-xs" style={{ background: 'rgba(0,191,255,0.06)', border: '1px solid rgba(0,191,255,0.2)', color: '#7b88c0' }}>
              {form.product_type === 'digital_code'
                ? 'Codes are managed in the Code Inventory tab. Add codes there after saving this product.'
                : 'Accounts are managed in the Account Inventory tab. Add accounts there after saving this product.'}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#7b88c0', transition: 'all 0.2s' }}>
            Cancel
          </button>
          <button onClick={save} disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-bold tracking-wider"
            style={{
              background: loading ? 'rgba(0,191,255,0.05)' : 'linear-gradient(135deg, rgba(0,191,255,0.18) 0%, rgba(138,43,226,0.18) 100%)',
              border: '1px solid rgba(0,191,255,0.35)', color: loading ? '#3a4570' : '#ffffff',
              fontFamily: "'Rajdhani', 'Inter', sans-serif", transition: 'all 0.2s',
            }}>
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────── announcement modal */
const ANN_CATEGORIES = ['News', 'Update', 'Promotion', 'Maintenance', 'Event', 'Release', 'Important'];

interface AnnModalProps { announcement: Announcement | null; onClose: () => void; adminName: string; }

function AnnouncementModal({ announcement, onClose, adminName }: AnnModalProps) {
  const { upsertAnnouncement } = useStore();
  const isEdit = !!announcement;
  const [form, setForm] = useState({
    title:      announcement?.title      ?? '',
    content:    announcement?.content    ?? '',
    category:   announcement?.category   ?? 'News',
    image_url:  announcement?.image_url  ?? '',
    created_by: announcement?.created_by ?? adminName,
    pinned:     announcement?.pinned     ?? false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [preview, setPreview] = useState(false);

  function set<K extends keyof typeof form>(key: K, val: typeof form[K]) { setForm(f => ({ ...f, [key]: val })); }

  async function save() {
    if (!form.title.trim())   return setError('Title is required');
    if (!form.content.trim()) return setError('Content is required');
    setLoading(true); setError('');
    const payload = {
      title:      form.title.trim(),
      content:    form.content.trim(),
      category:   form.category,
      image_url:  form.image_url.trim() || null,
      created_by: form.created_by.trim() || null,
      pinned:     form.pinned,
      updated_at: new Date().toISOString(),
    };
    try {
      if (isEdit) {
        const { data, error } = await supabase.from('announcements').update(payload).eq('id', announcement.id).select().single();
        if (error) { setError(error.message || error.code || JSON.stringify(error)); setLoading(false); return; }
        if (data) upsertAnnouncement(data as Announcement);
      } else {
        const { data, error } = await supabase.from('announcements').insert(payload).select().single();
        if (error) { setError(error.message || error.code || JSON.stringify(error)); setLoading(false); return; }
        if (data) upsertAnnouncement(data as Announcement);
      }
      onClose();
    } catch (err: unknown) {
      const e = err as any;
      setError(e?.message || e?.error || e?.code || JSON.stringify(err) || 'Unknown error');
    } finally { setLoading(false); }
  }

  const cat = CATEGORY_STYLE[form.category] ?? CATEGORY_STYLE['News'];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
      <motion.div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#080d28', border: '1px solid rgba(0,191,255,0.2)', boxShadow: '0 0 48px rgba(0,191,255,0.08)', maxHeight: '92vh' }}
        initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2 }}>

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <h2 className="font-bold tracking-widest text-sm" style={{ color: '#ffffff', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>
              {isEdit ? 'EDIT ANNOUNCEMENT' : 'NEW ANNOUNCEMENT'}
            </h2>
            {form.pinned && <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(0,191,255,0.1)', color: '#00BFFF' }}>PINNED</span>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setPreview(p => !p)} className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: preview ? 'rgba(0,191,255,0.1)' : 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: preview ? '#00BFFF' : '#7b88c0' }}>
              {preview ? 'Edit' : 'Preview'}
            </button>
            <button onClick={onClose} style={{ color: '#3a4570' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto">
          {preview ? (
            /* Preview pane */
            <div className="px-6 py-5">
              <div className="flex flex-wrap gap-2 mb-3">
                {form.pinned && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase"
                  style={{ background: 'rgba(0,191,255,0.1)', color: '#00BFFF', border: '1px solid rgba(0,191,255,0.25)' }}>PINNED</span>}
                <span className="inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase"
                  style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}>{form.category}</span>
              </div>
              <h2 className="text-xl font-bold mb-3" style={{ color: '#e8eaf6', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>
                {form.title || <span style={{ color: '#2e3a5a' }}>Untitled</span>}
              </h2>
              <div className="text-sm leading-relaxed" style={{ color: '#7b88c0' }}
                dangerouslySetInnerHTML={{ __html: renderContent(form.content || '*No content yet*') }} />
              {form.created_by && (
                <div className="mt-4 pt-3 text-xs" style={{ color: '#2e3a5a', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  Posted by {form.created_by} · {format(new Date(), 'MMMM d, yyyy')}
                </div>
              )}
            </div>
          ) : (
            /* Edit form */
            <div className="px-6 py-5 flex flex-col gap-4">
              {error && <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,68,68,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.2)' }}>{error}</div>}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Title *</label>
                <input className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Announcement title..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Category</label>
                  <select className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.category} onChange={e => set('category', e.target.value)} style={{ cursor: 'pointer' }}>
                    {ANN_CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#080d28' }}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Posted By</label>
                  <input className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.created_by} onChange={e => set('created_by', e.target.value)} placeholder="Your name" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Content *</label>
                  <span className="text-[9px] uppercase tracking-widest" style={{ color: '#2e3a5a' }}>
                    Supports **bold**, *italic*, # Heading, - list, [link](url)
                  </span>
                </div>
                <textarea
                  rows={8}
                  className="a-input px-3 py-2.5 rounded-lg text-sm resize-y"
                  style={{ minHeight: '140px' }}
                  value={form.content}
                  onChange={e => set('content', e.target.value)}
                  placeholder="Write your announcement here...&#10;&#10;Use **bold**, *italic*, # Heading, - bullet points, [link text](https://...)"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Cover Image URL</label>
                <input className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
              </div>

              {/* Pinned toggle */}
              <button type="button" onClick={() => set('pinned', !form.pinned)}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-left"
                style={{ background: form.pinned ? 'rgba(0,191,255,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${form.pinned ? 'rgba(0,191,255,0.2)' : 'rgba(255,255,255,0.07)'}`, transition: 'all 0.2s' }}>
                <div className="w-9 h-5 rounded-full flex items-center transition-all" style={{ background: form.pinned ? '#00BFFF' : 'rgba(255,255,255,0.1)', padding: '2px' }}>
                  <div className="w-4 h-4 rounded-full transition-all" style={{ background: '#fff', transform: form.pinned ? 'translateX(16px)' : 'translateX(0)' }} />
                </div>
                <div>
                  <div className="text-xs font-semibold" style={{ color: form.pinned ? '#00BFFF' : '#7b88c0' }}>Pin this announcement</div>
                  <div className="text-[10px]" style={{ color: '#2e3a5a' }}>Pinned posts appear at the top of the feed</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#7b88c0' }}>Cancel</button>
          <button onClick={save} disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-bold tracking-wider"
            style={{
              background: loading ? 'rgba(0,191,255,0.05)' : 'linear-gradient(135deg, rgba(0,191,255,0.18) 0%, rgba(138,43,226,0.18) 100%)',
              border: '1px solid rgba(0,191,255,0.35)', color: loading ? '#3a4570' : '#ffffff',
              fontFamily: "'Rajdhani', 'Inter', sans-serif",
            }}>
            {loading ? 'Publishing...' : isEdit ? 'Save Changes' : 'Publish'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────── announcements panel */
function AnnouncementsPanel({ adminEmail }: { adminEmail: string }) {
  const { announcements, setAnnouncements, upsertAnnouncement, removeAnnouncement } = useStore();
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item: Announcement | null }>({ open: false, item: null });

  const adminName = adminEmail.split('@')[0];

  useEffect(() => {
    supabase.from('announcements').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setAnnouncements(data); setLoading(false); });

    const ch = supabase.channel('announcements-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, (payload) => {
        if (payload.eventType === 'DELETE') removeAnnouncement((payload.old as { id: string }).id);
        else upsertAnnouncement(payload.new as Announcement);
      }).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  async function togglePin(a: Announcement) {
    const newVal = !a.pinned;
    upsertAnnouncement({ ...a, pinned: newVal });
    await supabase.from('announcements').update({ pinned: newVal, updated_at: new Date().toISOString() }).eq('id', a.id);
  }

  async function deleteAnn(a: Announcement) {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    removeAnnouncement(a.id);
    await supabase.from('announcements').delete().eq('id', a.id);
  }

  const sorted = [...announcements].sort((x, y) => {
    if (x.pinned && !y.pinned) return -1;
    if (!x.pinned && y.pinned) return 1;
    return y.created_at.localeCompare(x.created_at);
  });

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)' }}>

      {/* header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <h2 className="font-bold tracking-widest text-sm" style={{ color: '#ffffff', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>ANNOUNCEMENTS</h2>
          <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: '#2e3a5a' }}>{announcements.length} posts • live</p>
        </div>
        <button onClick={() => setModal({ open: true, item: null })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase"
          style={{ background: 'linear-gradient(135deg, rgba(0,191,255,0.12) 0%, rgba(138,43,226,0.12) 100%)', border: '1px solid rgba(0,191,255,0.3)', color: '#00BFFF', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Announcement
        </button>
      </div>

      {/* col headers */}
      <div className="hidden sm:grid px-6 py-2.5 text-[10px] uppercase tracking-widest"
        style={{ gridTemplateColumns: '1fr 110px 90px 80px 130px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#2e3a5a' }}>
        <span>Title</span><span>Category</span><span>Posted</span><span>Pinned</span><span className="text-right">Actions</span>
      </div>

      {loading ? (
        <div className="px-6 py-10 text-center text-xs uppercase tracking-widest" style={{ color: '#2e3a5a' }}>Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="px-6 py-10 text-center text-xs" style={{ color: '#3a4570' }}>No announcements yet.</div>
      ) : (
        <div>
          {sorted.map(a => {
            const cat = CATEGORY_STYLE[a.category] ?? CATEGORY_STYLE['News'];
            return (
              <div key={a.id} className="a-row sm:grid px-6 py-4 items-center flex flex-wrap gap-3"
                style={{ gridTemplateColumns: '1fr 110px 90px 80px 130px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                {/* title */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {a.pinned && <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00BFFF' }} />}
                    <span className="text-sm font-semibold truncate" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>{a.title}</span>
                  </div>
                  {a.created_by && <span className="text-xs" style={{ color: '#2e3a5a' }}>by {a.created_by}</span>}
                </div>
                {/* category */}
                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase self-start"
                  style={{ background: cat.bg, color: cat.color }}>{a.category}</span>
                {/* date */}
                <span className="text-xs" style={{ color: '#3a4570' }}>{format(new Date(a.created_at), 'MMM d, yyyy')}</span>
                {/* pinned */}
                <button onClick={() => togglePin(a)} className="text-xs px-2 py-1 rounded-lg self-start"
                  style={{ background: a.pinned ? 'rgba(0,191,255,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${a.pinned ? 'rgba(0,191,255,0.2)' : 'rgba(255,255,255,0.07)'}`, color: a.pinned ? '#00BFFF' : '#3a4570', transition: 'all 0.2s' }}>
                  {a.pinned ? 'Unpin' : 'Pin'}
                </button>
                {/* actions */}
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setModal({ open: true, item: a })} className="a-btn-edit px-3 py-1.5 rounded-lg text-xs font-semibold">Edit</button>
                  <button onClick={() => deleteAnn(a)} className="a-btn-del px-3 py-1.5 rounded-lg text-xs font-semibold">Del</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal.open && (
        <AnnouncementModal
          announcement={modal.item}
          onClose={() => setModal({ open: false, item: null })}
          adminName={adminName}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────── dashboard */
function AdminDashboard({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
  const { products, setProducts, upsertProduct, removeProduct, orders, setOrders, upsertOrder, removeOrder } = useStore();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'products' | 'orders' | 'announcements' | 'codes' | 'accounts' | 'settings'>('products');
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [adminRole, setAdminRole] = useState('administrator');
  const [vaultOpen, setVaultOpen] = useState(isVaultUnlocked());
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const TAB_ACCESS: Record<string, Array<typeof tab>> = {
    owner:         ['products', 'orders', 'announcements', 'codes', 'accounts', 'settings'],
    administrator: ['products', 'orders', 'announcements', 'codes', 'accounts', 'settings'],
    moderator:     ['products', 'orders', 'announcements'],
  };
  const allowedTabs = TAB_ACCESS[adminRole] ?? TAB_ACCESS.administrator;

  const ROLE_COLOR: Record<string, string> = { owner: '#F7931A', administrator: '#00BFFF', moderator: '#7b88c0' };
  const [modal, setModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, import('@/lib/types').OrderItem[]>>({});
  const [checkingPayments, setCheckingPayments] = useState(false);

  useEffect(() => {
    // Read role + totp_enabled directly from Supabase — works in local dev and on Vercel
    supabase.from('admins').select('*').eq('id', user.id).single().then(({ data }) => {
      if (!data) return;
      const role = data.role ?? 'administrator';
      const totp = data.totp_enabled ?? false;
      setAdminRole(role);
      setTotpEnabled(totp);
      const allowed = TAB_ACCESS[role] ?? TAB_ACCESS.administrator;
      setTab(prev => allowed.includes(prev) ? prev : 'products');
    });

    const vaultPoll = setInterval(() => setVaultOpen(isVaultUnlocked()), 10_000);

    supabase.from('products').select('*').order('category').then(({ data }) => {
      if (data) setProducts(data);
      setLoading(false);
    });
    supabase.from('orders').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setOrders(data);
    });

    const ch = supabase
      .channel('products-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        if (payload.eventType === 'DELETE') removeProduct((payload.old as { id: string }).id);
        else upsertProduct(payload.new as Product);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'DELETE') removeOrder((payload.old as { id: string }).id);
        else upsertOrder(payload.new as import('@/lib/types').Order);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); clearInterval(vaultPoll); };
  }, []);

  // Refresh vault state when switching tabs (e.g. user unlocked vault in codes tab, now viewing orders)
  function switchTab(t: typeof tab) {
    setVaultOpen(isVaultUnlocked());
    setTab(t);
    if (t === 'settings') loadMaintenanceMode();
  }

  const totalStock      = products.reduce((s, p) => s + p.stock, 0);
  const lowStock        = products.filter(p => p.stock > 0 && p.stock < 10).length;
  const outOfStock      = products.filter(p => p.stock === 0).length;
  const waitingOrders   = orders.filter(o => o.status === 'waiting_for_inventory').length;

  const paidStatuses = ['paid', 'delivering', 'delivered'];
  const providerStats = (['paymongo', 'coinbase', 'coinsph'] as const).map(pm => {
    const pmOrders = orders.filter(o => o.payment_method === pm);
    const paidOrders = pmOrders.filter(o => paidStatuses.includes(o.status));
    const revenue = paidOrders.reduce((s, o) => s + Number(o.total), 0);
    const successRate = pmOrders.length > 0 ? Math.round((paidOrders.length / pmOrders.length) * 100) : 0;
    return { pm, count: pmOrders.length, revenue, successRate };
  });

  const PROVIDER_LABELS: Record<string, string> = { paymongo: 'PayMongo', coinbase: 'Coinbase', coinsph: 'Coins.ph' };
  const PROVIDER_COLORS: Record<string, string> = { paymongo: '#00BFFF', coinbase: '#F7931A', coinsph: '#00C896' };

  async function adjustStock(p: Product, delta: number) {
    const newStock = Math.max(0, p.stock + delta);
    if (newStock === p.stock) return;
    setBusy(b => ({ ...b, [p.id]: true }));
    upsertProduct({ ...p, stock: newStock });
    await supabase.from('products').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', p.id);
    setBusy(b => ({ ...b, [p.id]: false }));
  }

  async function deleteProduct(p: Product) {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    removeProduct(p.id);
    await supabase.from('products').delete().eq('id', p.id);
  }

  const stockColor = (stock: number) => stock === 0 ? '#FF4444' : stock < 10 ? '#FF8C00' : '#00E676';

  async function updateOrderStatus(orderId: string, status: import('@/lib/types').OrderStatus) {
    setBusy(b => ({ ...b, [orderId]: true }));
    const { data } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId).select().single();
    if (data) upsertOrder(data as import('@/lib/types').Order);
    setBusy(b => ({ ...b, [orderId]: false }));
  }

  async function cancelOrder(orderId: string) {
    if (!window.confirm('Cancel this order?')) return;
    await updateOrderStatus(orderId, 'cancelled');
  }

  async function loadMaintenanceMode() {
    const { data } = await supabase.from('site_config').select('value').eq('key', 'maintenance_mode').single();
    setMaintenanceMode(data?.value === 'true');
  }

  async function toggleMaintenanceMode() {
    setMaintenanceLoading(true);
    const next = !maintenanceMode;
    const { error } = await supabase.from('site_config').upsert(
      { key: 'maintenance_mode', value: String(next), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    if (!error) setMaintenanceMode(next);
    else alert('Failed to update maintenance mode. Make sure the site_config table exists.');
    setMaintenanceLoading(false);
  }

  async function fulfillCoinsphOrder(orderId: string) {
    if (!window.confirm('Mark as paid and trigger automatic fulfillment (assign codes/accounts + send email)?')) return;
    setBusy(b => ({ ...b, [orderId]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin-fulfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, token: session?.access_token }),
      });
      const data = await res.json();
      if (!res.ok) alert('Fulfillment failed: ' + (data.error ?? 'Unknown error'));
    } catch { alert('Request failed. Check your connection.'); }
    finally { setBusy(b => ({ ...b, [orderId]: false })); }
  }

  async function checkCoinsphPayments() {
    setCheckingPayments(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/cron-coinsph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session?.access_token }),
      });
      const text = await res.text();
      if (text.trimStart().startsWith('<')) {
        alert('API not reachable — ensure env vars are set in Vercel and redeploy.');
        return;
      }
      const data = JSON.parse(text);
      if (!res.ok) {
        alert('Check failed: ' + (data.error ?? 'Unknown error'));
      } else {
        alert(`Done. Checked ${data.checked ?? 0} deposit(s), fulfilled ${data.processed ?? 0} order(s).`);
      }
    } catch { alert('Request failed. Check your connection.'); }
    finally { setCheckingPayments(false); }
  }

  async function toggleOrderExpand(orderId: string) {
    if (expandedOrder === orderId) { setExpandedOrder(null); return; }
    setExpandedOrder(orderId);
    if (!orderItems[orderId]) {
      const { data } = await supabase.from('order_items').select('*').eq('order_id', orderId);
      setOrderItems(prev => ({ ...prev, [orderId]: (data ?? []) as import('@/lib/types').OrderItem[] }));
    }
  }

  async function sendDeliveryEmail(order: import('@/lib/types').Order) {
    if (!window.confirm('Assign codes/accounts from inventory, deduct stock, and send delivery email?')) return;
    setSendingEmail(order.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin-fulfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, token: session?.access_token }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert('Fulfillment failed: ' + (data.error || 'Unknown error'));
      } else {
        alert('Order fulfilled — codes assigned, stock updated, email sent!');
      }
    } catch { alert('Fulfillment request failed. Check API config.'); }
    finally { setSendingEmail(null); }
  }

  return (
    <div className="min-h-screen" style={{ background: '#050816', fontFamily: "'Inter', sans-serif" }}>
      <style>{ADMIN_CSS}</style>

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(0,191,255,0.08)', background: 'rgba(5,8,22,0.96)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(to bottom, #00BFFF, #8A2BE2)' }} />
          <span className="font-bold tracking-widest text-sm uppercase" style={{ color: '#fff', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>
            Sale Shop Admin
          </span>
          <span className="hidden sm:block text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(255,68,68,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.2)' }}>
            STAFF ONLY
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-xs" style={{ color: '#3a4570' }}>{user.email}</span>
          <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide"
            style={{ background: `${ROLE_COLOR[adminRole] ?? '#7b88c0'}14`, color: ROLE_COLOR[adminRole] ?? '#7b88c0', border: `1px solid ${ROLE_COLOR[adminRole] ?? '#7b88c0'}35` }}>
            {adminRole}
          </span>
          <button onClick={onLogout} className="text-xs px-3 py-1.5 rounded-lg uppercase tracking-wider font-semibold"
            style={{ border: '1px solid rgba(255,68,68,0.25)', color: '#FF6B6B', background: 'transparent', transition: 'all 0.2s' }}>
            Logout
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto">

        {/* ── Stats ── */}
        <motion.div className="flex flex-wrap gap-3 mb-8"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <StatCard label="Total Products"       value={products.length}  color="#00BFFF" />
          <StatCard label="Total Stock"          value={totalStock}       color="#00E676" />
          <StatCard label="Low Stock"            value={lowStock}         color="#FF8C00" />
          <StatCard label="Out of Stock"         value={outOfStock}       color="#FF4444" />
          {waitingOrders > 0 && (
            <StatCard label="Awaiting Inventory" value={waitingOrders}    color="#FF8C00" />
          )}
        </motion.div>

        {/* ── Payment provider analytics ── */}
        {providerStats.some(p => p.count > 0) && (
          <motion.div className="flex flex-wrap gap-3 mb-8"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
            {providerStats.filter(p => p.count > 0).map(({ pm, count, revenue, successRate }) => {
              const color = PROVIDER_COLORS[pm];
              return (
                <div key={pm} className="flex-1 min-w-[150px] p-4 rounded-xl"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: `1px solid ${color}22` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color, fontFamily: "'Rajdhani','Inter',sans-serif" }}>
                      {PROVIDER_LABELS[pm]}
                    </span>
                  </div>
                  <p className="text-xl font-bold mb-0.5" style={{ color: '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>
                    ₱{revenue.toLocaleString()}
                  </p>
                  <p className="text-[10px]" style={{ color: '#3a4570' }}>
                    {count} orders · {successRate}% success
                  </p>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* ── Tab switcher ── */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {allowedTabs.map(t => {
            const pendingCount = t === 'orders' ? orders.filter(o => o.status === 'pending').length : 0;
            const label = t === 'codes' ? 'Code Inv.' : t === 'accounts' ? 'Acct Inv.' : t.charAt(0).toUpperCase() + t.slice(1);
            return (
              <button key={t} onClick={() => switchTab(t)}
                className="relative px-5 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all"
                style={{
                  fontFamily: "'Rajdhani', 'Inter', sans-serif",
                  background: tab === t ? 'linear-gradient(135deg, rgba(0,191,255,0.14) 0%, rgba(138,43,226,0.12) 100%)' : 'transparent',
                  border: `1px solid ${tab === t ? 'rgba(0,191,255,0.28)' : 'transparent'}`,
                  color: tab === t ? '#00BFFF' : '#3a4570',
                }}>
                {label}
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: '#FF8C00', color: '#fff' }}>{pendingCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Products panel ── */}
        {tab === 'products' && (
          <motion.div className="rounded-2xl overflow-hidden"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)' }}>

            {/* table header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h2 className="font-bold tracking-widest text-sm" style={{ color: '#ffffff', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>PRODUCTS</h2>
                <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: '#2e3a5a' }}>{products.length} items • live</p>
              </div>
              <button
                onClick={() => setModal({ open: true, product: null })}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase"
                style={{ background: 'linear-gradient(135deg, rgba(0,191,255,0.12) 0%, rgba(138,43,226,0.12) 100%)', border: '1px solid rgba(0,191,255,0.3)', color: '#00BFFF', fontFamily: "'Rajdhani', 'Inter', sans-serif", transition: 'all 0.2s' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Product
              </button>
            </div>

            {/* col headers */}
            <div className="hidden sm:grid px-6 py-2.5 text-[10px] uppercase tracking-widest"
              style={{ gridTemplateColumns: '1fr 130px 90px 160px 110px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#2e3a5a' }}>
              <span>Name</span><span>Category</span><span>Price</span><span>Stock</span><span className="text-right">Actions</span>
            </div>

            {/* rows */}
            {loading ? (
              <div className="px-6 py-10 text-center text-xs uppercase tracking-widest" style={{ color: '#2e3a5a' }}>Loading products...</div>
            ) : products.length === 0 ? (
              <div className="px-6 py-10 text-center text-xs" style={{ color: '#3a4570' }}>No products. Add one to get started.</div>
            ) : (
              <div className="overflow-x-auto">
                {products.map(p => (
                  <div key={p.id} className="a-row sm:grid px-6 py-4 items-center flex flex-wrap gap-3"
                    style={{ gridTemplateColumns: '1fr 130px 90px 160px 110px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>

                    {/* name */}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>{p.name}</div>
                      {p.description && <div className="text-xs mt-0.5 truncate max-w-xs" style={{ color: '#2e3a5a' }}>{p.description}</div>}
                    </div>

                    {/* category */}
                    <div className="text-xs" style={{ color: '#7b88c0' }}>{p.category ?? '—'}</div>

                    {/* price */}
                    <div className="text-sm font-bold" style={{ color: '#ffffff', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>₱{p.price}</div>

                    {/* stock controls */}
                    <div className="flex items-center gap-2">
                      <button onClick={() => adjustStock(p, -1)} disabled={p.stock === 0 || busy[p.id]}
                        className="a-stock-minus w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center"
                        style={{ color: p.stock === 0 ? '#2e3a5a' : '#7b88c0', cursor: p.stock === 0 ? 'not-allowed' : 'pointer' }}>
                        −
                      </button>
                      <span className="w-10 text-center text-sm font-bold tabular-nums"
                        style={{ color: stockColor(p.stock), fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>
                        {p.stock}
                      </span>
                      <button onClick={() => adjustStock(p, 1)} disabled={busy[p.id]}
                        className="a-stock-plus w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center">
                        +
                      </button>
                    </div>

                    {/* actions */}
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setModal({ open: true, product: p })}
                        className="a-btn-edit px-3 py-1.5 rounded-lg text-xs font-semibold">Edit</button>
                      <button onClick={() => deleteProduct(p)}
                        className="a-btn-del px-3 py-1.5 rounded-lg text-xs font-semibold">Del</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Announcements panel ── */}
        {/* ── Orders panel ── */}
        {tab === 'orders' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)' }}>

            {/* header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h2 className="font-bold tracking-widest text-sm" style={{ color: '#ffffff', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>ORDERS</h2>
                <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: '#2e3a5a' }}>{orders.length} total · live</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {orders.some(o => o.status === 'pending' && o.payment_method === 'coinsph') && (
                  <button
                    disabled={checkingPayments}
                    onClick={checkCoinsphPayments}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      background: checkingPayments ? 'rgba(0,200,150,0.05)' : 'rgba(0,200,150,0.1)',
                      border: '1px solid rgba(0,200,150,0.3)',
                      color: checkingPayments ? '#3a4570' : '#00C896',
                      cursor: checkingPayments ? 'not-allowed' : 'pointer',
                      fontFamily: "'Rajdhani','Inter',sans-serif",
                      transition: 'all 0.2s',
                    }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ animation: checkingPayments ? 'spin 1s linear infinite' : 'none' }}>
                      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    {checkingPayments ? 'Checking...' : 'Check Coins.ph'}
                  </button>
                )}
                {(['pending','processing','paid','delivering','delivered','failed','cancelled'] as const).map(s => {
                  const count = orders.filter(o => o.status === s).length;
                  if (!count) return null;
                  const colors: Record<string, string> = { pending:'#FF8C00', processing:'#00BFFF', paid:'#8A2BE2', delivering:'#00BFFF', delivered:'#00E676', waiting_for_inventory:'#FF8C00', failed:'#FF4444', cancelled:'#FF4444' };
                  return (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded font-bold uppercase"
                      style={{ background: `${colors[s]}18`, color: colors[s], border: `1px solid ${colors[s]}40` }}>
                      {s} {count}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* col headers */}
            <div className="hidden sm:grid px-6 py-2.5 text-[10px] uppercase tracking-widest"
              style={{ gridTemplateColumns: '1fr 160px 90px 110px 200px 32px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#2e3a5a' }}>
              <span>Customer</span><span>Email</span><span>Total</span><span>Status</span><span className="text-right">Actions</span><span></span>
            </div>

            {orders.length === 0 ? (
              <div className="px-6 py-10 text-center text-xs" style={{ color: '#3a4570' }}>No orders yet.</div>
            ) : (
              <div>
                {orders.map(o => {
                  const colors: Record<string, string> = { pending:'#FF8C00', processing:'#00BFFF', paid:'#8A2BE2', delivering:'#00BFFF', delivered:'#00E676', waiting_for_inventory:'#FF8C00', failed:'#FF4444', cancelled:'#FF4444' };
                  const sc = colors[o.status] ?? '#7b88c0';
                  const isBusy = busy[o.id] || sendingEmail === o.id;
                  return (
                    <div key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div className="a-row sm:grid px-6 py-4 items-center flex flex-wrap gap-3"
                      style={{ gridTemplateColumns: '1fr 160px 90px 110px 200px 32px' }}>

                      {/* customer */}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>{o.customer_name}</p>
                        <p className="text-[10px]" style={{ color: '#2e3a5a' }}>{o.id.slice(0,8).toUpperCase()} · {format(new Date(o.created_at), 'MMM d')}</p>
                      </div>

                      {/* email */}
                      <p className="text-xs truncate" style={{ color: '#3a4570' }}>{o.customer_email}</p>

                      {/* total */}
                      <p className="text-sm font-bold" style={{ color: '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>₱{Number(o.total).toLocaleString()}</p>

                      {/* status */}
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase"
                        style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}40` }}>{o.status}</span>

                      {/* actions */}
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {o.status === 'pending' && (
                          <button disabled={isBusy} onClick={() => updateOrderStatus(o.id, 'processing')}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide"
                            style={{ background: 'rgba(0,191,255,0.1)', border: '1px solid rgba(0,191,255,0.25)', color: '#00BFFF', cursor: 'pointer', opacity: isBusy ? 0.5 : 1 }}>
                            Processing
                          </button>
                        )}
                        {(o.status === 'processing' || o.status === 'pending') && (
                          <button disabled={isBusy} onClick={() => updateOrderStatus(o.id, 'paid')}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide"
                            style={{ background: 'rgba(138,43,226,0.12)', border: '1px solid rgba(138,43,226,0.3)', color: '#8A2BE2', cursor: 'pointer', opacity: isBusy ? 0.5 : 1 }}>
                            Mark Paid
                          </button>
                        )}
                        {(o.status === 'paid' || o.status === 'delivering' || o.status === 'delivered') && (
                          <button disabled={sendingEmail === o.id} onClick={() => sendDeliveryEmail(o)}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide"
                            style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.25)', color: '#00E676', cursor: 'pointer', opacity: sendingEmail === o.id ? 0.5 : 1 }}>
                            {sendingEmail === o.id ? 'Fulfilling...' : 'Fulfill & Email'}
                          </button>
                        )}
                        {o.payment_method === 'coinsph' && o.status === 'pending' && (
                          <button disabled={isBusy} onClick={() => fulfillCoinsphOrder(o.id)}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide"
                            style={{ background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.3)', color: '#00C896', cursor: 'pointer', opacity: isBusy ? 0.5 : 1 }}>
                            {isBusy ? 'Fulfilling...' : 'Fulfill Order'}
                          </button>
                        )}
                        {o.status === 'waiting_for_inventory' && (
                          <span className="text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(255,140,0,0.1)', color: '#FF8C00', border: '1px solid rgba(255,140,0,0.25)' }}>
                            Restock needed
                          </span>
                        )}
                        {!['delivered','failed','cancelled','waiting_for_inventory'].includes(o.status) && (
                          <button disabled={isBusy} onClick={() => cancelOrder(o.id)}
                            className="a-btn-del px-2.5 py-1.5 rounded-lg text-[10px] font-semibold">
                            Cancel
                          </button>
                        )}
                      </div>

                      {/* Expand toggle */}
                      <button onClick={() => toggleOrderExpand(o.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a4570', padding: '4px', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#00BFFF')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#3a4570')}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: expandedOrder === o.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>

                    {/* Expanded: order items + assigned credentials */}
                    {expandedOrder === o.id && (
                      <div className="px-6 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        {!orderItems[o.id] ? (
                          <p className="text-[10px] pt-3" style={{ color: '#2e3a5a' }}>Loading...</p>
                        ) : (
                          <div className="flex flex-col gap-2 pt-3">
                            {/* Vault hint when credentials exist but vault is locked */}
                            {!vaultOpen && (orderItems[o.id] ?? []).some(i => i.assigned_code || i.assigned_username) && (
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1"
                                style={{ background: 'rgba(0,191,255,0.05)', border: '1px solid rgba(0,191,255,0.15)' }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00BFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                                <span className="text-[10px]" style={{ color: '#3a4570' }}>Credentials hidden — unlock the vault in Code Inv. or Acct Inv. to reveal</span>
                              </div>
                            )}
                            {(orderItems[o.id] ?? []).map(item => (
                              <div key={item.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>{item.product_name} ×{item.quantity}</span>
                                  <span className="text-xs font-bold" style={{ color: '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>₱{(item.price * item.quantity).toLocaleString()}</span>
                                </div>
                                {item.assigned_code && (
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-[9px] uppercase tracking-widest" style={{ color: '#2e3a5a' }}>Code</span>
                                    {vaultOpen
                                      ? <span className="text-xs font-mono font-bold" style={{ color: '#00BFFF' }}>{item.assigned_code}</span>
                                      : <span className="text-xs font-mono" style={{ color: '#2e3a5a' }}>{'•'.repeat(Math.min(item.assigned_code.length, 14))}</span>
                                    }
                                  </div>
                                )}
                                {item.assigned_username && (
                                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                                    <div>
                                      <span className="text-[9px] uppercase tracking-widest block mb-0.5" style={{ color: '#2e3a5a' }}>Username</span>
                                      {vaultOpen
                                        ? <span className="text-xs font-mono" style={{ color: '#c8d0f0' }}>{item.assigned_username}</span>
                                        : <span className="text-xs font-mono" style={{ color: '#2e3a5a' }}>••••••••</span>
                                      }
                                    </div>
                                    <div>
                                      <span className="text-[9px] uppercase tracking-widest block mb-0.5" style={{ color: '#2e3a5a' }}>Password</span>
                                      {vaultOpen
                                        ? <span className="text-xs font-mono" style={{ color: '#c8d0f0' }}>{item.assigned_password}</span>
                                        : <span className="text-xs font-mono" style={{ color: '#2e3a5a' }}>••••••••</span>
                                      }
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {tab === 'codes' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
            <VaultGuard totpEnabled={totpEnabled}>
              <CodeInventoryPanel products={products} />
            </VaultGuard>
          </motion.div>
        )}

        {tab === 'accounts' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
            <VaultGuard totpEnabled={totpEnabled}>
              <AccountInventoryPanel products={products} />
            </VaultGuard>
          </motion.div>
        )}

        {tab === 'announcements' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
            <AnnouncementsPanel adminEmail={user.email} />
          </motion.div>
        )}

        {tab === 'settings' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-col gap-6">

            {/* ── Maintenance mode card ── */}
            <div className="rounded-2xl p-6" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] uppercase tracking-widest font-bold mb-4" style={{ color: '#00BFFF' }}>Site Settings</p>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold mb-1" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>
                    Maintenance Mode
                  </p>
                  <p className="text-xs" style={{ color: '#3a4570' }}>
                    {maintenanceMode
                      ? 'Site is hidden from visitors. Admins can still access everything.'
                      : 'Site is live and visible to all visitors.'}
                  </p>
                </div>
                <button
                  onClick={toggleMaintenanceMode}
                  disabled={maintenanceLoading}
                  style={{
                    flexShrink: 0,
                    padding: '8px 20px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "'Rajdhani','Inter',sans-serif",
                    letterSpacing: '0.06em',
                    cursor: maintenanceLoading ? 'not-allowed' : 'pointer',
                    opacity: maintenanceLoading ? 0.6 : 1,
                    transition: 'all 0.2s',
                    background: maintenanceMode
                      ? 'rgba(0,230,118,0.12)'
                      : 'rgba(255,140,0,0.12)',
                    border: maintenanceMode
                      ? '1px solid rgba(0,230,118,0.3)'
                      : '1px solid rgba(255,140,0,0.3)',
                    color: maintenanceMode ? '#00E676' : '#FF8C00',
                  }}>
                  {maintenanceLoading ? '...' : maintenanceMode ? '▲ Go Live' : '⏸ Maintenance'}
                </button>
              </div>

              {maintenanceMode && (
                <div className="mt-4 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,140,0,0.06)', border: '1px solid rgba(255,140,0,0.2)', color: '#FF8C00' }}>
                  ⚠ Maintenance is ON — visitors see the maintenance page. You can still browse the shop normally as an admin.
                </div>
              )}
            </div>

            <AdminSettingsPanel
              adminId={user.id}
              adminEmail={user.email}
              totpEnabled={totpEnabled}
              role={adminRole}
              onTotpChange={setTotpEnabled}
            />
          </motion.div>
        )}

      </div>

      {modal.open && (
        <ProductModal
          product={modal.product}
          onClose={() => setModal({ open: false, product: null })}
          categories={[...new Set(products.map(p => p.category).filter(Boolean) as string[])]}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────── main */
export default function AdminPage() {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [user, setUser]           = useState<AdminUser | null>(null);

  useEffect(() => {
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setAuthState('login'); setUser(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setAuthState('login'); return; }
    verifyAdmin({ id: session.user.id, email: session.user.email! });
  }

  async function verifyAdmin(u: AdminUser) {
    const { data } = await supabase.from('admins').select('id').eq('id', u.id).maybeSingle();
    if (data) { setUser(u); setAuthState('dashboard'); }
    else setAuthState('denied');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null); setAuthState('login');
  }

  if (authState === 'checking') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#050816' }}>
      <span className="text-[10px] uppercase tracking-widest" style={{ color: '#2e3a5a' }}>Verifying access...</span>
    </div>
  );

  if (authState === 'login') return <AdminLogin onSuccess={verifyAdmin} />;

  if (authState === 'denied') return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#050816' }}>
      <style>{ADMIN_CSS}</style>
      <div className="text-xl font-bold tracking-widest" style={{ color: '#FF6B6B', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>ACCESS DENIED</div>
      <div className="text-xs" style={{ color: '#3a4570' }}>Your account is not in the admins list.</div>
      <button onClick={handleLogout} className="mt-2 text-xs px-4 py-2 rounded-lg"
        style={{ border: '1px solid rgba(255,68,68,0.25)', color: '#FF6B6B', background: 'transparent' }}>
        Sign Out
      </button>
    </div>
  );

  return <AdminDashboard user={user!} onLogout={handleLogout} />;
}
