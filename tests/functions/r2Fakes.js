// Test doubles for the publish functions: an in-memory R2 bucket behind a
// fake fetch (the Cloudflare v4 object and list endpoints), an in-memory
// Postmark (the owner emails), and a fake Supabase client that understands
// the query chains publish-site, admin-site-upgrade, slugClaim and
// adminAuth use.
import { vi } from 'vitest';

const OBJECT_PATH = /\/r2\/buckets\/autosite-published\/objects(?:\/([^/]+))?$/;

// opts.failPut(key, body) / opts.failGet(key) → true makes that call fail;
// opts.hangPut(key, body) → true makes that PUT never answer (until its
// AbortSignal fires, if it has one).
export function fakeR2(objects = {}, opts = {}) {
  const store = new Map(Object.entries(objects));
  const calls = [];
  const fetch = vi.fn(async (url, init = {}) => {
    const u = new URL(url);
    const m = u.pathname.match(OBJECT_PATH);
    if (!m) throw new Error(`unexpected fetch ${url}`);
    const method = init.method || 'GET';
    if (!m[1]) {
      const prefix = u.searchParams.get('prefix') || '';
      calls.push(['LIST', prefix]);
      const result = [...store.keys()].filter((k) => k.startsWith(prefix)).sort()
        .map((key) => ({ key, size: store.get(key).length, last_modified: '2026-10-02T12:00:00.000Z' }));
      return new Response(JSON.stringify({ success: true, result, result_info: { is_truncated: false } }), { status: 200 });
    }
    const key = decodeURIComponent(m[1]);
    calls.push([method, key, init.headers?.['Content-Type'] || null]);
    if (method === 'PUT') {
      if (opts.failPut?.(key, init.body)) return new Response('boom', { status: 500 });
      if (opts.hangPut?.(key, init.body)) {
        return new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal.reason || new Error('aborted')));
        });
      }
      store.set(key, init.body);
      return new Response('{"success":true}', { status: 200 });
    }
    if (method === 'GET') {
      if (opts.failGet?.(key)) return new Response('down', { status: 503 });
      if (!store.has(key)) return new Response('{"success":false,"errors":[{"code":10007}]}', { status: 404 });
      return new Response(store.get(key), { status: 200 });
    }
    if (method === 'DELETE') { store.delete(key); return new Response('{}', { status: 200 }); }
    throw new Error(`unexpected ${method}`);
  });
  return { store, calls, fetch };
}

// Postmark's POST /email, answered in memory: `sent` holds every accepted
// message (its JSON body, the token it came with and the MessageID given).
// opts.reject(message) → { status, ErrorCode, Message } refuses that send
// (a status of 500 or more is a Postmark server error);
// opts.noAnswer(message) → true makes it fail like a network error;
// opts.lostAnswer(message) → true accepts it, then fails like a network
// error (Postmark has it, the caller never hears).
// GET /message-streams/{id} answers from opts.streams ({ id: type }).
export const POSTMARK_EMAIL_URL = 'https://api.postmarkapp.com/email';
export const POSTMARK_STREAMS_URL = 'https://api.postmarkapp.com/message-streams/';
export function fakePostmark(opts = {}) {
  const sent = [];
  const attempts = [];
  const lookups = [];
  const streams = opts.streams || { outbound: 'Transactional', broadcast: 'Broadcasts' };
  let n = 0;
  const handle = async (url, init = {}) => {
    if (url.startsWith(POSTMARK_STREAMS_URL) && (init.method || 'GET') === 'GET') {
      const id = decodeURIComponent(url.slice(POSTMARK_STREAMS_URL.length));
      lookups.push({ id, token: init.headers?.['X-Postmark-Server-Token'] || null });
      if (!streams[id]) return new Response(JSON.stringify({ ErrorCode: 1226, Message: 'The message stream for the provided \'ID\' was not found.' }), { status: 422 });
      return new Response(JSON.stringify({ ID: id, Name: id, MessageStreamType: streams[id] }), { status: 200 });
    }
    if (url !== POSTMARK_EMAIL_URL || init.method !== 'POST') throw new Error(`unexpected Postmark call ${init.method} ${url}`);
    const message = JSON.parse(init.body);
    attempts.push(message);
    if (opts.noAnswer?.(message)) throw new TypeError('fetch failed');
    const refusal = opts.reject?.(message);
    if (refusal) {
      return new Response(JSON.stringify({ ErrorCode: refusal.ErrorCode, Message: refusal.Message }), { status: refusal.status || 422 });
    }
    n += 1;
    const MessageID = `pm-msg-${n}`;
    sent.push({ ...message, token: init.headers?.['X-Postmark-Server-Token'] || null, MessageID });
    if (opts.lostAnswer?.(message)) throw new TypeError('fetch failed');
    return new Response(JSON.stringify({ To: message.To, SubmittedAt: '2026-10-03T12:00:00Z', MessageID, ErrorCode: 0, Message: 'OK' }), { status: 200 });
  };
  return { sent, attempts, lookups, handle };
}

