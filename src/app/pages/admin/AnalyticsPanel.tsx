import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { format, subDays, subMonths, startOfDay, eachDayOfInterval } from 'date-fns';

// Direct PostgREST fetch — avoids the custom supabase query builder
const SB_URL = 'https://hxfccpadsbunynignbwn.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmNjcGFkc2J1bnluaWduYnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk1ODYsImV4cCI6MjA5ODQ4NTU4Nn0.YVABbHcntCEAWSkXtRtKsfWhQ_A8nDYweitrMLTSjyE';
const SB_H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

async function sbGet<T>(table: string, params: Record<string, string>): Promise<T[]> {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${qs}`, { headers: SB_H });
  if (!r.ok) return [];
  const d = await r.json();
  return Array.isArray(d) ? d : [];
}

type Range = '7d' | '30d' | '3m';
interface Order { id: string; total: number; created_at: string; status: string; }
interface Membership { created_at: string; tier: string; }

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="p-5 rounded-2xl flex flex-col gap-1" style={{ background: 'var(--as1)', border: `1px solid ${color}22` }}>
      <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: 'var(--at)' }}>{value}</p>
      {sub && <p className="text-[11px]" style={{ color: 'var(--atf)' }}>{sub}</p>}
    </div>
  );
}

const TICK_STYLE = { fill: '#3a4570', fontSize: 10 };
const GRID_STYLE = { stroke: 'rgba(255,255,255,0.04)' };

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
}

export default function AnalyticsPanel() {
  const [range, setRange] = useState<Range>('7d');
  const [orders, setOrders] = useState<Order[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const since = subMonths(new Date(), 3).toISOString();
      const [ords, mems] = await Promise.all([
        sbGet<Order>('orders', { 'created_at': `gte.${since}`, select: 'id,total,created_at,status', order: 'created_at.asc' }),
        sbGet<Membership>('user_memberships', { 'created_at': `gte.${since}`, select: 'created_at,tier', order: 'created_at.asc' }),
      ]);
      setOrders(ords);
      setMemberships(mems);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const now = new Date();
  const rangeStart = range === '7d' ? subDays(now, 6) : range === '30d' ? subDays(now, 29) : subMonths(now, 3);
  const allDays = eachDayOfInterval({ start: startOfDay(rangeStart), end: startOfDay(now) });
  const MAX_PTS = range === '7d' ? 7 : range === '30d' ? 30 : 24;

  const filteredOrders = orders.filter(o => new Date(o.created_at) >= rangeStart);
  const filteredMembers = memberships.filter(m => new Date(m.created_at) >= rangeStart);

  const dayLabel = (d: Date) => format(d, range === '7d' ? 'EEE' : 'MMM d');

  const revenueData = downsample(allDays.map(day => {
    const s = day.getTime(), e = s + 86400000;
    const dayOrders = filteredOrders.filter(o => { const t = new Date(o.created_at).getTime(); return t >= s && t < e; });
    return { label: dayLabel(day), revenue: dayOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0), orders: dayOrders.length };
  }), MAX_PTS);

  const memberData = downsample(allDays.map(day => {
    const s = day.getTime(), e = s + 86400000;
    const dayMems = filteredMembers.filter(m => { const t = new Date(m.created_at).getTime(); return t >= s && t < e; });
    return { label: dayLabel(day), vip: dayMems.filter(m => m.tier === 'vip').length, reseller: dayMems.filter(m => m.tier === 'reseller').length };
  }), MAX_PTS);

  const totalRevenue   = filteredOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const totalOrders    = filteredOrders.length;
  const deliveredCount = filteredOrders.filter(o => o.status === 'delivered').length;
  const newMembers     = filteredMembers.length;

  const RANGES: { key: Range; label: string }[] = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '3m', label: '3 Months' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(0,191,255,0.15)', borderTopColor: '#00BFFF', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center gap-3 py-20">
      <p className="text-sm" style={{ color: '#FF6B6B' }}>Could not load analytics</p>
      <p className="text-xs" style={{ color: 'var(--atg)' }}>{error}</p>
      <button onClick={loadData} className="px-4 py-2 rounded-lg text-xs font-bold"
        style={{ background: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.2)', color: '#00BFFF', cursor: 'pointer' }}>
        Retry
      </button>
    </div>
  );

  const noRevenue = revenueData.every(d => d.revenue === 0);
  const noOrders  = revenueData.every(d => d.orders === 0);
  const noMembers = memberData.every(d => d.vip === 0 && d.reseller === 0);

  return (
    <div className="space-y-6">
      {/* Header + range selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs uppercase tracking-[0.2em] font-bold" style={{ color: 'var(--atf)' }}>Store Analytics</p>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--as2)', border: '1px solid var(--ab)' }}>
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                background: range === r.key ? 'rgba(0,191,255,0.12)' : 'transparent',
                color: range === r.key ? '#00BFFF' : 'var(--atf)',
                border: range === r.key ? '1px solid rgba(0,191,255,0.25)' : '1px solid transparent',
              }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Revenue" value={`₱${totalRevenue.toLocaleString()}`} sub={`${range} period`} color="#00E676" />
        <StatCard label="Orders" value={totalOrders} sub={`${deliveredCount} delivered`} color="#00BFFF" />
        <StatCard label="New Members" value={newMembers} sub={`${range} period`} color="#FFB400" />
        <StatCard label="Delivery Rate" value={totalOrders > 0 ? `${Math.round((deliveredCount / totalOrders) * 100)}%` : '—'} sub="of all orders" color="#B06EFF" />
      </div>

      {/* Revenue chart */}
      <div className="p-5 rounded-2xl" style={{ background: 'var(--as1)', border: '1px solid var(--ab)' }}>
        <p className="text-xs font-bold uppercase tracking-[0.15em] mb-4" style={{ color: 'var(--at2)' }}>Revenue (₱)</p>
        {noRevenue
          ? <p className="text-xs py-10 text-center" style={{ color: 'var(--atg)' }}>No revenue data for this period</p>
          : <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenueData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID_STYLE} vertical={false} />
                <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} width={44}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                <Tooltip contentStyle={{ background: 'rgba(8,10,24,0.95)', border: '1px solid var(--ab2)', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: 'var(--atm)' }} itemStyle={{ color: '#00E676' }}
                  formatter={(v: number) => [`₱${v.toLocaleString()}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#00E676" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#00E676' }} />
              </LineChart>
            </ResponsiveContainer>
        }
      </div>

      {/* Orders chart */}
      <div className="p-5 rounded-2xl" style={{ background: 'var(--as1)', border: '1px solid var(--ab)' }}>
        <p className="text-xs font-bold uppercase tracking-[0.15em] mb-4" style={{ color: 'var(--at2)' }}>Orders Per Day</p>
        {noOrders
          ? <p className="text-xs py-8 text-center" style={{ color: 'var(--atg)' }}>No orders for this period</p>
          : <ResponsiveContainer width="100%" height={160}>
              <BarChart data={revenueData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID_STYLE} vertical={false} />
                <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'rgba(8,10,24,0.95)', border: '1px solid var(--ab2)', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: 'var(--atm)' }} itemStyle={{ color: '#00BFFF' }}
                  formatter={(v: number) => [v, 'Orders']} />
                <Bar dataKey="orders" fill="#00BFFF" fillOpacity={0.65} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
        }
      </div>

      {/* Members chart */}
      <div className="p-5 rounded-2xl" style={{ background: 'var(--as1)', border: '1px solid var(--ab)' }}>
        <p className="text-xs font-bold uppercase tracking-[0.15em] mb-4" style={{ color: 'var(--at2)' }}>New Member Signups</p>
        {noMembers
          ? <p className="text-xs py-8 text-center" style={{ color: 'var(--atg)' }}>No new members for this period</p>
          : <ResponsiveContainer width="100%" height={160}>
              <BarChart data={memberData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID_STYLE} vertical={false} />
                <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'rgba(8,10,24,0.95)', border: '1px solid var(--ab2)', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: 'var(--atm)' }} />
                <Legend wrapperStyle={{ fontSize: 10, color: 'var(--atf)', paddingTop: 8 }} />
                <Bar dataKey="vip" name="VIP" fill="#FFB400" fillOpacity={0.75} radius={[3, 3, 0, 0]} stackId="a" />
                <Bar dataKey="reseller" name="Reseller" fill="#00E676" fillOpacity={0.75} radius={[3, 3, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
        }
      </div>
    </div>
  );
}
