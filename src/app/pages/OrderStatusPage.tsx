import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderStatus } from '@/lib/types';

const DISCORD_URL = 'https://discord.gg/2n5UZj56Nk';

function QRImage() {
  const [ok, setOk] = useState(true);
  if (!ok) return (
    <div className="flex flex-col items-center gap-3" style={{ width: 200, height: 200, justifyContent: 'center' }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
        <rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="7" height="2"/>
      </svg>
      <p className="text-[10px] text-center leading-relaxed" style={{ color: '#3a4570', maxWidth: 160 }}>
        QR not set up yet.{' '}
        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#7b8ce8' }}>Contact us on Discord</a>
        {' '}for payment details.
      </p>
    </div>
  );
  return (
    <img
      src="/pay-qr.png"
      alt="Payment QR Code"
      className="rounded-xl"
      style={{ width: 200, height: 200, objectFit: 'contain', background: '#fff', padding: 8 }}
      onError={() => setOk(false)}
    />
  );
}

const STATUS_STEPS: { key: OrderStatus; label: string; desc: string }[] = [
  { key: 'pending',    label: 'Pending',    desc: 'Order received, awaiting payment' },
  { key: 'processing', label: 'Processing', desc: 'Payment received, verifying' },
  { key: 'paid',       label: 'Paid',       desc: 'Payment confirmed' },
  { key: 'delivering', label: 'Delivering', desc: 'Sending your products' },
  { key: 'delivered',  label: 'Delivered',  desc: 'Products delivered to your email' },
];

const STATUS_ORDER: OrderStatus[] = ['pending', 'processing', 'paid', 'delivering', 'delivered'];

function stepIndex(status: OrderStatus) {
  const i = STATUS_ORDER.indexOf(status);
  return i === -1 ? 0 : i;
}

const STATUS_COLOR: Record<string, string> = {
  pending:    '#FF8C00',
  processing: '#00BFFF',
  paid:       '#8A2BE2',
  delivering: '#00BFFF',
  delivered:  '#00E676',
  failed:     '#FF4444',
  cancelled:  '#FF4444',
};

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentResult = searchParams.get('payment'); // 'success' | 'cancelled' | null
  const [order, setOrder]   = useState<Order | null>(null);
  const [items, setItems]   = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);

  // Load stored PayMongo URL from checkout page
  useEffect(() => {
    if (!id) return;
    const stored = localStorage.getItem(`pm_url_${id}`);
    if (stored) setPaymentUrl(stored);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let currentStatus = '';

    async function fetchStatus() {
      const [{ data: o, error: oErr }, { data: oi }] = await Promise.all([
        supabase.from('orders').select('*').eq('id', id).single(),
        supabase.from('order_items').select('*').eq('order_id', id),
      ]);
      if (oErr || !o) { setError('Order not found.'); setLoading(false); return; }
      setOrder(o as Order);
      setItems((oi ?? []) as OrderItem[]);
      setLoading(false);
      currentStatus = o.status;
      if (o.status !== 'pending') {
        localStorage.removeItem(`pm_url_${id}`);
        setPaymentUrl(null);
        setShowPayModal(false);
      }
    }

    fetchStatus();
    // Poll every 3s so status update after payment appears quickly
    const poll = setInterval(() => {
      if (currentStatus === 'delivered' || currentStatus === 'failed' || currentStatus === 'cancelled') {
        clearInterval(poll);
        return;
      }
      fetchStatus();
    }, 3_000);

    return () => clearInterval(poll);
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#050816' }}>
      <span className="text-xs uppercase tracking-widest" style={{ color: '#3a4570' }}>Loading order...</span>
    </div>
  );

  if (error || !order) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#050816' }}>
      <p className="text-xs uppercase tracking-widest" style={{ color: '#FF6B6B' }}>{error || 'Order not found'}</p>
      <button onClick={() => navigate('/')} style={{ color: '#3a4570', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Go Home</button>
    </div>
  );

  const currentStep = stepIndex(order.status);
  const isFailed    = order.status === 'failed' || order.status === 'cancelled';
  const isWaiting   = order.status === 'waiting_for_inventory';
  const isDelivered = order.status === 'delivered';
  const color       = STATUS_COLOR[order.status] ?? '#00BFFF';

  return (
    <>
    <div className="min-h-screen" style={{ background: '#050816', fontFamily: "'Inter', sans-serif" }}>
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0" style={{
        background: `radial-gradient(ellipse 60% 40% at 50% 20%, ${color}18 0%, transparent 60%)`,
        transition: 'all 1s ease',
      }} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-12 pb-24">

        {/* Back */}
        <motion.button onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm mb-8"
          style={{ color: '#7b88c0', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span style={{ fontFamily: "'Rajdhani','Inter',sans-serif", fontWeight: 600 }}>Home</span>
        </motion.button>

        {/* Header */}
        <motion.div className="mb-8" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif", letterSpacing: '0.05em' }}>
              ORDER STATUS
            </h1>
            <span className="text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-widest"
              style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}>
              {order.status}
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: '#3a4570' }}>
            {order.id.slice(0, 8).toUpperCase()} · {format(new Date(order.created_at), 'MMMM d, yyyy')}
          </p>
          <div className="mt-4 h-px" style={{ background: `linear-gradient(90deg, ${color}60, transparent)`, transition: 'all 1s' }} />
        </motion.div>

        {/* Progress steps */}
        {!isFailed && (
          <motion.div className="mb-8 rounded-2xl p-5"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex items-start">
              {STATUS_STEPS.map((step, i) => {
                const done    = i < currentStep;
                const active  = i === currentStep;
                const pending = i > currentStep;
                const stepColor = active ? color : done ? '#00E676' : '#2e3a5a';
                return (
                  <div key={step.key} className="flex-1 flex flex-col items-center relative">
                    {/* Connector line */}
                    {i > 0 && (
                      <div className="absolute top-3 right-1/2 w-full h-px"
                        style={{ background: done ? '#00E67644' : 'rgba(255,255,255,0.06)', transition: 'all 0.5s' }} />
                    )}
                    {/* Dot */}
                    <div className="relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: done ? 'rgba(0,230,118,0.15)' : active ? `${color}20` : 'rgba(255,255,255,0.04)',
                        border: `1.5px solid ${stepColor}`,
                        transition: 'all 0.5s',
                      }}>
                      {done
                        ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        : active
                          ? <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                          : null}
                    </div>
                    {/* Label */}
                    <p className="text-[9px] font-bold uppercase tracking-wider mt-2 text-center"
                      style={{ color: pending ? '#2e3a5a' : stepColor, transition: 'all 0.5s' }}>
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Current step description */}
            <div className="mt-5 pt-4 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-xs" style={{ color: '#7b88c0' }}>
                {isFailed ? 'Order was cancelled or failed.' : isWaiting ? 'Awaiting inventory restock. We will deliver as soon as stock is available.' : STATUS_STEPS[Math.min(currentStep, STATUS_STEPS.length - 1)]?.desc}
              </p>
              {!isDelivered && !isFailed && (
                <p className="text-[10px] mt-1" style={{ color: '#2e3a5a' }}>This page updates automatically.</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Order details */}
        <motion.div className="rounded-2xl overflow-hidden mb-5"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>

          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#00BFFF' }}>Order Details</p>
          </div>

          <div className="px-5 py-4 flex flex-col gap-4">
            {/* Customer */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#2e3a5a' }}>Name</p>
                <p style={{ color: '#c8d0f0' }}>{order.customer_name}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#2e3a5a' }}>Email</p>
                <p style={{ color: '#c8d0f0' }}>{order.customer_email}</p>
              </div>
              {order.customer_discord && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#2e3a5a' }}>Discord</p>
                  <p style={{ color: '#c8d0f0' }}>{order.customer_discord}</p>
                </div>
              )}
            </div>

            {/* Items */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
              <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: '#2e3a5a' }}>Items</p>
              <div className="flex flex-col gap-2">
                {items.map(i => (
                  <div key={i.id} className="flex items-center justify-between text-xs">
                    <span style={{ color: '#7b88c0' }}>{i.product_name} ×{i.quantity}</span>
                    <span className="font-bold" style={{ color: '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>₱{(i.price * i.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-xs uppercase tracking-widest" style={{ color: '#3a4570' }}>Total Paid</span>
              <span className="text-lg font-bold" style={{ color: '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif" }}>₱{Number(order.total).toLocaleString()}</span>
            </div>
          </div>
        </motion.div>

        {/* Payment instructions — Coins.ph / GCash / InstaPay */}
        {order.status === 'pending' && order.payment_method === 'coinsph' && (
          <motion.div className="rounded-2xl overflow-hidden mb-5"
            style={{ background: 'rgba(0,200,150,0.04)', border: '1px solid rgba(0,200,150,0.25)' }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(0,200,150,0.15)' }}>
              <div className="flex items-center gap-2.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C896" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                <p className="text-sm font-bold" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>
                  Pay With GCash, Maya, or Bank
                </p>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded font-bold uppercase tracking-widest"
                style={{ background: 'rgba(255,140,0,0.15)', color: '#FF8C00', border: '1px solid rgba(255,140,0,0.3)' }}>
                PENDING
              </span>
            </div>

            <div className="px-5 py-4 flex flex-col gap-4">
              <p className="text-xs leading-relaxed" style={{ color: '#7b88c0' }}>
                Scan the QR code with GCash, Maya, or any bank app, then send the{' '}
                <strong style={{ color: '#ffffff' }}>exact amount below, centavos included.</strong>
              </p>

              {/* Amount */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#3a4570' }}>Amount to Send</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold" style={{ color: '#ffffff', fontFamily: "'Rajdhani','Inter',sans-serif", letterSpacing: '0.04em' }}>
                    ₱{Number(order.total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                  <button onClick={() => navigator.clipboard.writeText(Number(order.total).toFixed(2))}
                    className="text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-wide"
                    style={{ background: 'rgba(0,200,150,0.12)', color: '#00C896', border: '1px solid rgba(0,200,150,0.3)', cursor: 'pointer' }}>
                    Copy
                  </button>
                </div>
              </div>

              {/* QR Code */}
              <div className="rounded-xl overflow-hidden flex flex-col items-center py-6 gap-4"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <QRImage />
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#3a4570' }}>Paying</p>
                  <p className="text-sm font-bold" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>
                    {import.meta.env.VITE_COINSPH_NAME ?? 'Sale Shop'}
                  </p>
                </div>
              </div>

              {/* Order ID reference */}
              <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'rgba(0,191,255,0.05)', border: '1px solid rgba(0,191,255,0.2)' }}>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: '#3a4570' }}>Put this as your Reference / Message</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-base tracking-widest" style={{ color: '#00BFFF' }}>
                    {order.id.slice(0, 8).toUpperCase()}
                  </span>
                  <button onClick={() => navigator.clipboard.writeText(order.id.slice(0, 8).toUpperCase())}
                    className="text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-wide"
                    style={{ background: 'rgba(0,191,255,0.1)', color: '#00BFFF', border: '1px solid rgba(0,191,255,0.25)', cursor: 'pointer' }}>
                    Copy
                  </button>
                </div>
              </div>

              <p className="text-[10px] leading-relaxed" style={{ color: '#3a4570' }}>
                Sending a different amount can delay your order, because the amount is how your payment is matched to it. Confirmation is not instant.
              </p>

              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold w-fit"
                style={{ background: 'rgba(88,101,242,0.15)', border: '1px solid rgba(88,101,242,0.3)', color: '#7b8ce8', textDecoration: 'none', fontFamily: "'Rajdhani','Inter',sans-serif" }}>
                Message us on Discord →
              </a>
            </div>
          </motion.div>
        )}

        {/* Payment received — verifying (after PayMongo/Coinbase redirect back) */}
        {order.status === 'pending' && order.payment_method !== 'coinsph' && paymentResult === 'success' && (
          <motion.div className="rounded-2xl p-5 mb-5"
            style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.25)' }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00E676' }} />
              <p className="text-xs font-bold" style={{ color: '#00E676' }}>Payment Received</p>
            </div>
            <p className="text-xs leading-relaxed mb-1" style={{ color: '#7b88c0' }}>
              Your payment was submitted successfully. We are verifying it now — your products will be delivered shortly.
            </p>
            <p className="text-[10px]" style={{ color: '#3a4570' }}>This page updates automatically every few seconds.</p>
          </motion.div>
        )}

        {/* Payment cancelled */}
        {paymentResult === 'cancelled' && order.status === 'pending' && (
          <motion.div className="rounded-2xl p-5 mb-5"
            style={{ background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.2)' }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <p className="text-xs font-bold mb-2" style={{ color: '#FF4444' }}>Payment Cancelled</p>
            <p className="text-xs leading-relaxed mb-3" style={{ color: '#7b88c0' }}>
              Your payment was not completed. Your order is still open — contact us on Discord if you need help or want to try again.
            </p>
            <div className="flex items-center gap-2 p-2.5 rounded-lg mb-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-[10px] uppercase tracking-widest" style={{ color: '#3a4570' }}>Order ID</span>
              <span className="text-xs font-mono font-bold flex-1" style={{ color: '#c8d0f0' }}>{order.id}</span>
              <button onClick={() => navigator.clipboard.writeText(order.id)}
                className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(0,191,255,0.08)', color: '#00BFFF', border: '1px solid rgba(0,191,255,0.2)', cursor: 'pointer' }}>
                Copy
              </button>
            </div>
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(88,101,242,0.15)', border: '1px solid rgba(88,101,242,0.3)', color: '#7b8ce8', textDecoration: 'none', fontFamily: "'Rajdhani','Inter',sans-serif" }}>
              Contact on Discord →
            </a>
          </motion.div>
        )}

        {/* Pay Now — opens PayMongo in a modal overlay */}
        {order.status === 'pending' && order.payment_method !== 'coinsph' && paymentUrl && !paymentResult && (
          <motion.div className="rounded-2xl overflow-hidden mb-5"
            style={{ background: 'rgba(0,191,255,0.05)', border: '1px solid rgba(0,191,255,0.25)' }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(0,191,255,0.1)' }}>
              <p className="text-sm font-bold" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>Complete Your Payment</p>
              <p className="text-[10px] mt-0.5" style={{ color: '#3a4570' }}>Pay securely without leaving this page. Your order updates automatically once payment is confirmed.</p>
            </div>
            <div className="px-5 py-4">
              <button
                onClick={() => setShowPayModal(true)}
                className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, rgba(0,191,255,0.18), rgba(0,191,255,0.08))', border: '1px solid rgba(0,191,255,0.45)', color: '#00BFFF', cursor: 'pointer', fontFamily: "'Rajdhani','Inter',sans-serif", letterSpacing: '0.06em' }}>
                Pay Now
              </button>
            </div>
          </motion.div>
        )}

        {/* Fallback — no URL (e.g. old orders or direct navigation) */}
        {order.status === 'pending' && order.payment_method !== 'coinsph' && !paymentUrl && !paymentResult && (
          <motion.div className="rounded-2xl p-5 mb-5"
            style={{ background: 'rgba(255,140,0,0.06)', border: '1px solid rgba(255,140,0,0.2)' }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <p className="text-xs font-bold mb-2" style={{ color: '#FF8C00' }}>Awaiting Payment</p>
            <p className="text-xs leading-relaxed mb-3" style={{ color: '#7b88c0' }}>
              Please complete payment via your selected payment provider. Contact us on Discord with your Order ID if you need help.
            </p>
            <div className="flex items-center gap-2 p-2.5 rounded-lg mb-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-[10px] uppercase tracking-widest" style={{ color: '#3a4570' }}>Order ID</span>
              <span className="text-xs font-mono font-bold flex-1" style={{ color: '#c8d0f0' }}>{order.id}</span>
              <button onClick={() => navigator.clipboard.writeText(order.id)}
                className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(0,191,255,0.08)', color: '#00BFFF', border: '1px solid rgba(0,191,255,0.2)', cursor: 'pointer' }}>
                Copy
              </button>
            </div>
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(88,101,242,0.15)', border: '1px solid rgba(88,101,242,0.3)', color: '#7b8ce8', textDecoration: 'none', fontFamily: "'Rajdhani','Inter',sans-serif" }}>
              Contact on Discord →
            </a>
          </motion.div>
        )}

        {/* Delivered: all delivery types */}
        {isDelivered && items.some(i => i.download_url || i.assigned_code || i.assigned_username) && (
          <motion.div className="flex flex-col gap-3"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

            {/* Download links */}
            {items.filter(i => i.download_url).map(i => (
              <div key={`dl-${i.id}`} className="rounded-2xl p-5" style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)' }}>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: '#00E676' }}>{i.product_name} — Download</p>
                <a href={i.download_url!} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold"
                  style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', color: '#00E676', textDecoration: 'none' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download your product
                </a>
              </div>
            ))}

            {/* Digital codes */}
            {items.filter(i => i.assigned_code).map(i => (
              <div key={`code-${i.id}`} className="rounded-2xl p-5" style={{ background: 'rgba(0,191,255,0.06)', border: '1px solid rgba(0,191,255,0.2)' }}>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: '#00BFFF' }}>{i.product_name} — Your Code</p>
                <p className="text-[10px] mb-3" style={{ color: '#3a4570' }}>Keep this code secure. It can only be used once.</p>
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.25)' }}>
                  <span className="font-mono font-bold text-base tracking-widest" style={{ color: '#ffffff' }}>{i.assigned_code}</span>
                  <button onClick={() => navigator.clipboard.writeText(i.assigned_code!)}
                    className="text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-wide flex-shrink-0"
                    style={{ background: 'rgba(0,191,255,0.15)', border: '1px solid rgba(0,191,255,0.3)', color: '#00BFFF', cursor: 'pointer' }}>
                    Copy
                  </button>
                </div>
              </div>
            ))}

            {/* Account credentials */}
            {items.filter(i => i.assigned_username).map(i => (
              <div key={`acct-${i.id}`} className="rounded-2xl p-5" style={{ background: 'rgba(138,43,226,0.06)', border: '1px solid rgba(138,43,226,0.2)' }}>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: '#8A2BE2' }}>{i.product_name} — Account Details</p>
                <p className="text-[10px] mb-3" style={{ color: '#3a4570' }}>Store these credentials securely. Do not share them.</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                    style={{ background: 'rgba(138,43,226,0.08)', border: '1px solid rgba(138,43,226,0.2)' }}>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#3a4570' }}>Username</p>
                      <p className="text-sm font-mono font-semibold" style={{ color: '#c8d0f0' }}>{i.assigned_username}</p>
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(i.assigned_username!)}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg font-bold"
                      style={{ background: 'rgba(138,43,226,0.12)', border: '1px solid rgba(138,43,226,0.3)', color: '#8A2BE2', cursor: 'pointer' }}>
                      Copy
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                    style={{ background: 'rgba(138,43,226,0.08)', border: '1px solid rgba(138,43,226,0.2)' }}>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#3a4570' }}>Password</p>
                      <p className="text-sm font-mono font-semibold" style={{ color: '#c8d0f0' }}>{i.assigned_password}</p>
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(i.assigned_password!)}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg font-bold"
                      style={{ background: 'rgba(138,43,226,0.12)', border: '1px solid rgba(138,43,226,0.3)', color: '#8A2BE2', cursor: 'pointer' }}>
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>

    {/* PayMongo payment modal */}
    {showPayModal && paymentUrl && (
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
        onClick={e => { if (e.target === e.currentTarget) setShowPayModal(false); }}>
        <div className="relative w-full sm:max-w-lg flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
          style={{ height: '90vh', background: '#050816', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 60px rgba(0,191,255,0.15)' }}>

          {/* Modal header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00BFFF' }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani','Inter',sans-serif" }}>Secure Payment</p>
            </div>
            <button
              onClick={() => setShowPayModal(false)}
              className="flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#7b88c0', cursor: 'pointer', fontSize: '14px' }}>
              ✕
            </button>
          </div>

          {/* PayMongo iframe */}
          <iframe
            src={paymentUrl}
            title="PayMongo Checkout"
            className="flex-1 w-full"
            style={{ border: 'none', background: '#fff' }}
            allow="payment"
          />

          {/* Footer note */}
          <div className="px-4 py-2.5 flex-shrink-0 text-center"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}>
            <p className="text-[10px]" style={{ color: '#2e3a5a' }}>
              This page updates automatically once your payment is confirmed. You can close this anytime.
            </p>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
