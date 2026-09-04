import type { VercelRequest, VercelResponse } from './_types';
import crypto from 'node:crypto';

const SUPABASE_URL = 'https://hxfccpadsbunynignbwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE';
const APP_NAME = 'Sale Shop Admin';

// ── TOTP ─────────────────────────────────────────────────────────────────────

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function generateSecret(): string {
  const bytes = crypto.randomBytes(20);
  let result = '', bits = 0, val = 0;
  for (const b of bytes) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += B32[(val >> bits) & 0x1f];
    }
  }
  return result;
}

function b32ToBuffer(s: string): Buffer {
  s = s.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  const out: number[] = [];
  let bits = 0, val = 0;
  for (const c of s) {
    val = (val << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((val >> bits) & 0xff);
      val &= (1 << bits) - 1;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: string, counter: number): string {
  const key = b32ToBuffer(secret);
  const msg = Buffer.alloc(8);
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) { msg[i] = Number(c & 0xffn); c >>= 8n; }
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const off = hmac[19] & 0xf;
  const code = ((hmac[off] & 0x7f) << 24 | hmac[off + 1] << 16 | hmac[off + 2] << 8 | hmac[off + 3]) % 1_000_000;
  return String(code).padStart(6, '0');
}

function verifyTotp(token: string, secret: string): boolean {
  const t = Math.floor(Date.now() / 1000 / 30);
  return [t - 2, t - 1, t, t + 1, t + 2].some(w => hotp(secret, w) === token);
}

function totpUri(email: string, secret: string): string {
  const acc = encodeURIComponent(`${APP_NAME}:${email}`);
  const iss = encodeURIComponent(APP_NAME);
  return `otpauth://totp/${acc}?secret=${secret}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
}

// ── Supabase REST helpers ─────────────────────────────────────────────────────

function svcKey() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return k;
}
function svcH() { const k = svcKey(); return { 'apikey': k, 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }; }
function anonH(token: string) { return { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }; }

async function svcGet<T>(table: string, filters: Record<string, unknown>, select = '*'): Promise<T | null> {
  const qs = new URLSearchParams({ select });
  for (const [k, v] of Object.entries(filters)) qs.append(k, `eq.${v}`);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers: svcH() });
  if (!r.ok) return null;
  const rows = await r.json() as any[];
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function svcGetAll<T>(table: string, select = '*'): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}`, { headers: svcH() });
  if (!r.ok) return [];
  return r.json();
}

async function svcUpdate(table: string, filters: Record<string, unknown>, data: unknown): Promise<void> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) qs.append(k, `eq.${v}`);
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { method: 'PATCH', headers: svcH(), body: JSON.stringify(data) });
}

async function svcInsert(table: string, data: unknown): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers: svcH(), body: JSON.stringify(data) });
}

async function svcUpsert(table: string, data: unknown, onConflict: string): Promise<void> {
  const h = { ...svcH(), 'Prefer': `return=representation,resolution=merge-duplicates,on_conflict=${onConflict}` };
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers: h, body: JSON.stringify(data) });
}

async function svcDelete(table: string, filters: Record<string, unknown>): Promise<void> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) qs.append(k, `eq.${v}`);
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { method: 'DELETE', headers: svcH() });
}

async function svcGetUserById(userId: string): Promise<{ email?: string } | null> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { headers: svcH() });
  if (!r.ok) return null;
  return r.json();
}

