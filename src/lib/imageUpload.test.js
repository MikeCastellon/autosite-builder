import { describe, it, expect } from 'vitest';
import {
  isDataUrl,
  buildImagePath,
  partitionLegacyImages,
  migrateLegacyImages,
} from './imageUpload.js';

describe('isDataUrl', () => {
  it('detects base64 data URLs and rejects http URLs / empties', () => {
    expect(isDataUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
    expect(isDataUrl('https://x.supabase.co/a.jpg')).toBe(false);
    expect(isDataUrl('')).toBe(false);
    expect(isDataUrl(null)).toBe(false);
    expect(isDataUrl(undefined)).toBe(false);
  });
});

describe('buildImagePath', () => {
  it('namespaces by siteId and includes the key + a suffix, ending .jpg', () => {
    const p = buildImagePath('site-123', 'hero', 'abc123');
    expect(p).toBe('site-123/hero-abc123.jpg');
  });
});

describe('partitionLegacyImages', () => {
  it('separates base64 entries from already-migrated URL entries', () => {
    const images = {
      hero: 'data:image/jpeg;base64,AAAA',
      logo: 'https://x.supabase.co/logo.jpg',
      about: 'data:image/png;base64,BBBB',
      empty: '',
    };
    const { toMigrate, keep } = partitionLegacyImages(images);
    expect(toMigrate).toEqual(['hero', 'about']);
    expect(keep).toEqual({ logo: 'https://x.supabase.co/logo.jpg', empty: '' });
  });

  it('returns empty results for null/empty input', () => {
    expect(partitionLegacyImages(null)).toEqual({ toMigrate: [], keep: {} });
    expect(partitionLegacyImages({})).toEqual({ toMigrate: [], keep: {} });
  });
});

describe('migrateLegacyImages', () => {
  it('uploads only base64 entries and returns an all-resolved map', async () => {
    const images = {
      hero: 'data:image/jpeg;base64,AAAA',
      logo: 'https://x.supabase.co/logo.jpg',
    };
    const calls = [];
    const fakeUpload = async (value, { siteId, imageKey }) => {
      calls.push({ value, siteId, imageKey });
      return `https://x.supabase.co/${siteId}/${imageKey}.jpg`;
    };
    const result = await migrateLegacyImages(images, 'site-9', { uploadFn: fakeUpload });
    expect(result.migrated).toBe(true);
    expect(result.images).toEqual({
      hero: 'https://x.supabase.co/site-9/hero.jpg',
      logo: 'https://x.supabase.co/logo.jpg',
    });
    expect(calls).toEqual([{ value: 'data:image/jpeg;base64,AAAA', siteId: 'site-9', imageKey: 'hero' }]);
  });

  it('keeps base64 for a failed upload and still reports migrated for the rest', async () => {
    const images = { hero: 'data:image/jpeg;base64,AAAA', about: 'data:image/jpeg;base64,BBBB' };
    const fakeUpload = async (value, { imageKey }) => {
      if (imageKey === 'about') throw new Error('boom');
      return 'https://x/hero.jpg';
    };
    const result = await migrateLegacyImages(images, 'site-9', { uploadFn: fakeUpload });
    expect(result.migrated).toBe(true);
    expect(result.images.hero).toBe('https://x/hero.jpg');
    expect(result.images.about).toBe('data:image/jpeg;base64,BBBB');
  });

  it('returns migrated:false when nothing needs migration', async () => {
    const images = { logo: 'https://x/logo.jpg' };
    const result = await migrateLegacyImages(images, 'site-9', { uploadFn: async () => 'x' });
    expect(result.migrated).toBe(false);
    expect(result.images).toEqual(images);
  });
});
