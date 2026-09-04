import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import type { CustomerTier, CustomerUser } from './types';

const BASE = `https://${projectId}.supabase.co`;
const KEY  = publicAnonKey;
const CS_KEY = 'cs_session';

interface CustomerAuthCtx {
  user: CustomerUser | null;
  loading: boolean;
  signIn:  (email: string, password: string) => Promise<string | null>;
  signUp:  (email: string, password: string) => Promise<string | null>;
  signOut: () => void;
  refreshTier: () => Promise<void>;
}

const Ctx = createContext<CustomerAuthCtx>({
  user: null, loading: true,
  signIn: async () => null, signUp: async () => null, signOut: () => {}, refreshTier: async () => {},
});

function getStoredSession(): { access_token: string; user: { id: string; email: string } } | null {
  try { const r = localStorage.getItem(CS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

async function fetchTier(userId: string, token: string): Promise<CustomerTier> {
  try {
    const res = await fetch(
      `${BASE}/rest/v1/user_memberships?user_id=eq.${userId}&select=tier&limit=1`,
      { headers: { apikey: KEY, Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return 'normal';
    const rows = await res.json();
    return (rows?.[0]?.tier as CustomerTier) ?? 'normal';
  } catch { return 'normal'; }
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getStoredSession();
    if (!session) { setLoading(false); return; }
    fetchTier(session.user.id, session.access_token).then(tier => {
      setUser({ id: session.user.id, email: session.user.email, tier });
      setLoading(false);
    });
  }, []);

  async function signIn(email: string, password: string): Promise<string | null> {
    const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return json?.error_description ?? json?.msg ?? 'Login failed';
    const session = { access_token: json.access_token, user: { id: json.user.id, email: json.user.email } };
    localStorage.setItem(CS_KEY, JSON.stringify(session));
    const tier = await fetchTier(session.user.id, session.access_token);
    setUser({ id: session.user.id, email: session.user.email, tier });
    return null;
  }

  async function signUp(email: string, password: string): Promise<string | null> {
    const res = await fetch(`${BASE}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return json?.error_description ?? json?.msg ?? 'Signup failed';
    if (json.access_token) {
      const session = { access_token: json.access_token, user: { id: json.user.id, email: json.user.email } };
      localStorage.setItem(CS_KEY, JSON.stringify(session));
      setUser({ id: session.user.id, email: session.user.email, tier: 'normal' });
    } else {
      return 'Account created! Check your email to confirm, then sign in.';
    }
    return null;
  }

  async function refreshTier() {
    const session = getStoredSession();
    if (!session || !user) return;
    const tier = await fetchTier(session.user.id, session.access_token);
    setUser(u => u ? { ...u, tier } : null);
  }

  function signOut() {
    localStorage.removeItem(CS_KEY);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, signIn, signUp, signOut, refreshTier }}>{children}</Ctx.Provider>;
}

export function useCustomerAuth() { return useContext(Ctx); }

export function tierPrice(price: number, vipPrice: number | null, resellerPrice: number | null, tier: CustomerTier): number {
  if (tier === 'reseller' && resellerPrice != null) return resellerPrice;
  if (tier === 'vip'      && vipPrice      != null) return vipPrice;
  return price;
}

export function tierLabel(tier: CustomerTier): string {
  if (tier === 'vip')      return 'VIP';
  if (tier === 'reseller') return 'RESELLER';
  return '';
}

export function tierColor(tier: CustomerTier): string {
  if (tier === 'vip')      return '#FFB400';
  if (tier === 'reseller') return '#00E676';
  return '';
}
