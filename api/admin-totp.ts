import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hxfccpadsbunynignbwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE';
const APP_NAME = 'Sale Shop Admin';

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
  // Fallback for columns that may not exist yet if migration hasn't run
  if (admin.role === undefined) admin.role = 'administrator';
  if (admin.totp_enabled === undefined) admin.totp_enabled = false;
  return { user, admin, client };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
  if (req.method !== 'POST') return res.status(405).end();

  const { action, code, token } = req.body as {
    action: 'setup' | 'verify-setup' | 'verify' | 'disable' | 'status';
    code?: string;
    token: string;
  };

  if (!token) return res.status(401).json({ error: 'No auth token' });

  const ctx = await getAdminUser(token);
  if (!ctx) return res.status(403).json({ error: 'Not an admin' });

  const { user, admin } = ctx;
  const svc = serviceClient();

  // ── status ──────────────────────────────────────────────────────
  if (action === 'status') {
    return res.status(200).json({ totp_enabled: admin.totp_enabled, role: admin.role ?? 'administrator' });
  }

  // ── setup: generate secret + QR code ────────────────────────────
  if (action === 'setup') {
    const secret = authenticator.generateSecret(20);
    const uri = authenticator.keyuri(user.email ?? 'admin', APP_NAME, secret);
    const qrDataUrl = await QRCode.toDataURL(uri, { width: 220, margin: 2, color: { dark: '#c8d0f0', light: '#050816' } });

    await svc.from('admin_totp_secrets').upsert({ admin_id: user.id, secret, enabled: false }, { onConflict: 'admin_id' });

    return res.status(200).json({ qrDataUrl, secret });
  }

  // ── verify-setup: confirm code and enable 2FA ────────────────────
  if (action === 'verify-setup') {
    const { data: row } = await svc.from('admin_totp_secrets').select('secret').eq('admin_id', user.id).single();
    if (!row) return res.status(400).json({ error: 'Run setup first' });

    const valid = authenticator.verify({ token: code!, secret: row.secret });
    if (!valid) return res.status(400).json({ error: 'Invalid code — check your authenticator app' });

    await svc.from('admin_totp_secrets').update({ enabled: true }).eq('admin_id', user.id);
    await svc.from('admins').update({ totp_enabled: true }).eq('id', user.id);

    await svc.from('admin_audit_logs').insert({
      admin_id: user.id, action: '2fa_enabled', resource: 'settings',
      user_agent: req.headers['user-agent'] ?? null,
    });

    return res.status(200).json({ success: true });
  }

  // ── verify: vault access check ───────────────────────────────────
  if (action === 'verify') {
    const { data: row } = await svc.from('admin_totp_secrets').select('secret, enabled').eq('admin_id', user.id).single();
    if (!row?.enabled) return res.status(400).json({ error: '2FA not enabled' });

    const valid = authenticator.verify({ token: code!, secret: row.secret });
    if (!valid) return res.status(400).json({ error: 'Invalid code' });

    await svc.from('admin_audit_logs').insert({
      admin_id: user.id, action: 'vault_unlocked', resource: 'inventory',
      user_agent: req.headers['user-agent'] ?? null,
    });

    return res.status(200).json({ success: true });
  }

  // ── disable: remove 2FA ──────────────────────────────────────────
  if (action === 'disable') {
    if (!code) return res.status(400).json({ error: 'Confirm with your current code first' });
    const { data: row } = await svc.from('admin_totp_secrets').select('secret').eq('admin_id', user.id).single();
    if (row) {
      const valid = authenticator.verify({ token: code, secret: row.secret });
      if (!valid) return res.status(400).json({ error: 'Invalid code' });
    }

    await svc.from('admin_totp_secrets').delete().eq('admin_id', user.id);
    await svc.from('admins').update({ totp_enabled: false }).eq('id', user.id);
    await svc.from('admin_audit_logs').insert({
      admin_id: user.id, action: '2fa_disabled', resource: 'settings',
      user_agent: req.headers['user-agent'] ?? null,
    });

    return res.status(200).json({ success: true });
  }

  // ── list-admins: fetch all admins with emails (owner only) ──────
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

  // ── set-role: change an admin's role (owner only) ────────────────
  if (action === 'set-role') {
    if (admin.role !== 'owner') return res.status(403).json({ error: 'Owner role required' });

    const { targetId, newRole } = req.body as { targetId: string; newRole: string };
    const VALID = ['owner', 'administrator', 'moderator'];
    if (!VALID.includes(newRole)) return res.status(400).json({ error: 'Invalid role' });

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
