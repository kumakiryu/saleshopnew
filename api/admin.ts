import type { VercelRequest, VercelResponse } from './_types';
import { fulfillOrder, verifyAdminToken } from './_shared';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hxfccpadsbunynignbwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE';
const APP_NAME = 'Sale Shop Admin';

// ── TOTP helpers ──────────────────────────────────────────────────────────────

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function generateSecret(): string {
  const bytes = crypto.randomBytes(20);
  let result = '', bits = 0, val = 0;
  for (const b of bytes) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { bits -= 5; result += B32[(val >> bits) & 0x1f]; }
  }
  return result;
}

function b32ToBuffer(s: string): Buffer {
  s = s.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  const out: number[] = [];
  let bits = 0, val = 0;
  for (const c of s) {
    val = (val << 5) | B32.indexOf(c); bits += 5;
    if (bits >= 8) { bits -= 8; out.push((val >> bits) & 0xff); val &= (1 << bits) - 1; }
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
  return `otpauth://totp/${encodeURIComponent(`${APP_NAME}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(APP_NAME)}&algorithm=SHA1&digits=6&period=30`;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

function svcKey() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return k;
}
function svcH() {
  const k = svcKey();
  return { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
}
function anonH(token: string) {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

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
  return r.json() as Promise<T[]>;
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
  const h = { ...svcH(), Prefer: `return=representation,resolution=merge-duplicates,on_conflict=${onConflict}` };
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
  return r.json() as Promise<{ email?: string }>;
}

async function getTotpAdminUser(token: string) {
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
  return { user: { id: user.id as string, email: user.email as string ?? '' }, admin };
}

// ── Action: fulfill ───────────────────────────────────────────────────────────

async function handleFulfill(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { orderId, token } = req.body as { orderId?: string; token?: string };
  if (!orderId || !token) return res.status(400).json({ error: 'Missing orderId or token' });
  const auth = await verifyAdminToken(token);
  if (!auth.ok) return res.status(403).json({ error: auth.reason ?? 'Forbidden' });
  await fulfillOrder(orderId);
  return res.status(200).json({ success: true });
}

// ── Action: tokens ────────────────────────────────────────────────────────────

async function handleTokens(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = String(req.headers['x-admin-token'] ?? req.body?.token ?? '');
  const auth = await verifyAdminToken(token);
  if (!auth.ok) return res.status(403).json({ error: 'Forbidden' });
  const { action, target_user_id, token_type, amount } = req.body ?? {};
  if (!action || !target_user_id || !token_type) return res.status(400).json({ error: 'Missing fields' });
  if (!['add', 'remove', 'reset'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  if (!['vip', 'reseller'].includes(token_type)) return res.status(400).json({ error: 'Invalid token_type' });
  const col = token_type === 'vip' ? 'vip_tokens' : 'reseller_tokens';
  const headers = svcH();
  const existing = await fetch(`${SUPABASE_URL}/rest/v1/user_tokens?user_id=eq.${target_user_id}&select=*&limit=1`, { headers });
  const rows = existing.ok ? (await existing.json() as any[]) : [];
  const row = rows?.[0];
  let newVal: number;
  if (action === 'reset') {
    newVal = 0;
  } else {
    const current = row?.[col] ?? 0;
    const delta = Number(amount ?? 0);
    newVal = action === 'add' ? current + delta : Math.max(0, current - delta);
  }
  if (row) {
    await fetch(`${SUPABASE_URL}/rest/v1/user_tokens?user_id=eq.${target_user_id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ [col]: newVal, updated_at: new Date().toISOString() }),
    });
  } else {
    await fetch(`${SUPABASE_URL}/rest/v1/user_tokens`, {
      method: 'POST', headers,
      body: JSON.stringify({ user_id: target_user_id, vip_tokens: 0, reseller_tokens: 0, [col]: newVal, updated_at: new Date().toISOString() }),
    });
  }
  await fetch(`${SUPABASE_URL}/rest/v1/token_transactions`, {
    method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: target_user_id, transaction_type: 'adjust', amount: action === 'remove' ? -Number(amount ?? 0) : newVal, reason: `Admin ${action} — by ${auth.userId}`, created_at: new Date().toISOString() }),
  });
  return res.status(200).json({ ok: true, new_balance: newVal });
}

// ── Action: totp ──────────────────────────────────────────────────────────────

