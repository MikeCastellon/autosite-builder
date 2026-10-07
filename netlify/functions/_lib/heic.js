// HEIC/HEIF to JPEG, for the custom-site uploads (custom-site-heic-background).
//
// iPhones save photos as HEIC. Claude can't look at them, the Design step
// can't import them and most browsers can't show them on a site, so the
// background function turns each one into a JPEG. Pure JS and wasm, nothing
// native to build on Netlify: libheif (LGPL-3.0, compiled to wasm with the
// wasm inlined, from libheif-js) decodes and jpeg-js encodes, the two
// libraries heic-convert is made of. heic-convert's own API isn't used: it
// copies the whole decoded image out to JS and encodes it at full size,
// where this picks the primary image and scales it down first, reading the
// pixels where libheif decoded them.
//
// Orientation: HEIF stores rotation and mirroring as the `irot` / `imir`
// properties of the image, and libheif applies them while decoding (its
// default decode options), so the pixels come out upright and
// get_width/get_height already describe the turned image. iPhones record
// orientation that way (the sensor's pixels plus irot); the EXIF Orientation
// they also write describes the same turn and must not be applied a second
// time (the HEIF spec has readers ignore it). The tests turn a fixture's
// irot and check where the corners land. The JPEG carries no EXIF at all, so
// a browser shows it as decoded, and the phone's location metadata doesn't
// ride along onto a website.
//
// Bundling: wasm-bundle.js carries the wasm inline (no file to ship), but
// it reads `__dirname` as it loads. Netlify bundles these functions as
// CommonJS (netlify/functions/package.json has no "type": "module"), where
// that is defined; an ESM bundle needs Netlify's createRequire/__dirname
// banner, and without it the function fails as it loads.
import libheif from 'libheif-js/wasm-bundle.js';
import jpegJs from 'jpeg-js';

// Longest side of the JPEG: sharp on any screen a site is seen on (a hero is
// at most ~2560 px wide on a big retina display), a fraction of the bytes of
// a 12 or 48 MP original.
export const HEIC_MAX_SIDE = 2560;
// jpeg-js quality, 1..100.
export const HEIC_JPEG_QUALITY = 86;
// Refused before the pixels are decoded. libheif's heap peaks at about 7
// bytes a pixel while it turns the decoded YCbCr into RGBA, and a wasm heap
// never shrinks back. A 48 MP iPhone photo (8064x6048) fits the function's
// 1 GB: measured at ~650 MB resident for the whole process, and at most
// ~800 MB over eight in a row (copying the RGBA out to JS as well, as
// libheif-js's display() does, took eight past 1.3 GB).
export const HEIC_MAX_PIXELS = 50 * 1000 * 1000;

// The ftyp major brands of HEIF still images and sequences (HEVC-coded or
// generic). AVIF ('avif', 'avis') is a HEIF too, but this libheif build has
// no AV1 decoder, and browsers show AVIF anyway.
const HEIF_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'mif2', 'msf1']);

export function isHeifBuffer(buf) {
  if (!buf || buf.length < 12) return false;
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b.toString('latin1', 4, 8) !== 'ftyp') return false;
  return HEIF_BRANDS.has(b.toString('latin1', 8, 12).replace(/\0/g, ' ').trim());
}

// libheif's enums are embind objects, one instance per value.
const sameEnum = (a, b) => a === b || (!!a && !!b && a.value !== undefined && a.value === b.value);

