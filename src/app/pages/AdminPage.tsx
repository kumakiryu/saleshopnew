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
import MembersPanel from './admin/MembersPanel';
import EmailCenterPanel from './admin/EmailCenterPanel';
import TokenEconomyPanel from './admin/TokenEconomyPanel';
import AnalyticsPanel from './admin/AnalyticsPanel';
import WebhooksPanel from './admin/WebhooksPanel';
import { isVaultUnlocked } from '@/lib/vault';

/* ─────────────────────────────────────────────────────── types */
type AuthState = 'checking' | 'login' | 'denied' | 'dashboard';
interface AdminUser { id: string; email: string; }

/* ─────────────────────────────────────────────────────── css */
const ADMIN_CSS = `
  .a-input {
    background: var(--as3);
    border: 1px solid var(--ab2);
    color: var(--at);
    outline: none;
    transition: border-color 0.2s;
    width: 100%;
    color-scheme: dark;
  }
  .a-input:focus { border-color: rgba(0,191,255,0.5); }
  .a-input::placeholder { color: var(--atg); }
  .a-input option, .a-input optgroup { background: #080d28 !important; color: #e8eaf6 !important; }
  select.a-input { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234a5580' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px; }
  .a-row { transition: background 0.15s; }
  .a-row:hover { background: var(--as1); }
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
    background: var(--as4);
    border: 1px solid var(--ab);
    transition: all 0.15s;
  }
  .a-stock-minus:hover:not(:disabled) { background: var(--ab2); }
  .a-stock-plus {
    background: rgba(0,191,255,0.08);
    border: 1px solid rgba(0,191,255,0.2);
    color: #00BFFF;
    transition: all 0.15s;
  }
  .a-stock-plus:hover:not(:disabled) { background: rgba(0,191,255,0.16); }
  .nav-item { display:flex; align-items:center; gap:9px; padding:8px 12px 8px 10px; border-radius:9px; margin:1px 8px; font-size:12px; font-weight:500; color:var(--nav-text); cursor:pointer; transition:all 0.18s; background:transparent; border:1px solid transparent; text-align:left; width:calc(100% - 16px); position:relative; }
  .nav-item:hover { background:var(--nav-hover); color:var(--nav-text-hover); }
  .nav-item.active { background:linear-gradient(135deg,rgba(0,191,255,0.12) 0%,rgba(0,191,255,0.05) 100%); color:var(--nav-active-text); border-color:rgba(0,191,255,0.18); box-shadow:inset 3px 0 0 #00BFFF, 0 0 16px rgba(0,191,255,0.06); }
  .nav-section-label { font-size:9px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; color:var(--nav-section-label); padding:14px 22px 5px; font-family:'Exo 2','Inter',sans-serif; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

/* ─────────────────────────────────────────────────────── icons */
const SvgIc = ({ children, size = 14 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{children}</svg>
);
const IcGrid   = () => <SvgIc><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></SvgIc>;
const IcOrders = () => <SvgIc><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></SvgIc>;
const IcBox    = () => <SvgIc><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></SvgIc>;
const IcBell   = () => <SvgIc><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></SvgIc>;
const IcUsers  = () => <SvgIc><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></SvgIc>;
const IcMail   = () => <SvgIc><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></SvgIc>;
const IcCode   = () => <SvgIc><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></SvgIc>;
const IcDb     = () => <SvgIc><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></SvgIc>;
const IcGear   = () => <SvgIc><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></SvgIc>;
const IcCoin   = () => <SvgIc><circle cx="12" cy="12" r="9"/><path d="M12 6v2m0 8v2M8.5 9.5C8.5 8.12 10.07 7 12 7s3.5 1.12 3.5 2.5c0 1.5-1.57 2.5-3.5 2.5s-3.5 1-3.5 2.5C8.5 15.88 10.07 17 12 17s3.5-1.12 3.5-2.5"/></SvgIc>;

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="nav-section-label">{label}</div>{children}</div>;
}
function NavItem({ icon, label, active, onClick, badge }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button className={`nav-item${active ? ' active' : ''}`} onClick={onClick}>
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{ background: '#FF8C00', color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '1px 5px' }}>{badge}</span>
      )}
    </button>
  );
}

type Tab = 'dashboard' | 'analytics' | 'products' | 'orders' | 'announcements' | 'codes' | 'accounts' | 'settings' | 'members' | 'emails' | 'tokens' | 'webhooks';
const TAB_TITLES: Record<Tab, string> = { dashboard: 'Dashboard', analytics: 'Analytics', orders: 'Orders', products: 'All Products', announcements: 'Announcements', codes: 'Code Inventory', accounts: 'Account Inventory', members: 'Members', emails: 'Email Center', settings: 'Settings', tokens: 'Token Economy', webhooks: 'Webhooks' };
const TAB_SUBTITLES: Record<Tab, string> = { dashboard: 'Overview of your store performance.', analytics: 'Revenue, orders, and membership trends.', orders: 'Track and manage customer orders.', products: 'Manage your product catalog and stock.', announcements: 'Post and manage store announcements.', codes: 'Manage digital code inventory (vault-protected).', accounts: 'Manage account credentials inventory (vault-protected).', members: 'Manage VIP and Reseller memberships.', emails: 'Monitor email delivery logs.', settings: 'Configure store and admin settings.', tokens: 'Manage VIP & Reseller tokens, rewards, and leaderboards.', webhooks: 'Discord webhook notifications and event config.' };

/* ─────────────────────────────────────────────────────── helpers */
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 min-w-[120px] p-4 rounded-xl" style={{
      background: `linear-gradient(135deg, ${color}08 0%, transparent 100%)`,
      border: `1px solid ${color}20`,
      backdropFilter: 'blur(8px)',
    }}>
      <div className="text-[28px] font-bold mb-0.5 leading-none" style={{ color, fontFamily: "'JetBrains Mono', 'Inter', monospace" }}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: 'var(--atg)', fontFamily: "'Exo 2','Inter',sans-serif" }}>{label}</div>
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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#050816', position: 'relative', overflow: 'hidden' }}>
      <style>{ADMIN_CSS}</style>
      <style>{`
        :root {
          --at: #e8eaf6; --at2: #c8d0f0; --atm: #7b88c0; --atf: #4a5580; --atg: #3a4570;
          --as1: rgba(255,255,255,0.02); --as2: rgba(255,255,255,0.03);
          --as3: rgba(255,255,255,0.04); --as4: rgba(255,255,255,0.05);
          --ab: rgba(255,255,255,0.07); --ab2: rgba(255,255,255,0.10);
          --a-modal-bg: #080d28; --a-page-bg: #050816;
        }
      `}</style>
      {/* Subtle background orbs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: '60vw', height: '60vw', top: '-20vw', right: '-10vw', background: 'radial-gradient(ellipse, rgba(0,191,255,0.04) 0%, transparent 65%)', filter: 'blur(50px)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', width: '50vw', height: '50vw', bottom: '-15vw', left: '-5vw', background: 'radial-gradient(ellipse, rgba(138,43,226,0.05) 0%, transparent 65%)', filter: 'blur(40px)', borderRadius: '50%' }} />
      </div>
      <motion.div className="w-full max-w-sm relative z-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-5" style={{ background: 'linear-gradient(135deg, rgba(0,191,255,0.15) 0%, rgba(138,43,226,0.15) 100%)', border: '1px solid rgba(0,191,255,0.25)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00BFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(to bottom, #00BFFF, #8A2BE2)' }} />
            <span className="text-xl font-bold tracking-[0.15em]" style={{ color: 'var(--at)', fontFamily: "'Exo 2', 'Inter', sans-serif" }}>ADMIN</span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: 'var(--atg)', fontFamily: "'Exo 2','Inter',sans-serif" }}>Sale Shop Control Panel</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6 rounded-2xl" style={{
          background: 'linear-gradient(135deg, var(--as4) 0%, var(--as2) 100%)',
          border: '1px solid var(--ab)', backdropFilter: 'blur(16px)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        }}>
          {error && <ErrorBox msg={error} />}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="a-input px-3 py-2.5 rounded-lg text-sm" placeholder="admin@example.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="a-input px-3 py-2.5 rounded-lg text-sm" placeholder="••••••••" />
          </div>

          <button type="submit" disabled={loading} className="mt-1 py-3 rounded-lg text-sm font-bold tracking-widest uppercase"
            style={{
              background: loading ? 'rgba(0,191,255,0.05)' : 'linear-gradient(135deg, rgba(0,191,255,0.18) 0%, rgba(138,43,226,0.18) 100%)',
              border: '1px solid rgba(0,191,255,0.35)', color: loading ? 'var(--atg)' : 'var(--at)',
              fontFamily: "'Exo 2', 'Inter', sans-serif", transition: 'all 0.2s',
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
    name:           product?.name           ?? '',
    description:    product?.description    ?? '',
    image_url:      product?.image_url      ?? '',
    download_url:   product?.download_url   ?? '',
    price:          product?.price?.toString()          ?? '',
    vip_price:      product?.vip_price?.toString()      ?? '',
    reseller_price: product?.reseller_price?.toString() ?? '',
    category:       product?.category       ?? '',
    stock:          product?.stock?.toString()          ?? '0',
    product_type:   product?.product_type   ?? 'physical',
  });
  const [isNewCat, setIsNewCat] = useState(
    !!product?.category && !categories.includes(product.category)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  function set(key: keyof typeof form, val: string) { setForm(f => ({ ...f, [key]: val })); }

  async function uploadImage(file: File) {
    setUploading(true); setUploadErr('');
    try {
      const SB_URL = 'https://hxfccpadsbunynignbwn.supabase.co';
      const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE';
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const r = await fetch(`${SB_URL}/storage/v1/object/product-images/${path}`, {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': file.type, 'x-upsert': 'true' },
        body: file,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as any;
        throw new Error(err?.error ?? err?.message ?? 'Upload failed');
      }
      const publicUrl = `${SB_URL}/storage/v1/object/public/product-images/${path}`;
      set('image_url', publicUrl);
    } catch (e: any) {
      setUploadErr(e?.message ?? 'Upload failed. Make sure the "product-images" bucket exists and is public in Supabase Storage.');
    } finally { setUploading(false); }
  }

  async function save() {
    if (!form.name.trim()) return setError('Name is required');
    setLoading(true); setError('');
    const payload = {
      name:           form.name.trim(),
      description:    form.description.trim()    || null,
      image_url:      form.image_url.trim()      || null,
      download_url:   form.product_type === 'digital_download' ? (form.download_url.trim() || null) : null,
      price:          parseFloat(form.price)     || 0,
      vip_price:      form.vip_price      ? (parseFloat(form.vip_price)      || null) : null,
      reseller_price: form.reseller_price ? (parseFloat(form.reseller_price) || null) : null,
      category:       form.category.trim()       || null,
      stock:          parseInt(form.stock)       || 0,
      product_type:   form.product_type,
      updated_at:     new Date().toISOString(),
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
        style={{ background: 'var(--a-modal-bg)', border: '1px solid rgba(0,191,255,0.2)', boxShadow: '0 0 48px rgba(0,191,255,0.08)' }}
        initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2 }}
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ab)' }}>
          <h2 className="font-bold tracking-widest text-sm" style={{ color: 'var(--at)', fontFamily: "'Exo 2', 'Inter', sans-serif" }}>
            {isEdit ? 'EDIT PRODUCT' : 'ADD PRODUCT'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--atg)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* body */}
        <div className="px-6 py-5 flex flex-col gap-4 max-h-[68vh] overflow-y-auto">
          {error && <ErrorBox msg={error} />}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Name *</label>
            <input className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Product name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Category</label>
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
                    style={{ background: 'var(--as4)', border: '1px solid var(--ab2)', color: 'var(--atm)' }}
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
              <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Regular Price (₱)</label>
              <input type="number" min="0" step="0.01" className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: '#FFB400' }}>VIP Price (₱) <span style={{ color: 'var(--atg)' }}>optional</span></label>
              <input type="number" min="0" step="0.01" className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.vip_price} onChange={e => set('vip_price', e.target.value)} placeholder="Leave blank = no VIP price" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: '#00E676' }}>Reseller Price (₱) <span style={{ color: 'var(--atg)' }}>optional</span></label>
              <input type="number" min="0" step="0.01" className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.reseller_price} onChange={e => set('reseller_price', e.target.value)} placeholder="Leave blank = no reseller price" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Stock Quantity</label>
            <input type="number" min="0" className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Description</label>
            <textarea rows={2} className="a-input px-3 py-2.5 rounded-lg text-sm resize-none" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Product Image</label>
            {/* File upload */}
            <label className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm cursor-pointer" style={{ background: 'rgba(0,191,255,0.05)', border: '1px dashed rgba(0,191,255,0.25)', color: uploading ? '#3a4570' : '#00BFFF' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {uploading ? 'Uploading...' : 'Upload Image'}
              <input type="file" accept="image/*" className="hidden" disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />
            </label>
            {uploadErr && <p className="text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(255,68,68,0.08)', color: '#FF6B6B' }}>{uploadErr}</p>}
            {/* Image preview */}
            {form.image_url && (
              <div className="flex items-center gap-2">
                <img src={form.image_url} alt="preview" className="rounded-md object-cover flex-shrink-0" style={{ width: 48, height: 48, border: '1px solid var(--ab2)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <input className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
              </div>
            )}
            {!form.image_url && (
              <input className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="Or paste an image URL..." />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Product Type</label>
            <select className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.product_type} onChange={e => set('product_type', e.target.value)} style={{ cursor: 'pointer' }}>
              <option value="physical"         style={{ background: '#080d28' }}>Physical Product</option>
              <option value="digital_download" style={{ background: '#080d28' }}>Digital Download</option>
              <option value="digital_code"     style={{ background: '#080d28' }}>Digital Code</option>
              <option value="account_product"  style={{ background: '#080d28' }}>Account Product</option>
            </select>
          </div>

          {form.product_type === 'digital_download' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Download URL</label>
              <input className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.download_url} onChange={e => set('download_url', e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
          )}

          {(form.product_type === 'digital_code' || form.product_type === 'account_product') && (
            <div className="px-3 py-2.5 rounded-lg text-xs" style={{ background: 'rgba(0,191,255,0.06)', border: '1px solid rgba(0,191,255,0.2)', color: 'var(--atm)' }}>
              {form.product_type === 'digital_code'
                ? 'Codes are managed in the Code Inventory tab. Add codes there after saving this product.'
                : 'Accounts are managed in the Account Inventory tab. Add accounts there after saving this product.'}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--ab)' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: 'transparent', border: '1px solid var(--ab2)', color: 'var(--atm)', transition: 'all 0.2s' }}>
            Cancel
          </button>
          <button onClick={save} disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-bold tracking-wider"
            style={{
              background: loading ? 'rgba(0,191,255,0.05)' : 'linear-gradient(135deg, rgba(0,191,255,0.18) 0%, rgba(138,43,226,0.18) 100%)',
              border: '1px solid rgba(0,191,255,0.35)', color: loading ? 'var(--atg)' : 'var(--at)',
              fontFamily: "'Exo 2', 'Inter', sans-serif", transition: 'all 0.2s',
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
        style={{ background: 'var(--a-modal-bg)', border: '1px solid rgba(0,191,255,0.2)', boxShadow: '0 0 48px rgba(0,191,255,0.08)', maxHeight: '92vh' }}
        initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2 }}>

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--ab)' }}>
          <div className="flex items-center gap-3">
            <h2 className="font-bold tracking-widest text-sm" style={{ color: 'var(--at)', fontFamily: "'Exo 2', 'Inter', sans-serif" }}>
              {isEdit ? 'EDIT ANNOUNCEMENT' : 'NEW ANNOUNCEMENT'}
            </h2>
            {form.pinned && <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(0,191,255,0.1)', color: '#00BFFF' }}>PINNED</span>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setPreview(p => !p)} className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: preview ? 'rgba(0,191,255,0.1)' : 'transparent', border: '1px solid var(--ab2)', color: preview ? '#00BFFF' : '#7b88c0' }}>
              {preview ? 'Edit' : 'Preview'}
            </button>
            <button onClick={onClose} style={{ color: 'var(--atg)' }}>
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
              <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--at)', fontFamily: "'Exo 2', 'Inter', sans-serif" }}>
                {form.title || <span style={{ color: 'var(--atg)' }}>Untitled</span>}
              </h2>
              <div className="text-sm leading-relaxed" style={{ color: 'var(--atm)' }}
                dangerouslySetInnerHTML={{ __html: renderContent(form.content || '*No content yet*') }} />
              {form.created_by && (
                <div className="mt-4 pt-3 text-xs" style={{ color: 'var(--atg)', borderTop: '1px solid var(--as4)' }}>
                  Posted by {form.created_by} · {format(new Date(), 'MMMM d, yyyy')}
                </div>
              )}
            </div>
          ) : (
            /* Edit form */
            <div className="px-6 py-5 flex flex-col gap-4">
              {error && <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,68,68,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.2)' }}>{error}</div>}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Title *</label>
                <input className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Announcement title..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Category</label>
                  <select className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.category} onChange={e => set('category', e.target.value)} style={{ cursor: 'pointer' }}>
                    {ANN_CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#080d28' }}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Posted By</label>
                  <input className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.created_by} onChange={e => set('created_by', e.target.value)} placeholder="Your name" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Content *</label>
                  <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--atg)' }}>
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
                <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Cover Image URL</label>
                <input className="a-input px-3 py-2.5 rounded-lg text-sm" value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
              </div>

              {/* Pinned toggle */}
              <button type="button" onClick={() => set('pinned', !form.pinned)}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-left"
                style={{ background: form.pinned ? 'rgba(0,191,255,0.06)' : 'var(--as2)', border: `1px solid ${form.pinned ? 'rgba(0,191,255,0.2)' : 'var(--ab)'}`, transition: 'all 0.2s' }}>
                <div className="w-9 h-5 rounded-full flex items-center transition-all" style={{ background: form.pinned ? '#00BFFF' : 'var(--ab2)', padding: '2px' }}>
                  <div className="w-4 h-4 rounded-full transition-all" style={{ background: '#fff', transform: form.pinned ? 'translateX(16px)' : 'translateX(0)' }} />
                </div>
                <div>
                  <div className="text-xs font-semibold" style={{ color: form.pinned ? '#00BFFF' : '#7b88c0' }}>Pin this announcement</div>
                  <div className="text-[10px]" style={{ color: 'var(--atg)' }}>Pinned posts appear at the top of the feed</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--ab)' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: 'transparent', border: '1px solid var(--ab2)', color: 'var(--atm)' }}>Cancel</button>
          <button onClick={save} disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-bold tracking-wider"
            style={{
              background: loading ? 'rgba(0,191,255,0.05)' : 'linear-gradient(135deg, rgba(0,191,255,0.18) 0%, rgba(138,43,226,0.18) 100%)',
              border: '1px solid rgba(0,191,255,0.35)', color: loading ? 'var(--atg)' : 'var(--at)',
              fontFamily: "'Exo 2', 'Inter', sans-serif",
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
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid var(--ab)', backdropFilter: 'blur(8px)' }}>

      {/* header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ab)' }}>
        <div>
          <h2 className="font-bold tracking-widest text-sm" style={{ color: 'var(--at)', fontFamily: "'Exo 2', 'Inter', sans-serif" }}>ANNOUNCEMENTS</h2>
          <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--atg)' }}>{announcements.length} posts • live</p>
        </div>
        <button onClick={() => setModal({ open: true, item: null })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase"
          style={{ background: 'linear-gradient(135deg, rgba(0,191,255,0.12) 0%, rgba(138,43,226,0.12) 100%)', border: '1px solid rgba(0,191,255,0.3)', color: '#00BFFF', fontFamily: "'Exo 2', 'Inter', sans-serif" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Announcement
        </button>
      </div>

      {/* col headers */}
      <div className="hidden sm:grid px-6 py-2.5 text-[10px] uppercase tracking-widest"
        style={{ gridTemplateColumns: '1fr 110px 90px 80px 130px', borderBottom: '1px solid var(--as3)', color: 'var(--atg)' }}>
        <span>Title</span><span>Category</span><span>Posted</span><span>Pinned</span><span className="text-right">Actions</span>
      </div>

      {loading ? (
        <div className="px-6 py-10 text-center text-xs uppercase tracking-widest" style={{ color: 'var(--atg)' }}>Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="px-6 py-10 text-center text-xs" style={{ color: 'var(--atg)' }}>No announcements yet.</div>
      ) : (
        <div>
          {sorted.map(a => {
            const cat = CATEGORY_STYLE[a.category] ?? CATEGORY_STYLE['News'];
            return (
              <div key={a.id} className="a-row sm:grid px-6 py-4 items-center flex flex-wrap gap-3"
                style={{ gridTemplateColumns: '1fr 110px 90px 80px 130px', borderBottom: '1px solid var(--as2)' }}>
                {/* title */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {a.pinned && <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00BFFF' }} />}
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--at2)', fontFamily: "'Exo 2', 'Inter', sans-serif" }}>{a.title}</span>
                  </div>
                  {a.created_by && <span className="text-xs" style={{ color: 'var(--atg)' }}>by {a.created_by}</span>}
                </div>
                {/* category */}
                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase self-start"
                  style={{ background: cat.bg, color: cat.color }}>{a.category}</span>
                {/* date */}
                <span className="text-xs" style={{ color: 'var(--atg)' }}>{format(new Date(a.created_at), 'MMM d, yyyy')}</span>
                {/* pinned */}
                <button onClick={() => togglePin(a)} className="text-xs px-2 py-1 rounded-lg self-start"
                  style={{ background: a.pinned ? 'rgba(0,191,255,0.1)' : 'var(--as3)', border: `1px solid ${a.pinned ? 'rgba(0,191,255,0.2)' : 'var(--ab)'}`, color: a.pinned ? '#00BFFF' : '#3a4570', transition: 'all 0.2s' }}>
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
  const [tab, setTab] = useState<Tab>('orders');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('admin_sidebar_collapsed') === '1');
  const [adminTheme, setAdminTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('admin_theme') as 'dark' | 'light') ?? 'dark');
  const [bellOpen, setBellOpen] = useState(false);

  function toggleSidebar() {
    setSidebarCollapsed(v => { const next = !v; localStorage.setItem('admin_sidebar_collapsed', next ? '1' : '0'); return next; });
  }
  function toggleTheme() {
    setAdminTheme(t => { const next = t === 'dark' ? 'light' : 'dark'; localStorage.setItem('admin_theme', next); return next; });
  }
  const isLight = adminTheme === 'light';

  // Theme-aware color helpers
  const th = {
    bg:         isLight ? '#f0f2f8' : '#0d0d0f',
    sidebarBg:  isLight ? '#f8f9fc' : 'linear-gradient(180deg,#0d0f1a 0%,#0a0c18 100%)',
    topbarBg:   isLight ? '#ffffff' : '#111115',
    border:     isLight ? 'rgba(0,0,0,0.08)' : 'var(--ab)',
    text:       isLight ? '#1a1d2e' : '#e8eaf6',
    textMuted:  isLight ? '#6b7498' : '#4a5580',
    textFaint:  isLight ? '#9ba8c8' : '#3a4570',
    cardBg:     isLight ? 'rgba(0,0,0,0.03)' : 'var(--as2)',
    navActive:  isLight ? 'rgba(0,141,255,0.12)' : 'rgba(0,191,255,0.13)',
    navHover:   isLight ? 'rgba(0,0,0,0.04)' : 'var(--as3)',
  };
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [adminRole, setAdminRole] = useState('administrator');
  const [vaultOpen, setVaultOpen] = useState(isVaultUnlocked());
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const TAB_ACCESS: Record<string, Tab[]> = {
    owner:         ['dashboard','analytics','products','orders','announcements','codes','accounts','members','emails','tokens','webhooks','settings'],
    administrator: ['dashboard','analytics','products','orders','announcements','codes','accounts','members','emails','tokens','webhooks','settings'],
    moderator:     ['dashboard','analytics','products','orders','announcements'],
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

    function refreshData() {
      supabase.from('products').select('*').order('category').then(({ data }) => {
        if (data) setProducts(data);
        setLoading(false);
      });
      supabase.from('orders').select('*').order('created_at', { ascending: false }).then(({ data }) => {
        if (data) setOrders(data);
      });
    }

    refreshData();
    // Poll every 8 seconds so new orders appear without a manual refresh
    const dataPoll = setInterval(refreshData, 8_000);

    return () => { clearInterval(vaultPoll); clearInterval(dataPoll); };
  }, []);

  function switchTab(t: Tab) {
    setVaultOpen(isVaultUnlocked());
    setTab(t);
    setSidebarOpen(false);
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

  async function deleteOrder(orderId: string) {
    if (!window.confirm('Permanently delete this order? This cannot be undone.')) return;
    removeOrder(orderId);
    await supabase.from('order_items').delete().eq('order_id', orderId);
    await supabase.from('orders').delete().eq('id', orderId);
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
      if (!session?.access_token) { alert('Not logged in — please refresh.'); return; }
      const res = await fetch('/api/admin?action=fulfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, token: session.access_token }),
      });
      const data = await res.json().catch(() => ({ error: `Server error (HTTP ${res.status})` }));
      if (!res.ok) alert('Fulfillment failed: ' + (data.error ?? 'Unknown error'));
      else {
        supabase.from('orders').select('*').order('created_at', { ascending: false }).then(({ data: rows }) => { if (rows) setOrders(rows); });
      }
    } catch (e) {
      alert('Request failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(b => ({ ...b, [orderId]: false })); }
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
      if (!session?.access_token) {
        alert('Not logged in — please refresh and log in again.');
        return;
      }
      const res = await fetch('/api/admin?action=fulfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, token: session.access_token }),
      });
      const rawText = await res.text();
      let data: { error?: string; success?: boolean };
      try { data = JSON.parse(rawText); }
      catch { data = { error: `HTTP ${res.status} — ${rawText.slice(0, 300)}` }; }
      if (!res.ok) {
        alert('Fulfillment failed: ' + (data.error || 'Unknown error'));
      } else {
        alert('Order fulfilled — codes assigned, stock updated, email sent!');
        supabase.from('orders').select('*').order('created_at', { ascending: false }).then(({ data: rows }) => { if (rows) setOrders(rows); });
      }
    } catch (e) {
      alert('Fulfillment request failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setSendingEmail(null); }
  }

  const rc = ROLE_COLOR[adminRole] ?? '#7b88c0';
  const pendingOrders = orders.filter(o => o.status === 'pending').length;

  const SidebarContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div style={{ width: collapsed ? 56 : 240, height: '100%', background: th.sidebarBg, borderRight: `1px solid ${th.border}`, display: 'flex', flexDirection: 'column', transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: collapsed ? '18px 0' : '18px 20px 14px', borderBottom: `1px solid ${th.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 8 }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#00BFFF 0%,#8A2BE2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,191,255,0.25)' }}>
              <IcGrid />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: th.text, fontFamily: "'Exo 2','Inter',sans-serif", letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>SALE SHOP</div>
              <div style={{ fontSize: 8, color: th.textFaint, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Control Panel</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#00BFFF 0%,#8A2BE2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IcGrid />
          </div>
        )}
        {!collapsed && (
          <button onClick={toggleSidebar} title="Collapse sidebar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: th.textFaint, padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          </button>
        )}
      </div>

      {/* Collapsed: expand button */}
      {collapsed && (
        <button onClick={toggleSidebar} title="Expand sidebar" style={{ margin: '10px auto 0', background: 'none', border: 'none', cursor: 'pointer', color: th.textFaint, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        </button>
      )}

      <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 8, paddingTop: collapsed ? 4 : 0 }}>
        {/* NavItem in collapsed mode shows only icon centered */}
        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingTop: 6 }}>
            {[
              { icon: <IcOrders />, t: 'orders' as Tab, label: 'Orders', badge: pendingOrders || undefined },
              { icon: <IcBox />, t: 'products' as Tab, label: 'Products' },
              { icon: <IcGrid />, t: 'dashboard' as Tab, label: 'Dashboard' },
              ...(allowedTabs.includes('analytics') ? [{ icon: <SvgIc><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></SvgIc>, t: 'analytics' as Tab, label: 'Analytics' }] : []),
              ...(allowedTabs.includes('announcements') ? [{ icon: <IcBell />, t: 'announcements' as Tab, label: 'Announcements' }] : []),
              ...(allowedTabs.includes('members') ? [{ icon: <IcUsers />, t: 'members' as Tab, label: 'Members' }] : []),
              ...(allowedTabs.includes('emails') ? [{ icon: <IcMail />, t: 'emails' as Tab, label: 'Email Center' }] : []),
              ...(allowedTabs.includes('tokens') ? [{ icon: <IcCoin />, t: 'tokens' as Tab, label: 'Token Economy' }] : []),
              ...(allowedTabs.includes('codes') ? [{ icon: <IcCode />, t: 'codes' as Tab, label: 'Code Inventory' }] : []),
              ...(allowedTabs.includes('accounts') ? [{ icon: <IcDb />, t: 'accounts' as Tab, label: 'Acct Inventory' }] : []),
              ...(allowedTabs.includes('webhooks') ? [{ icon: <SvgIc><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></SvgIc>, t: 'webhooks' as Tab, label: 'Webhooks' }] : []),
              ...(allowedTabs.includes('settings') ? [{ icon: <IcGear />, t: 'settings' as Tab, label: 'Settings' }] : []),
            ].map(({ icon, t, label, badge }) => (
              <button key={t} onClick={() => switchTab(t)} title={label}
                style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', position: 'relative',
                  background: tab === t ? 'rgba(0,191,255,0.15)' : 'transparent',
                  color: tab === t ? '#00BFFF' : th.textMuted }}>
                {icon}
                {badge ? <span style={{ position: 'absolute', top: 3, right: 3, minWidth: 14, height: 14, borderRadius: 99, background: '#FF4444', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <>
            <NavSection label="Quick Use">
              <NavItem icon={<IcOrders />} label="Orders" active={tab === 'orders'} onClick={() => switchTab('orders')} badge={pendingOrders || undefined} />
              <NavItem icon={<IcBox />} label="All Products" active={tab === 'products'} onClick={() => switchTab('products')} />
            </NavSection>
            <NavSection label="Home">
              <NavItem icon={<IcGrid />} label="Dashboard" active={tab === 'dashboard'} onClick={() => switchTab('dashboard')} />
              {allowedTabs.includes('analytics') && (
                <NavItem icon={<SvgIc><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></SvgIc>} label="Analytics" active={tab === 'analytics'} onClick={() => switchTab('analytics')} />
              )}
            </NavSection>
            {allowedTabs.some(t => ['announcements','members','emails','tokens'].includes(t)) && (
              <NavSection label="Manage">
                {allowedTabs.includes('announcements') && <NavItem icon={<IcBell />} label="Announcements" active={tab === 'announcements'} onClick={() => switchTab('announcements')} />}
                {allowedTabs.includes('members') && <NavItem icon={<IcUsers />} label="Members" active={tab === 'members'} onClick={() => switchTab('members')} />}
                {allowedTabs.includes('emails') && <NavItem icon={<IcMail />} label="Email Center" active={tab === 'emails'} onClick={() => switchTab('emails')} />}
                {allowedTabs.includes('tokens') && <NavItem icon={<IcCoin />} label="Token Economy" active={tab === 'tokens'} onClick={() => switchTab('tokens')} />}
              </NavSection>
            )}
            {allowedTabs.some(t => ['codes','accounts','webhooks','settings'].includes(t)) && (
              <NavSection label="Advanced">
                {allowedTabs.includes('codes') && <NavItem icon={<IcCode />} label="Code Inventory" active={tab === 'codes'} onClick={() => switchTab('codes')} />}
                {allowedTabs.includes('accounts') && <NavItem icon={<IcDb />} label="Acct Inventory" active={tab === 'accounts'} onClick={() => switchTab('accounts')} />}
                {allowedTabs.includes('webhooks') && <NavItem icon={<SvgIc><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></SvgIc>} label="Webhooks" active={tab === 'webhooks'} onClick={() => switchTab('webhooks')} />}
                {allowedTabs.includes('settings') && <NavItem icon={<IcGear />} label="Settings" active={tab === 'settings'} onClick={() => switchTab('settings')} />}
              </NavSection>
            )}
          </>
        )}
      </nav>

      {/* User footer */}
      <div style={{ padding: collapsed ? '10px 0' : '10px 14px', borderTop: `1px solid ${th.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${rc}20`, border: `1px solid ${rc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: rc, flexShrink: 0 }}>{user.email[0].toUpperCase()}</div>
        {!collapsed && (
          <>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 10, color: th.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
              <div style={{ fontSize: 8, color: rc, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{adminRole}</div>
            </div>
            <button onClick={onLogout} title="Logout" style={{ background: 'none', border: 'none', cursor: 'pointer', color: th.textFaint, padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#FF6B6B')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = th.textFaint)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: th.bg, fontFamily: "\'Inter\',sans-serif", colorScheme: isLight ? 'light' : 'dark' }}>
      <style>{ADMIN_CSS}</style>
      <style>{`
        :root {
          --nav-text: ${isLight ? '#5a6490' : '#4a5580'};
          --nav-text-hover: ${isLight ? '#1a1d2e' : '#9ba8c8'};
          --nav-active-text: ${isLight ? '#0070e0' : '#e8eaf6'};
          --nav-hover: ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'};
          --nav-section-label: ${isLight ? '#9ba8c8' : '#2a3450'};
          /* admin panel theme tokens */
          --at:  ${isLight ? '#1a1d2e' : '#e8eaf6'};
          --at2: ${isLight ? '#2e3460' : '#c8d0f0'};
          --atm: ${isLight ? '#4a5580' : '#7b88c0'};
          --atf: ${isLight ? '#6b7498' : '#4a5580'};
          --atg: ${isLight ? '#8090b0' : '#3a4570'};
          --as1: ${isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)'};
          --as2: ${isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)'};
          --as3: ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'};
          --as4: ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'};
          --ab:  ${isLight ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.07)'};
          --ab2: ${isLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.10)'};
          --a-modal-bg: ${isLight ? '#f4f6fb' : '#080d28'};
          --a-page-bg:  ${isLight ? '#eef0f8' : '#050816'};
        }
      `}</style>

      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setSidebarOpen(false)} />
          <div style={{ position: 'relative', zIndex: 1 }}><SidebarContent collapsed={false} /></div>
        </div>
      )}

      <div className="hidden md:block" style={{ height: '100vh', flexShrink: 0 }}><SidebarContent collapsed={sidebarCollapsed} /></div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        <div style={{ height: 56, flexShrink: 0, background: th.topbarBg, borderBottom: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px' }}>

          {/* Mobile hamburger */}
          <button className="md:hidden" onClick={() => setSidebarOpen(true)} title="Open menu"
            style={{ background: 'none', border: `1px solid ${th.border}`, cursor: 'pointer', padding: '5px 7px', borderRadius: 8, color: th.textMuted, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>

          {/* Page title (topbar) */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span className="hidden sm:block" style={{ fontSize: 13, fontWeight: 700, color: th.text, fontFamily: "'Exo 2','Inter',sans-serif", letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{TAB_TITLES[tab]}</span>
          </div>

          {/* Theme toggle */}
          <button onClick={toggleTheme} title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
            style={{ background: 'none', border: `1px solid ${th.border}`, cursor: 'pointer', padding: '5px 7px', borderRadius: 8, color: th.textMuted, display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#00BFFF')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = th.textMuted)}>
            {isLight ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            )}
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setBellOpen(b => !b)} style={{ background: bellOpen ? 'rgba(0,191,255,0.1)' : 'none', border: bellOpen ? '1px solid rgba(0,191,255,0.25)' : '1px solid transparent', cursor: 'pointer', padding: '5px 7px', borderRadius: 8, color: bellOpen ? '#00BFFF' : '#4a5580', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>
              <IcBell size={15} />
            </button>
            {pendingOrders > 0 && !bellOpen && (
              <span style={{ position: 'absolute', top: 1, right: 1, minWidth: 16, height: 16, borderRadius: 99, background: '#FF4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', pointerEvents: 'none' }}>{Math.min(pendingOrders, 9)}+</span>
            )}
            {bellOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setBellOpen(false)} />
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 320, maxHeight: 420, overflowY: 'auto', background: 'var(--as2, #16161a)', border: '1px solid rgba(0,191,255,0.2)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 50 }}>
                  <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--ab)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--atm)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Pending Orders</span>
                    {pendingOrders > 0 && <span style={{ fontSize: 10, background: '#FF4444', color: '#fff', borderRadius: 99, padding: '1px 6px', fontWeight: 700 }}>{pendingOrders}</span>}
                  </div>
                  {orders.filter(o => o.status === 'pending' || o.status === 'processing').length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--atg)' }}>No pending orders</div>
                  ) : (
                    orders.filter(o => o.status === 'pending' || o.status === 'processing').map(o => {
                      const sc = o.status === 'pending' ? '#FF8C00' : '#00BFFF';
                      return (
                        <button key={o.id} onClick={() => { setBellOpen(false); switchTab('orders'); }}
                          style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--as3)', transition: 'background 0.1s' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--as3)')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--at2)' }}>{o.customer_name}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--at)' }}>&#x20B1;{Number(o.total).toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 10, color: 'var(--atg)' }}>{o.customer_email}</span>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${sc}18`, color: sc, border: `1px solid ${sc}40`, textTransform: 'uppercase' }}>{o.status}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                  {orders.filter(o => o.status === 'pending' || o.status === 'processing').length > 0 && (
                    <button onClick={() => { setBellOpen(false); switchTab('orders'); }}
                      style={{ width: '100%', padding: '10px 16px', background: 'rgba(0,191,255,0.05)', border: 'none', borderTop: '1px solid rgba(0,191,255,0.1)', cursor: 'pointer', fontSize: 12, color: '#00BFFF', fontWeight: 600, textAlign: 'center' }}>
                      View all orders →
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px 40px' }}>
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: th.text, fontFamily: "'Exo 2','Inter',sans-serif", marginBottom: 4 }}>{TAB_TITLES[tab]}</h1>
            <p style={{ fontSize: 13, color: th.textMuted }}>{TAB_SUBTITLES[tab]}</p>
          </motion.div>

          {tab === 'dashboard' && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex flex-wrap gap-3 mb-6">
                <StatCard label="Total Products" value={products.length} color="#00BFFF" />
                <StatCard label="Total Stock" value={totalStock} color="#00E676" />
                <StatCard label="Low Stock" value={lowStock} color="#FF8C00" />
                <StatCard label="Out of Stock" value={outOfStock} color="#FF4444" />
                <StatCard label="Total Orders" value={orders.length} color="#8A2BE2" />
                {waitingOrders > 0 && <StatCard label="Awaiting Inventory" value={waitingOrders} color="#FF8C00" />}
              </div>
              {providerStats.some(p => p.count > 0) && (
                <div className="flex flex-wrap gap-3 mb-6">
                  {providerStats.filter(p => p.count > 0).map(({ pm, count, revenue, successRate }) => {
                    const pColor = PROVIDER_COLORS[pm];
                    return (
                      <div key={pm} className="flex-1 min-w-[150px] p-4 rounded-xl" style={{ background: 'var(--as1)', border: `1px solid ${pColor}22` }}>
                        <div className="flex items-center gap-2 mb-2"><div className="w-1.5 h-1.5 rounded-full" style={{ background: pColor }} /><span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: pColor }}>{PROVIDER_LABELS[pm]}</span></div>
                        <p className="text-xl font-bold mb-0.5" style={{ color: 'var(--at)', fontFamily: "'Exo 2','Inter',sans-serif" }}>&#x20B1;{revenue.toLocaleString()}</p>
                        <p className="text-[10px]" style={{ color: 'var(--atg)' }}>{count} orders &middot; {successRate}% success</p>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--as1)', border: '1px solid var(--ab)' }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ab)' }}>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Recent Orders</span>
                  <button onClick={() => switchTab('orders')} style={{ color: '#00BFFF', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>View all &#x2192;</button>
                </div>
                {orders.slice(0, 5).map(o => {
                  const dash_sc = ({ pending: '#FF8C00', processing: '#00BFFF', paid: '#8A2BE2', delivering: '#00BFFF', delivered: '#00E676', waiting_for_inventory: '#FF8C00', failed: '#FF4444', cancelled: '#FF4444' } as Record<string,string>)[o.status] ?? '#7b88c0';
                  return (
                    <div key={o.id} className="a-row flex items-center gap-4 px-6 py-3" style={{ borderBottom: '1px solid var(--as2)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--at2)', fontFamily: "'Exo 2','Inter',sans-serif" }}>{o.customer_name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--atg)' }}>{o.customer_email}</p>
                      </div>
                      <span className="text-sm font-bold" style={{ color: 'var(--at)', fontFamily: "'Exo 2','Inter',sans-serif" }}>&#x20B1;{Number(o.total).toLocaleString()}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest" style={{ background: `${dash_sc}18`, color: dash_sc, border: `1px solid ${dash_sc}40` }}>{o.status}</span>
                      <span className="text-xs hidden sm:block" style={{ color: 'var(--atg)' }}>{format(new Date(o.created_at), 'MMM d, h:mm a')}</span>
                    </div>
                  );
                })}
                {orders.length === 0 && <div className="px-6 py-8 text-center text-xs" style={{ color: 'var(--atg)' }}>No orders yet.</div>}
              </div>
            </motion.div>
          )}

        {/* ── Products panel ── */}
        {tab === 'products' && (
          <motion.div className="rounded-2xl overflow-hidden"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            style={{ background: 'linear-gradient(135deg, var(--as3) 0%, var(--as1) 100%)', border: '1px solid var(--ab)', backdropFilter: 'blur(8px)' }}>

            {/* table header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ab)' }}>
              <div>
                <h2 className="font-bold tracking-widest text-sm" style={{ color: 'var(--at)', fontFamily: "'Exo 2', 'Inter', sans-serif" }}>PRODUCTS</h2>
                <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--atg)' }}>{products.length} items • live</p>
              </div>
              <button
                onClick={() => setModal({ open: true, product: null })}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase"
                style={{ background: 'linear-gradient(135deg, rgba(0,191,255,0.12) 0%, rgba(138,43,226,0.12) 100%)', border: '1px solid rgba(0,191,255,0.3)', color: '#00BFFF', fontFamily: "'Exo 2', 'Inter', sans-serif", transition: 'all 0.2s' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Product
              </button>
            </div>

            {/* col headers */}
            <div className="hidden sm:grid px-6 py-2.5 text-[10px] uppercase tracking-widest"
              style={{ gridTemplateColumns: '1fr 130px 90px 160px 110px', borderBottom: '1px solid var(--as3)', color: 'var(--atg)' }}>
              <span>Name</span><span>Category</span><span>Price</span><span>Stock</span><span className="text-right">Actions</span>
            </div>

            {/* rows */}
            {loading ? (
              <div className="px-6 py-10 text-center text-xs uppercase tracking-widest" style={{ color: 'var(--atg)' }}>Loading products...</div>
            ) : products.length === 0 ? (
              <div className="px-6 py-10 text-center text-xs" style={{ color: 'var(--atg)' }}>No products. Add one to get started.</div>
            ) : (
              <div className="overflow-x-auto">
                {products.map(p => (
                  <div key={p.id} className="a-row sm:grid px-6 py-4 items-center flex flex-wrap gap-3"
                    style={{ gridTemplateColumns: '1fr 130px 90px 160px 110px', borderBottom: '1px solid var(--as2)' }}>

                    {/* name */}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: 'var(--at2)', fontFamily: "'Exo 2', 'Inter', sans-serif" }}>{p.name}</div>
                      {p.description && <div className="text-xs mt-0.5 truncate max-w-xs" style={{ color: 'var(--atg)' }}>{p.description}</div>}
                    </div>

                    {/* category */}
                    <div className="text-xs" style={{ color: 'var(--atm)' }}>{p.category ?? '—'}</div>

                    {/* price */}
                    <div className="text-sm font-bold" style={{ color: 'var(--at)', fontFamily: "'Exo 2', 'Inter', sans-serif" }}>₱{p.price}</div>

                    {/* stock controls */}
                    <div className="flex items-center gap-2">
                      <button onClick={() => adjustStock(p, -1)} disabled={p.stock === 0 || busy[p.id]}
                        className="a-stock-minus w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center"
                        style={{ color: p.stock === 0 ? '#2e3a5a' : '#7b88c0', cursor: p.stock === 0 ? 'not-allowed' : 'pointer' }}>
                        −
                      </button>
                      <span className="w-10 text-center text-sm font-bold tabular-nums"
                        style={{ color: stockColor(p.stock), fontFamily: "'Exo 2', 'Inter', sans-serif" }}>
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
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid var(--ab)', backdropFilter: 'blur(8px)' }}>

            {/* header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ab)' }}>
              <div>
                <h2 className="font-bold tracking-widest text-sm" style={{ color: 'var(--at)', fontFamily: "'Exo 2', 'Inter', sans-serif" }}>ORDERS</h2>
                <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--atg)' }}>{orders.length} total · live</p>
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
                      fontFamily: "'Exo 2','Inter',sans-serif",
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
              style={{ gridTemplateColumns: '1fr 160px 90px 110px 200px 32px', borderBottom: '1px solid var(--as3)', color: 'var(--atg)' }}>
              <span>Customer</span><span>Email</span><span>Total</span><span>Status</span><span className="text-right">Actions</span><span></span>
            </div>

            {orders.length === 0 ? (
              <div className="px-6 py-10 text-center text-xs" style={{ color: 'var(--atg)' }}>No orders yet.</div>
            ) : (
              <div>
                {orders.map(o => {
                  const colors: Record<string, string> = { pending:'#FF8C00', processing:'#00BFFF', paid:'#8A2BE2', delivering:'#00BFFF', delivered:'#00E676', waiting_for_inventory:'#FF8C00', failed:'#FF4444', cancelled:'#FF4444' };
                  const sc = colors[o.status] ?? '#7b88c0';
                  const isBusy = busy[o.id] || sendingEmail === o.id;
                  return (
                    <div key={o.id} style={{ borderBottom: '1px solid var(--as2)' }}>
                    <div className="a-row sm:grid px-6 py-4 items-center flex flex-wrap gap-3"
                      style={{ gridTemplateColumns: '1fr 160px 90px 110px 200px 32px' }}>

                      {/* customer */}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--at2)', fontFamily: "'Exo 2','Inter',sans-serif" }}>{o.customer_name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--atg)' }}>{o.id.slice(0,8).toUpperCase()} · {format(new Date(o.created_at), 'MMM d')}</p>
                      </div>

                      {/* email */}
                      <p className="text-xs truncate" style={{ color: 'var(--atg)' }}>{o.customer_email}</p>

                      {/* total */}
                      <p className="text-sm font-bold" style={{ color: 'var(--at)', fontFamily: "'Exo 2','Inter',sans-serif" }}>₱{Number(o.total).toLocaleString()}</p>

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
                        <button onClick={() => deleteOrder(o.id)}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                          style={{ background: 'rgba(120,0,0,0.15)', border: '1px solid rgba(180,0,0,0.3)', color: '#cc4444' }}
                          title="Delete order permanently">
                          🗑
                        </button>
                      </div>

                      {/* Expand toggle */}
                      <button onClick={() => toggleOrderExpand(o.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--atg)', padding: '4px', transition: 'color 0.15s' }}
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
                      <div className="px-6 pb-4" style={{ borderTop: '1px solid var(--as3)' }}>
                        {!orderItems[o.id] ? (
                          <p className="text-[10px] pt-3" style={{ color: 'var(--atg)' }}>Loading...</p>
                        ) : (
                          <div className="flex flex-col gap-2 pt-3">
                            {/* Vault hint when credentials exist but vault is locked */}
                            {!vaultOpen && (orderItems[o.id] ?? []).some(i => i.assigned_code || i.assigned_username) && (
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1"
                                style={{ background: 'rgba(0,191,255,0.05)', border: '1px solid rgba(0,191,255,0.15)' }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00BFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                                <span className="text-[10px]" style={{ color: 'var(--atg)' }}>Credentials hidden — unlock the vault in Code Inv. or Acct Inv. to reveal</span>
                              </div>
                            )}
                            {(orderItems[o.id] ?? []).map(item => (
                              <div key={item.id} className="rounded-xl p-3" style={{ background: 'var(--as1)', border: '1px solid var(--as4)' }}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold" style={{ color: 'var(--at2)', fontFamily: "'Exo 2','Inter',sans-serif" }}>{item.product_name} ×{item.quantity}</span>
                                  <span className="text-xs font-bold" style={{ color: 'var(--at)', fontFamily: "'Exo 2','Inter',sans-serif" }}>₱{(item.price * item.quantity).toLocaleString()}</span>
                                </div>
                                {item.assigned_code && (
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--atg)' }}>Code</span>
                                    {vaultOpen
                                      ? <span className="text-xs font-mono font-bold" style={{ color: '#00BFFF' }}>{item.assigned_code}</span>
                                      : <span className="text-xs font-mono" style={{ color: 'var(--atg)' }}>{'•'.repeat(Math.min(item.assigned_code.length, 14))}</span>
                                    }
                                  </div>
                                )}
                                {item.assigned_username && (
                                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                                    <div>
                                      <span className="text-[9px] uppercase tracking-widest block mb-0.5" style={{ color: 'var(--atg)' }}>Username</span>
                                      {vaultOpen
                                        ? <span className="text-xs font-mono" style={{ color: 'var(--at2)' }}>{item.assigned_username}</span>
                                        : <span className="text-xs font-mono" style={{ color: 'var(--atg)' }}>••••••••</span>
                                      }
                                    </div>
                                    <div>
                                      <span className="text-[9px] uppercase tracking-widest block mb-0.5" style={{ color: 'var(--atg)' }}>Password</span>
                                      {vaultOpen
                                        ? <span className="text-xs font-mono" style={{ color: 'var(--at2)' }}>{item.assigned_password}</span>
                                        : <span className="text-xs font-mono" style={{ color: 'var(--atg)' }}>••••••••</span>
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

        {tab === 'analytics' && (
          <motion.div className="rounded-2xl p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid var(--ab)' }}>
            <AnalyticsPanel />
          </motion.div>
        )}

        {tab === 'members' && (
          <motion.div className="rounded-2xl p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid var(--ab)' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold tracking-widest text-sm" style={{ color: 'var(--at)', fontFamily: "'Exo 2', 'Inter', sans-serif" }}>MEMBERS</h2>
                <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--atg)' }}>Manage VIP & Reseller accounts</p>
              </div>
            </div>
            <MembersPanel adminId={user.id} />
          </motion.div>
        )}

        {tab === 'emails' && (
          <motion.div className="rounded-2xl p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid var(--ab)' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold tracking-widest text-sm" style={{ color: 'var(--at)', fontFamily: "'Exo 2', 'Inter', sans-serif" }}>EMAIL CENTER</h2>
                <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--atg)' }}>Delivery monitoring · auto-refreshes every 10s</p>
              </div>
            </div>
            <EmailCenterPanel />
          </motion.div>
        )}

        {tab === 'tokens' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
            <TokenEconomyPanel adminToken="" />
          </motion.div>
        )}

        {tab === 'webhooks' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
            <WebhooksPanel />
          </motion.div>
        )}

        {tab === 'settings' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-col gap-6">

            {/* ── Maintenance mode card ── */}
            <div className="rounded-2xl p-6" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))', border: '1px solid var(--ab)' }}>
              <p className="text-[10px] uppercase tracking-widest font-bold mb-4" style={{ color: '#00BFFF' }}>Site Settings</p>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold mb-1" style={{ color: 'var(--at2)', fontFamily: "'Exo 2','Inter',sans-serif" }}>
                    Maintenance Mode
                  </p>
                  <p className="text-xs" style={{ color: 'var(--atg)' }}>
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
                    fontFamily: "'Exo 2','Inter',sans-serif",
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--a-page-bg)' }}>
      <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atg)' }}>Verifying access...</span>
    </div>
  );

  if (authState === 'login') return <AdminLogin onSuccess={verifyAdmin} />;

  if (authState === 'denied') return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--a-page-bg)' }}>
      <style>{ADMIN_CSS}</style>
      <div className="text-xl font-bold tracking-widest" style={{ color: '#FF6B6B', fontFamily: "'Exo 2', 'Inter', sans-serif" }}>ACCESS DENIED</div>
      <div className="text-xs" style={{ color: 'var(--atg)' }}>Your account is not in the admins list.</div>
      <button onClick={handleLogout} className="mt-2 text-xs px-4 py-2 rounded-lg"
        style={{ border: '1px solid rgba(255,68,68,0.25)', color: '#FF6B6B', background: 'transparent' }}>
        Sign Out
      </button>
    </div>
  );

  return <AdminDashboard user={user!} onLogout={handleLogout} />;
}
