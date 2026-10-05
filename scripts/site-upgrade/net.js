// Every request the tool makes goes through this guard (it replaces the
// global fetch, which netlify/functions/_shared/r2.js uses too):
//   - GET / HEAD only to the R2 objects API of the autosite-published
//     bucket, the live sites (*.autocaregeniushub.com) and the production
//     app; any other host is refused.
//   - PUT only to that R2 bucket, only in "write" mode and only for the keys
//     the current step allows (one site's backup folder and live pages).
//     Never DELETE, POST or PATCH.
//   - "read" mode (plan, backups) refuses every write; "dry-run" records the
//     write (key, size, sha256) and answers it as stored without sending it.
import { createHash } from 'node:crypto';
import { PRODUCTION_APP_ORIGIN } from '../../src/lib/siteUpgrade.js';

export const PUBLISH_DOMAIN = 'autocaregeniushub.com';
const R2_OBJECTS = /^\/client\/v4\/accounts\/[0-9a-f]{32}\/r2\/buckets\/autosite-published\/objects(?:\/([^/]+))?$/i;

export function sha256(s) {
  return createHash('sha256').update(String(s), 'utf8').digest('hex');
}

function r2Target(u) {
  if (u.protocol !== 'https:' || u.hostname !== 'api.cloudflare.com') return null;
  const m = R2_OBJECTS.exec(u.pathname);
  if (!m) return null;
  return { key: m[1] ? decodeURIComponent(m[1]) : null };
}

function publicHost(u) {
  if (u.protocol !== 'https:') return false;
  if (u.origin === PRODUCTION_APP_ORIGIN) return true;
  return u.hostname.endsWith(`.${PUBLISH_DOMAIN}`) && /^[a-z0-9-]{1,63}$/.test(u.hostname.slice(0, -PUBLISH_DOMAIN.length - 1));
}

const blocked = (msg) => Object.assign(new Error(`Blocked: ${msg}`), { blocked: true });

const REAL = Symbol('site-upgrade real fetch');

export function createNetGuard({ realFetch = globalThis.fetch } = {}) {
  // Never a guard around a guard (a second run in one process).
  const base = realFetch?.[REAL] || realFetch;
  const state = { mode: 'read', allow: null, writes: [], onSend: null };

  async function guardedFetch(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = String(init.method || 'GET').toUpperCase();
    const r2 = r2Target(url);
    if (method === 'GET' || method === 'HEAD') {
      if (!r2 && !publicHost(url)) throw blocked(`${method} ${url.origin} is not a host this tool reads`);
      if (r2 && !process.env.CLOUDFLARE_API_TOKEN) throw blocked('R2 read without the R2 token');
      return base(url.href, init);
    }
    if (method !== 'PUT' || !r2?.key) throw blocked(`${method} ${url.origin}${r2 ? ' (R2)' : ''} is never sent by this tool`);
    const body = typeof init.body === 'string' ? init.body : String(init.body ?? '');
    const write = {
      key: r2.key, bytes: Buffer.byteLength(body, 'utf8'), sha256: sha256(body),
      contentType: init.headers?.['Content-Type'] || null,
    };
    if (state.mode === 'dry-run') {
      state.writes.push({ ...write, sent: false, ok: true, status: null });
      return new Response('{"success":true}', { status: 200 });
    }
    if (state.mode !== 'write') throw blocked(`this command does not write (PUT ${r2.key})`);
    if (!state.allow || !state.allow(r2.key)) throw blocked(`PUT ${r2.key} is outside this step's keys`);
    // Logged before it is sent: should the run be cut off mid-write, the
    // log still names the object that may have changed.
    state.onSend?.(write);
    let res;
    try {
      res = await base(url.href, init);
    } catch (e) {
      state.writes.push({ ...write, sent: true, ok: false, status: null });
      throw e;
    }
    state.writes.push({ ...write, sent: true, ok: res.ok, status: res.status });
    return res;
  }
  guardedFetch[REAL] = base;

  return {
    fetch: guardedFetch,
    install() { globalThis.fetch = guardedFetch; },
    // mode: 'read' | 'dry-run' | 'write'; allow(key) → true for keys this step may PUT.
    set(mode, allow = null) { state.mode = mode; state.allow = allow; },
    get mode() { return state.mode; },
    // onSend(write) runs right before each real PUT is sent.
    set onSend(fn) { state.onSend = fn; },
    // The writes recorded since the last take(), sent or (dry-run) not.
    take() { const w = state.writes; state.writes = []; return w; },
  };
}

// The keys one site's publish or restore may write: its backup folder
// (backups, meta.json, hold.json) and its two live pages.
export function siteKeys(siteId, slug) {
  const backup = `_backups/${siteId}/`;
  const live = new Set([`${slug}/index.html`, `${slug}/book/index.html`]);
  return (key) => (key.startsWith(backup) && !key.slice(backup.length).includes('..')) || live.has(key);
}

export function holdKeyOnly(siteId) {
  return (key) => key === `_backups/${siteId}/hold.json`;
}

// GET of a public URL: { status, body, bytes, headers }. Never cached; a
// query string keeps any cache between here and R2 out of it. The answer
// must start within timeoutMs; the body then gets bodyTimeoutMs of its own:
// the live pages that store photos inline run to 5 MB and some sites serve
// them slowly (33 s for one). With maxBytes, a body past it is not read to
// the end ({ tooLarge: true, bytes: what was read }); a body cut off by its
// time limit comes back as { timedOut: true, body: null, bytes }.
export async function publicGet(url, {
  fetchImpl = globalThis.fetch, timeoutMs = 60000, bodyTimeoutMs = 180000, bust = true, maxBytes = null,
} = {}) {
  const u = new URL(url);
  if (bust) u.searchParams.set('acg_upgrade', Date.now().toString(36));
  const ctl = new AbortController();
  let timer = setTimeout(() => ctl.abort(new Error(`no answer within ${Math.round(timeoutMs / 1000)} s`)), timeoutMs);
  let res;
  try {
    res = await fetchImpl(u.href, { method: 'GET', cache: 'no-store', redirect: 'manual', signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
  const out = (extra) => ({ status: res.status, headers: res.headers, ...extra });
  timer = setTimeout(() => ctl.abort(new Error('body time limit')), bodyTimeoutMs);
  try {
    if (!res.body?.getReader) {
      const body = await res.text();
      return out({ body, bytes: Buffer.byteLength(body, 'utf8') });
    }
    const reader = res.body.getReader();
    const chunks = [];
    let bytes = 0;
    for (;;) {
      let step;
      try {
        step = await reader.read();
      } catch (e) {
        if (ctl.signal.aborted) return out({ body: null, bytes, timedOut: true });
        throw e;
      }
      if (step.done) break;
      bytes += step.value.byteLength;
      if (maxBytes && bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        return out({ body: null, bytes, tooLarge: true });
      }
      chunks.push(step.value);
    }
    const body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
    return out({ body, bytes: Buffer.byteLength(body, 'utf8') });
  } finally {
    clearTimeout(timer);
  }
}

export function liveSiteUrl(slug, file = 'index.html') {
  return `https://${slug}.${PUBLISH_DOMAIN}/${file === 'index.html' ? '' : file.replace(/index\.html$/, '')}`;
}