// Decodes the primary image of a HEIC/HEIF file and calls `use(image)` with
// its pixels where libheif decoded them: { width, height, stride, data,
// hasAlpha }, RGBA, upright, `data` a view of libheif's heap (row y starts
// at y * stride). The pixels are released once `use` settles, so it must be
// done with them by then and call nothing of libheif's in between (a call
// could grow the heap and detach the view). Returns what `use` returns.
// A file can hold several top-level images (a burst, an edit beside its
// original); the one a viewer shows is the primary.
async function withPrimaryImage(buffer, use, { maxPixels = HEIC_MAX_PIXELS } = {}) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (!isHeifBuffer(buf)) throw new Error('Not a HEIC/HEIF image');
  await libheif.ready;
  const decoder = new libheif.HeifDecoder();
  let images = [];
  try {
    images = decoder.decode(buf) || [];
    if (!images.length) throw new Error('libheif could not read the file (damaged or not a still image)');
    const image = images.find((img) => typeof img.is_primary === 'function' && img.is_primary()) || images[0];
    const width = image.get_width();
    const height = image.get_height();
    if (!(width > 0 && height > 0)) throw new Error('The HEIC image has no size');
    if (width * height > maxPixels) throw new Error(`The image is too large to convert (${width}x${height})`);
    const hasAlpha = typeof image.has_alpha_channel === 'function' && !!image.has_alpha_channel();
    // What libheif-js's image.display() does, minus its copy of every pixel
    // into a JS array (as big again as the RGBA itself).
    const decoded = await libheif.heif_js_decode_image2(
      image.handle, libheif.heif_colorspace.heif_colorspace_RGB, libheif.heif_chroma.heif_chroma_interleaved_RGBA,
    );
    if (!decoded || decoded.code || !decoded.image) {
      throw new Error(`libheif could not decode the image${decoded?.message ? `: ${decoded.message}` : ''}`);
    }
    try {
      const plane = (decoded.channels || []).find((c) => sameEnum(c?.id, libheif.heif_channel.heif_channel_interleaved));
      const w = plane?.width;
      const h = plane?.height;
      const stride = plane?.stride;
      if (!plane?.data || !(w > 0 && h > 0) || !(stride >= w * 4) || plane.data.length < stride * (h - 1) + w * 4) {
        throw new Error('libheif could not decode the image');
      }
      return await use({ width: w, height: h, stride, data: plane.data, hasAlpha });
    } finally {
      libheif.heif_image_release(decoded.image);
    }
  } finally {
    // The wasm heap outlives one file: give back what this one took.
    for (const img of images) {
      try { img.free(); } catch { /* already freed */ }
    }
    try { decoder.decoder?.delete(); } catch { /* nothing to free */ }
  }
}

// An RGBA image as a tightly packed copy (stride = width * 4) a JPEG
// encoder can take; an image already packed comes back as it is.
function packRgba(image) {
  const { width: w, height: h, data } = image;
  const stride = image.stride || w * 4;
  if (stride === w * 4 && data.length === w * h * 4) return image;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) out.set(data.subarray(y * stride, y * stride + w * 4), y * w * 4);
  return { width: w, height: h, data: out };
}

// The primary image of a HEIC/HEIF file as { width, height, data (RGBA,
// Uint8ClampedArray, packed), hasAlpha }: a copy of every pixel, for callers
// that keep them (convertHeic doesn't make one).
export async function decodeHeic(buffer, opts) {
  return withPrimaryImage(buffer, (image) => {
    const packed = packRgba(image);
    // packRgba copied already, or handed back the view of libheif's heap.
    const data = packed === image ? new Uint8ClampedArray(image.data) : packed.data;
    return { width: image.width, height: image.height, data, hasAlpha: image.hasAlpha };
  }, opts);
}

// Box edges for scaling n source pixels down to m (n > m): output pixel i
// covers source pixels [e[i], e[i + 1]). Each box holds at least one pixel
// because n / m > 1.
function boxEdges(n, m) {
  const e = new Int32Array(m + 1);
  for (let i = 0; i <= m; i += 1) e[i] = Math.round((i * n) / m);
  return e;
}

