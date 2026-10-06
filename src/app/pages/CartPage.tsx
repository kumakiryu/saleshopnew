import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { useStore } from '@/lib/store';
import { useCustomerAuth, tierPrice, tierLabel, tierColor } from '@/lib/customerAuth';
import logoImage from '@/imports/image-1.png';

const CSS = `
  .cart-qty-btn {
    width: 32px; height: 32px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 700; cursor: pointer;
    transition: all 0.18s;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    color: #98A2B8;
  }
  .cart-qty-btn:hover:not(:disabled) {
    background: rgba(0,191,255,0.1);
    border-color: rgba(0,191,255,0.3);
    color: #F5F7FF;
  }
  .cart-qty-btn:disabled { opacity: 0.25; cursor: not-allowed; }
  .cart-remove-btn {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; border-radius: 8px;
    border: 1px solid rgba(255,68,68,0.18);
    color: rgba(255,107,107,0.7);
    background: transparent; cursor: pointer;
    font-size: 11px; font-weight: 600;
    transition: all 0.18s;
  }
  .cart-remove-btn:hover {
    background: rgba(255,68,68,0.09);
    border-color: rgba(255,68,68,0.35);
    color: #FF6B6B;
  }
  .cart-item-card {
    background: rgba(11,16,32,0.6);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 20px;
    transition: border-color 0.2s;
  }
  .cart-item-card:hover { border-color: rgba(255,255,255,0.12); }
  .checkout-btn {
    background: linear-gradient(135deg, rgba(0,191,255,0.16) 0%, rgba(138,43,226,0.16) 100%);
    border: 1px solid rgba(0,191,255,0.38);
    color: #F5F7FF;
    transition: all 0.22s;
  }
  .checkout-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(0,191,255,0.26) 0%, rgba(138,43,226,0.26) 100%);
    border-color: rgba(0,191,255,0.65);
    box-shadow: 0 0 28px rgba(0,191,255,0.2);
    transform: translateY(-1px);
  }
  .checkout-btn:disabled { opacity: 0.4; cursor: not-allowed; }
`;

