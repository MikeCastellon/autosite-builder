import { supabase } from './supabase.js';

const BUCKET = 'site-images';
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

export function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image');
}

export function buildImagePath(siteId, imageKey, suffix) {
  return `${siteId}/${imageKey}-${suffix}.jpg`;
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

// Browser-only: load any image source into a canvas, cap the longest edge,
// and re-encode as a JPEG Blob. Accepts a File or a data-URL string.
async function downscaleToJpegBlob(source) {
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
    i.onerror = reject;
    i.src = dataUrl;
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image encode failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

// Short non-cryptographic suffix to bust caches and avoid collisions on re-upload.
function shortSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

// Browser-only: downscale -> upload to Supabase Storage -> return public URL.
export async function uploadSiteImage(source, { siteId, imageKey }) {
  const blob = await downscaleToJpegBlob(source);
  const path = buildImagePath(siteId, imageKey, shortSuffix());
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
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
