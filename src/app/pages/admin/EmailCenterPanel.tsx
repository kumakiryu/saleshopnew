import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { EmailLog } from '@/lib/types';

const STATUS_COLOR: Record<string, string> = {
  sent:      '#00BFFF',
  delivered: '#00E676',
  failed:    '#FF6B6B',
};
const STATUS_BG: Record<string, string> = {
  sent:      'rgba(0,191,255,0.1)',
  delivered: 'rgba(0,230,118,0.1)',
  failed:    'rgba(255,68,68,0.1)',
};

function getAdminToken() {
  try { const s = localStorage.getItem('sb_session'); return s ? JSON.parse(s).access_token : ''; } catch { return ''; }
}

export default function EmailCenterPanel() {
  const [logs, setLogs]       = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<'all' | 'sent' | 'delivered' | 'failed'>('all');
  const [resending, setResending] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    const { data } = await supabase
      .from('email_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(200);
    if (data) setLogs(data as EmailLog[]);
    setLoading(false);
  }

  async function resend(orderId: string, logId: string) {
    setResending(logId);
    setResendMsg(null);
    try {
      const r = await fetch('/api/admin?action=resend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
        body: JSON.stringify({ order_id: orderId }),
      });
      const d = await r.json();
      setResendMsg({ id: logId, ok: r.ok, text: r.ok ? '✓ Resent' : d.error ?? 'Failed' });
      if (r.ok) setTimeout(load, 1500);
    } catch {
      setResendMsg({ id: logId, ok: false, text: 'Request failed' });
    } finally { setResending(null); }
  }

  const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter);

  const counts = {
    total:     logs.length,
    delivered: logs.filter(l => l.status === 'delivered').length,
    sent:      logs.filter(l => l.status === 'sent').length,
    failed:    logs.filter(l => l.status === 'failed').length,
  };
  const successRate = counts.total > 0
    ? Math.round(((counts.delivered + counts.sent) / counts.total) * 100)
    : 100;

  return (
    <div className="flex flex-col gap-6">

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Emails', value: counts.total, color: '#00BFFF' },
          { label: 'Delivered', value: counts.delivered, color: '#00E676' },
          { label: 'Sent (pending)', value: counts.sent, color: '#FFB400' },
          { label: 'Failed', value: counts.failed, color: '#FF6B6B' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
            border: `1px solid ${s.color}22`,
          }}>
            <div className="text-2xl font-black mb-0.5" style={{ color: s.color, fontFamily: "'Exo 2', 'Inter', sans-serif" }}>{s.value}</div>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atg)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Success rate bar */}
      <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: 'var(--as2)', border: '1px solid var(--ab)' }}>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--atm)' }}>Email Success Rate</span>
            <span className="text-sm font-bold" style={{ color: successRate >= 90 ? '#00E676' : successRate >= 70 ? '#FFB400' : '#FF6B6B' }}>{successRate}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${successRate}%`,
              background: successRate >= 90 ? '#00E676' : successRate >= 70 ? '#FFB400' : '#FF6B6B',
            }} />
          </div>
        </div>
        <button onClick={load} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.2)', color: '#00BFFF', cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'delivered', 'sent', 'failed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? 'rgba(0,191,255,0.12)' : 'var(--as2)',
            border: `1px solid ${filter === f ? 'rgba(0,191,255,0.3)' : 'var(--ab)'}`,
            color: filter === f ? '#00BFFF' : 'var(--atm)',
            padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && <span className="ml-1.5 opacity-60">{counts[f as keyof typeof counts] ?? 0}</span>}
          </button>
        ))}
      </div>

      {/* Email log table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--ab)' }}>
        <div className="px-4 py-3 grid gap-3 text-[10px] uppercase tracking-widest" style={{ gridTemplateColumns: '2fr 3fr 1fr 1.5fr 1fr 60px', background: 'var(--as2)', color: 'var(--atg)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div>Recipient</div>
          <div>Subject</div>
          <div>Status</div>
          <div>Sent</div>
          <div>Order</div>
          <div></div>
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--atg)' }}>Loading email logs...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--atg)' }}>No email logs found</div>
        ) : filtered.map(log => (
          <div key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            {/* Summary row — clickable to expand */}
            <div
              className="px-4 py-3 grid gap-3 items-center cursor-pointer"
              style={{ gridTemplateColumns: '2fr 3fr 1fr 1.5fr 1fr 60px' }}
              onClick={() => setExpanded(ex => ex === log.id ? null : log.id)}
            >
              <div className="min-w-0 flex items-center gap-1.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3a4570" strokeWidth="2.5" style={{ flexShrink: 0, transform: expanded === log.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="9 18 15 12 9 6"/></svg>
                <p className="text-xs truncate" style={{ color: 'var(--at2)' }}>{log.recipient}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs truncate" style={{ color: 'var(--atm)' }}>{log.subject ?? '—'}</p>
                {log.error && <p className="text-[10px] truncate" style={{ color: '#FF6B6B' }}>{log.error}</p>}
              </div>
              <div>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{
                  background: STATUS_BG[log.status] ?? 'var(--as4)',
                  color: STATUS_COLOR[log.status] ?? 'var(--atm)',
                  border: `1px solid ${STATUS_COLOR[log.status] ?? '#7b88c0'}33`,
                }}>
                  {log.status}
                </span>
              </div>
              <div>
                <p className="text-[11px]" style={{ color: 'var(--atg)' }}>
                  {format(new Date(log.sent_at), 'MMM d HH:mm')}
                </p>
              </div>
              <div>
                {log.order_id && (
                  <p className="text-[10px] font-mono" style={{ color: 'var(--atg)' }}>
                    {log.order_id.slice(0, 6)}…
                  </p>
                )}
              </div>
              <div onClick={e => e.stopPropagation()}>
                {log.order_id && (
                  <div>
                    <button
                      disabled={resending === log.id}
                      onClick={() => resend(log.order_id!, log.id)}
                      className="text-[10px] px-2 py-1 rounded font-bold"
                      style={{ background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.2)', color: '#FFB400', cursor: 'pointer', whiteSpace: 'nowrap', opacity: resending === log.id ? 0.5 : 1 }}>
                      {resending === log.id ? '...' : 'Resend'}
                    </button>
                    {resendMsg?.id === log.id && (
                      <p className="text-[9px] mt-0.5" style={{ color: resendMsg.ok ? '#00E676' : '#FF6B6B' }}>{resendMsg.text}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Expanded detail panel */}
            {expanded === log.id && (
              <div className="mx-4 mb-3 p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--ab)' }}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--atg)' }}>To</p>
                    <p className="text-xs font-mono" style={{ color: 'var(--at2)' }}>{log.recipient}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--atg)' }}>Sent At</p>
                    <p className="text-xs" style={{ color: 'var(--at2)' }}>{format(new Date(log.sent_at), 'PPpp')}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--atg)' }}>Subject</p>
                    <p className="text-xs" style={{ color: 'var(--at2)' }}>{log.subject ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--atg)' }}>Status</p>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: STATUS_BG[log.status], color: STATUS_COLOR[log.status] }}>{log.status}</span>
                  </div>
                  {log.order_id && (
                    <div>
                      <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--atg)' }}>Order ID</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--atm)' }}>{log.order_id}</p>
                    </div>
                  )}
                  {log.resend_id && (
                    <div>
                      <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--atg)' }}>Resend Message ID</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--atm)' }}>{log.resend_id}</p>
                    </div>
                  )}
                </div>
                {log.error && (
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.2)' }}>
                    <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#FF6B6B' }}>Error Details</p>
                    <p className="text-[11px] font-mono break-all" style={{ color: '#FF6B6B' }}>{log.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-[11px]" style={{ color: 'var(--atg)' }}>Auto-refreshes every 10 seconds · {filtered.length} records · Resend re-sends the delivery email for any order.</p>
    </div>
  );
}
