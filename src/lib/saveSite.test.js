import { describe, it, expect, vi } from 'vitest';
import { saveSite, buildSiteRecord } from './saveSite.js';

// supabase.js throws at import without env vars; saveSite gets a fake client.
vi.mock('./supabase.js', () => ({ supabase: {} }));

// Minimal chainable stand-in for supabase.from('sites'). Each terminal call
// (single / maybeSingle) resolves the next queued response.
function fakeClient(responses) {
  const calls = [];
  const client = {
    from(table) {
      const call = { table, op: null, values: null, filters: [] };
      calls.push(call);
      const b = {
        update(v) { call.op = 'update'; call.values = v; return b; },
        insert(v) { call.op = 'insert'; call.values = v; return b; },
        upsert(v) { call.op = 'upsert'; call.values = v; return b; },
        eq(col, val) { call.filters.push([col, val]); return b; },
        select() { return b; },
        maybeSingle() { return Promise.resolve(responses.shift()); },
        single() { return Promise.resolve(responses.shift()); },
      };
      return b;
    },
  };
  return { client, calls };
}

const SITE = {
  siteId: 'site-1',
  userId: 'admin-1',
  businessInfo: { businessName: 'Shine' },
  generatedCopy: { heroTitle: 'Hi' },
  templateId: 'detailing_sporty',
  images: { hero: 'https://x/hero.jpg' },
  widgetConfigIds: ['w1'],
  customColors: { accent: '#ff0000' },
  customFonts: {},
};

describe('saveSite', () => {
  it('updates an existing row without touching user_id', async () => {
    const { client, calls } = fakeClient([{ data: { id: 'site-1', user_id: 'owner-9' }, error: null }]);
    const row = await saveSite(SITE, client);
    expect(row.user_id).toBe('owner-9');
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe('update');
    expect(calls[0].filters).toEqual([['id', 'site-1']]);
    expect(calls[0].values).not.toHaveProperty('user_id');
    expect(calls[0].values).not.toHaveProperty('id');
  });

  it('inserts with the caller as owner when the row does not exist yet', async () => {
    const { client, calls } = fakeClient([
      { data: null, error: null },
      { data: { id: 'site-1', user_id: 'admin-1' }, error: null },
    ]);
    await saveSite(SITE, client);
    expect(calls.map((c) => c.op)).toEqual(['update', 'insert']);
    expect(calls[1].values).toMatchObject({ id: 'site-1', user_id: 'admin-1', template_id: 'detailing_sporty' });
  });

  it('falls back to an update when an overlapping save created the row first', async () => {
    const { client, calls } = fakeClient([
      { data: null, error: null },
      { data: null, error: { code: '23505', message: 'duplicate key' } },
      { data: { id: 'site-1' }, error: null },
    ]);
    const row = await saveSite(SITE, client);
    expect(row).toEqual({ id: 'site-1' });
    expect(calls.map((c) => c.op)).toEqual(['update', 'insert', 'update']);
  });

  it('throws the insert error when the row belongs to someone this user cannot see', async () => {
    const dup = { code: '23505', message: 'duplicate key' };
    const { client } = fakeClient([
      { data: null, error: null },
      { data: null, error: dup },
      { data: null, error: null },
    ]);
    await expect(saveSite(SITE, client)).rejects.toBe(dup);
  });

  it('throws RLS errors from the insert (e.g. the per-type site cap)', async () => {
    const rls = { code: '42501', message: 'new row violates row-level security policy' };
    const { client, calls } = fakeClient([{ data: null, error: null }, { data: null, error: rls }]);
    await expect(saveSite(SITE, client)).rejects.toBe(rls);
    expect(calls).toHaveLength(2);
  });

  it('throws update errors without inserting', async () => {
    const err = { code: '500', message: 'boom' };
    const { client, calls } = fakeClient([{ data: null, error: err }]);
    await expect(saveSite(SITE, client)).rejects.toBe(err);
    expect(calls).toHaveLength(1);
  });
});

describe('buildSiteRecord', () => {
  const now = new Date('2026-09-28T12:00:00.000Z');

  it('stashes images, colors and fonts inside generated_content', () => {
    const r = buildSiteRecord({ ...SITE, customFonts: { heading: 'Inter' } }, now);
    expect(r.generated_content).toEqual({
      heroTitle: 'Hi',
      _images: { hero: 'https://x/hero.jpg' },
      _customColors: { accent: '#ff0000' },
      _customFonts: { heading: 'Inter' },
    });
    expect(r.updated_at).toBe('2026-09-28T12:00:00.000Z');
    expect(r.widget_config_ids).toEqual(['w1']);
    expect(r).not.toHaveProperty('user_id');
  });

  it('keeps generated_content as-is when there is no side data', () => {
    const copy = { heroTitle: 'Hi' };
    const r = buildSiteRecord({ generatedCopy: copy, images: {}, customColors: {}, customFonts: {} }, now);
    expect(r.generated_content).toBe(copy);
    expect(r.widget_config_ids).toEqual([]);
  });
});
