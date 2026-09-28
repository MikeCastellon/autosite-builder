import { describe, it, expect } from 'vitest';
import { resolvePublishSlug, isSlugShared } from './slugClaim.js';
import { slugCandidates, isReservedSlug } from './slug.js';

// Minimal in-memory stand-in for the supabase-js query builder calls
// slugClaim makes: select/update + eq/neq/is/limit/maybeSingle.
function fakeDb(rows, { onUpdate, updateError } = {}) {
  return {
    from() {
      const q = { filters: [], op: 'select', values: null, lim: null, single: false };
      const run = () => {
        let hit = rows.filter((r) => q.filters.every((f) => f(r)));
        if (q.op === 'update') {
          const err = updateError?.(q.values, hit);
          if (err) return { data: null, error: err };
          hit.forEach((r) => Object.assign(r, q.values));
          onUpdate?.(q.values, hit);
        }
        if (q.lim != null) hit = hit.slice(0, q.lim);
        const data = hit.map((r) => ({ ...r }));
        return { data: q.single ? (data[0] ?? null) : data, error: null };
      };
      const b = {
        select() { return b; },
        update(v) { q.op = 'update'; q.values = v; return b; },
        eq(c, v) { q.filters.push((r) => r[c] === v); return b; },
        neq(c, v) { q.filters.push((r) => r[c] !== v); return b; },
        is(c, v) { q.filters.push((r) => (r[c] ?? null) === v); return b; },
        limit(n) { q.lim = n; return b; },
        maybeSingle() { q.single = true; return b; },
        then(res, rej) { return Promise.resolve(run()).then(res, rej); },
      };
      return b;
    },
  };
}

const row = (id, slug = null, created_at = '2026-01-01') => ({ id, slug, created_at });

describe('slugCandidates', () => {
  it('starts with the requested slug, then numbered suffixes', () => {
    expect(slugCandidates('acme', 3)).toEqual(['acme', 'acme-2', 'acme-3']);
  });
  it('keeps every candidate within 63 chars', () => {
    const long = 'a'.repeat(63);
    for (const c of slugCandidates(long, 12)) expect(c.length).toBeLessThanOrEqual(63);
    expect(slugCandidates(long, 12)[11]).toBe(`${'a'.repeat(60)}-12`);
  });
  it('does not leave a double dash when trimming lands on one', () => {
    expect(slugCandidates(`${'a'.repeat(60)}-b`, 2)[1]).toBe(`${'a'.repeat(60)}-2`);
  });
});

describe('isReservedSlug', () => {
  it('reserves our own subdomains', () => {
    expect(isReservedSlug('www')).toBe(true);
    expect(isReservedSlug('sitebuilder')).toBe(true);
    expect(isReservedSlug('acme-detailing')).toBe(false);
  });
});

describe('resolvePublishSlug', () => {
  it('claims the requested slug on first publish when it is free', async () => {
    const rows = [row('me')];
    expect(await resolvePublishSlug(fakeDb(rows), { id: 'me', slug: null }, 'acme')).toEqual({ slug: 'acme' });
    expect(rows[0].slug).toBe('acme');
  });

  it('never takes a slug another site holds; it picks the next free one', async () => {
    const rows = [row('other', 'acme'), row('other2', 'acme-2'), row('me')];
    expect(await resolvePublishSlug(fakeDb(rows), { id: 'me', slug: null }, 'acme')).toEqual({ slug: 'acme-3' });
    expect(rows.find((r) => r.id === 'other').slug).toBe('acme');
  });

  it('skips reserved slugs', async () => {
    const rows = [row('me')];
    expect(await resolvePublishSlug(fakeDb(rows), { id: 'me', slug: null }, 'www')).toEqual({ slug: 'www-2' });
  });

  it('keeps the stored slug even when the business was renamed', async () => {
    const rows = [row('me', 'old-name')];
    expect(await resolvePublishSlug(fakeDb(rows), { id: 'me', slug: 'old-name' }, 'new-name')).toEqual({ slug: 'old-name' });
    expect(rows[0].slug).toBe('old-name');
  });

  it('refuses to publish while another row shares the stored slug', async () => {
    const rows = [row('a', 'malpica'), row('b', 'malpica')];
    const res = await resolvePublishSlug(fakeDb(rows), { id: 'b', slug: 'malpica' }, 'malpica');
    expect(res.status).toBe(409);
    expect(res.slug).toBeUndefined();
  });

  it('rejects an invalid requested slug on first publish', async () => {
    const res = await resolvePublishSlug(fakeDb([row('me')]), { id: 'me', slug: null }, '../evil');
    expect(res.status).toBe(400);
  });

  it('backs off when another site claims the same slug at the same moment', async () => {
    const rows = [row('other', null, '2026-05-01'), row('me', null, '2026-01-01')];
    const db = fakeDb(rows, {
      // The other site's claim lands between our availability check and
      // our holders check. It may already have returned and be uploading,
      // so we must move on even though our row is older.
      onUpdate: (values, hit) => {
        if (values.slug === 'acme' && hit[0]?.id === 'me') rows[0].slug = 'acme';
      },
    });
    expect(await resolvePublishSlug(db, { id: 'me', slug: null }, 'acme')).toEqual({ slug: 'acme-2' });
    expect(rows[0].slug).toBe('acme');
    expect(rows[1].slug).toBe('acme-2');
  });

  it('refuses a stored slug that is malformed or reserved', async () => {
    for (const slug of ['victim-detailing/book', '../x', 'www', 'sitebuilder']) {
      const rows = [row('me', slug)];
      const res = await resolvePublishSlug(fakeDb(rows), { id: 'me', slug }, 'acme');
      expect(res.status).toBe(409);
      expect(res.slug).toBeUndefined();
    }
  });

  it('tries the next slug when the unique index rejects a claim', async () => {
    const rows = [row('me')];
    const db = fakeDb(rows, {
      updateError: (values) => (values.slug === 'acme' ? { code: '23505', message: 'duplicate key' } : null),
    });
    expect(await resolvePublishSlug(db, { id: 'me', slug: null }, 'acme')).toEqual({ slug: 'acme-2' });
  });

  it('uses the slug a concurrent publish of the same site already claimed', async () => {
    const rows = [row('me', 'claimed-meanwhile')];
    // The caller loaded the row before the other request claimed a slug.
    expect(await resolvePublishSlug(fakeDb(rows), { id: 'me', slug: null }, 'acme')).toEqual({ slug: 'claimed-meanwhile' });
  });

  it('reports a database error as a retryable 500, not a slug', async () => {
    const db = { from: () => { throw new Error('connection reset'); } };
    const res = await resolvePublishSlug(db, { id: 'me', slug: null }, 'acme');
    expect(res.status).toBe(500);
  });
});

describe('isSlugShared', () => {
  it('is false for a unique or missing slug', async () => {
    const rows = [row('a', 'one'), row('b', 'two')];
    expect(await isSlugShared(fakeDb(rows), { id: 'a', slug: 'one' })).toBe(false);
    expect(await isSlugShared(fakeDb(rows), { id: 'c', slug: null })).toBe(false);
  });
  it('is true when another row holds the same slug', async () => {
    const rows = [row('a', 'one'), row('b', 'one')];
    expect(await isSlugShared(fakeDb(rows), { id: 'a', slug: 'one' })).toBe(true);
  });
});