// One fetch for a test that talks to R2 and Postmark; anything else throws.
export function routeFetch(r2, postmark) {
  return vi.fn(async (url, init) => {
    if (String(url).startsWith('https://api.postmarkapp.com/')) {
      if (!postmark) throw new Error(`unexpected fetch ${url}`);
      return postmark.handle(String(url), init);
    }
    return r2.fetch(url, init);
  });
}

// tables: { sites: [...], profiles: [...], widget_configs: [...], users: [...] }
// `users` are auth users ({ id, email, user_metadata }), read through
// db.auth.admin.getUserById.
// opts.publishedAtError: error object returned for an update that sets
// published_at, or a select that names it (e.g. the column is missing);
// opts.throwOnPublishedAt makes such an update throw.
export function fakeDb(tables = {}, opts = {}) {
  const state = { sites: [], profiles: [], widget_configs: [], users: [], ...structuredClone(tables) };
  const updates = [];

  function run(q) {
    const rows = state[q.table] || [];
    const match = (r) => q.ops.every(([op, c, v]) => {
      if (op === 'eq') return r[c] === v;
      if (op === 'neq') return r[c] !== v;
      if (op === 'in') return v.includes(r[c]);
      if (op === 'is') return (r[c] ?? null) === v;
      return true;
    });
    const update = q.ops.find((o) => o[0] === 'update');
    // A read naming published_at fails like an update would (missing column).
    const select = q.ops.find((o) => o[0] === 'select');
    if (!update && opts.publishedAtError && /published_at/.test(String(select?.[1] || ''))) {
      return { data: null, error: opts.publishedAtError };
    }
    const single = q.ops.some((o) => o[0] === 'single' || o[0] === 'maybeSingle');
    const hits = rows.filter(match);
    if (update) {
      const patch = update[1];
      updates.push({ table: q.table, patch, ids: hits.map((r) => r.id) });
      if ('published_at' in patch) {
        if (opts.throwOnPublishedAt) throw new Error('network down');
        if (opts.publishedAtError) return { data: null, error: opts.publishedAtError };
      }
      hits.forEach((r) => Object.assign(r, patch));
      return { data: hits.map((r) => ({ ...r })), error: null };
    }
    const copy = (r) => (r ? structuredClone(r) : null);
    return single ? { data: copy(hits[0]), error: null } : { data: hits.map(copy), error: null };
  }

  function from(table) {
    const q = { table, ops: [] };
    const api = {};
    for (const op of ['select', 'update', 'eq', 'neq', 'in', 'is', 'order', 'limit']) {
      api[op] = (...args) => { q.ops.push([op, ...args]); return api; };
    }
    api.single = () => { q.ops.push(['single']); return Promise.resolve().then(() => run(q)); };
    api.maybeSingle = () => { q.ops.push(['maybeSingle']); return Promise.resolve().then(() => run(q)); };
    api.then = (res, rej) => Promise.resolve().then(() => run(q)).then(res, rej);
    return api;
  }

  const auth = {
    admin: {
      getUserById: vi.fn(async (id) => {
        const user = state.users.find((u) => u.id === id);
        return user
          ? { data: { user: structuredClone(user) }, error: null }
          : { data: { user: null }, error: { message: 'User not found', status: 404 } };
      }),
    },
  };

  return { from, auth, state, updates };
}

export const post = (body, headers = {}) => ({
  httpMethod: 'POST',
  headers: { authorization: 'Bearer token', ...headers },
  body: JSON.stringify(body),
});

export const bodyOf = (res) => JSON.parse(res.body);
