import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router';
import { format } from 'date-fns';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import logoImage from '@/imports/image-1.png';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useAnnouncements } from '@/lib/useAnnouncements';
import { CATEGORY_STYLE } from './AnnouncementsPage';
import { useCustomerAuth, tierPrice, tierLabel, tierColor, type CustomerTier } from '@/lib/customerAuth';
import MemberDropdown from './MemberDropdown';
import type { Product } from '@/lib/types';

const DISCORD_INVITE_URL = 'https://discord.gg/saleshop';

const DISCORD_PATH =
  'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z';

const CATEGORY_CONFIG: Record<string, { icon: string; accent: string }> = {
  'Rockstar Games':   { icon: '🎮', accent: '#FF4500' },
  'Discord Accounts': { icon: '💬', accent: '#5865F2' },
  'Steam Accounts':   { icon: '🎲', accent: '#1b9ddb' },
};

const CSS = `
  :root {
    --cyan: #00BFFF;
    --purple: #8A2BE2;
    --gold: #F5B000;
    --shop-bg: #060812;
  }

  @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');

  @keyframes orb-1 {
    0%, 100% { transform: translate(0%, 0%) scale(1); }
    50%       { transform: translate(-6%, 10%) scale(1.1); }
  }
  @keyframes orb-2 {
    0%, 100% { transform: translate(0%, 0%) scale(1); }
    50%       { transform: translate(8%, -7%) scale(0.9); }
  }
  @keyframes orb-3 {
    0%, 100% { transform: translate(0%, 0%) scale(1); }
    50%       { transform: translate(-4%, -8%) scale(1.06); }
  }
  @keyframes logo-breathe {
    0%, 100% { filter: drop-shadow(0 0 32px rgba(0,191,255,0.4)) drop-shadow(0 0 72px rgba(138,43,226,0.28)); }
    50%       { filter: drop-shadow(0 0 60px rgba(0,191,255,0.72)) drop-shadow(0 0 120px rgba(138,43,226,0.55)); }
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0,191,255,0.6); }
    50%       { opacity: 0.7; box-shadow: 0 0 0 5px rgba(0,191,255,0); }
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes hero-line-in {
    from { opacity: 0; transform: translateY(24px) skewY(1.5deg); }
    to   { opacity: 1; transform: translateY(0) skewY(0deg); }
  }
  @keyframes count-pop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.35); }
    100% { transform: scale(1); }
  }
  @keyframes modal-in {
    from { opacity: 0; transform: scale(0.94) translateY(16px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  .logo-breathe { animation: logo-breathe 3.5s ease-in-out infinite; will-change: filter; }
  .orb-1 { animation: orb-1 18s ease-in-out infinite; }
  .orb-2 { animation: orb-2 22s ease-in-out infinite; }
  .orb-3 { animation: orb-3 26s ease-in-out infinite; }

  /* Navbar — backdrop-filter lives on ::before so the nav itself is NOT
     a fixed-position containing block; dropdowns can overflow freely */
  .shop-nav {
    isolation: isolate;
  }
  .shop-nav::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(6,8,18,0.78);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    z-index: -1;
    pointer-events: none;
  }

  /* Cart count animation */
  .cart-count {
    font-family: 'JetBrains Mono', 'Inter', monospace;
    font-size: 12px;
    font-weight: 600;
    color: #00BFFF;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    display: inline-block;
  }
  .cart-count-pop {
    animation: count-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* CTA buttons */
  .btn-primary-shop {
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, rgba(0,191,255,0.14) 0%, rgba(138,43,226,0.14) 100%);
    border: 1px solid rgba(0,191,255,0.38);
    transition: border-color 0.28s, box-shadow 0.28s, transform 0.22s;
    will-change: transform;
  }
  .btn-primary-shop::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(0,191,255,0.10) 0%, rgba(138,43,226,0.10) 100%);
    opacity: 0;
    transition: opacity 0.28s;
  }
  .btn-primary-shop:hover::before { opacity: 1; }
  .btn-primary-shop:hover {
    border-color: rgba(0,191,255,0.75);
    box-shadow: 0 0 28px rgba(0,191,255,0.4), 0 0 60px rgba(138,43,226,0.2);
    transform: translateY(-2px);
  }
  .btn-primary-shop:active { transform: translateY(0); }

  .btn-discord-shop {
    background: rgba(88,101,242,0.1);
    border: 1px solid rgba(88,101,242,0.28);
    transition: background 0.25s, border-color 0.25s, transform 0.2s;
  }
  .btn-discord-shop:hover {
    background: rgba(88,101,242,0.18);
    border-color: rgba(88,101,242,0.5);
    transform: translateY(-1px);
  }

  .btn-ghost-shop {
    border: 1px solid rgba(255,255,255,0.08);
    transition: border-color 0.25s, background 0.25s, transform 0.2s;
  }
  .btn-ghost-shop:hover {
    border-color: rgba(0,191,255,0.28);
    background: rgba(0,191,255,0.06);
    transform: translateY(-1px);
  }

  /* Trust stat chips */
  .trust-chip {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    transition: border-color 0.25s, background 0.25s, transform 0.2s;
  }
  .trust-chip:hover {
    background: rgba(0,191,255,0.05);
    border-color: rgba(0,191,255,0.18);
    transform: translateY(-2px);
  }

  /* Announcement widget */
  .ann-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    backdrop-filter: blur(12px);
    transition: border-color 0.28s, box-shadow 0.28s, transform 0.2s;
  }
  .ann-card:hover {
    border-color: rgba(0,191,255,0.22);
    box-shadow: 0 0 24px rgba(0,191,255,0.06);
    transform: translateY(-2px);
  }

  /* News update panel */
  .news-panel {
    background: linear-gradient(135deg, rgba(0,191,255,0.04) 0%, rgba(138,43,226,0.04) 100%);
    border: 1px solid rgba(0,191,255,0.12);
    border-left: 3px solid #00BFFF;
    backdrop-filter: blur(16px);
    transition: border-color 0.28s, box-shadow 0.28s, transform 0.2s;
  }
  .news-panel:hover {
    border-color: rgba(0,191,255,0.28);
    border-left-color: #00BFFF;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 24px rgba(0,191,255,0.08);
    transform: translateY(-2px);
  }

  /* Category tabs */
  .cat-tab {
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    transition: all 0.22s;
    white-space: nowrap;
  }
  .cat-tab:hover {
    border-color: rgba(0,191,255,0.3);
    background: rgba(0,191,255,0.06);
  }
  .cat-tab-active {
    background: rgba(0,191,255,0.12) !important;
    border-color: rgba(0,191,255,0.5) !important;
    box-shadow: 0 0 14px rgba(0,191,255,0.18);
  }

  /* Product cards */
  .p-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    transition: border-color 0.28s, box-shadow 0.28s, transform 0.25s;
    will-change: transform;
    position: relative;
    overflow: hidden;
  }
  .p-card:hover {
    border-color: rgba(0,191,255,0.22);
    box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 24px rgba(0,191,255,0.07);
    transform: translateY(-4px);
  }

  /* Product card image */
  .p-card-img {
    transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }
  .p-card:hover .p-card-img {
    transform: scale(1.05);
  }
  .p-card-hovered .p-card-img {
    transform: scale(1.05);
  }

  /* Description overlay */
  .desc-overlay {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    background: linear-gradient(to top, rgba(4,6,16,0.98) 0%, rgba(6,8,22,0.92) 60%, transparent 100%);
    backdrop-filter: blur(8px);
    padding: 48px 16px 72px;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.25s ease, transform 0.25s ease;
    pointer-events: none;
    z-index: 10;
  }
  .p-card-hovered .desc-overlay {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  /* Card buttons always above overlay */
  .p-card-actions {
    position: relative;
    z-index: 20;
  }

  /* Cart & Buy Now buttons */
  .btn-add-cart {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 12px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    font-family: 'Exo 2', 'Inter', sans-serif;
    border: 1px solid rgba(255,255,255,0.09);
    color: rgba(200,208,240,0.7);
    background: transparent;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
  }
  .btn-add-cart:hover:not(:disabled) {
    border-color: rgba(0,191,255,0.35);
    background: rgba(0,191,255,0.07);
    color: #c8d0f0;
  }
  .btn-add-cart:disabled { opacity: 0.3; cursor: not-allowed; }

  .btn-buy-now {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 12px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    font-family: 'Exo 2', 'Inter', sans-serif;
    border: 1px solid rgba(0,191,255,0.32);
    color: #e8eaf6;
    background: linear-gradient(135deg, rgba(0,191,255,0.14) 0%, rgba(138,43,226,0.14) 100%);
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
  }
  .btn-buy-now:hover:not(:disabled) {
    border-color: rgba(0,191,255,0.6);
    background: linear-gradient(135deg, rgba(0,191,255,0.22) 0%, rgba(138,43,226,0.22) 100%);
    box-shadow: 0 0 18px rgba(0,191,255,0.22);
  }
  .btn-buy-now:disabled { opacity: 0.3; cursor: not-allowed; }

  /* Nav cart button */
  .nav-cart-btn {
    position: relative;
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.04);
    transition: border-color 0.22s, background 0.22s;
  }
  .nav-cart-btn:hover {
    border-color: rgba(0,191,255,0.35);
    background: rgba(0,191,255,0.07);
  }

  /* Hero headline lines */
  .hero-line {
    display: block;
    animation: hero-line-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .hero-line-1 { animation-delay: 0.05s; }
  .hero-line-2 { animation-delay: 0.15s; }
  .hero-line-3 { animation-delay: 0.25s; }

  /* Center nav links */
  .nav-center-link {
    transition: all 0.2s;
  }
  .nav-center-link:hover {
    background: rgba(255,255,255,0.06) !important;
    color: #F5F7FF !important;
  }

  /* Mobile nav dropdown */
  .mobile-nav-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: rgba(6,8,18,0.97);
    backdrop-filter: blur(20px) saturate(1.4);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    padding: 8px 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 100;
  }

  /* Member identity pill */
  .member-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px 5px 6px;
    border-radius: 999px;
    cursor: pointer;
    border: none;
    transition: all 0.22s;
    position: relative;
    overflow: hidden;
  }
  .member-pill::before {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 0.22s;
    background: rgba(255,255,255,0.04);
  }
  .member-pill:hover::before { opacity: 1; }

  /* Member dropdown panel */
  .member-dropdown-panel {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    min-width: 240px;
    background: rgba(8,10,24,0.98);
    backdrop-filter: blur(24px);
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05);
    z-index: 9999;
    animation: modal-in 0.22s cubic-bezier(0.22,1,0.36,1) both;
  }
  .member-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: #98A2B8;
    width: 100%;
    text-align: left;
    transition: background 0.15s, color 0.15s;
    font-family: 'Inter', sans-serif;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .member-menu-item:hover {
    background: rgba(255,255,255,0.04);
    color: #F5F7FF;
  }

  /* Modal */
  .product-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(4,6,16,0.85);
    backdrop-filter: blur(12px);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .product-modal-box {
    background: #080B1A;
    border: 1px solid rgba(0,191,255,0.18);
    border-radius: 20px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.7), 0 0 60px rgba(0,191,255,0.08);
    width: 100%;
    max-width: 860px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: modal-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @media (min-width: 640px) {
    .product-modal-box {
      flex-direction: row;
      max-height: 80vh;
    }
  }
  .product-modal-img-col {
    width: 100%;
    min-height: 220px;
    max-height: 280px;
    flex-shrink: 0;
    overflow: hidden;
    position: relative;
    background: #0a0d1a;
  }
  @media (min-width: 640px) {
    .product-modal-img-col {
      width: 46%;
      max-height: none;
    }
  }
  .product-modal-info-col {
    flex: 1;
    overflow-y: auto;
    padding: 28px 24px 28px;
    scrollbar-width: thin;
    scrollbar-color: rgba(0,191,255,0.2) transparent;
  }
`;

