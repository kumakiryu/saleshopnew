import { projectId, publicAnonKey } from '../../utils/supabase/info';

const BASE = `https://${projectId}.supabase.co`;
let _session: { access_token: string; user: any } | null = null;

function authHeaders(extra?: Record<string, string>) {
  return {
    'apikey': publicAnonKey,
    'Authorization': `Bearer ${_session?.access_token ?? publicAnonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...extra,
  };
}

// ── Query builder ─────────────────────────────────────────────────────────────

type Order = { column: string; ascending: boolean };

class QueryBuilder {
  private _table: string;
  private _select = '*';
  private _filters: string[] = [];
  private _order: Order | null = null;
  private _limit: number | null = null;
  private _single = false;
  private _maybeSingle = false;

  constructor(table: string) { this._table = table; }

  select(cols = '*') { this._select = cols; return this; }
  eq(col: string, val: unknown) { this._filters.push(`${col}=eq.${val}`); return this; }
  neq(col: string, val: unknown) { this._filters.push(`${col}=neq.${val}`); return this; }
  in(col: string, vals: unknown[]) { this._filters.push(`${col}=in.(${vals.join(',')})`); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this._order = { column: col, ascending: opts?.ascending ?? true }; return this;
  }
  limit(n: number) { this._limit = n; return this; }
  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }

  private _buildUrl(method: string) {
    const qs = new URLSearchParams({ select: this._select });
    this._filters.forEach(f => { const [k, v] = f.split('='); qs.append(k, v); });
    if (this._order) qs.append('order', `${this._order.column}.${this._order.ascending ? 'asc' : 'desc'}`);
    if (this._limit) qs.append('limit', String(this._limit));
    return `${BASE}/rest/v1/${this._table}?${qs}`;
  }

  async then(resolve: (v: any) => void, reject?: (e: any) => void) {
    try {
      const res = await fetch(this._buildUrl('GET'), { headers: authHeaders({ 'Prefer': 'return=representation' }) });
      const json = await res.json();
      if (!res.ok) { resolve({ data: null, error: json }); return; }
      if (this._single) {
        if (!Array.isArray(json) || json.length === 0) resolve({ data: null, error: { message: 'No rows' } });
        else resolve({ data: json[0], error: null });
      } else if (this._maybeSingle) {
        resolve({ data: Array.isArray(json) ? (json[0] ?? null) : null, error: null });
      } else {
        resolve({ data: json, error: null });
      }
    } catch (e) { resolve({ data: null, error: e }); }
  }

  async insert(data: object | object[]) {
    const res = await fetch(`${BASE}/rest/v1/${this._table}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { data: null, error: json };
    const rows = Array.isArray(json) ? json : [json];
    return { data: Array.isArray(data) ? rows : rows[0] ?? null, error: null };
  }

  async upsert(data: object | object[], opts?: { onConflict?: string }) {
    const prefer = `resolution=merge-duplicates${opts?.onConflict ? `,on_conflict=${opts.onConflict}` : ''}`;
    const res = await fetch(`${BASE}/rest/v1/${this._table}`, {
      method: 'POST',
      headers: authHeaders({ 'Prefer': `return=representation,${prefer}` }),
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { data: null, error: json };
    return { data: json, error: null };
  }

  async update(data: object) {
    const qs = new URLSearchParams();
    this._filters.forEach(f => { const [k, v] = f.split('='); qs.append(k, v); });
    const res = await fetch(`${BASE}/rest/v1/${this._table}?${qs}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { data: null, error: json };
    return { data: json, error: null };
  }

  async delete() {
    const qs = new URLSearchParams();
    this._filters.forEach(f => { const [k, v] = f.split('='); qs.append(k, v); });
    const res = await fetch(`${BASE}/rest/v1/${this._table}?${qs}`, {
      method: 'DELETE',
      headers: authHeaders({ 'Prefer': 'return=representation' }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { data: null, error: json };
    return { data: json, error: null };
  }

  on(_event: string, _filter: string, _cb: (payload: any) => void) {
    return { subscribe: () => ({ unsubscribe: () => {} }) };
  }
}

// ── Realtime stub ─────────────────────────────────────────────────────────────

class RealtimeChannel {
  private _table = '';
  private _cb: ((p: any) => void) | null = null;
  private _eventSource: EventSource | null = null;

  on(_event: string, opts: { event: string; schema?: string; table?: string; filter?: string }, cb: (p: any) => void) {
    this._table = opts.table ?? '';
    this._cb = cb;
    return this;
  }

  subscribe() {
    if (!this._table || !this._cb) return this;
    const url = `${BASE}/realtime/v1/api/broadcast?apikey=${publicAnonKey}`;
    return this;
  }

  unsubscribe() { this._eventSource?.close(); }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

const _listeners: Array<(event: string, session: any) => void> = [];
let _initialized = false;

function persistSession(s: typeof _session) {
  _session = s;
  if (s) localStorage.setItem('sb_session', JSON.stringify(s));
  else localStorage.removeItem('sb_session');
}

function loadPersistedSession() {
  if (_initialized) return;
  _initialized = true;
  try {
    const raw = localStorage.getItem('sb_session');
    if (raw) _session = JSON.parse(raw);
  } catch { _session = null; }
}

const auth = {
  getSession: async () => {
    loadPersistedSession();
    return { data: { session: _session }, error: null };
  },

  getUser: async () => {
    loadPersistedSession();
    if (!_session) return { data: { user: null }, error: null };
    const res = await fetch(`${BASE}/auth/v1/user`, { headers: authHeaders() });
    if (!res.ok) return { data: { user: null }, error: await res.json() };
    const user = await res.json();
    return { data: { user }, error: null };
  },

  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': publicAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return { data: { user: null, session: null }, error: json };
    const session = { access_token: json.access_token, user: json.user, ...json };
    persistSession(session);
    _listeners.forEach(l => l('SIGNED_IN', session));
    return { data: { user: json.user, session }, error: null };
  },

  signOut: async () => {
    await fetch(`${BASE}/auth/v1/logout`, { method: 'POST', headers: authHeaders() }).catch(() => {});
    persistSession(null);
    _listeners.forEach(l => l('SIGNED_OUT', null));
    return { error: null };
  },

  onAuthStateChange: (cb: (event: string, session: any) => void) => {
    loadPersistedSession();
    _listeners.push(cb);
    setTimeout(() => cb(_session ? 'SIGNED_IN' : 'SIGNED_OUT', _session), 0);
    return { data: { subscription: { unsubscribe: () => { const i = _listeners.indexOf(cb); if (i >= 0) _listeners.splice(i, 1); } } } };
  },

  admin: {
    getUserById: async (id: string) => {
      const res = await fetch(`${BASE}/auth/v1/admin/users/${id}`, { headers: authHeaders() });
      if (!res.ok) return { data: { user: null }, error: await res.json() };
      return { data: { user: await res.json() }, error: null };
    },
  },
};

// ── Storage ───────────────────────────────────────────────────────────────────

const storage = {
  from: (bucket: string) => ({
    getPublicUrl: (path: string) => ({
      data: { publicUrl: `${BASE}/storage/v1/object/public/${bucket}/${path}` },
    }),
    upload: async (path: string, file: File) => {
      const res = await fetch(`${BASE}/storage/v1/object/${bucket}/${path}`, {
        method: 'POST',
        headers: { 'apikey': publicAnonKey, 'Authorization': `Bearer ${_session?.access_token ?? publicAnonKey}` },
        body: file,
      });
      return res.ok ? { data: { path }, error: null } : { data: null, error: await res.json() };
    },
  }),
};

// ── Channel ───────────────────────────────────────────────────────────────────

function channel(_name: string) { return new RealtimeChannel(); }
function removeChannel(_ch: any) {}

// ── Main client ───────────────────────────────────────────────────────────────

export const supabase = {
  from: (table: string) => new QueryBuilder(table),
  auth,
  storage,
  channel,
  removeChannel,
};
