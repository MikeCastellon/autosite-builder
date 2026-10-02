// Test doubles for the publish functions: an in-memory R2 bucket behind a
// fake fetch (the Cloudflare v4 object and list endpoints), and a fake
// Supabase client that understands the query chains publish-site,
// admin-site-upgrade, slugClaim and adminAuth use.
import { vi } from 'vitest';

const OBJECT_PATH = /\/r2\/buckets\/autosite-published\/objects(?:\/([^/]+))?$/;

// opts.failPut(key) / opts.failGet(key) → true makes that call fail.
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
      if (opts.failPut?.(key)) return new Response('boom', { status: 500 });
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

// tables: { sites: [...], profiles: [...], widget_configs: [...] }
// opts.publishedAtError: error object returned for an update that sets
// published_at, or a select that names it (e.g. the column is missing);
// opts.throwOnPublishedAt makes such an update throw.
export function fakeDb(tables = {}, opts = {}) {
  const state = { sites: [], profiles: [], widget_configs: [], ...structuredClone(tables) };
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

  return { from, state, updates };
}

export const post = (body, headers = {}) => ({
  httpMethod: 'POST',
  headers: { authorization: 'Bearer token', ...headers },
  body: JSON.stringify(body),
});

export const bodyOf = (res) => JSON.parse(res.body);
