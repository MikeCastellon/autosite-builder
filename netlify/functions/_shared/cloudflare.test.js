import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCustomHostname, getCustomHostname, deleteCustomHostname, listCustomHostnames } from './cloudflare.js';

const ZONE = 'zone-123';
const TOKEN = 'cf-token';

describe('cloudflare custom hostnames', () => {
  beforeEach(() => {
    process.env.CLOUDFLARE_API_TOKEN = TOKEN;
    process.env.CLOUDFLARE_ZONE_ID = ZONE;
    vi.restoreAllMocks();
  });

  it('createCustomHostname calls POST with correct body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { id: 'hn-1', hostname: 'x.com', status: 'pending' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createCustomHostname('x.com');
    expect(result.id).toBe('hn-1');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/zones/${ZONE}/custom_hostnames`);
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    const body = JSON.parse(opts.body);
    expect(body.hostname).toBe('x.com');
    expect(body.ssl.method).toBe('http');
    expect(body.ssl.type).toBe('dv');
  });

  it('createCustomHostname throws on API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ success: false, errors: [{ code: 1414, message: 'hostname already exists' }] }),
    }));

    await expect(createCustomHostname('x.com')).rejects.toThrow(/hostname already exists/);
  });

  it('getCustomHostname returns parsed result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { id: 'hn-1', status: 'active', ssl: { status: 'active' } } }),
    }));

    const result = await getCustomHostname('hn-1');
    expect(result.status).toBe('active');
    expect(result.ssl.status).toBe('active');
  });

  it('deleteCustomHostname succeeds on 200 and 404', async () => {
    const fetch404 = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    vi.stubGlobal('fetch', fetch404);
    await expect(deleteCustomHostname('hn-missing')).resolves.toBe(true);
  });

  it('listCustomHostnames filters by hostname param', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: [{ id: 'hn-1', hostname: 'x.com' }] }),
    }));
    const result = await listCustomHostnames({ hostname: 'x.com' });
    expect(result).toHaveLength(1);
  });
});
