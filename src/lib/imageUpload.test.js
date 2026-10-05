import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Records every storage upload instead of talking to Supabase.
const uploads = vi.hoisted(() => []);
vi.mock('./supabase.js', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: async (path, blob, opts) => {
          uploads.push({ path, blob, opts });
          return { error: null };
        },
        getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      }),
    },
  },
}));

const {
  isDataUrl,
  buildImagePath,
  extensionForType,
  sourceMimeType,
  mayHaveAlpha,
  hasTransparentPixel,
  svgHasActiveContent,
  dataUrlToBlob,
  partitionLegacyImages,
  migrateLegacyImages,
  uploadSiteImage,
} = await import('./imageUpload.js');

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
  it('namespaces by siteId and includes the key + a suffix, ending .jpg by default', () => {
    const p = buildImagePath('site-123', 'hero', 'abc123');
    expect(p).toBe('site-123/hero-abc123.jpg');
  });

  it('uses the extension of the encoded type', () => {
    expect(buildImagePath('s', 'logo', 'x', extensionForType('image/png'))).toBe('s/logo-x.png');
    expect(buildImagePath('s', 'logo', 'x', extensionForType('image/webp'))).toBe('s/logo-x.webp');
    expect(buildImagePath('s', 'logo', 'x', extensionForType('image/svg+xml'))).toBe('s/logo-x.svg');
    expect(extensionForType('image/jpeg')).toBe('jpg');
    expect(extensionForType('')).toBe('jpg');
  });
});

