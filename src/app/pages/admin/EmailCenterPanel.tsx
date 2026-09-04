import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { EmailLog } from '@/lib/types';

const STATUS_COLOR: Record<string, string> = {
  sent:       '#00BFFF',
  delivered:  '#00E676',
  failed:     '#FF6B6B',
};
const STATUS_BG: Record<string, string> = {
  sent:       'rgba(0,191,255,0.1)',
  delivered:  'rgba(0,230,118,0.1)',
  failed:     'rgba(255,68,68,0.1)',
};

export default function EmailCenterPanel() {
  const [logs, setLogs]       = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<'all' | 'sent' | 'delivered' | 'failed'>('all');

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
            <div className="text-2xl font-black mb-0.5" style={{ color: s.color, fontFamily: "'Rajdhani', 'Inter', sans-serif" }}>{s.value}</div>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: '#3a4570' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Success rate bar */}
      <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] uppercase tracking-widest" style={{ color: '#7b88c0' }}>Email Success Rate</span>
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
            background: filter === f ? 'rgba(0,191,255,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${filter === f ? 'rgba(0,191,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
            color: filter === f ? '#00BFFF' : '#7b88c0',
            padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && <span className="ml-1.5 opacity-60">{counts[f as keyof typeof counts] ?? 0}</span>}
          </button>
        ))}
      </div>

      {/* Email log table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-4 py-3 grid grid-cols-12 gap-3 text-[10px] uppercase tracking-widest" style={{ background: 'rgba(255,255,255,0.03)', color: '#3a4570', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="col-span-3">Recipient</div>
          <div className="col-span-4">Subject</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Sent</div>
          <div className="col-span-1">Order</div>
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: '#3a4570' }}>Loading email logs...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: '#3a4570' }}>No email logs found</div>
        ) : filtered.map(log => (
          <div key={log.id} className="px-4 py-3 grid grid-cols-12 gap-3 items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="col-span-3 min-w-0">
              <p className="text-xs truncate" style={{ color: '#c8d0f0' }}>{log.recipient}</p>
            </div>
            <div className="col-span-4 min-w-0">
              <p className="text-xs truncate" style={{ color: '#7b88c0' }}>{log.subject ?? '—'}</p>
              {log.error && <p className="text-[10px] truncate" style={{ color: '#FF6B6B' }}>{log.error}</p>}
            </div>
            <div className="col-span-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{
                background: STATUS_BG[log.status] ?? 'rgba(255,255,255,0.05)',
                color: STATUS_COLOR[log.status] ?? '#7b88c0',
                border: `1px solid ${STATUS_COLOR[log.status] ?? '#7b88c0'}33`,
              }}>
                {log.status}
              </span>
            </div>
            <div className="col-span-2">
              <p className="text-[11px]" style={{ color: '#3a4570' }}>
                {format(new Date(log.sent_at), 'MMM d HH:mm')}
              </p>
            </div>
            <div className="col-span-1">
              {log.order_id && (
                <p className="text-[10px] font-mono" style={{ color: '#3a4570' }}>
                  {log.order_id.slice(0, 6)}…
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px]" style={{ color: '#3a4570' }}>Auto-refreshes every 10 seconds · {filtered.length} records</p>
    </div>
  );
}