async function handleTotp(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { action, code, token } = req.body as { action: string; code?: string; token: string };
  if (!token) return res.status(401).json({ error: 'No auth token' });
  const ctx = await getTotpAdminUser(token);
  if (!ctx) return res.status(403).json({ error: 'Not an admin' });
  const { user, admin } = ctx;

  if (action === 'status') return res.status(200).json({ totp_enabled: admin.totp_enabled, role: admin.role ?? 'administrator' });

  if (action === 'setup') {
    const secret = generateSecret();
    await svcUpsert('admin_totp_secrets', { admin_id: user.id, secret, enabled: false }, 'admin_id');
    return res.status(200).json({ uri: totpUri(user.email, secret), secret });
  }

  if (action === 'verify-setup') {
    const row = await svcGet<{ secret: string }>('admin_totp_secrets', { admin_id: user.id }, 'secret');
    if (!row) return res.status(400).json({ error: 'Run setup first' });
    if (!verifyTotp(code!, row.secret)) return res.status(400).json({ error: 'Invalid code — check your authenticator app' });
    await svcUpdate('admin_totp_secrets', { admin_id: user.id }, { enabled: true });
    await svcUpdate('admins', { id: user.id }, { totp_enabled: true });
    await svcInsert('admin_audit_logs', { admin_id: user.id, action: '2fa_enabled', resource: 'settings', user_agent: req.headers['user-agent'] ?? null });
    return res.status(200).json({ success: true });
  }

  if (action === 'verify') {
    const row = await svcGet<{ secret: string; enabled: boolean }>('admin_totp_secrets', { admin_id: user.id }, 'secret,enabled');
    if (!row?.enabled) return res.status(400).json({ error: '2FA not enabled' });
    if (!verifyTotp(code!, row.secret)) return res.status(400).json({ error: 'Invalid code' });
    await svcInsert('admin_audit_logs', { admin_id: user.id, action: 'vault_unlocked', resource: 'inventory', user_agent: req.headers['user-agent'] ?? null });
    return res.status(200).json({ success: true });
  }

  if (action === 'disable') {
    if (!code) return res.status(400).json({ error: 'Confirm with your current code first' });
    const row = await svcGet<{ secret: string }>('admin_totp_secrets', { admin_id: user.id }, 'secret');
    if (row && !verifyTotp(code, row.secret)) return res.status(400).json({ error: 'Invalid code' });
    await svcDelete('admin_totp_secrets', { admin_id: user.id });
    await svcUpdate('admins', { id: user.id }, { totp_enabled: false });
    await svcInsert('admin_audit_logs', { admin_id: user.id, action: '2fa_disabled', resource: 'settings', user_agent: req.headers['user-agent'] ?? null });
    return res.status(200).json({ success: true });
  }

  if (action === 'list-admins') {
    if (admin.role !== 'owner') return res.status(403).json({ error: 'Owner role required' });
    const rows = await svcGetAll<{ id: string; role: string; totp_enabled: boolean }>('admins', 'id,role,totp_enabled');
    const list = await Promise.all(rows.map(async a => {
      const u = await svcGetUserById(a.id);
      return { id: a.id, email: u?.email ?? 'Unknown', role: a.role ?? 'administrator', totp_enabled: a.totp_enabled };
    }));
    return res.status(200).json({ admins: list });
  }

  if (action === 'set-role') {
    if (admin.role !== 'owner') return res.status(403).json({ error: 'Owner role required' });
    const { targetId, newRole } = req.body as { targetId: string; newRole: string };
    if (!['owner', 'administrator', 'moderator'].includes(newRole)) return res.status(400).json({ error: 'Invalid role' });
    await svcUpdate('admins', { id: targetId }, { role: newRole });
    await svcInsert('admin_audit_logs', { admin_id: user.id, action: 'role_changed', resource: `${targetId.slice(0, 8)} → ${newRole}`, user_agent: req.headers['user-agent'] ?? null });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Unknown totp action' });
}

// ── Action: create-member ─────────────────────────────────────────────────────

async function handleCreateMember(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password, tier, adminToken } = req.body as { email: string; password: string; tier: string; adminToken: string };
  if (!email || !password || !tier || !adminToken) return res.status(400).json({ error: 'Missing fields' });
  const { ok, userId: adminId, reason } = await verifyAdminToken(adminToken);
  if (!ok) return res.status(401).json({ error: reason ?? 'Unauthorized' });
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svcH(),
    body: JSON.stringify({ email: email.trim().toLowerCase(), password, email_confirm: true }),
  });
  const createData = await createRes.json() as any;
  if (!createRes.ok) return res.status(400).json({ error: createData?.msg ?? createData?.message ?? createData?.error_description ?? 'Account creation failed' });
  const userId = createData?.id;
  if (!userId) return res.status(500).json({ error: 'User created but no ID returned' });
  if (tier !== 'normal') {
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/user_memberships`, {
      method: 'POST',
      headers: { ...svcH(), Prefer: 'return=representation,resolution=merge-duplicates,on_conflict=user_id' },
      body: JSON.stringify({ user_id: userId, tier, assigned_by: adminId, assigned_at: new Date().toISOString() }),
    });
    if (!upsertRes.ok) {
      const err = await upsertRes.json().catch(() => ({})) as any;
      return res.status(500).json({ error: err?.message ?? 'Account created but tier assignment failed. Use Assign Tier to fix.' });
    }
  }
  return res.status(200).json({ ok: true, userId, email: email.trim().toLowerCase(), tier });
}

// ── Action: list-members ──────────────────────────────────────────────────────

async function handleListMembers(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const adminToken = req.headers['x-admin-token'] as string;
  if (!adminToken) return res.status(401).json({ error: 'Missing token' });
  const { ok, reason } = await verifyAdminToken(adminToken);
  if (!ok) return res.status(401).json({ error: reason ?? 'Unauthorized' });
  const [membershipsRes, usersRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/user_memberships?select=*&order=assigned_at.desc`, { headers: svcH() }),
    fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers: svcH() }),
  ]);
  if (!membershipsRes.ok) return res.status(500).json({ error: 'Failed to fetch memberships' });
  if (!usersRes.ok) return res.status(500).json({ error: 'Failed to fetch users' });
  const memberships = (await membershipsRes.json()) as any[];
  const usersData = (await usersRes.json()) as { users: { id: string; email?: string }[] };
  const users = usersData.users ?? [];
  const emailMap: Record<string, string> = {};
  for (const u of users) { if (u.id && u.email) emailMap[u.id] = u.email; }
  const result = (Array.isArray(memberships) ? memberships : []).map((m: any) => ({ ...m, email: emailMap[m.user_id] ?? m.email ?? null }));
  return res.status(200).json(result);
}

