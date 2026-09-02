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

type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

class QueryBuilder {
  private _table: string;
  private _cols = '*';
  private _filters: string[] = [];
  private _orderCol = '';
  private _orderAsc = true;
  private _limitN: number | null = null;
  private _single = false;
  private _maybeSingle = false;
  private _op: Op = 'select';
  private _body: unknown = null;
  private _upsertConflict?: string;

  constructor(table: string) { this._table = table; }

  // ── filter helpers ──────────────────────────────────────────────────────────
  eq(col: string, val: unknown) { this._filters.push(`${col}=eq.${val}`); return this; }
  neq(col: string, val: unknown) { this._filters.push(`${col}=neq.${val}`); return this; }
  in(col: string, vals: unknown[]) { this._filters.push(`${col}=in.(${vals.join(',')})`); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this._orderCol = col; this._orderAsc = opts?.ascending ?? true; return this;
  }
  limit(n: number) { this._limitN = n; return this; }

  // ── terminal markers ────────────────────────────────────────────────────────
  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }

  // ── operations (all return `this` for chaining) ─────────────────────────────
  select(cols = '*') {
    if (this._op === 'select') this._cols = cols;
    // if called after insert/update/upsert: no-op, just enables row return
    return this;
  }

  insert(data: unknown) { this._op = 'insert'; this._body = data; return this; }
  update(data: unknown) { this._op = 'update'; this._body = data; return this; }

  upsert(data: unknown, opts?: { onConflict?: string }) {
    this._op = 'upsert'; this._body = data; this._upsertConflict = opts?.onConflict; return this;
  }

  delete() { this._op = 'delete'; return this; }

  // ── filter querystring builder ──────────────────────────────────────────────
  private _filterQS() {
    const qs = new URLSearchParams();
    for (const f of this._filters) {
      const i = f.indexOf('=');
      qs.append(f.slice(0, i), f.slice(i + 1));
    }
    return qs;
  }

  // ── awaitable ───────────────────────────────────────────────────────────────
  then(resolve: (v: any) => void, reject?: (e: any) => void) {
    const run = async () => {
      try {
        let res: Response;

        if (this._op === 'select') {
          const qs = this._filterQS();
          qs.set('select', this._cols);
          if (this._orderCol) qs.set('order', `${this._orderCol}.${this._orderAsc ? 'asc' : 'desc'}`);
          if (this._limitN) qs.set('limit', String(this._limitN));
          res = await fetch(`${BASE}/rest/v1/${this._table}?${qs}`, { headers: authHeaders() });

        } else if (this._op === 'insert') {
          res = await fetch(`${BASE}/rest/v1/${this._table}`, {
            method: 'POST',
            headers: authHeaders({ 'Prefer': 'return=representation' }),
            body: JSON.stringify(this._body),
          });

        } else if (this._op === 'upsert') {
          const prefer = `return=representation,resolution=merge-duplicates${this._upsertConflict ? `,on_conflict=${this._upsertConflict}` : ''}`;
          res = await fetch(`${BASE}/rest/v1/${this._table}`, {
            method: 'POST',
            headers: authHeaders({ 'Prefer': prefer }),
            body: JSON.stringify(this._body),
          });

        } else if (this._op === 'update') {
          const qs = this._filterQS();
          res = await fetch(`${BASE}/rest/v1/${this._table}?${qs}`, {
            method: 'PATCH',
            headers: authHeaders({ 'Prefer': 'return=representation' }),
            body: JSON.stringify(this._body),
          });

        } else { // delete
          const qs = this._filterQS();
          res = await fetch(`${BASE}/rest/v1/${this._table}?${qs}`, {
            method: 'DELETE',
            headers: authHeaders({ 'Prefer': 'return=representation' }),
          });
        }

        const json = await res.json().catch(() => null);
        if (!res.ok) { resolve({ data: null, error: json }); return; }

        if (this._single) {
          const row = Array.isArray(json) ? (json[0] ?? null) : (json ?? null);
          resolve(row ? { data: row, error: null } : { data: null, error: { message: 'No rows found' } });
        } else if (this._maybeSingle) {
          resolve({ data: Array.isArray(json) ? (json[0] ?? null) : (json ?? null), error: null });
        } else {
          resolve({ data: json ?? [], error: null });
        }
      } catch (e) {
        resolve({ data: null, error: e });
      }
    };
    run().then(undefined, reject);
  }
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
    try {
      const res = await fetch(`${BASE}/auth/v1/user`, { headers: authHeaders() });
      if (!res.ok) { persistSession(null); return { data: { user: null }, error: null }; }
      return { data: { user: await res.json() }, error: null };
    } catch { return { data: { user: null }, error: null }; }
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
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const i = _listeners.indexOf(cb);
            if (i >= 0) _listeners.splice(i, 1);
          },
        },
      },
    };
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

// ── Realtime (stub — real-time not needed for shop preview) ───────────────────

class RealtimeChannel {
  on(_ev: string, _opts: any, _cb: any) { return this; }
  subscribe() { return this; }
  unsubscribe() {}
}

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