export default function CartPage() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateCartQty, clearCart, cartCount } = useStore();
  const { user: cusUser } = useCustomerAuth();

  useEffect(() => {
    if (cartItems.length === 0) return;
    let idle: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(idle);
      idle = setTimeout(() => clearCart(), 15 * 60 * 1000);
    };
    reset();
    const EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;
    EVENTS.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    return () => { clearTimeout(idle); EVENTS.forEach(ev => window.removeEventListener(ev, reset)); };
  }, [cartItems.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const cusTier = cusUser?.tier ?? 'normal';
  const tierTotal = cartItems.reduce((sum, ci) =>
    sum + tierPrice(ci.product.price, ci.product.vip_price ?? null, ci.product.reseller_price ?? null, cusTier) * ci.quantity, 0
  );
  const regularTotal = cartItems.reduce((sum, ci) => sum + ci.product.price * ci.quantity, 0);
  const savings = regularTotal - tierTotal;
  const count = cartCount();

  return (
    <div className="min-h-screen" style={{ background: '#060812', fontFamily: "'Inter', sans-serif" }}>
      <style>{CSS}</style>

      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute rounded-full" style={{ width: '60vw', height: '60vw', top: '-15vw', left: '-15vw', background: 'radial-gradient(ellipse, rgba(0,100,255,0.09) 0%, transparent 65%)', filter: 'blur(40px)' }} />
        <div className="absolute rounded-full" style={{ width: '50vw', height: '50vw', top: '-10vw', right: '-10vw', background: 'radial-gradient(ellipse, rgba(138,43,226,0.07) 0%, transparent 65%)', filter: 'blur(40px)' }} />
      </div>

      {/* Navbar strip */}
      <div className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-5 gap-4" style={{ background: 'rgba(6,8,18,0.75)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => navigate('/stock')} className="inline-flex items-center gap-2" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: '0.1em', background: 'linear-gradient(90deg, #F5F7FF 0%, #00BFFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>SALE SHOP</span>
        </button>
        <div style={{ flex: 1 }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-24">

        {/* Header */}
        <motion.div className="mb-8" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-end justify-between mb-2">
            <div>
              <h1 style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 900, fontSize: 'clamp(24px, 5vw, 36px)', letterSpacing: '0.06em', color: '#F5F7FF', lineHeight: 1 }}>
                YOUR CART
              </h1>
              <p style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '12px', color: '#626C80', letterSpacing: '0.08em', marginTop: '4px' }}>
                {count} item{count !== 1 ? 's' : ''}
              </p>
            </div>
            {cartItems.length > 0 && (
              <button onClick={clearCart} className="cart-remove-btn" style={{ border: '1px solid rgba(255,68,68,0.15)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                Clear all
              </button>
            )}
          </div>
          <div className="h-px mt-4" style={{ background: 'linear-gradient(90deg, rgba(0,191,255,0.4), transparent)' }} />
        </motion.div>

        {cartItems.length === 0 ? (
          /* Empty state */
          <motion.div
            className="flex flex-col items-center justify-center py-32 gap-5"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,191,255,0.05)', border: '1px solid rgba(0,191,255,0.12)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(0,191,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </div>
            <div className="text-center">
              <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, fontSize: '16px', color: '#F5F7FF', marginBottom: '6px' }}>Your cart is empty</p>
              <p style={{ fontSize: '13px', color: '#626C80' }}>Add products from the inventory to get started.</p>
            </div>
            <button onClick={() => navigate('/stock')}
              className="checkout-btn inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold"
              style={{ fontFamily: "'Exo 2','Inter',sans-serif", letterSpacing: '0.06em', cursor: 'pointer' }}>
              Browse Inventory
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Left — Cart items */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {cartItems.map((item, i) => {
                  const linePrice = tierPrice(item.product.price, item.product.vip_price ?? null, item.product.reseller_price ?? null, cusTier);
                  const lineTotal = linePrice * item.quantity;
                  const isDiscounted = cusTier !== 'normal' && linePrice !== item.product.price;
                  return (
                    <motion.div
                      key={item.product.id}
                      className="cart-item-card p-4 flex gap-4 items-start"
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -30, scale: 0.96 }}
                      transition={{ delay: 0.05 + i * 0.04, exit: { duration: 0.18 } }}
                    >
                      {/* Image */}
                      <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 64, height: 64, background: 'rgba(0,191,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        {item.product.image_url
                          ? <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(0,191,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                              </svg>
                            </div>
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, fontSize: '14px', color: '#F5F7FF', lineHeight: '1.2' }}>{item.product.name}</p>
                            {item.product.category && (
                              <p style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#626C80', textTransform: 'uppercase', marginTop: '2px' }}>{item.product.category}</p>
                            )}
                          </div>
                          <button className="cart-remove-btn flex-shrink-0" onClick={() => removeFromCart(item.product.id)}>
                            Remove
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          {/* Qty controls */}
                          <div className="flex items-center gap-2">
                            <button className="cart-qty-btn" onClick={() => updateCartQty(item.product.id, item.quantity - 1)} disabled={item.quantity <= 1}>−</button>
                            <span style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '14px', fontWeight: 600, color: '#F5F7FF', minWidth: '28px', textAlign: 'center' }}>{item.quantity}</span>
                            <button className="cart-qty-btn" onClick={() => updateCartQty(item.product.id, item.quantity + 1)} disabled={item.quantity >= item.product.stock}>+</button>
                          </div>

                          {/* Line total */}
                          <div className="text-right">
                            {isDiscounted && (
                              <p style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '11px', color: '#626C80', textDecoration: 'line-through' }}>
                                ₱{(item.product.price * item.quantity).toLocaleString()}
                              </p>
                            )}
                            <p style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '15px', fontWeight: 600, color: isDiscounted ? (tierColor(cusTier) || '#F5F7FF') : '#F5F7FF' }}>
                              ₱{lineTotal.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Right — Order summary */}
            <motion.div
              className="lg:col-span-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
            >
              <div className="sticky top-20 rounded-2xl overflow-hidden" style={{ background: 'rgba(11,16,32,0.7)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
                {/* Header */}
                <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, fontSize: '11px', letterSpacing: '0.15em', color: '#00BFFF', textTransform: 'uppercase' }}>Order Summary</p>
                </div>

                {/* Tier badge */}
                {cusTier !== 'normal' && (
                  <div className="mx-4 mt-4 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2" style={{
                    background: cusTier === 'vip' ? 'rgba(245,176,0,0.08)' : 'rgba(0,230,118,0.08)',
                    border: `1px solid ${cusTier === 'vip' ? 'rgba(245,176,0,0.2)' : 'rgba(0,230,118,0.2)'}`,
                    color: cusTier === 'vip' ? '#F5B000' : '#00E676',
                  }}>
                    {cusTier === 'vip' ? '★' : '◆'} {tierLabel(cusTier)} pricing active
                  </div>
                )}

                {/* Items */}
                <div className="px-5 py-4 flex flex-col gap-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {cartItems.map(ci => {
                    const p = tierPrice(ci.product.price, ci.product.vip_price ?? null, ci.product.reseller_price ?? null, cusTier);
                    return (
                      <div key={ci.product.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p style={{ fontSize: '12px', color: '#98A2B8', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ci.product.name}</p>
                          <p style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '10px', color: '#626C80' }}>×{ci.quantity}</p>
                        </div>
                        <p style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '13px', fontWeight: 600, color: '#F5F7FF', flexShrink: 0 }}>₱{(p * ci.quantity).toLocaleString()}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="px-5 py-4 flex flex-col gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {savings > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: '12px', color: '#626C80' }}>Subtotal</span>
                      <span style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '12px', color: '#626C80', textDecoration: 'line-through' }}>₱{regularTotal.toLocaleString()}</span>
                    </div>
                  )}
                  {savings > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: '12px', color: cusTier === 'vip' ? '#F5B000' : '#00E676' }}>Member discount</span>
                      <span style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '12px', fontWeight: 600, color: cusTier === 'vip' ? '#F5B000' : '#00E676' }}>−₱{savings.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="px-5 py-4 flex items-center justify-between">
                  <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, fontSize: '13px', color: '#98A2B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total</span>
                  <span style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '22px', fontWeight: 600, color: '#F5F7FF' }}>₱{tierTotal.toLocaleString()}</span>
                </div>

                <div className="px-4 pb-4">
                  <button
                    onClick={() => navigate('/checkout')}
                    className="checkout-btn w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    style={{ fontFamily: "'Exo 2','Inter',sans-serif", letterSpacing: '0.08em', cursor: 'pointer' }}
                  >
                    Proceed to Checkout
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </button>
                  <p style={{ fontSize: '10px', color: '#626C80', textAlign: 'center', marginTop: '10px' }}>Payment details provided after checkout</p>
                </div>
              </div>
            </motion.div>

          </div>
        )}
      </div>
    </div>
  );
}
