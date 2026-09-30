import { describe, it, expect } from 'vitest';
import { parseTrackView, decodeTrackViewBody, isOwnerAppReferrer } from '../../netlify/functions/_lib/track-view-core.js';

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
  it('rejects an oversized body', () => {
    const big = JSON.stringify({ siteId: ok, kind: 'site', referrer: 'https://x.com/' + 'a'.repeat(5000) });
    expect(parseTrackView(big)).toBeNull();
  });
});

describe('decodeTrackViewBody', () => {
  const ok = '11111111-2222-4333-8444-555555555555';
  const json = JSON.stringify({ siteId: ok, kind: 'site' });
  it('passes a plain text body through (what scheduler.js sends)', () => {
    expect(decodeTrackViewBody({ body: json, isBase64Encoded: false })).toBe(json);
  });
  it('decodes a base64-encoded body', () => {
    const b64 = Buffer.from(json, 'utf8').toString('base64');
    const decoded = decodeTrackViewBody({ body: b64, isBase64Encoded: true });
    expect(parseTrackView(decoded)).toEqual({ siteId: ok, kind: 'site', referrer_host: null });
  });
  it('tolerates a missing event or body', () => {
    expect(decodeTrackViewBody(undefined)).toBeUndefined();
    expect(decodeTrackViewBody({ isBase64Encoded: true })).toBeUndefined();
  });
});

describe('isOwnerAppReferrer', () => {
  it('flags the owner app, deploy previews and local dev', () => {
    expect(isOwnerAppReferrer('sitebuilder.autocaregenius.com')).toBe(true);
    expect(isOwnerAppReferrer('SiteBuilder.AutoCareGenius.com')).toBe(true);
    expect(isOwnerAppReferrer('deploy-preview-12--autosite-builder.netlify.app')).toBe(true);
    expect(isOwnerAppReferrer('localhost:5190')).toBe(true);
  });
  it('counts real referrers and direct visits', () => {
    expect(isOwnerAppReferrer('www.google.com')).toBe(false);
    expect(isOwnerAppReferrer('joes-detailing.autocaregeniushub.com')).toBe(false);
    expect(isOwnerAppReferrer('evil-autosite-builder.netlify.app')).toBe(false);
    expect(isOwnerAppReferrer(null)).toBe(false);
  });
  it('reads the host parseTrackView extracts from a thumbnail iframe', () => {
    const p = parseTrackView(JSON.stringify({
      siteId: '11111111-2222-4333-8444-555555555555', kind: 'site',
      referrer: 'https://sitebuilder.autocaregenius.com/',
    }));
    expect(isOwnerAppReferrer(p.referrer_host)).toBe(true);
  });
});
