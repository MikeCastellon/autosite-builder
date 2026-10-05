// tests/functions/generate-website-status.test.js
// The job status endpoint with Blobs and auth stubbed: a signed-in user reads
// only their own job, whatever id they send.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ records: new Map(), reads: [], stores: [], failRead: false }));

vi.mock('../../netlify/functions/node_modules/@netlify/blobs/dist/main.js', () => {
  const store = {
    async get(key, options) {
      state.reads.push({ key, options });
      if (state.failRead) throw new Error('blobs down');
      return state.records.has(key) ? structuredClone(state.records.get(key)) : null;
    },
  };
  return {
    getStore: (opts) => { state.stores.push({ kind: 'site', opts }); return store; },
    getDeployStore: (opts) => { state.stores.push({ kind: 'deploy', opts }); return store; },
  };
});

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  requireUser: async (event) => {
    const auth = event.headers.authorization || '';
    if (auth === 'Bearer tok-1') return { id: 'user-1' };
    if (auth === 'Bearer tok-2') return { id: 'user-2' };
    throw Object.assign(new Error('Not signed in. Please sign in again.'), { status: 401 });
  },
  supabaseAdmin: () => ({}),
}));

const { default: handler } = await import('../../netlify/functions/generate-website-status.js');

const JOB = '3b241101-e2bb-4255-8caf-4136c566a962';
const production = { deploy: { context: 'production' } };

async function poll(jobId, { token = 'tok-1', context = production, method = 'GET', origin } = {}) {
  const url = `https://example.test/.netlify/functions/generate-website-status${jobId === undefined ? '' : `?jobId=${encodeURIComponent(jobId)}`}`;
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (origin) headers.origin = origin;
  const res = await handler(new Request(url, { method, headers }), context);
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

beforeEach(() => {
  state.records = new Map();
  state.reads = [];
  state.stores = [];
  state.failRead = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('generate-website-status', () => {
  it('returns the caller\'s running, done and failed jobs', async () => {
    state.records.set(`user-1/${JOB}`, { status: 'running', startedAt: new Date().toISOString(), model: 'claude-opus-5' });
    let res = await poll(JOB);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'running', startedAt: expect.any(String) });

    state.records.set(`user-1/${JOB}`, { status: 'done', copy: { headline: 'Hi' }, startedAt: 'x', finishedAt: 'y' });
    res = await poll(JOB);
    expect(res.body).toEqual({ status: 'done', copy: { headline: 'Hi' } });

    state.records.set(`user-1/${JOB}`, { status: 'error', code: 'daily_limit', httpStatus: 429, error: 'Daily generation limit reached. Try again in 24h.' });
    res = await poll(JOB);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'error', code: 'daily_limit', httpStatus: 429, error: 'Daily generation limit reached. Try again in 24h.' });
  });

  it('cannot read another user\'s job, even with its id', async () => {
    state.records.set(`user-1/${JOB}`, { status: 'done', copy: { headline: 'Private' } });
    const res = await poll(JOB, { token: 'tok-2' });
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('Private');
    expect(state.reads.map((r) => r.key)).toEqual([`user-2/${JOB}`]);
  });

  it('answers 404 for an unknown job (not started yet)', async () => {
    const res = await poll(JOB);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Job not found' });
  });

  it('rejects a missing or malformed job id without reading the store', async () => {
    for (const id of [undefined, '', 'abc', `../user-2/${JOB}`, `${JOB}/x`]) {
      const res = await poll(id);
      expect(res.status).toBe(400);
    }
    expect(state.reads).toEqual([]);
  });

  it('requires a signed-in user', async () => {
    state.records.set(`user-1/${JOB}`, { status: 'done', copy: { headline: 'Hi' } });
    for (const token of [null, 'expired']) {
      const res = await poll(JOB, { token });
      expect(res.status).toBe(401);
      expect(res.body.copy).toBeUndefined();
    }
    expect(state.reads).toEqual([]);
  });

  it('reports a job stuck in running past the background limit as timed out', async () => {
    state.records.set(`user-1/${JOB}`, { status: 'running', startedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString() });
    const res = await poll(JOB);
    expect(res.body).toMatchObject({ status: 'error', code: 'stale', httpStatus: 504 });
  });

  it('reads with strong consistency from the same store the background job writes to', async () => {
    await poll(JOB);
    expect(state.stores.at(-1)).toEqual({ kind: 'site', opts: { name: 'copy-jobs', consistency: 'strong' } });
    expect(state.reads[0].options).toEqual({ type: 'json' });
    await poll(JOB, { context: { deploy: { context: 'deploy-preview' } } });
    expect(state.stores.at(-1).kind).toBe('deploy');
  });

  it('is never cached and answers 503 (keep polling) when storage fails, naming the cause', async () => {
    let res = await poll(JOB);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toBe('application/json');
    state.failRead = true;
    res = await poll(JOB);
    expect(res.status).toBe(503);
    // The wizard switches to the legacy route after repeated storage errors.
    expect(res.body).toEqual({ error: 'Could not read the job status. Please try again.', code: 'storage_unavailable' });
    expect(JSON.stringify(res.body)).not.toContain('blobs down');
  });

  it('never shows the job\'s internal fields (path, slot, rejected request)', async () => {
    state.records.set(`user-1/${JOB}`, {
      status: 'done', copy: { headline: 'Hi' }, path: 'legacy', model: 'claude-sonnet-4-6',
      slotAt: 'x', retryOf: 'y', primaryRejected: { status: 400, type: 'invalid_request_error', requestId: 'req_1' }, claim: 'c',
    });
    expect((await poll(JOB)).body).toEqual({ status: 'done', copy: { headline: 'Hi' } });
    state.records.set(`user-1/${JOB}`, { status: 'error', code: 'config', httpStatus: 500, error: 'No.', path: 'legacy', slotAt: 'x' });
    expect((await poll(JOB)).body).toEqual({ status: 'error', code: 'config', httpStatus: 500, error: 'No.' });
  });

  it('cannot reach a retry marker: only uuid job ids are read', async () => {
    state.records.set(`user-1/${JOB}/retry`, { status: 'retried', by: 'x' });
    expect((await poll(`${JOB}/retry`)).status).toBe(400);
    expect(state.reads).toEqual([]);
  });

  it('answers CORS preflight and rejects other methods', async () => {
    const pre = await poll(JOB, { method: 'OPTIONS', origin: 'http://localhost:5190', token: null });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('http://localhost:5190');
    expect((await poll(JOB, { method: 'POST' })).status).toBe(405);
  });
});