describe('format helpers', () => {
  it('reads the MIME type of files and data URLs', () => {
    expect(sourceMimeType(new Blob(['x'], { type: 'image/PNG' }))).toBe('image/png');
    expect(sourceMimeType('data:image/svg+xml;base64,PHN2Zy8+')).toBe('image/svg+xml');
    expect(sourceMimeType('data:image/svg+xml,%3Csvg%2F%3E')).toBe('image/svg+xml');
    expect(sourceMimeType(new Blob(['x']))).toBe('');
    expect(sourceMimeType(null)).toBe('');
  });

  it('only skips the alpha scan for JPEG', () => {
    expect(mayHaveAlpha('image/jpeg')).toBe(false);
    expect(mayHaveAlpha('image/png')).toBe(true);
    expect(mayHaveAlpha('image/webp')).toBe(true);
    expect(mayHaveAlpha('image/gif')).toBe(true);
    expect(mayHaveAlpha('')).toBe(true);
  });

  it('finds any pixel that is not fully opaque', () => {
    expect(hasTransparentPixel(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]))).toBe(false);
    expect(hasTransparentPixel(new Uint8ClampedArray([1, 2, 3, 255, 0, 0, 0, 0]))).toBe(true);
    expect(hasTransparentPixel(new Uint8ClampedArray([9, 9, 9, 254]))).toBe(true);
  });

  it('flags SVGs that can run code but not ordinary logo markup', () => {
    expect(svgHasActiveContent('<svg><script>alert(1)</script></svg>')).toBe(true);
    expect(svgHasActiveContent('<svg onload="alert(1)"></svg>')).toBe(true);
    expect(svgHasActiveContent('<svg><a href="javascript:alert(1)"><rect/></a></svg>')).toBe(true);
    expect(svgHasActiveContent('<svg><foreignObject><iframe src="x"></iframe></foreignObject></svg>')).toBe(true);
    expect(svgHasActiveContent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>Logo</title><path d="M0 0h10v10z" fill="#c00" opacity=".8"/></svg>',
    )).toBe(false);
  });

  it('sees through encoded or split script URLs', () => {
    expect(svgHasActiveContent('<svg><a href="&#106;avascript:alert(1)"><rect/></a></svg>')).toBe(true);
    expect(svgHasActiveContent('<svg><a href="&#x6A;ava&#x09;script:alert(1)"><rect/></a></svg>')).toBe(true);
    expect(svgHasActiveContent('<svg><a href="java\nscript:alert(1)"><rect/></a></svg>')).toBe(true);
    expect(svgHasActiveContent('<svg><a href="data:text/html;base64,PHNjcmlwdD4="><rect/></a></svg>')).toBe(true);
    expect(svgHasActiveContent('<svg><text>R&#38;D &#169; 2024</text></svg>')).toBe(false);
  });

  it('treats a typeless .svg file as SVG', () => {
    expect(sourceMimeType(new File(['<svg/>'], 'logo.SVG', { type: '' }))).toBe('image/svg+xml');
    expect(sourceMimeType(new File(['x'], 'photo.heic', { type: '' }))).toBe('');
  });

  it('decodes base64 and URL-encoded data URLs', async () => {
    const b64 = dataUrlToBlob(`data:image/svg+xml;base64,${btoa('<svg/>')}`);
    expect(b64.type).toBe('image/svg+xml');
    expect(await b64.text()).toBe('<svg/>');
    const enc = dataUrlToBlob(`data:image/svg+xml,${encodeURIComponent('<svg a="1"/>')}`);
    expect(await enc.text()).toBe('<svg a="1"/>');
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

// uploadSiteImage with a stand-in canvas: `pixels` is what getImageData
// returns, `encoded` lists every toBlob call, `pngSize` fakes the PNG size.
describe('uploadSiteImage', () => {
  let scene;

  beforeEach(() => {
    uploads.length = 0;
    scene = { width: 800, height: 400, alpha: 255, pngSize: 1000, webpSupported: true, encoded: [], scanned: 0, canvas: null };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => {},
        getImageData: (x, y, w, h) => {
          scene.scanned += 1;
          const data = new Uint8ClampedArray(w * h * 4 > 64 ? 64 : w * h * 4).fill(255);
          data[data.length - 1] = scene.alpha;
          return { data };
        },
      }),
      toBlob: (cb, type, quality) => {
        scene.encoded.push({ type, quality });
        const outType = type === 'image/webp' && !scene.webpSupported ? 'image/png' : type;
        const size = outType === 'image/png' ? scene.pngSize : 100;
        cb(new Blob([new Uint8Array(size)], { type: outType }));
      },
    };
    scene.canvas = canvas;
    globalThis.document = { createElement: () => canvas };
    globalThis.Image = class {
      set src(_) {
        this.width = scene.width;
        this.height = scene.height;
        queueMicrotask(() => this.onload());
      }
    };
    globalThis.FileReader = class {
      readAsDataURL(blob) {
        this.result = `data:${blob.type};base64,AAAA`;
        queueMicrotask(() => this.onload());
      }
    };
  });

  afterEach(() => {
    delete globalThis.document;
    delete globalThis.Image;
    delete globalThis.FileReader;
  });

  const file = (type) => new Blob([new Uint8Array(10)], { type });

  it('keeps a transparent PNG logo as PNG instead of a JPEG with a black box', async () => {
    scene.alpha = 0;
    const url = await uploadSiteImage(file('image/png'), { siteId: 's1', imageKey: 'logo' });
    expect(scene.encoded.map((e) => e.type)).toEqual(['image/png']);
    expect(uploads[0].opts.contentType).toBe('image/png');
    expect(uploads[0].path).toMatch(/^s1\/logo-[a-z0-9]+\.png$/);
    expect(url).toBe(`https://cdn.test/${uploads[0].path}`);
  });

  it('still stores an opaque PNG (e.g. a screenshot) as JPEG', async () => {
    await uploadSiteImage(file('image/png'), { siteId: 's1', imageKey: 'hero' });
    expect(scene.encoded).toEqual([{ type: 'image/jpeg', quality: 0.85 }]);
    expect(uploads[0].opts.contentType).toBe('image/jpeg');
    expect(uploads[0].path).toMatch(/\.jpg$/);
  });

  it('never scans JPEG photos for transparency', async () => {
    await uploadSiteImage(file('image/jpeg'), { siteId: 's1', imageKey: 'hero' });
    expect(scene.scanned).toBe(0);
    expect(uploads[0].opts.contentType).toBe('image/jpeg');
  });

  it('keeps alpha for WebP sources too', async () => {
    scene.alpha = 128;
    await uploadSiteImage(file('image/webp'), { siteId: 's1', imageKey: 'logo' });
    expect(uploads[0].opts.contentType).toBe('image/png');
  });

  it('switches a large transparent image to WebP when the browser can encode it', async () => {
    scene.alpha = 0;
    scene.pngSize = 2 * 1024 * 1024;
    await uploadSiteImage(file('image/png'), { siteId: 's1', imageKey: 'about' });
    expect(uploads[0].opts.contentType).toBe('image/webp');
    expect(uploads[0].path).toMatch(/\.webp$/);
  });

  it('falls back to PNG when the browser cannot encode WebP', async () => {
    scene.alpha = 0;
    scene.pngSize = 2 * 1024 * 1024;
    scene.webpSupported = false;
    await uploadSiteImage(file('image/png'), { siteId: 's1', imageKey: 'about' });
    expect(uploads[0].opts.contentType).toBe('image/png');
  });

  it('caps the longest edge at 2000px', async () => {
    scene.width = 5000;
    scene.height = 2500;
    await uploadSiteImage(file('image/jpeg'), { siteId: 's1', imageKey: 'hero' });
    expect([scene.canvas.width, scene.canvas.height]).toEqual([2000, 1000]);
  });

  it('uploads an SVG untouched, without the canvas', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>';
    await uploadSiteImage(new Blob([svg], { type: 'image/svg+xml' }), { siteId: 's1', imageKey: 'logo' });
    expect(scene.encoded).toEqual([]);
    expect(uploads[0].opts.contentType).toBe('image/svg+xml');
    expect(uploads[0].path).toMatch(/\.svg$/);
    expect(await uploads[0].blob.text()).toBe(svg);
  });

  it('passes a legacy base64 SVG through during migration', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    const result = await migrateLegacyImages({ logo: `data:image/svg+xml;base64,${btoa(svg)}` }, 's1');
    expect(result.images.logo).toMatch(/^https:\/\/cdn\.test\/s1\/logo-[a-z0-9]+\.svg$/);
    expect(await uploads[0].blob.text()).toBe(svg);
  });

  it('refuses an SVG with a script', async () => {
    const bad = new Blob(['<svg><script>alert(1)</script></svg>'], { type: 'image/svg+xml' });
    await expect(uploadSiteImage(bad, { siteId: 's1', imageKey: 'logo' })).rejects.toThrow(/PNG/);
    expect(uploads).toEqual([]);
  });
});
