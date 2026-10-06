import { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { useCustomerAuth } from '@/lib/customerAuth';
import MemberDropdown from './MemberDropdown';
import TokenIcon from '@/app/components/TokenIcon';
import logoImage from '@/imports/image-1.png';

const PERKS = [
  { icon: '💰', title: 'Lowest Prices', desc: 'Reseller pricing — the best rates available' },
  { icon: '📦', title: 'Bulk Purchasing', desc: 'Buy in bulk with reseller-tier stock access' },
  { icon: '🏪', title: 'Reseller Products', desc: 'Access to reseller-exclusive product catalog' },
  { icon: '🪙', title: 'Token Rewards', desc: 'Earn 2 Reseller Tokens per ₱100 spent — double the VIP rate' },
];

const GREEN = '#00E676';

const CSS = `
  @keyframes green-breathe {
    0%, 100% { box-shadow: 0 0 0 1px rgba(0,230,118,0.18), 0 0 32px rgba(0,230,118,0.05); }
    50% { box-shadow: 0 0 0 1px rgba(0,230,118,0.32), 0 0 48px rgba(0,230,118,0.1); }
  }
  .green-card { animation: green-breathe 4s ease-in-out infinite; }
  .res-input {
    background: rgba(11,16,32,0.7); border: 1px solid rgba(255,255,255,0.09);
    color: #F5F7FF; outline: none; border-radius: 12px; padding: 11px 14px;
    font-size: 14px; width: 100%; transition: border-color 0.2s, box-shadow 0.2s;
    font-family: 'Inter', sans-serif; box-sizing: border-box;
  }
  .res-input::placeholder { color: #626C80; }
  .res-input:focus { border-color: rgba(0,230,118,0.4); box-shadow: 0 0 0 3px rgba(0,230,118,0.06); }
  .res-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: #626C80; margin-bottom: 7px; display: block; font-family: 'Exo 2','Inter',sans-serif; font-weight: 700; }
  .green-btn { background: linear-gradient(135deg, rgba(0,230,118,0.15) 0%, rgba(0,200,100,0.15) 100%); border: 1px solid rgba(0,230,118,0.35); color: ${GREEN}; transition: all 0.22s; }
  .green-btn:hover:not(:disabled) { background: linear-gradient(135deg, rgba(0,230,118,0.25) 0%, rgba(0,200,100,0.25) 100%); border-color: rgba(0,230,118,0.6); box-shadow: 0 0 24px rgba(0,230,118,0.12); transform: translateY(-1px); }
  .green-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .perk-card-green { background: rgba(0,230,118,0.03); border: 1px solid rgba(0,230,118,0.09); border-radius: 16px; transition: border-color 0.2s, background 0.2s; }
  .perk-card-green:hover { background: rgba(0,230,118,0.06); border-color: rgba(0,230,118,0.18); }
`;

export default function ResellerPage() {
  const navigate = useNavigate();
  const { user, signIn, tokenBalance } = useCustomerAuth();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const isReseller = user?.tier === 'reseller';
  const isVip      = user?.tier === 'vip';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    const err = await signIn(email, password);
    setLoading(false);
    if (err) setError(err);
  }

  return (
    <div className="min-h-screen" style={{ background: '#060812', fontFamily: "'Inter', sans-serif" }}>
      <style>{CSS}</style>

      {/* Green background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute rounded-full" style={{ width: '70vw', height: '50vw', top: '-20vw', left: '-10vw', background: 'radial-gradient(ellipse, rgba(0,230,118,0.04) 0%, transparent 65%)', filter: 'blur(50px)' }} />
        <div className="absolute rounded-full" style={{ width: '50vw', height: '50vw', top: '-8vw', right: '-15vw', background: 'radial-gradient(ellipse, rgba(0,180,80,0.05) 0%, transparent 65%)', filter: 'blur(40px)' }} />
      </div>

      {/* Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-5" style={{ overflow: 'visible' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,8,18,0.78)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', zIndex: -1, pointerEvents: 'none' }} />
        <button onClick={() => navigate('/')} className="inline-flex items-center gap-2" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: '0.1em', background: 'linear-gradient(90deg, #F5F7FF 0%, #00BFFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>SALE SHOP</span>
        </button>
        <div style={{ flex: 1 }} />
        {(isVip || isReseller) && <MemberDropdown isReseller={isReseller} />}
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* Left — Benefits */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6" style={{ background: 'rgba(0,230,118,0.07)', border: '1px solid rgba(0,230,118,0.18)' }}>
              <span style={{ color: GREEN, fontSize: '14px', fontWeight: 700 }}>◆</span>
              <span style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: GREEN, textTransform: 'uppercase' }}>Wholesale Program</span>
            </div>

            <h1 style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 900, fontSize: 'clamp(28px, 5vw, 44px)', color: GREEN, letterSpacing: '0.06em', lineHeight: 1, marginBottom: '8px' }}>
              RESELLER PROGRAM
            </h1>
            <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#626C80', textTransform: 'uppercase', marginBottom: '16px' }}>
              Wholesale Pricing &amp; Benefits
            </p>
            <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#98A2B8', marginBottom: '28px' }}>
              Become an official reseller and access the lowest prices on the platform. Earn double tokens on every purchase.
            </p>

            <div className="flex flex-col gap-3 mb-8">
              {PERKS.map((p, i) => (
                <motion.div
                  key={p.title}
                  className="perk-card-green flex items-start gap-4 p-4"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.07 }}
                >
                  {p.icon === '🪙' ? <TokenIcon size={26} /> : <span style={{ fontSize: '20px', flexShrink: 0 }}>{p.icon}</span>}
                  <div>
                    <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, fontSize: '14px', color: '#F5F7FF', marginBottom: '3px' }}>{p.title}</p>
                    <p style={{ fontSize: '12px', color: '#98A2B8' }}>{p.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="p-4 rounded-2xl" style={{ background: 'rgba(0,230,118,0.03)', border: '1px solid rgba(0,230,118,0.12)' }}>
              <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 700, fontSize: '11px', letterSpacing: '0.1em', color: GREEN, textTransform: 'uppercase', marginBottom: '6px' }}>How to become a Reseller?</p>
              <p style={{ fontSize: '13px', color: '#98A2B8', lineHeight: '1.6' }}>Open a ticket on our Discord server and request a reseller account. Our team will review your application — usually within 24 hours.</p>
            </div>
          </motion.div>

          {/* Right — Auth / Status */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {user ? (
              <div className={`p-6 rounded-2xl ${isReseller ? 'green-card' : ''}`} style={{ background: isReseller ? 'rgba(0,230,118,0.04)' : 'rgba(11,16,32,0.6)', border: `1px solid ${isReseller ? 'rgba(0,230,118,0.18)' : 'rgba(255,255,255,0.08)'}` }}>
                {isReseller ? (
                  <>
                    <div className="text-center mb-6">
                      <div style={{ fontSize: '40px', color: GREEN, marginBottom: '12px', fontWeight: 700 }}>◆</div>
                      <h2 style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 900, fontSize: '22px', letterSpacing: '0.08em', color: GREEN }}>YOU ARE A RESELLER</h2>
                      <p style={{ fontSize: '12px', color: '#98A2B8', marginTop: '4px' }}>Reseller pricing is active on your account</p>
                    </div>

                    <div className="mb-5 p-4 rounded-2xl flex items-center justify-between" style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.16)' }}>
                      <div className="flex items-center gap-3">
                        <TokenIcon size={24} />
                        <div>
                          <p style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', color: '#626C80', textTransform: 'uppercase', marginBottom: '2px' }}>Reseller Tokens</p>
                          <p style={{ fontFamily: "'JetBrains Mono','Inter',monospace", fontSize: '24px', fontWeight: 600, color: GREEN, lineHeight: 1 }}>{tokenBalance?.resellerTokens ?? 0}</p>
                        </div>
                      </div>
                      <button onClick={() => navigate('/reseller/topup')} className="green-btn px-4 py-2 rounded-xl text-xs font-bold" style={{ fontFamily: "'Exo 2','Inter',sans-serif", letterSpacing: '0.06em', cursor: 'pointer' }}>
                        Top Up
                      </button>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <button onClick={() => navigate('/reseller/dashboard')} className="green-btn w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2" style={{ fontFamily: "'Exo 2','Inter',sans-serif", letterSpacing: '0.08em', cursor: 'pointer' }}>
                        MY DASHBOARD
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      </button>
                      <button onClick={() => navigate('/stock')} className="w-full py-3 rounded-2xl text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#98A2B8', cursor: 'pointer', fontFamily: "'Exo 2','Inter',sans-serif" }}>
                        Shop with Reseller Prices
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <p style={{ fontSize: '14px', color: '#F5F7FF', marginBottom: '8px' }}>Logged in as <strong>{user.email}</strong></p>
                    <p style={{ fontSize: '12px', color: '#98A2B8', marginBottom: '16px' }}>{isVip ? 'You have VIP membership.' : 'Open a ticket on Discord to apply for Reseller.'}</p>
                    <button onClick={() => navigate('/stock')} className="w-full py-3 rounded-2xl text-sm font-bold" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#F5F7FF', cursor: 'pointer', fontFamily: "'Exo 2','Inter',sans-serif" }}>
                      Go to Shop
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="p-6 rounded-2xl" style={{ background: 'rgba(11,16,32,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h3 style={{ fontFamily: "'Exo 2','Inter',sans-serif", fontWeight: 800, fontSize: '16px', letterSpacing: '0.08em', color: '#F5F7FF', marginBottom: '4px' }}>RESELLER LOGIN</h3>
                  <p style={{ fontSize: '12px', color: '#626C80', marginBottom: '24px' }}>Sign in with your reseller account</p>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {error && (
                      <div className="px-3 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(255,68,68,0.08)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,0.18)' }}>
                        {error}
                      </div>
                    )}
                    <div>
                      <label className="res-label">Email</label>
                      <input type="email" required className="res-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
                    </div>
                    <div>
                      <label className="res-label">Password</label>
                      <input type="password" required className="res-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                    </div>
                    <button type="submit" disabled={loading} className="green-btn w-full py-3.5 rounded-2xl text-sm font-bold" style={{ fontFamily: "'Exo 2','Inter',sans-serif", letterSpacing: '0.1em', cursor: loading ? 'not-allowed' : 'pointer' }}>
                      {loading ? 'Please wait…' : 'SIGN IN'}
                    </button>
                  </form>
                  <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ fontSize: '11px', textAlign: 'center', color: '#626C80' }}>
                      {"Don't have an account? "}
                      <a href="https://discord.gg/saleshop" target="_blank" rel="noopener noreferrer" style={{ color: GREEN, textDecoration: 'none', fontWeight: 600 }}>Open a Discord ticket →</a>
                    </p>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <button onClick={() => navigate('/vip')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#626C80', fontSize: '12px', padding: 0 }}>
                    Are you a <span style={{ color: '#F5B000', fontWeight: 700 }}>VIP</span>? Login here →
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