async function getAdminUser(token: string): Promise<{ user: { id: string; email: string }; admin: Record<string, unknown> } | null> {
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: anonH(token) });
  if (!userRes.ok) return null;
  const user = await userRes.json() as any;
  if (!user?.id) return null;

  const adminRes = await fetch(`${SUPABASE_URL}/rest/v1/admins?id=eq.${user.id}&select=*&limit=1`, { headers: anonH(token) });
  if (!adminRes.ok) return null;
  const rows = await adminRes.json() as any[];
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const admin = rows[0];
  if (admin.role === undefined) admin.role = 'administrator';
  if (admin.totp_enabled === undefined) admin.totp_enabled = false;
  return { user: { id: user.id, email: user.email ?? '' }, admin };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end();

    const { action, code, token } = req.body as { action: string; code?: string; token: string };
    if (!token) return res.status(401).json({ error: 'No auth token' });

    const ctx = await getAdminUser(token);
    if (!ctx) return res.status(403).json({ error: 'Not an admin' });

    const { user, admin } = ctx;

    if (action === 'status') {
      return res.status(200).json({ totp_enabled: admin.totp_enabled, role: admin.role ?? 'administrator' });
    }

    if (action === 'setup') {
      const secret = generateSecret();
      const uri = totpUri(user.email, secret);
      await svcUpsert('admin_totp_secrets', { admin_id: user.id, secret, enabled: false }, 'admin_id');
      return res.status(200).json({ uri, secret });
    }

    if (action === 'verify-setup') {
      const row = await svcGet<{ secret: string }>('admin_totp_secrets', { admin_id: user.id }, 'secret');
      if (!row) return res.status(400).json({ error: 'Run setup first' });
      if (!verifyTotp(code!, row.secret)) return res.status(400).json({ error: 'Invalid code — check your authenticator app' });

      await svcUpdate('admin_totp_secrets', { admin_id: user.id }, { enabled: true });
      await svcUpdate('admins', { id: user.id }, { totp_enabled: true });
      await svcInsert('admin_audit_logs', {
        admin_id: user.id, action: '2fa_enabled', resource: 'settings',
        user_agent: req.headers['user-agent'] ?? null,
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'verify') {
      const row = await svcGet<{ secret: string; enabled: boolean }>('admin_totp_secrets', { admin_id: user.id }, 'secret,enabled');
      if (!row?.enabled) return res.status(400).json({ error: '2FA not enabled' });
      if (!verifyTotp(code!, row.secret)) return res.status(400).json({ error: 'Invalid code' });

      await svcInsert('admin_audit_logs', {
        admin_id: user.id, action: 'vault_unlocked', resource: 'inventory',
        user_agent: req.headers['user-agent'] ?? null,
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'disable') {
      if (!code) return res.status(400).json({ error: 'Confirm with your current code first' });
      const row = await svcGet<{ secret: string }>('admin_totp_secrets', { admin_id: user.id }, 'secret');
      if (row && !verifyTotp(code, row.secret)) return res.status(400).json({ error: 'Invalid code' });

      await svcDelete('admin_totp_secrets', { admin_id: user.id });
      await svcUpdate('admins', { id: user.id }, { totp_enabled: false });
      await svcInsert('admin_audit_logs', {
        admin_id: user.id, action: '2fa_disabled', resource: 'settings',
        user_agent: req.headers['user-agent'] ?? null,
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'list-admins') {
      if (admin.role !== 'owner') return res.status(403).json({ error: 'Owner role required' });
      const rows = await svcGetAll<{ id: string; role: string; totp_enabled: boolean }>('admins', 'id,role,totp_enabled');
      const list = await Promise.all(
        rows.map(async (a) => {
          const u = await svcGetUserById(a.id);
          return { id: a.id, email: u?.email ?? 'Unknown', role: a.role ?? 'administrator', totp_enabled: a.totp_enabled };
        })
      );
      return res.status(200).json({ admins: list });
    }

    if (action === 'set-role') {
      if (admin.role !== 'owner') return res.status(403).json({ error: 'Owner role required' });
      const { targetId, newRole } = req.body as { targetId: string; newRole: string };
      if (!['owner', 'administrator', 'moderator'].includes(newRole)) return res.status(400).json({ error: 'Invalid role' });

      await svcUpdate('admins', { id: targetId }, { role: newRole });
      await svcInsert('admin_audit_logs', {
        admin_id: user.id, action: 'role_changed', resource: `${targetId.slice(0, 8)} → ${newRole}`,
        user_agent: req.headers['user-agent'] ?? null,
      });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin-totp] error:', message);
    return res.status(500).json({ error: message });
  }
}