// Scales an RGBA image ({ width, height, data, stride? }) down so its
// longest side is at most `maxSide`, each output pixel the plain average of
// the source pixels its box covers (an area average: no ringing, no moire
// from skipped pixels, and every source pixel read once). The result is
// packed. An image that already fits comes back as it is.
export function downscaleRgba(image, maxSide = HEIC_MAX_SIDE) {
  const { width: W, height: H, data: src } = image;
  const stride = image.stride || W * 4;
  const longest = Math.max(W, H);
  if (!(maxSide > 0) || longest <= maxSide) return image;
  const scale = maxSide / longest;
  const w = Math.max(1, Math.min(maxSide, Math.round(W * scale)));
  const h = Math.max(1, Math.min(maxSide, Math.round(H * scale)));
  const xs = boxEdges(W, w);
  const ys = boxEdges(H, h);
  const out = new Uint8ClampedArray(w * h * 4);
  const acc = new Float64Array(w * 4);
  for (let y = 0; y < h; y += 1) {
    acc.fill(0);
    const y0 = ys[y];
    const y1 = ys[y + 1];
    for (let sy = y0; sy < y1; sy += 1) {
      const row = sy * stride;
      for (let x = 0; x < w; x += 1) {
        let r = 0; let g = 0; let b = 0; let a = 0;
        for (let i = row + xs[x] * 4, end = row + xs[x + 1] * 4; i < end; i += 4) {
          r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3];
        }
        const o = x * 4;
        acc[o] += r; acc[o + 1] += g; acc[o + 2] += b; acc[o + 3] += a;
      }
    }
    const rows = y1 - y0;
    for (let x = 0; x < w; x += 1) {
      const n = rows * (xs[x + 1] - xs[x]);
      const o = x * 4;
      const p = (y * w + x) * 4;
      // Uint8ClampedArray rounds on assignment.
      out[p] = acc[o] / n;
      out[p + 1] = acc[o + 1] / n;
      out[p + 2] = acc[o + 2] / n;
      out[p + 3] = acc[o + 3] / n;
    }
  }
  return { width: w, height: h, data: out };
}

// JPEG has no transparency: see-through pixels (a HEIF logo with alpha)
// would come out black, so they go onto white. In place. Without `width`,
// `data` is taken as packed pixels; with it, only each row's `width` pixels
// (rows `stride` bytes apart) are touched.
export function flattenOnWhite(data, { width, height, stride } = {}) {
  const rowBytes = width > 0 ? width * 4 : data.length - (data.length % 4);
  const step = width > 0 ? (stride || rowBytes) : rowBytes;
  const rows = width > 0 ? height : 1;
  for (let y = 0; y < rows; y += 1) {
    for (let i = y * step, end = i + rowBytes; i < end; i += 4) {
      const a = data[i + 3];
      if (a === 255) continue;
      const k = a / 255;
      // Rounded here: the pixels may be a plain Uint8Array (libheif's heap),
      // which truncates.
      data[i] = Math.round(data[i] * k + 255 * (1 - k));
      data[i + 1] = Math.round(data[i + 1] * k + 255 * (1 - k));
      data[i + 2] = Math.round(data[i + 2] * k + 255 * (1 - k));
      data[i + 3] = 255;
    }
  }
  return data;
}

// An RGBA image ({ width, height, data, stride?, hasAlpha? }, as
// withPrimaryImage or decodeHeic hands it over) to a JPEG no wider or taller
// than maxSide. Returns { jpeg: Buffer, width, height }. Flattens an image
// with alpha in place.
export function encodeJpeg(image, { maxSide = HEIC_MAX_SIDE, quality = HEIC_JPEG_QUALITY } = {}) {
  if (image.hasAlpha) flattenOnWhite(image.data, { width: image.width, height: image.height, stride: image.stride });
  const scaled = packRgba(downscaleRgba(image, maxSide));
  const q = Math.min(100, Math.max(1, Math.round(Number(quality) || HEIC_JPEG_QUALITY)));
  const { data } = jpegJs.encode({ data: scaled.data, width: scaled.width, height: scaled.height }, q);
  return { jpeg: Buffer.from(data), width: scaled.width, height: scaled.height };
}

// A HEIC/HEIF file's primary image as a JPEG, upright, longest side at most
// maxSide. Returns { jpeg: Buffer, width, height }; throws when the bytes
// aren't a HEIC/HEIF image libheif can decode, or the image has more than
// maxPixels pixels.
export async function convertHeic(buffer, { maxSide = HEIC_MAX_SIDE, quality = HEIC_JPEG_QUALITY, maxPixels = HEIC_MAX_PIXELS } = {}) {
  return withPrimaryImage(buffer, (image) => encodeJpeg(image, { maxSide, quality }), { maxPixels });
}
