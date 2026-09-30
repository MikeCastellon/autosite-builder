import { supabase } from './supabase.js';

const BUCKET = 'site-images';
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;
const WEBP_QUALITY = 0.9;
// Transparent images are stored as lossless PNG (crisp logo edges). Past
// this size (a large cut-out photo) a WebP is used instead when the browser
// can encode one and it comes out smaller; both keep the alpha channel.
const PNG_BUDGET_BYTES = 1.5 * 1024 * 1024;

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image');
}

export function extensionForType(type) {
  return EXTENSIONS[type] || 'jpg';
}

export function buildImagePath(siteId, imageKey, suffix, ext = 'jpg') {
  return `${siteId}/${imageKey}-${suffix}.${ext}`;
}

// MIME type of a File/Blob or a data URL, lower-cased ('' when unknown).
// Some systems hand over an .svg file with an empty type; the canvas path
// cannot read those, so the file name decides.
export function sourceMimeType(source) {
  if (typeof source === 'string') {
    const m = /^data:([^;,]+)/i.exec(source);
    return m ? m[1].toLowerCase() : '';
  }
  const type = typeof source?.type === 'string' ? source.type.toLowerCase() : '';
  if (!type && typeof source?.name === 'string' && /\.svg$/i.test(source.name)) return 'image/svg+xml';
  return type;
}

// JPEG has no alpha channel, so its pixels never need the transparency scan.
// Anything else (PNG, WebP, GIF, AVIF, unknown) might be see-through.
export function mayHaveAlpha(type) {
  return type !== 'image/jpeg' && type !== 'image/jpg';
}

// `data` is canvas RGBA (getImageData().data): true if any pixel is not fully
// opaque. Stops at the first one, so a transparent logo exits almost at once.
export function hasTransparentPixel(data) {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

// Decodes numeric character references (&#106; / &#x6A;), which XML resolves
// inside attributes, so an encoded "javascript:" cannot slip past the check.
function decodeCharRefs(text) {
  return text.replace(/&#(x[0-9a-f]+|\d+);?/gi, (_, n) => {
    const code = n[0] === 'x' || n[0] === 'X' ? parseInt(n.slice(1), 16) : parseInt(n, 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  });
}

// SVGs are uploaded as-is (no canvas), so refuse the ones that can run code
// when their URL is opened directly. Logos exported from design tools never
// need scripts, event handlers or script URLs. Browsers drop whitespace and
// control characters inside a URL scheme, so those are removed before the
// scheme check.
export function svgHasActiveContent(text) {
  const src = decodeCharRefs(String(text));
  if (/<script[\s>/]|<(?:iframe|embed|object)[\s>/]|\son[a-z]+\s*=/i.test(src)) return true;
  return /javascript:|data:text\/html/i.test(src.replace(/[\u0000- ]+/g, ''));
}

export function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(5, comma); // between "data:" and ","
  const payload = dataUrl.slice(comma + 1);
  const type = meta.split(';')[0] || 'application/octet-stream';
  const bytes = /;base64/i.test(meta)
    ? Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(payload));
  return new Blob([bytes], { type });
}

// Split an images map into base64 keys needing migration vs entries to keep as-is.
export function partitionLegacyImages(images) {
  const toMigrate = [];
  const keep = {};
  for (const [key, value] of Object.entries(images || {})) {
    if (isDataUrl(value)) toMigrate.push(key);
    else keep[key] = value;
  }
  return { toMigrate, keep };
}

async function svgBlob(source) {
  const blob = typeof source === 'string' ? dataUrlToBlob(source) : source;
  const text = await blob.text();
  if (svgHasActiveContent(text)) {
    throw new Error('This SVG contains scripts, which are not allowed. Export it as a PNG and upload that instead.');
  }
  return new Blob([text], { type: 'image/svg+xml' });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image encode failed'))),
      type,
      quality,
    );
  });
}

// Browser-only: load any raster source into a canvas and cap the longest
// edge. Opaque images (photos) become JPEG as before; images with any
// transparent pixel (logos) keep their alpha as PNG, or WebP when large.
// Encoding a transparent PNG as JPEG painted a black box behind logos.
async function downscaleToBlob(source, type) {
  const dataUrl = typeof source === 'string'
    ? source
    : await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(source);
      });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('This image could not be read. Try a JPG or PNG.'));
    i.src = dataUrl;
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  let transparent = false;
  if (mayHaveAlpha(type)) {
    try {
      transparent = hasTransparentPixel(ctx.getImageData(0, 0, w, h).data);
    } catch {
      transparent = true; // can't inspect: keep alpha rather than risk a black box
    }
  }
  if (!transparent) return canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);

  const png = await canvasToBlob(canvas, 'image/png');
  if (png.size <= PNG_BUDGET_BYTES) return png;
  // Browsers that can't encode WebP hand back a PNG, hence the type check.
  const webp = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY).catch(() => null);
  return webp && webp.type === 'image/webp' && webp.size < png.size ? webp : png;
}

// Short non-cryptographic suffix to bust caches and avoid collisions on re-upload.
function shortSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

// Browser-only: SVG passes through untouched; any other image is downscaled
// and re-encoded (see downscaleToBlob). Uploads to Supabase Storage with the
// matching extension/content type and returns the public URL.
export async function uploadSiteImage(source, { siteId, imageKey }) {
  const type = sourceMimeType(source);
  const blob = type === 'image/svg+xml' ? await svgBlob(source) : await downscaleToBlob(source, type);
  const path = buildImagePath(siteId, imageKey, shortSuffix(), extensionForType(blob.type));
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: blob.type });
  if (error) throw new Error(error.message || 'Image upload failed');
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Convert any base64 entries in an images map to storage URLs. Best-effort:
// a failed image keeps its base64 value. `uploadFn` is injectable for tests.
export async function migrateLegacyImages(images, siteId, { uploadFn = uploadSiteImage } = {}) {
  const { toMigrate, keep } = partitionLegacyImages(images);
  if (toMigrate.length === 0) return { migrated: false, images: images || {} };

  const result = { ...keep };
  for (const key of toMigrate) {
    try {
      result[key] = await uploadFn(images[key], { siteId, imageKey: key });
    } catch {
      result[key] = images[key]; // keep base64; will retry next open
    }
  }
  return { migrated: true, images: result };
}