// ── Action: manage-membership ─────────────────────────────────────────────────

async function handleManageMembership(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, tier, adminToken } = req.body as { email: string; tier: string; adminToken: string };
  if (!email || !tier || !adminToken) return res.status(400).json({ error: 'Missing fields' });
  const { ok, userId: adminId, reason } = await verifyAdminToken(adminToken);
  if (!ok) return res.status(401).json({ error: reason ?? 'Unauthorized' });
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers: svcH() });
  if (!listRes.ok) return res.status(500).json({ error: 'Failed to look up user' });
  const listData = await listRes.json() as any;
  const users: any[] = listData?.users ?? (Array.isArray(listData) ? listData : []);
  const targetUser = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
  if (!targetUser) return res.status(404).json({ error: `No account found for ${email}` });
  const userId = targetUser.id;
  if (tier === 'normal') {
    await fetch(`${SUPABASE_URL}/rest/v1/user_memberships?user_id=eq.${userId}`, { method: 'DELETE', headers: svcH() });
  } else {
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/user_memberships`, {
      method: 'POST',
      headers: { ...svcH(), Prefer: 'return=representation,resolution=merge-duplicates,on_conflict=user_id' },
      body: JSON.stringify({ user_id: userId, tier, assigned_by: adminId, assigned_at: new Date().toISOString() }),
    });
    if (!upsertRes.ok) {
      const err = await upsertRes.json().catch(() => ({})) as any;
      return res.status(500).json({ error: err?.message ?? 'Failed to set membership' });
    }
  }
  return res.status(200).json({ ok: true, userId, tier });
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? '');
  try {
    switch (action) {
      case 'fulfill': return await handleFulfill(req, res);
      case 'tokens': return await handleTokens(req, res);
      case 'totp': return await handleTotp(req, res);
      case 'create-member': return await handleCreateMember(req, res);
      case 'list-members': return await handleListMembers(req, res);
      case 'manage-membership': return await handleManageMembership(req, res);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[admin?action=${action}] error:`, message);
    return res.status(500).json({ error: message });
  }
}
