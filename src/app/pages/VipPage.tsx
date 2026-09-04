import { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { useCustomerAuth } from '@/lib/customerAuth';
import MemberDropdown from './MemberDropdown';
import TokenIcon from '@/app/components/TokenIcon';

const PERKS = [
  { icon: '💎', title: 'VIP Pricing', desc: 'Exclusive discounted prices on all products' },
  { icon: '⚡', title: 'Priority Support', desc: 'Skip the queue — get help first' },
  { icon: '🎁', title: 'VIP Promotions', desc: 'Access to VIP-only deals and flash sales' },
  { icon: '🪙', title: 'Token Rewards', desc: 'Earn 1 VIP Token per ₱100 spent — redeem for prizes' },
];

const GOLD = '#FFB400';

export default function VipPage() {
  const navigate = useNavigate();
  const { user, signIn, tokenBalance } = useCustomerAuth();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const isVip      = user?.tier === 'vip';
  const isReseller = user?.tier === 'reseller';
  const isMember   = isVip || isReseller;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    const err = await signIn(email, password);
    setLoading(false);
    if (err) setError(err);
  }

  return (
    <div className="min-h-screen" style={{ background: '#050816', fontFamily: "'Inter', sans-serif" }}>
      <div className="pointer-events-none fixed inset-0" style={{
        background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(255,180,0,0.08) 0%, transparent 60%)',
      }} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-4 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm" style={{ color: '#7b88c0', background: 'none', border: 'none', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back to Shop
        </button>

        {(isVip || isReseller) && <MemberDropdown isReseller={isReseller} />}
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(255,180,0,0.15)', border: '1px solid rgba(255,180,0,0.3)' }}>💎</div>
              <div>
                <h1 className="text-3xl font-black tracking-wider" style={{ color: GOLD, fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>VIP MEMBERSHIP</h1>
                <p className="text-xs uppercase tracking-widest" style={{ color: '#7b88c0' }}>Exclusive Member Benefits</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-8" style={{ color: '#7b88c0' }}>Join our VIP program and unlock exclusive pricing, priority support, members-only deals, and token rewards.</p>
            <div className="flex flex-col gap-3">
              {PERKS.map(p => (
                <div key={p.title} className="flex items-start gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,180,0,0.04)', border: '1px solid rgba(255,180,0,0.12)' }}>
                  {p.icon === "🪙" ? <TokenIcon size={28} /> : <span className="text-xl flex-shrink-0">{p.icon}</span>}
                  <div>
                    <p className="text-sm font-bold mb-0.5" style={{ color: '#e8eaf6' }}>{p.title}</p>
                    <p className="text-xs" style={{ color: '#7b88c0' }}>{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(255,180,0,0.05)', border: '1px solid rgba(255,180,0,0.15)' }}>
              <p className="text-xs font-bold mb-1" style={{ color: GOLD }}>How to get VIP?</p>
              <p className="text-xs" style={{ color: '#7b88c0' }}>Open a ticket on our Discord server and request a membership account. Our team will create your account and assign your tier — usually within 24 hours.</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {user ? (
              <div className="p-6 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(255,180,0,0.06) 0%, rgba(255,255,255,0.02) 100%)', border: `1px solid ${isVip ? 'rgba(255,180,0,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
                {isVip ? (
                  <>
                    <div className="text-center mb-4">
                      <div className="text-4xl mb-3">💎</div>
                      <h2 className="text-xl font-black tracking-wider" style={{ color: GOLD, fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>YOU ARE VIP</h2>
                      <p className="text-xs mt-1" style={{ color: '#7b88c0' }}>All VIP pricing is active on your account</p>
                    </div>
                    <div className="mb-4 p-3 rounded-xl flex items-center justify-between" style={{ background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.2)' }}>
                      <div className="flex items-center gap-2">
                        <TokenIcon size={22} />
                        <div>
                          <p className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>VIP Tokens</p>
                          <p className="text-xl font-black" style={{ color: GOLD, fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>{tokenBalance?.vipTokens ?? 0}</p>
                        </div>
                      </div>
                      <button onClick={() => navigate('/vip/topup')} className="text-xs px-3 py-1.5 rounded-lg font-bold" style={{ background: 'rgba(255,180,0,0.15)', border: '1px solid rgba(255,180,0,0.3)', color: GOLD, cursor: 'pointer' }}>Top Up</button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => navigate('/vip/dashboard')} className="w-full py-3 rounded-xl text-sm font-bold tracking-wider" style={{ background: 'linear-gradient(135deg, rgba(255,180,0,0.2) 0%, rgba(255,140,0,0.2) 100%)', border: '1px solid rgba(255,180,0,0.4)', color: GOLD, fontFamily: "'Rajdhani', 'Inter', sans-serif", cursor: 'pointer' }}>MY DASHBOARD →</button>
                      <button onClick={() => navigate('/stock')} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#7b88c0', cursor: 'pointer' }}>Shop with VIP Prices</button>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-sm mb-2" style={{ color: '#c8d0f0' }}>Logged in as <strong>{user.email}</strong></p>
                    <p className="text-xs mb-4" style={{ color: '#7b88c0' }}>{isReseller ? 'You have Reseller membership.' : 'Open a ticket on Discord to request VIP.'}</p>
                    <button onClick={() => navigate('/stock')} className="w-full py-3 rounded-xl text-sm font-bold" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#c8d0f0', cursor: 'pointer' }}>Go to Shop</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="p-6 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <h3 className="text-sm font-bold mb-1" style={{ color: '#c8d0f0', fontFamily: "'Rajdhani', 'Inter', sans-serif", letterSpacing: '0.06em' }}>MEMBER LOGIN</h3>
                  <p className="text-[11px] mb-6" style={{ color: '#3a4570' }}>Sign in with your membership account</p>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {error && <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,68,68,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.2)' }}>{error}</div>}
                    <div>
                      <label className="text-[10px] uppercase tracking-widest mb-1.5 block" style={{ color: '#7b88c0' }}>Email</label>
                      <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8eaf6', outline: 'none', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', width: '100%' }} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest mb-1.5 block" style={{ color: '#7b88c0' }}>Password</label>
                      <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8eaf6', outline: 'none', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', width: '100%' }} />
                    </div>
                    <button type="submit" disabled={loading} style={{ background: loading ? 'rgba(255,180,0,0.05)' : 'linear-gradient(135deg, rgba(255,180,0,0.2) 0%, rgba(255,140,0,0.2) 100%)', border: '1px solid rgba(255,180,0,0.4)', color: loading ? '#3a4570' : GOLD, padding: '12px', borderRadius: '12px', fontWeight: 700, letterSpacing: '0.08em', fontFamily: "'Rajdhani', 'Inter', sans-serif", fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', width: '100%' }}>
                      {loading ? 'Please wait...' : 'SIGN IN'}
                    </button>
                  </form>
                  <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[11px] text-center" style={{ color: '#3a4570' }}>
                      {"Don't have an account? "}
                      <a href="https://discord.gg/2n5UZj56Nk" target="_blank" rel="noopener noreferrer" style={{ color: GOLD, textDecoration: 'none' }}>Open a ticket on Discord →</a>
                    </p>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <button onClick={() => navigate('/reseller')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7b88c0', fontSize: '12px', padding: 0 }}>
                    Are you a <span style={{ color: '#00E676', fontWeight: 700 }}>RESELLER</span>? Login here →
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
