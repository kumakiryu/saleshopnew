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

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const [urlRes, threshRes] = await Promise.all([
          fetch('/api/site-config?key=discord_webhook_url'),
          fetch('/api/site-config?key=low_stock_threshold'),
        ]);
        if (urlRes.ok) {
          const data = await urlRes.json();
          setWebhookUrl(data.value ?? '');
        }
        if (threshRes.ok) {
          const data = await threshRes.json();
          setLowStockThreshold(data.value ?? '');
        }
      } catch {
        // silently ignore config load errors
      }
    }
    loadConfig();
  }, []);

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
            title={webhookUrl ? 'Send a test message to Discord' : 'Enter a webhook URL first'}
          >
            {testing ? 'Sending…' : 'Send Test'}
          </button>
        </div>

        {saveMsg && <p style={s.statusMsg(saveMsg.ok)}>{saveMsg.text}</p>}
        {testMsg && <p style={s.statusMsg(testMsg.ok)}>{testMsg.text}</p>}
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