const pageVariants = {
  enter:  (dir: number) => ({ opacity: 0, x: dir * 48 }),
  center: { opacity: 1, x: 0 },
  exit:   (dir: number) => ({ opacity: 0, x: dir * -48 }),
};

/* ── Background ─────────────────────────────────────────────────── */
function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Base */}
      <div className="absolute inset-0" style={{ background: '#060812' }} />
      {/* Gradient orbs */}
      <div className="orb-1 absolute rounded-full" style={{
        width: '70vw', height: '70vw',
        top: '-20vw', left: '-20vw',
        background: 'radial-gradient(ellipse at center, rgba(0,100,255,0.13) 0%, transparent 65%)',
        filter: 'blur(40px)',
      }} />
      <div className="orb-2 absolute rounded-full" style={{
        width: '60vw', height: '60vw',
        top: '-10vw', right: '-15vw',
        background: 'radial-gradient(ellipse at center, rgba(138,43,226,0.12) 0%, transparent 65%)',
        filter: 'blur(40px)',
      }} />
      <div className="orb-3 absolute rounded-full" style={{
        width: '50vw', height: '50vw',
        bottom: '-10vw', left: '25vw',
        background: 'radial-gradient(ellipse at center, rgba(0,60,180,0.09) 0%, transparent 65%)',
        filter: 'blur(40px)',
      }} />
      {/* Subtle noise grid */}
      <div className="absolute inset-0 opacity-[0.025]" style={{
        backgroundImage: 'linear-gradient(rgba(0,191,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,191,255,1) 1px, transparent 1px)',
        backgroundSize: '80px 80px',
      }} />
    </div>
  );
}

