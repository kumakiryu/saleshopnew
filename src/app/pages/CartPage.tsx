import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { useStore } from '@/lib/store';
import { useCustomerAuth, tierPrice, tierLabel, tierColor } from '@/lib/customerAuth';

const CSS = `
  .cart-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e8eaf6; outline: none; transition: border-color 0.2s; }
  .cart-input:focus { border-color: rgba(0,191,255,0.4); }
  .qty-btn { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #7b88c0; }
  .qty-btn:hover { background: rgba(0,191,255,0.1); border-color: rgba(0,191,255,0.3); color: #c8d0f0; }
  .qty-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .remove-btn { font-size: 11px; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(255,68,68,0.2); color: #FF6B6B; background: transparent; cursor: pointer; transition: all 0.2s; }
  .remove-btn:hover { background: rgba(255,68,68,0.1); border-color: rgba(255,68,68,0.4); }
`;

export default function CartPage() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateCartQty, clearCart, cartCount } = useStore();
  const { user: cusUser } = useCustomerAuth();
  const cusTier = cusUser?.tier ?? 'normal';
  const tierTotal = cartItems.reduce((sum, ci) =>
    sum + tierPrice(ci.product.price, ci.product.vip_price ?? null, ci.product.reseller_price ?? null, cusTier) * ci.quantity, 0
  );

  return (
    <div className="min-h-screen" style={{ background: '#050816', fontFamily: "'Inter', sans-serif" }}>
      <style>{CSS}</style>
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0" style={{
        background: 'radial-gradient(ellipse 70% 50% at 50% 20%, rgba(0,100,255,0.1) 0%, transparent 60%)',
      }} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-12 pb-24">

        {/* Back */}
        <motion.button onClick={() => navigate('/stock')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm mb-8 select-none"
          style={{ color: '#7b88c0', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.2s' }}
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,191,255,0.3)'; (e.currentTarget as HTMLElement).style.color = '#c8d0f0'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = '#7b88c0'; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span style={{ fontFamily: "'Rajdhani','Inter',sans-serif", fontWeight: 600 }}>Back to Stock</span>
        </motion.button>

        {/* Header */}
        <motion.div className="mb-8" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif", letterSpacing: '0.05em' }}>
            YOUR CART
          </h1>
          <p className="text-xs uppercase tracking-[0.25em]" style={{ color: '#3a4570' }}>{cartCount()} item{cartCount() !== 1 ? 's' : ''}</p>
          <div className="mt-4 h-px" style={{ background: 'linear-gradient(90deg, rgba(0,191,255,0.4), transparent)' }} />
        </motion.div>

        {cartItems.length === 0 ? (
          <motion.div className="flex flex-col items-center justify-center py-24 gap-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(0,191,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <p className="text-xs uppercase tracking-widest" style={{ color: '#2e3a5a' }}>Your cart is empty</p>
            <button onClick={() => navigate('/stock')}
              className="mt-2 px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.25)', color: '#00BFFF', fontFamily: "'Rajdhani','Inter',sans-serif", cursor: 'pointer' }}>
              Browse Stock
            </button>
          </motion.div>
        ) : (
          <>
            {/* Items */}
            <div className="flex flex-col gap-3 mb-6">
              {cartItems.map((item, i) => (
                <motion.div key={item.product.id}
                  className="rounded-2xl p-4 flex gap-4 items-start"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>

                  {/* Image or placeholder */}
                  <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
                    style={{ background: 'rgba(0,191,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {item.product.image_url
                      ? <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(0,191,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                        </svg>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>{item.product.name}</p>
                        {item.product.category && <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: '#3a4570' }}>{item.product.category}</p>}
                      </div>
                      <button className="remove-btn" onClick={() => removeFromCart(item.product.id)}>Remove</button>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      {/* Qty controls */}
                      <div className="flex items-center gap-2">
                        <button className="qty-btn" onClick={() => updateCartQty(item.product.id, item.quantity - 1)} disabled={item.quantity <= 1}>−</button>
                        <span className="w-8 text-center text-sm font-bold tabular-nums" style={{ color: '#e8eaf6', fontFamily: "'Rajdhani','Inter',sans-serif" }}>{item.quantity}</span>
                        <button className="qty-btn" onClick={() => updateCartQty(item.product.id, item.quantity + 1)} disabled={item.quantity >= item.product.stock}>+</button>
                      </div>
                      {/* Line total */}
                      <div className="text-right">
                        {cusTier !== 'normal' && tierPrice(item.product.price, item.product.vip_price ?? null, item.product.reseller_price ?? null, cusTier) !== item.product.price && (
                          <p className="text-[10px] line-through" style={{ color: '#3a4570' }}>₱{(item.product.price * item.quantity).toLocaleString()}</p>
                        )}
                        <span className="text-sm font-bold" style={{ color: cusTier !== 'normal' ? tierColor(cusTier) || '#ffffff' : '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>
                          ₱{(tierPrice(item.product.price, item.product.vip_price ?? null, item.product.reseller_price ?? null, cusTier) * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Summary */}
            <motion.div className="rounded-2xl p-5 mb-5"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest" style={{ color: '#3a4570' }}>Subtotal</span>
                  {cusTier !== 'normal' && tierLabel(cusTier) && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider"
                      style={{ background: `${tierColor(cusTier)}22`, color: tierColor(cusTier), border: `1px solid ${tierColor(cusTier)}44` }}>
                      {tierLabel(cusTier)}
                    </span>
                  )}
                </div>
                <span className="text-xl font-bold" style={{ color: cusTier !== 'normal' ? tierColor(cusTier) || '#ffffff' : '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>
                  ₱{tierTotal.toLocaleString()}
                </span>
              </div>
              <p className="text-[10px]" style={{ color: '#2e3a5a' }}>Payment instructions will be provided after checkout.</p>
            </motion.div>

            {/* Actions */}
            <motion.div className="flex gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
              <button onClick={clearCart}
                className="px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider"
                style={{ background: 'transparent', border: '1px solid rgba(255,68,68,0.2)', color: '#FF6B6B', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,68,68,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                Clear Cart
              </button>
              <button onClick={() => navigate('/checkout')}
                className="flex-1 py-3 rounded-xl text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,191,255,0.18) 0%, rgba(138,43,226,0.18) 100%)',
                  border: '1px solid rgba(0,191,255,0.4)',
                  color: '#ffffff',
                  fontFamily: "'Rajdhani','Inter',sans-serif",
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(0,191,255,0.1)',
                  transition: 'all 0.2s',
                }}>
                Proceed to Checkout →
              </button>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
