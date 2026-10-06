import { useState, useEffect } from 'react';

function getAdminToken() {
  try { return JSON.parse(localStorage.getItem('sb_session') ?? 'null')?.access_token ?? ''; } catch { return ''; }
}

const SUPABASE_URL = 'https://hxfccpadsbunynignbwn.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE';

type Order = {
  id: string;
  total: number;
  status: string;
  customer_email: string;
  created_at: string;
};

export default function WebhooksPanel() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [testingReport, setTestingReport] = useState(false);
  const [reportMsg, setReportMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [discordInfo, setDiscordInfo] = useState<{ name: string; guild: string; channel: string } | null>(null);
  const [discordInfoLoading, setDiscordInfoLoading] = useState(false);

  // Load config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const [urlRes, threshRes] = await Promise.all([
          fetch('/api/site-config?key=discord_webhook_url'),
          fetch('/api/site-config?key=low_stock_threshold'),
        ]);
        if (urlRes.ok) {
          const val = await urlRes.json();
          setWebhookUrl(typeof val === 'string' ? val : '');
          if (typeof val === 'string' && val.includes('discord.com/api/webhooks/')) {
            fetchDiscordInfo(val);
          }
        }
        if (threshRes.ok) {
          const val = await threshRes.json();
          setLowStockThreshold(val != null ? String(val) : '5');
        }
      } catch {
        // silently ignore config load errors
      }
    }
    loadConfig();
  }, []);

  async function fetchDiscordInfo(url: string) {
    if (!url || !url.includes('discord.com/api/webhooks/')) return;
    setDiscordInfoLoading(true);
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        const d = await res.json();
        setDiscordInfo({
          name: d.name ?? 'Webhook',
          guild: d.guild_id ?? '',
          channel: d.channel_id ?? '',
        });
      } else {
        setDiscordInfo(null);
      }
    } catch {
      setDiscordInfo(null);
    } finally {
      setDiscordInfoLoading(false);
    }
  }

  // Load recent orders on mount
  useEffect(() => {
    async function loadOrders() {
      setOrdersLoading(true);
      setOrdersError(null);
      try {
        const token = getAdminToken();
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/orders?order=created_at.desc&limit=10&select=id,total,status,customer_email,created_at`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
            },
          }
        );
        if (!res.ok) throw new Error(`Failed to fetch orders (${res.status})`);
        const data: Order[] = await res.json();
        setOrders(data);
      } catch (err: unknown) {
        setOrdersError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setOrdersLoading(false);
      }
    }
    loadOrders();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    const token = getAdminToken();
    try {
      const results = await Promise.all([
        fetch('/api/admin?action=set-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ key: 'discord_webhook_url', value: webhookUrl }),
        }),
        fetch('/api/admin?action=set-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ key: 'low_stock_threshold', value: lowStockThreshold }),
        }),
      ]);
      const allOk = results.every((r) => r.ok);
      setSaveMsg(allOk ? { text: 'Configuration saved.', ok: true } : { text: 'One or more saves failed.', ok: false });
    } catch {
      setSaveMsg({ text: 'Network error — could not save.', ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestWebhook() {
    if (!webhookUrl) {
      setTestMsg({ text: 'No webhook URL configured.', ok: false });
      return;
    }
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Test webhook from admin panel',
          username: 'Shop Bot',
        }),
      });
      if (res.ok || res.status === 204) {
        setTestMsg({ text: 'Test message sent to Discord.', ok: true });
      } else {
        setTestMsg({ text: `Discord returned ${res.status}.`, ok: false });
      }
    } catch {
      setTestMsg({ text: 'Failed to reach Discord webhook URL.', ok: false });
    } finally {
      setTesting(false);
    }
  }

  async function handleTestReport() {
    if (!webhookUrl) {
      setReportMsg({ text: 'No webhook URL configured — save it first.', ok: false });
      return;
    }
    setTestingReport(true);
    setReportMsg(null);
    try {
      const token = getAdminToken();
      const res = await fetch('/api/cron-stock-report', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setReportMsg({ text: '✓ Stock report sent to Discord.', ok: true });
      } else {
        const d = await res.json().catch(() => ({}));
        setReportMsg({ text: `Failed: ${(d as any).error ?? res.status}`, ok: false });
      }
    } catch {
      setReportMsg({ text: 'Network error.', ok: false });
    } finally {
      setTestingReport(false);
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const s = {
    page: {
      color: 'var(--at)',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '24px',
    },
    heading: {
      fontSize: '22px',
      fontWeight: 600,
      color: 'var(--at)',
      marginBottom: '4px',
    },
    subheading: {
      fontSize: '14px',
      color: 'var(--atm)',
      marginBottom: '0',
    },
    card: {
      background: 'var(--as1)',
      border: '1px solid var(--ab)',
      borderRadius: '12px',
      padding: '24px',
    },
    cardTitle: {
      fontSize: '15px',
      fontWeight: 600,
      color: 'var(--at)',
      marginBottom: '18px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    label: {
      display: 'block',
      fontSize: '13px',
      color: 'var(--atm)',
      marginBottom: '6px',
    },
    input: {
      width: '100%',
      background: 'var(--as3)',
      border: '1px solid var(--ab2)',
      borderRadius: '8px',
      padding: '10px 14px',
      color: 'var(--at)',
      fontSize: '14px',
      outline: 'none',
      boxSizing: 'border-box' as const,
    },
    fieldGroup: {
      marginBottom: '16px',
    },
    btnPrimary: (accent: string) => ({
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      padding: '10px 20px',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
    }),
    btnOutline: {
      background: 'transparent',
      color: 'var(--at)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '8px',
      padding: '10px 20px',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
    },
    statusMsg: (ok: boolean) => ({
      fontSize: '13px',
      color: ok ? '#4ade80' : '#f87171',
      marginTop: '10px',
    }),
    divider: {
      borderColor: 'var(--ab)',
      margin: '20px 0',
    },
    eventRow: {
      display: 'flex',
      gap: '12px',
      marginBottom: '14px',
    },
    eventIcon: {
      fontSize: '18px',
      lineHeight: '1.4',
      flexShrink: 0,
    },
    eventName: {
      fontSize: '14px',
      fontWeight: 600,
      color: 'var(--at)',
      marginBottom: '2px',
    },
    eventDesc: {
      fontSize: '13px',
      color: 'var(--atm)',
    },
    orderRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 0',
      borderBottom: '1px solid var(--ab)',
      fontSize: '13px',
    },
    badge: (status: string) => {
      const delivered = status === 'delivered';
      return {
        fontSize: '11px',
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: '99px',
        background: delivered ? 'rgba(74,222,128,0.12)' : 'rgba(123,136,192,0.12)',
        color: delivered ? '#4ade80' : 'var(--atm)',
        whiteSpace: 'nowrap' as const,
      };
    },
  };

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div>
        <h2 style={s.heading}>Webhooks</h2>
        <p style={s.subheading}>Configure Discord notifications and monitor recent activity.</p>
      </div>

      {/* Discord Config Card */}
      <div style={s.card}>
        <div style={s.cardTitle}>
          <span style={{ color: '#5865F2', fontSize: '18px' }}>⚙</span>
          Discord Webhook Configuration
        </div>

        <div style={s.fieldGroup}>
          <label style={s.label}>Discord Webhook URL</label>
          <input
            style={s.input}
            type="url"
            placeholder="https://discord.com/api/webhooks/..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
        </div>

        <div style={s.fieldGroup}>
          <label style={s.label}>Low Stock Threshold</label>
          <input
            style={{ ...s.input, maxWidth: '180px' }}
            type="number"
            min="0"
            placeholder="e.g. 5"
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            style={s.btnPrimary('#5865F2')}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>

          <button
            style={s.btnOutline}
            onClick={handleTestWebhook}
            disabled={testing || !webhookUrl}
            title={webhookUrl ? 'Send a test ping to Discord' : 'Enter a webhook URL first'}
          >
            {testing ? 'Sending…' : 'Test Ping'}
          </button>

          <button
            style={s.btnOutline}
            onClick={handleTestReport}
            disabled={testingReport || !webhookUrl}
            title={webhookUrl ? 'Send a stock report to Discord now' : 'Enter a webhook URL first'}
          >
            {testingReport ? 'Sending…' : 'Test Stock Report'}
          </button>
        </div>

        {saveMsg && <p style={s.statusMsg(saveMsg.ok)}>{saveMsg.text}</p>}
        {testMsg && <p style={s.statusMsg(testMsg.ok)}>{testMsg.text}</p>}
        {reportMsg && <p style={s.statusMsg(reportMsg.ok)}>{reportMsg.text}</p>}
      </div>

      {/* Connected Consumers Card */}
      <div style={s.card}>
        <div style={s.cardTitle}>
          <span style={{ color: '#00BFFF', fontSize: '18px' }}>🔗</span>
          Connected Webhook Consumers
        </div>
        <p style={{ ...s.subheading, marginBottom: '16px', fontSize: '12px' }}>
          Services currently registered to receive webhook events from this shop.
        </p>

        {/* Discord row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 14px', borderRadius: '10px', background: webhookUrl ? 'rgba(88,101,242,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${webhookUrl ? 'rgba(88,101,242,0.25)' : 'rgba(255,255,255,0.06)'}` }}>
          {/* Discord logo mark */}
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="16" viewBox="0 0 71 55" fill="white">
              <path d="M60.1 4.9A58.5 58.5 0 0 0 45.6.9a.2.2 0 0 0-.2.1c-.6 1.1-1.3 2.5-1.8 3.6a54.1 54.1 0 0 0-16.3 0 36 36 0 0 0-1.8-3.6.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.9 4.9a.2.2 0 0 0-.1.1C1.6 18.4-.9 31.5.3 44.4a.2.2 0 0 0 .1.2 58.8 58.8 0 0 0 17.7 9 .2.2 0 0 0 .3-.1 42.1 42.1 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.7 38.7 0 0 1-5.5-2.6.2.2 0 0 1 0-.4c.4-.3.7-.5 1.1-.8a.2.2 0 0 1 .2 0c11.6 5.3 24.1 5.3 35.6 0a.2.2 0 0 1 .2 0l1.1.8a.2.2 0 0 1 0 .4 36 36 0 0 1-5.5 2.6.2.2 0 0 0-.1.3c1.1 2 2.3 3.9 3.6 5.9a.2.2 0 0 0 .3.1 58.6 58.6 0 0 0 17.8-9 .2.2 0 0 0 .1-.2c1.5-15-2.5-28-10.6-39.5a.2.2 0 0 0-.1-.1zM23.7 36.5c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2z"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--at)' }}>Discord</span>
              {webhookUrl ? (
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                  {discordInfoLoading ? '…' : 'Connected'}
                </span>
              ) : (
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(255,255,255,0.05)', color: 'var(--atg)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Not configured
                </span>
              )}
            </div>
            {webhookUrl && discordInfo && (
              <div style={{ fontSize: '12px', color: 'var(--atm)' }}>
                Webhook: <span style={{ color: 'var(--at2)' }}>{discordInfo.name}</span>
                {discordInfo.guild && (
                  <> · <span style={{ color: 'var(--atg)', fontSize: '11px', fontFamily: 'monospace' }}>Guild {discordInfo.guild.slice(-6)}</span></>
                )}
              </div>
            )}
            {webhookUrl && !discordInfo && !discordInfoLoading && (
              <div style={{ fontSize: '12px', color: 'var(--atm)' }}>
                Webhook URL configured · <span style={{ color: 'var(--atg)', fontFamily: 'monospace', fontSize: '11px' }}>…/{webhookUrl.split('/').slice(-2, -1)[0]?.slice(-8)}/****</span>
              </div>
            )}
            {!webhookUrl && (
              <div style={{ fontSize: '12px', color: 'var(--atg)' }}>Add a Discord webhook URL above to connect your server.</div>
            )}
          </div>
          <div style={{ flexShrink: 0 }}>
            {webhookUrl ? (
              <button onClick={handleTestWebhook} disabled={testing}
                style={{ fontSize: '11px', padding: '5px 10px', borderRadius: 7, background: 'rgba(88,101,242,0.1)', border: '1px solid rgba(88,101,242,0.3)', color: '#8896f7', cursor: 'pointer', fontWeight: 600 }}>
                {testing ? '…' : 'Ping'}
              </button>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--atg)' }}>—</span>
            )}
          </div>
        </div>

        {/* Placeholder for future integrations */}
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.06)', opacity: 0.5 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '16px' }}>+</span>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--atg)' }}>More integrations coming soon</div>
            <div style={{ fontSize: '11px', color: 'var(--atf)' }}>Slack, Telegram, custom endpoints</div>
          </div>
        </div>
      </div>

      {/* Events Reference Card */}
      <div style={s.card}>
        <div style={s.cardTitle}>
          <span style={{ color: '#00BFFF', fontSize: '18px' }}>📋</span>
          Webhook Events Reference
        </div>

        <div style={s.eventRow}>
          <span style={s.eventIcon}>🛒</span>
          <div>
            <div style={s.eventName}>Purchase</div>
            <div style={s.eventDesc}>
              Fires when an order is fulfilled — payment received and product delivered to the customer.
            </div>
          </div>
        </div>

        <div style={s.eventRow}>
          <span style={s.eventIcon}>⚠️</span>
          <div>
            <div style={s.eventName}>Low Stock</div>
            <div style={s.eventDesc}>
              Fires when a product's remaining stock drops at or below the configured threshold after a sale.
            </div>
          </div>
        </div>

        <div style={s.eventRow}>
          <span style={s.eventIcon}>📦</span>
          <div>
            <div style={s.eventName}>Hourly Stock Report</div>
            <div style={s.eventDesc}>
              Fires every hour via a scheduled cron job. Requires the project to be deployed to Vercel with cron
              support enabled.
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Card */}
      <div style={s.card}>
        <div style={s.cardTitle}>
          <span style={{ color: '#00BFFF', fontSize: '18px' }}>🕒</span>
          Recent Activity
        </div>

        {ordersLoading && (
          <p style={{ color: 'var(--atm)', fontSize: '14px' }}>Loading orders…</p>
        )}

        {ordersError && (
          <p style={{ color: '#f87171', fontSize: '14px' }}>Error: {ordersError}</p>
        )}

        {!ordersLoading && !ordersError && orders.length === 0 && (
          <p style={{ color: 'var(--atm)', fontSize: '14px' }}>No recent orders found.</p>
        )}

        {!ordersLoading && !ordersError && orders.length > 0 && (
          <div>
            {orders.map((order, idx) => {
              const isDelivered = order.status === 'delivered';
              const label = isDelivered ? '🛒 Purchase webhook fired' : `Status: ${order.status}`;
              return (
                <div
                  key={order.id}
                  style={{
                    ...s.orderRow,
                    ...(idx === orders.length - 1 ? { borderBottom: 'none' } : {}),
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <span style={{ color: 'var(--at)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.customer_email || '—'}
                    </span>
                    <span style={{ color: 'var(--atg)', fontSize: '11px' }}>{label}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0, marginLeft: '12px' }}>
                    <span style={s.badge(order.status)}>
                      {isDelivered ? 'delivered' : order.status}
                    </span>
                    <span style={{ color: 'var(--atg)', fontSize: '11px' }}>
                      {formatDate(order.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