/* ── StockBadge ──────────────────────────────────────────────────── */
function StockBadge({ stock }: { stock: number }) {
  const out = stock === 0;
  const low = !out && stock < 5;
  const color = out ? '#FF4444' : low ? '#FF8C00' : '#00E676';
  const bg    = out ? 'rgba(255,68,68,0.1)'  : low ? 'rgba(255,140,0,0.1)'  : 'rgba(0,230,118,0.1)';
  const label = out ? 'OUT OF STOCK' : low ? `${stock} LEFT` : 'IN STOCK';
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-md text-[10px] font-bold tracking-widest uppercase"
      style={{ background: bg, color, border: `1px solid ${color}30` }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
      {label}
    </span>
  );
}

/* ── ProductDetailModal ──────────────────────────────────────────── */
function ProductDetailModal({
  product,
  onClose,
  cusTier,
  addToCart,
  navigate,
}: {
  product: Product;
  onClose: () => void;
  cusTier: CustomerTier;
  addToCart: (p: Product) => void;
  navigate: (path: string) => void;
}) {
  const soldOut = product.stock === 0;
  const displayPrice = tierPrice(product.price, product.vip_price, product.reseller_price, cusTier);
  const showDiscount = cusTier !== 'normal' && displayPrice !== product.price;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="product-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="product-modal-box">
        {/* Image column */}
        <div className="product-modal-img-col">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: soldOut ? 0.45 : 1 }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,191,255,0.025)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(0,191,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </div>
          )}
          <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
            <StockBadge stock={product.stock} />
          </div>
        </div>

        {/* Info column */}
        <div className="product-modal-info-col">
          {/* Close button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button
              onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(200,208,240,0.7)', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Product name */}
          <h2 style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 900, fontSize: 'clamp(18px, 4vw, 26px)', letterSpacing: '0.04em', color: '#F5F7FF', lineHeight: 1.1, marginBottom: '12px' }}>
            {product.name}
          </h2>

          {/* Description */}
          {product.description && (
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: '13px', lineHeight: '1.7', color: '#98A2B8', marginBottom: '20px' }}>
              {product.description}
            </p>
          )}

          {/* Prices */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#626C80', textTransform: 'uppercase' }}>Regular</span>
              <span style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '18px', fontWeight: 700, color: showDiscount ? '#626C80' : '#F5F7FF', textDecoration: showDiscount ? 'line-through' : 'none' }}>
                ₱{product.price}
              </span>
            </div>
            {product.vip_price && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,180,0,0.7)', textTransform: 'uppercase' }}>VIP</span>
                <span style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '16px', fontWeight: 600, color: cusTier === 'vip' ? '#F5B000' : 'rgba(255,180,0,0.55)' }}>
                  ₱{product.vip_price}
                </span>
              </div>
            )}
            {product.reseller_price && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(0,230,118,0.7)', textTransform: 'uppercase' }}>Reseller</span>
                <span style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '16px', fontWeight: 600, color: cusTier === 'reseller' ? '#00E676' : 'rgba(0,230,118,0.55)' }}>
                  ₱{product.reseller_price}
                </span>
              </div>
            )}
            {showDiscount && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: tierColor(cusTier), textTransform: 'uppercase' }}>{tierLabel(cusTier)} Price</span>
                <span style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '22px', fontWeight: 700, color: tierColor(cusTier) }}>
                  ₱{displayPrice}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-add-cart" disabled={soldOut} onClick={() => addToCart(product)} style={{ flex: 1 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Add to Cart
            </button>
            <button className="btn-buy-now" disabled={soldOut} onClick={() => { addToCart(product); navigate('/checkout'); }} style={{ flex: 1 }}>
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Navbar ─────────────────────────────────────────────────────── */
function Navbar({
  cartCount,
  cusUser,
  onNavigate,
}: {
  cartCount: number;
  cusUser: { email: string; tier: string } | null;
  onNavigate: (path: string) => void;
}) {
  const [prevCount, setPrevCount] = useState(cartCount);
  const [popping, setPopping] = useState(false);
  const isMember = cusUser?.tier === 'vip' || cusUser?.tier === 'reseller';

  useEffect(() => {
    if (cartCount !== prevCount) {
      setPopping(true);
      const t = setTimeout(() => setPopping(false), 320);
      setPrevCount(cartCount);
      return () => clearTimeout(t);
    }
  }, [cartCount]);

  return (
    <div className="shop-nav fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 sm:px-5 gap-3" style={{ overflow: 'visible' }}>
      {/* Brand */}
      <button onClick={() => onNavigate('/')} className="flex items-center select-none focus-visible:outline-none flex-shrink-0"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 900, fontSize: 17, letterSpacing: '0.1em', background: 'linear-gradient(90deg, #F5F7FF 0%, #00BFFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>SALE SHOP</span>
      </button>

      {/* Center nav — desktop only */}
      <div className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
        {[
          { label: 'Shop', path: '/stock' },
          { label: 'News', path: '/announcements' },
          { label: 'VIP', path: '/vip' },
          { label: 'Reseller', path: '/reseller' },
        ].map(link => (
          <button key={link.label} onClick={() => onNavigate(link.path)}
            className="nav-center-link px-3.5 py-1.5 rounded-lg text-xs select-none focus-visible:outline-none"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(200,208,240,0.4)', fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 600, letterSpacing: '0.08em' }}>
            {link.label}
          </button>
        ))}
        <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer"
          className="nav-center-link px-3.5 py-1.5 rounded-lg text-xs select-none inline-flex items-center gap-1.5"
          style={{ background: 'transparent', cursor: 'pointer', color: 'rgba(120,140,255,0.45)', fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 600, letterSpacing: '0.08em', textDecoration: 'none', border: 'none' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d={DISCORD_PATH} /></svg>
          Discord
        </a>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Cart */}
        {cartCount > 0 && (
          <button onClick={() => onNavigate('/cart')}
            className="nav-cart-btn relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full select-none focus-visible:outline-none"
            style={{ cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(0,191,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span className={`cart-count${popping ? ' cart-count-pop' : ''}`}>{cartCount}</span>
          </button>
        )}

        {/* Member pill — uses shared MemberDropdown */}
        {isMember && <MemberDropdown isReseller={cusUser!.tier === 'reseller'} />}

        {/* Not logged in or normal tier — single Sign In button */}
        {!isMember && (
          <button onClick={() => onNavigate('/vip')}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs select-none"
            style={{ color: '#00BFFF', background: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.25)', cursor: 'pointer', fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, letterSpacing: '0.08em', transition: 'all 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,191,255,0.14)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,191,255,0.45)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,191,255,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,191,255,0.25)'; }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            Sign In
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────── */
export default function ShopPage() {
  const { products, setProducts, upsertProduct, removeProduct, cartCount, addToCart, cartItems } = useStore();
  const announcements = useAnnouncements();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user: cusUser } = useCustomerAuth();
  const cusTier = cusUser?.tier ?? 'normal';
  const [page, setPage] = useState<'home' | 'stock'>(pathname === '/stock' ? 'stock' : 'home');
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    supabase.from('products').select('*').order('category')
      .then(({ data }) => { if (data) setProducts(data); setLoading(false); });

    const ch = supabase.channel('products-public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        if (payload.eventType === 'DELETE') removeProduct((payload.old as { id: string }).id);
        else upsertProduct(payload.new as Product);
      }).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (pathname === '/stock' && page !== 'stock') { setDir(1); setPage('stock'); }
    else if (pathname !== '/stock' && page !== 'home') { setDir(-1); setPage('home'); }
  }, [pathname]);

  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category ?? 'Other';
    return { ...acc, [cat]: [...(acc[cat] ?? []), p] };
  }, {});

  const categories = Object.keys(grouped);
  const filteredGrouped = selectedCategory && grouped[selectedCategory]
    ? { [selectedCategory]: grouped[selectedCategory] }
    : grouped;

  function goTo(target: 'home' | 'stock') {
    setDir(target === 'stock' ? 1 : -1);
    setPage(target);
    navigate(target === 'stock' ? '/stock' : '/');
    if (target === 'home') setSelectedCategory(null);
  }

  const latestAnnouncement = announcements[0] ?? null;
  const cartQty = cartCount();

  const totalInStock = products.filter(p => p.stock > 0).length;

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden" style={{ background: '#060812', fontFamily: "'Inter', sans-serif" }}>
      <style>{CSS}</style>
      <Background />

      <Navbar
        cartCount={cartQty}
        cusUser={cusUser}
        onNavigate={navigate}
      />

      {selectedProduct && (
        <ProductDetailModal
          key={selectedProduct.id}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          cusTier={cusTier}
          addToCart={addToCart}
          navigate={navigate}
        />
      )}

      <AnimatePresence mode="wait" custom={dir}>
        {page === 'home' ? (

          /* ════════════════ HOME ════════════════ */
          <motion.div
            key="home"
            custom={dir}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex flex-col items-center justify-center px-5 pt-14"
            style={{ minHeight: '100dvh' }}
          >
            <div className="flex flex-col items-center text-center w-full max-w-xl py-16">

              {/* Logo */}
              <motion.div
                className="logo-breathe relative mb-8 sm:mb-10"
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              >
                <ImageWithFallback
                  src={logoImage}
                  alt="Sale Shop"
                  className="relative z-10 h-auto object-contain"
                  style={{ width: 'min(440px, 82vw)' }}
                />
              </motion.div>

              {/* Hero Headline — horizontal chips row */}
              <motion.div
                className="mb-6 flex items-center justify-center gap-x-3 whitespace-nowrap w-full"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                {[
                  { text: 'DIGITAL PRODUCTS', color: '#F5F7FF', accent: false },
                  { text: 'INSTANT DELIVERY', color: '#00BFFF', accent: true },
                  { text: 'TRUSTED SERVICE', color: '#F5F7FF', accent: false },
                ].map((item, i) => (
                  <span key={item.text} className="inline-flex items-center gap-3">
                    {i > 0 && (
                      <span style={{ color: 'rgba(0,191,255,0.25)', fontSize: 'clamp(14px, 2.5vw, 20px)', lineHeight: 1 }}>·</span>
                    )}
                    <span style={{
                      fontFamily: "'Exo 2', 'Inter', sans-serif",
                      fontWeight: 900,
                      fontSize: 'clamp(13px, 2.8vw, 18px)',
                      letterSpacing: '0.12em',
                      color: item.color,
                      ...(item.accent ? {
                        background: 'linear-gradient(90deg, #00BFFF 0%, #8A2BE2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      } : {}),
                    }}>
                      {item.text}
                    </span>
                  </span>
                ))}
              </motion.div>

              {/* Tagline */}
              <motion.p
                className="text-[10px] sm:text-xs uppercase tracking-[0.3em] mb-10 w-full text-center"
                style={{ color: 'rgba(100,120,180,0.7)', letterSpacing: '0.28em' }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 }}
              >
                Automated&nbsp;·&nbsp;Secure&nbsp;·&nbsp;Fast
              </motion.p>

              {/* CTAs */}
              <motion.div
                className="flex flex-col items-center gap-3 w-full mb-10"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 }}
              >
                {/* Primary CTA */}
                <button
                  onClick={() => goTo('stock')}
                  className="btn-primary-shop inline-flex items-center gap-3 px-10 py-[14px] rounded-2xl select-none focus-visible:outline-none w-full sm:w-auto justify-center"
                  style={{ color: '#ffffff', cursor: 'pointer' }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(0,191,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                    <line x1="12" y1="12" x2="12" y2="16" /><line x1="10" y1="14" x2="14" y2="14" />
                  </svg>
                  <span style={{ fontFamily: "'Exo 2', 'Inter', sans-serif", fontWeight: 800, letterSpacing: '0.1em', fontSize: '1rem' }}>
                    BROWSE PRODUCTS
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,191,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>

                {/* Discord CTA */}
                <a
                  href={DISCORD_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-discord-shop inline-flex items-center gap-2 px-6 py-2.5 rounded-xl select-none focus-visible:outline-none"
                  style={{ color: '#7b92ff', textDecoration: 'none', cursor: 'pointer' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d={DISCORD_PATH} />
                  </svg>
                  <span style={{ fontFamily: "'Exo 2', 'Inter', sans-serif", fontWeight: 700, fontSize: '13px', letterSpacing: '0.06em' }}>
                    Join our Discord Server
                  </span>
                </a>
              </motion.div>

              {/* Trust stats — 3-per-row on desktop, stacked on mobile */}
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                {[
                  { icon: '⚡', label: 'Instant Delivery', sub: 'Automated fulfillment' },
                  { icon: '🛡️', label: 'Verified Stock', sub: `${totalInStock} products available` },
                  { icon: '💬', label: 'Discord Support', sub: 'Active community' },
                ].map((s) => (
                  <div key={s.label} className="trust-chip flex items-center gap-3 px-4 py-3 rounded-xl">
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{s.icon}</span>
                    <div className="text-left min-w-0">
                      <div style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, fontSize: '12px', color: '#F5F7FF', letterSpacing: '0.04em' }}>{s.label}</div>
                      <div style={{ fontSize: '10px', color: '#626C80', letterSpacing: '0.02em', marginTop: '1px' }}>{s.sub}</div>
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* Latest Announcement — NEWS UPDATE panel */}
              {latestAnnouncement && (
                <motion.div
                  className="w-full"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.65 }}
                >
                  {/* Panel label row */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: '#00BFFF', animation: 'pulse-dot 2s ease-in-out infinite', boxShadow: '0 0 6px #00BFFF' }}
                    />
                    <span style={{
                      fontFamily: "'Exo 2','Inter',sans-serif",
                      fontSize: '9px',
                      fontWeight: 800,
                      letterSpacing: '0.35em',
                      color: '#00BFFF',
                      textTransform: 'uppercase',
                    }}>
                      NEWS UPDATE
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(0,191,255,0.3), transparent)' }} />
                  </div>

                  {/* News panel card */}
                  <button
                    onClick={() => navigate('/announcements')}
                    className="news-panel w-full text-left rounded-2xl p-4 sm:p-5 focus-visible:outline-none"
                    style={{ cursor: 'pointer', display: 'block' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {(() => {
                          const cat = CATEGORY_STYLE[latestAnnouncement.category] ?? CATEGORY_STYLE['News'];
                          return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold tracking-widest uppercase mb-2.5"
                              style={{ background: cat.bg, color: cat.color }}>
                              {latestAnnouncement.category}
                            </span>
                          );
                        })()}
                        <h3 className="text-sm font-bold leading-snug mb-1.5 truncate"
                          style={{ color: '#F5F7FF', fontFamily: "'Exo 2','Inter',sans-serif", letterSpacing: '0.02em' }}>
                          {latestAnnouncement.title}
                        </h3>
                        <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: '#626C80' }}>
                          {latestAnnouncement.content.replace(/[#*\[\]()_`]/g, '').slice(0, 100)}
                        </p>
                        {latestAnnouncement.created_at && (
                          <p className="text-[10px] mt-2" style={{ color: 'rgba(80,100,160,0.55)' }}>
                            {format(new Date(latestAnnouncement.created_at), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-1 mt-0.5">
                        <div className="flex items-center gap-1" style={{ color: '#00BFFF' }}>
                          <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, fontSize: '11px', letterSpacing: '0.05em' }}>Read</span>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                          </svg>
                        </div>
                        <span style={{ fontSize: '9px', color: '#626C80', fontFamily: "'JetBrains Mono', monospace" }}>
                          VIEW ALL
                        </span>
                      </div>
                    </div>
                  </button>
                </motion.div>
              )}

            </div>
          </motion.div>

        ) : (

          /* ════════════════ STOCK ════════════════ */
          <motion.div
            key="stock"
            custom={dir}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex flex-col px-4 sm:px-8 pt-14 pb-20"
            style={{ minHeight: '100dvh' }}
          >
            <div className="w-full max-w-4xl mx-auto">

              {/* Page header */}
              <motion.div
                className="flex items-center gap-4 mt-7 mb-6"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
              >
                <button
                  onClick={() => goTo('home')}
                  className="btn-ghost-shop inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs select-none focus-visible:outline-none flex-shrink-0"
                  style={{ color: 'rgba(100,120,180,0.7)', background: 'transparent', cursor: 'pointer' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 600, letterSpacing: '0.06em' }}>Back</span>
                </button>

                <div className="h-4 w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

                <div>
                  <h1 style={{
                    fontFamily: "'Exo 2','Inter',sans-serif",
                    fontWeight: 900,
                    fontSize: 'clamp(18px, 4vw, 26px)',
                    letterSpacing: '0.08em',
                    color: '#F5F7FF',
                    lineHeight: 1,
                  }}>
                    INVENTORY
                  </h1>
                  <p style={{ fontSize: '10px', letterSpacing: '0.2em', color: '#626C80', textTransform: 'uppercase', marginTop: '3px' }}>
                    Real-time stock
                  </p>
                </div>

                <div style={{ flex: 1 }} />

                <div style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '11px', color: 'rgba(0,191,255,0.5)', letterSpacing: '0.04em' }}>
                  {products.length} items
                </div>
              </motion.div>

              {/* Divider */}
              <motion.div
                className="mb-5 h-px"
                style={{ background: 'linear-gradient(90deg, rgba(0,191,255,0.35), transparent)' }}
                initial={{ scaleX: 0, originX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.15, duration: 0.5 }}
              />

              {/* Category filter tabs */}
              {categories.length > 1 && (
                <motion.div
                  className="flex items-center gap-2 mb-6 overflow-x-auto pb-1"
                  style={{ scrollbarWidth: 'none' }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 }}
                >
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`cat-tab inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs flex-shrink-0 select-none focus-visible:outline-none ${!selectedCategory ? 'cat-tab-active' : ''}`}
                    style={{
                      color: !selectedCategory ? '#00BFFF' : '#626C80',
                      cursor: 'pointer',
                      fontFamily: "'Exo 2','Inter',sans-serif",
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                    }}
                  >
                    All
                    <span style={{
                      fontFamily: "'JetBrains Mono','Inter',monospace",
                      fontSize: '10px',
                      color: !selectedCategory ? 'rgba(0,191,255,0.7)' : '#626C80',
                    }}>
                      {products.length}
                    </span>
                  </button>
                  {categories.map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat] ?? { icon: '●', accent: '#00BFFF' };
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(active ? null : cat)}
                        className={`cat-tab inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs flex-shrink-0 select-none focus-visible:outline-none ${active ? 'cat-tab-active' : ''}`}
                        style={{
                          color: active ? '#00BFFF' : '#626C80',
                          cursor: 'pointer',
                          fontFamily: "'Exo 2','Inter',sans-serif",
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          borderColor: active ? `${cfg.accent}80` : undefined,
                        }}
                      >
                        <span style={{ fontSize: '11px' }}>{cfg.icon}</span>
                        {cat}
                        <span style={{
                          fontFamily: "'JetBrains Mono','Inter',monospace",
                          fontSize: '10px',
                          color: active ? `${cfg.accent}cc` : '#626C80',
                        }}>
                          {grouped[cat]?.length ?? 0}
                        </span>
                      </button>
                    );
                  })}
                </motion.div>
              )}

              {/* Products */}
              {loading ? (
                <div className="flex items-center justify-center py-24">
                  <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontSize: '11px', letterSpacing: '0.25em', color: '#626C80', textTransform: 'uppercase' }}>
                    Loading inventory…
                  </span>
                </div>
              ) : Object.keys(filteredGrouped).length === 0 ? (
                <div className="flex items-center justify-center py-24">
                  <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontSize: '11px', letterSpacing: '0.25em', color: '#626C80', textTransform: 'uppercase' }}>
                    No products available.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-10">
                  {Object.entries(filteredGrouped).map(([cat, items], ci) => {
                    const cfg = CATEGORY_CONFIG[cat] ?? { icon: '●', accent: '#00BFFF' };
                    return (
                      <motion.div
                        key={cat}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.22 + ci * 0.08 }}
                      >
                        {/* Category header */}
                        <div className="flex items-center gap-3 mb-4">
                          <span style={{ fontSize: '14px' }}>{cfg.icon}</span>
                          <span style={{
                            fontFamily: "'Exo 2','Inter',sans-serif",
                            fontWeight: 800,
                            fontSize: '11px',
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: cfg.accent,
                          }}>
                            {cat}
                          </span>
                          <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${cfg.accent}44, transparent)` }} />
                          <span style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '10px', color: '#626C80' }}>
                            {items.length}
                          </span>
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {items.map((item, ii) => {
                            const inCart = cartItems.find(c => c.product.id === item.id);
                            const soldOut = item.stock === 0;
                            const showDiscount = cusTier !== 'normal' &&
                              tierPrice(item.price, item.vip_price, item.reseller_price, cusTier) !== item.price;
                            const displayPrice = tierPrice(item.price, item.vip_price, item.reseller_price, cusTier);
                            const isHovered = hoveredId === item.id;

                            return (
                              <motion.div
                                key={item.id}
                                className={`p-card rounded-2xl overflow-hidden flex flex-col${isHovered ? ' p-card-hovered' : ''}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25 + ci * 0.06 + ii * 0.05 }}
                                onMouseEnter={() => setHoveredId(item.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                onTouchEnd={(e) => {
                                  // Only toggle on tap of card body, not buttons
                                  const target = e.target as HTMLElement;
                                  if (!target.closest('button')) {
                                    e.preventDefault();
                                    setHoveredId(prev => prev === item.id ? null : item.id);
                                  }
                                }}
                              >
                                {/* Image — clickable to open detail modal */}
                                <button
                                  className="w-full overflow-hidden flex-shrink-0 p-0"
                                  style={{ height: '160px', background: '#0a0d1a', border: 'none', cursor: 'pointer', display: 'block' }}
                                  onClick={() => { setSelectedProduct(null); setTimeout(() => setSelectedProduct(item), 0); }}
                                  title="View product details"
                                >
                                  {item.image_url ? (
                                    <img
                                      src={item.image_url}
                                      alt={item.name}
                                      className="p-card-img w-full h-full object-cover"
                                      style={{ opacity: soldOut ? 0.4 : 1 }}
                                    />
                                  ) : (
                                    <div className="p-card-img w-full h-full flex items-center justify-center" style={{ background: 'rgba(0,191,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(0,191,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                                      </svg>
                                    </div>
                                  )}
                                  {/* "View details" hint on hover */}
                                  <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, height: '160px',
                                    background: 'linear-gradient(to bottom, rgba(0,191,255,0.08) 0%, transparent 100%)',
                                    opacity: isHovered ? 1 : 0,
                                    transition: 'opacity 0.25s',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    justifyContent: 'flex-end',
                                    padding: '8px',
                                    pointerEvents: 'none',
                                  }}>
                                    <span style={{
                                      fontFamily: "'Exo 2','Inter',sans-serif",
                                      fontSize: '9px',
                                      fontWeight: 700,
                                      letterSpacing: '0.12em',
                                      color: 'rgba(0,191,255,0.8)',
                                      background: 'rgba(6,8,18,0.7)',
                                      border: '1px solid rgba(0,191,255,0.2)',
                                      borderRadius: '5px',
                                      padding: '3px 7px',
                                      textTransform: 'uppercase',
                                    }}>
                                      Details
                                    </span>
                                  </div>
                                </button>

                                {/* Body */}
                                <div className="flex flex-col flex-1 p-4 gap-3" style={{ position: 'relative' }}>

                                  {/* Name + Price */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <h3 className="font-bold leading-snug text-sm"
                                        style={{ color: '#F5F7FF', fontFamily: "'Exo 2','Inter',sans-serif", letterSpacing: '0.02em' }}>
                                        {item.name}
                                      </h3>
                                      {item.description && (
                                        <p className="text-[11px] mt-1 line-clamp-2 leading-relaxed" style={{ color: '#626C80' }}>
                                          {item.description}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                      {showDiscount ? (
                                        <>
                                          <div style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '11px', color: '#626C80', textDecoration: 'line-through' }}>₱{item.price}</div>
                                          <div style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '16px', fontWeight: 600, color: tierColor(cusTier) }}>
                                            ₱{displayPrice}
                                          </div>
                                          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: tierColor(cusTier), background: `${tierColor(cusTier)}18`, padding: '1px 5px', borderRadius: '4px', display: 'inline-block' }}>
                                            {tierLabel(cusTier)}
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <div style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '17px', fontWeight: 600, color: '#F5F7FF', lineHeight: 1 }}>
                                            ₱{item.price}
                                          </div>
                                          {item.vip_price && (
                                            <div style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '10px', color: 'rgba(255,180,0,0.55)', marginTop: '2px' }}>
                                              VIP ₱{item.vip_price}
                                            </div>
                                          )}
                                          {item.reseller_price && (
                                            <div style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '10px', color: 'rgba(0,230,118,0.55)', marginTop: '1px' }}>
                                              Reseller ₱{item.reseller_price}
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Stock + cart badge */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <StockBadge stock={item.stock} />
                                    {inCart && (
                                      <span style={{
                                        fontSize: '10px',
                                        fontFamily: "'JetBrains Mono','Inter',monospace",
                                        color: '#00BFFF',
                                        background: 'rgba(0,191,255,0.1)',
                                        border: '1px solid rgba(0,191,255,0.2)',
                                        padding: '2px 7px',
                                        borderRadius: '6px',
                                      }}>
                                        {inCart.quantity} in cart
                                      </span>
                                    )}
                                  </div>

                                  {/* Action buttons — always visible, z-index above overlay */}
                                  <div className="p-card-actions flex gap-2 mt-auto">
                                    <button className="btn-add-cart" disabled={soldOut} onClick={() => addToCart(item)}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                      </svg>
                                      Add to Cart
                                    </button>
                                    <button className="btn-buy-now" disabled={soldOut} onClick={() => { addToCart(item); navigate('/checkout'); }}>
                                      Buy Now
                                    </button>
                                  </div>

                                  {/* Description overlay — absolute, sits above body content but buttons stay on top via z-index */}
                                  {item.description && (
                                    <div className="desc-overlay">
                                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', lineHeight: '1.6', color: '#98A2B8', margin: 0 }}>
                                        {item.description}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>

        )}
      </AnimatePresence>
    </div>
  );
}
