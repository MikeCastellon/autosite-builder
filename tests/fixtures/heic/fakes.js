// In-memory stand-ins for the Supabase client the HEIC conversion uses
// (tests/functions/heic-*.test.js): custom_site_projects with updated_at
// moved on every write (as the table's trigger does), the activity log,
// profiles, and the private custom-site-assets bucket. Nothing here
// reaches a database or a bucket.
//
// Hooks a test can set on `state`:
//   beforeUpdate(row)  runs once, just before the next project update is
//                      applied (a write from someone else landing first)
//   onRemove(paths)    runs on every storage remove, before the objects go
//   onDownload(path)   runs on every storage download, before it answers
//   onUpload(path)     runs on every storage upload, after it is stored
//   uploadError(path)  truthy: that upload fails
// Every query is logged in state.ops as [table, kind] and every storage call
// in state.calls as [op, path], in order.
import { readFileSync } from 'node:fs';

// The HEIC files, written on macOS:
//   sample.heic       96x64, one image, a four-corner gradient (sips)
//   grid-turned.heic  1202x802 stored the way an iPhone stores a photo: a
//                     grid of 512x512 HEVC tiles, with orientation 6 (irot:
//                     turn 90 degrees clockwise to stand upright). Stored
//                     quadrants: top left blue, top right pink, bottom left
//                     green, bottom right yellow. Turned it is 802 px wide,
//                     so libheif pads its rows (stride 3216, not 3208).
//                     ImageIO's HEIC encoder (CGImageDestination).
//   alpha.heic        64x32 with an alpha channel: left half opaque blue,
//                     right half fully transparent (ImageIO).
export const SAMPLE_HEIC = readFileSync(new URL('./sample.heic', import.meta.url));
export const GRID_TURNED_HEIC = readFileSync(new URL('./grid-turned.heic', import.meta.url));
export const ALPHA_HEIC = readFileSync(new URL('./alpha.heic', import.meta.url));

export function fakeDb({ projects = [], profiles = [], files = {} } = {}) {
  const state = {
    projects, profiles, events: [], ops: [], calls: [], clock: 0,
    beforeUpdate: null, onRemove: null, onDownload: null, onUpload: null, uploadError: null,
    files: { ...files }, uploads: [], removed: [],
  };
  state.tick = () => new Date(Date.UTC(2026, 9, 7, 9, 0, 0, ++state.clock)).toISOString().replace('Z', '+00:00');
  const tables = { custom_site_projects: 'projects', custom_site_project_events: 'events', profiles: 'profiles' };

  function run(q) {
    const key = tables[q.table];
    if (!key) throw new Error(`unexpected table ${q.table}`);
    const rows = state[key];
    const op = (n) => q.ops.find((o) => o[0] === n);
    const match = (r) => q.ops.filter((o) => o[0] === 'eq').every(([, c, v]) => r[c] === v);
    const kind = op('insert') ? 'insert' : op('update') ? 'update' : op('delete') ? 'delete' : 'select';
    state.ops.push([q.table, kind]);
    if (op('insert')) {
      rows.push({ ...structuredClone(op('insert')[1]), created_at: new Date().toISOString() });
      return { data: null, error: null };
    }
    const single = op('single') || op('maybeSingle');
    if (op('update')) {
      const hook = state.beforeUpdate;
      state.beforeUpdate = null;
      if (hook && key === 'projects') hook(rows[0]);
      const hits = rows.filter(match);
      for (const r of hits) Object.assign(r, structuredClone(op('update')[1]), key === 'projects' ? { updated_at: state.tick() } : {});
      return single ? { data: hits[0] ? structuredClone(hits[0]) : null, error: null } : { data: hits.map((r) => structuredClone(r)), error: null };
    }
    const hits = rows.filter(match).map((r) => withAliases(r, op('select')?.[1]));
    return single ? { data: structuredClone(hits[0] || null), error: null } : { data: hits.map((r) => structuredClone(r)), error: null };
  }

  // PostgREST's `alias:column->key` (custom-site-form reads only
  // `heic:design->heic`): the alias is added; the other columns stay, since
  // the fake doesn't narrow a select.
  function withAliases(row, columns) {
    if (!row || typeof columns !== 'string' || !columns.includes('->')) return row;
    const out = { ...row };
    for (const part of columns.split(',')) {
      const m = /^\s*(\w+):(\w+)->(\w+)\s*$/.exec(part);
      if (m) out[m[1]] = row[m[2]] && typeof row[m[2]] === 'object' ? (row[m[2]][m[3]] ?? null) : null;
    }
    return out;
  }

  const from = (table) => {
    const q = { table, ops: [] };
    const api = {};
    for (const n of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit']) {
      api[n] = (...a) => { q.ops.push([n, ...a]); return api; };
    }
    api.single = () => { q.ops.push(['single']); return Promise.resolve(run(q)); };
    api.maybeSingle = () => { q.ops.push(['maybeSingle']); return Promise.resolve(run(q)); };
    api.then = (res, rej) => Promise.resolve(run(q)).then(res, rej);
    return api;
  };

  const storage = {
    from: (bucket) => ({
      download: async (p) => {
        state.calls.push(['download', p]);
        if (state.onDownload) state.onDownload(p);
        const f = state.files[p];
        return f ? { data: new Blob([f]), error: null } : { data: null, error: { message: 'Object not found' } };
      },
      upload: async (p, body, opts) => {
        state.calls.push(['upload', p]);
        if (state.uploadError && state.uploadError(p)) return { data: null, error: { message: 'Bucket is full' } };
        state.uploads.push({ bucket, path: p, body: Buffer.from(body), opts });
        state.files[p] = Buffer.from(body);
        if (state.onUpload) state.onUpload(p);
        return { data: { path: p }, error: null };
      },
      remove: async (paths) => {
        for (const p of paths) state.calls.push(['remove', p]);
        if (state.onRemove) state.onRemove(paths);
        state.removed.push(...paths.map((p) => ({ bucket, path: p })));
        for (const p of paths) delete state.files[p];
        return { data: [], error: null };
      },
      list: async (prefix) => ({
        data: Object.keys(state.files).filter((p) => p.startsWith(`${prefix}/`)).map((p) => ({ name: p.slice(prefix.length + 1) })),
        error: null,
      }),
      createSignedUrls: async (paths) => ({
        data: paths.map((p) => ({ path: p, signedUrl: `https://files.test/${p}?token=t` })),
        error: null,
      }),
    }),
  };
  return { from, storage, state };
}
