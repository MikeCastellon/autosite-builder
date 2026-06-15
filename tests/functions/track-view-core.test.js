import { describe, it, expect } from 'vitest';
import { parseTrackView } from '../../netlify/functions/_lib/track-view-core.js';

describe('parseTrackView', () => {
  const ok = '11111111-2222-4333-8444-555555555555';
  it('accepts a valid site view', () => {
    expect(parseTrackView(JSON.stringify({ siteId: ok, kind: 'site' })))
      .toEqual({ siteId: ok, kind: 'site', referrer_host: null });
  });
  it('accepts a booking view and extracts referrer host', () => {
    const r = parseTrackView(JSON.stringify({ siteId: ok, kind: 'booking', referrer: 'https://instagram.com/p/abc' }));
    expect(r).toEqual({ siteId: ok, kind: 'booking', referrer_host: 'instagram.com' });
  });
  it('accepts an already-parsed object', () => {
    expect(parseTrackView({ siteId: ok, kind: 'site' }).siteId).toBe(ok);
  });
  it('rejects bad kind', () => {
    expect(parseTrackView(JSON.stringify({ siteId: ok, kind: 'hack' }))).toBeNull();
  });
  it('rejects non-uuid siteId', () => {
    expect(parseTrackView(JSON.stringify({ siteId: 'nope', kind: 'site' }))).toBeNull();
  });
  it('rejects malformed JSON', () => {
    expect(parseTrackView('{not json')).toBeNull();
  });
  it('tolerates a junk referrer (null host)', () => {
    expect(parseTrackView(JSON.stringify({ siteId: ok, kind: 'site', referrer: 'not a url' })).referrer_host).toBeNull();
  });
});
