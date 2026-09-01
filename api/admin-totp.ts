import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hxfccpadsbunynignbwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE';
const APP_NAME = 'Sale Shop Admin';

// ── Pure-JS TOTP (RFC 6238) — no external packages ──────────────────────────

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function generateSecret(): string {
  return Array.from(crypto.randomBytes(20)).map(b => B32[b % 32]).join('');
}

function b32ToBuffer(s: string): Buffer {
  s = s.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  const out: number[] = [];
  let bits = 0, val = 0;
  for (const c of s) {
    val = (val << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
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

// ── Supabase helpers ─────────────────────────────────────────────────────────

function serviceClient() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

function userClient(token: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

async function getAdminUser(token: string) {
  const client = userClient(token);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const { data: admin } = await client.from('admins').select('*').eq('id', user.id).single();
  if (!admin) return null;
  if (admin.role === undefined) admin.role = 'administrator';
  if (admin.totp_enabled === undefined) admin.totp_enabled = false;
  return { user, admin, client };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end();

    const { action, code, token } = req.body as {
      action: string;
      code?: string;
      token: string;
    };

    if (!token) return res.status(401).json({ error: 'No auth token' });

    const ctx = await getAdminUser(token);
    if (!ctx) return res.status(403).json({ error: 'Not an admin' });

    const { user, admin } = ctx;
    const svc = serviceClient();

    // ── status ──────────────────────────────────────────────────────────────
    if (action === 'status') {
      return res.status(200).json({ totp_enabled: admin.totp_enabled, role: admin.role ?? 'administrator' });
    }

    // ── setup ────────────────────────────────────────────────────────────────
    if (action === 'setup') {
      const secret = generateSecret();
      const uri = totpUri(user.email ?? 'admin', secret);
      await svc.from('admin_totp_secrets').upsert(
        { admin_id: user.id, secret, enabled: false },
        { onConflict: 'admin_id' },
      );
      return res.status(200).json({ uri, secret });
    }

    // ── verify-setup ─────────────────────────────────────────────────────────
    if (action === 'verify-setup') {
      const { data: row } = await svc.from('admin_totp_secrets').select('secret').eq('admin_id', user.id).single();
      if (!row) return res.status(400).json({ error: 'Run setup first' });
      const t = Math.floor(Date.now() / 1000 / 30);
const expected = [t - 2, t - 1, t, t + 1, t + 2].map(w => hotp(row.secret, w));
if (!expected.includes(code!)) return res.status(400).json({ error: `Invalid code. Server time window: ${t}. Expected codes: ${expected.join(', ')}` });

      await svc.from('admin_totp_secrets').update({ enabled: true }).eq('admin_id', user.id);
      await svc.from('admins').update({ totp_enabled: true }).eq('id', user.id);
      await svc.from('admin_audit_logs').insert({
        admin_id: user.id, action: '2fa_enabled', resource: 'settings',
        user_agent: req.headers['user-agent'] ?? null,
      });
      return res.status(200).json({ success: true });
    }

    // ── verify (vault unlock) ────────────────────────────────────────────────
    if (action === 'verify') {
      const { data: row } = await svc.from('admin_totp_secrets').select('secret, enabled').eq('admin_id', user.id).single();
      if (!row?.enabled) return res.status(400).json({ error: '2FA not enabled' });
      if (!verifyTotp(code!, row.secret)) return res.status(400).json({ error: 'Invalid code' });

      await svc.from('admin_audit_logs').insert({
        admin_id: user.id, action: 'vault_unlocked', resource: 'inventory',
        user_agent: req.headers['user-agent'] ?? null,
      });
      return res.status(200).json({ success: true });
    }

    // ── disable ──────────────────────────────────────────────────────────────
    if (action === 'disable') {
      if (!code) return res.status(400).json({ error: 'Confirm with your current code first' });
      const { data: row } = await svc.from('admin_totp_secrets').select('secret').eq('admin_id', user.id).single();
      if (row && !verifyTotp(code, row.secret)) return res.status(400).json({ error: 'Invalid code' });

      await svc.from('admin_totp_secrets').delete().eq('admin_id', user.id);
      await svc.from('admins').update({ totp_enabled: false }).eq('id', user.id);
      await svc.from('admin_audit_logs').insert({
        admin_id: user.id, action: '2fa_disabled', resource: 'settings',
        user_agent: req.headers['user-agent'] ?? null,
      });
      return res.status(200).json({ success: true });
    }

    // ── list-admins ──────────────────────────────────────────────────────────
    if (action === 'list-admins') {
      if (admin.role !== 'owner') return res.status(403).json({ error: 'Owner role required' });
      const { data: rows } = await svc.from('admins').select('id, role, totp_enabled');
      const list = await Promise.all(
        (rows ?? []).map(async (a) => {
          const { data: { user: u } } = await svc.auth.admin.getUserById(a.id);
          return { id: a.id, email: u?.email ?? 'Unknown', role: a.role ?? 'administrator', totp_enabled: a.totp_enabled };
        })
      );
      return res.status(200).json({ admins: list });
    }

    // ── set-role ─────────────────────────────────────────────────────────────
    if (action === 'set-role') {
      if (admin.role !== 'owner') return res.status(403).json({ error: 'Owner role required' });
      const { targetId, newRole } = req.body as { targetId: string; newRole: string };
      if (!['owner', 'administrator', 'moderator'].includes(newRole)) return res.status(400).json({ error: 'Invalid role' });

      await svc.from('admins').update({ role: newRole }).eq('id', targetId);
      await svc.from('admin_audit_logs').insert({
        admin_id: user.id, action: 'role_changed', resource: `${targetId.slice(0, 8)} → ${newRole}`,
        user_agent: req.headers['user-agent'] ?? null,
      });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin-totp] unhandled error:', message);
    return res.status(500).json({ error: message });
  }
}
