// tests/functions/heic-convert.test.js
//
// HEIC/HEIF to JPEG (netlify/functions/_lib/heic.js) on a real HEIC: the
// 96x64 fixture macOS sips wrote from a four-corner gradient (top left
// blue, top right pink, bottom left green, bottom right yellow), so the
// tests can tell which way up the JPEG came out. The output is decoded
// again with jpeg-js to check its size and pixels.
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { ALPHA_HEIC, GRID_TURNED_HEIC, SAMPLE_HEIC } from '../fixtures/heic/fakes.js';

// jpeg-js as the functions resolve it (netlify/functions/node_modules).
const jpegJs = createRequire(new URL('../../netlify/functions/package.json', import.meta.url))('jpeg-js');

const {
  HEIC_JPEG_QUALITY, HEIC_MAX_SIDE, convertHeic, decodeHeic, downscaleRgba, encodeJpeg, flattenOnWhite, isHeifBuffer,
} = await import('../../netlify/functions/_lib/heic.js');

const isJpeg = (buf) => Buffer.isBuffer(buf) && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
const decodeJpeg = (buf) => jpegJs.decode(buf, { useTArray: true });
const pixel = (img, x, y) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));
// Within a JPEG's rounding of the source color.
const near = (got, want, tol = 24) => got.every((v, i) => Math.abs(v - want[i]) <= tol);

// The fixture's corners as libheif decodes them.
const BLUE = [0, 2, 125];
const PINK = [248, 2, 127];
const GREEN = [6, 248, 130];
const YELLOW = [249, 248, 130];

// The fixture with its irot property (rotation, in quarter turns
// anticlockwise) set to `quarterTurns`: the way a phone records a photo
// taken sideways. The box is 'irot' followed by one byte.
function rotated(quarterTurns) {
  const buf = Buffer.from(SAMPLE_HEIC);
  const at = buf.indexOf(Buffer.from('irot', 'latin1'));
  if (at < 0) throw new Error('fixture has no irot box');
  buf[at + 4] = quarterTurns & 3;
  return buf;
}

function gradient(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = Math.round((x * 255) / (width - 1));
      data[i + 1] = Math.round((y * 255) / (height - 1));
      data[i + 2] = 90;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('convertHeic', () => {
  it('turns the HEIC fixture into a JPEG of the same size and colors', async () => {
    const out = await convertHeic(SAMPLE_HEIC);
    expect(out.width).toBe(96);
    expect(out.height).toBe(64);
    expect(isJpeg(out.jpeg)).toBe(true);
    // Ends with the EOI marker: a whole file, not a truncated one.
    expect(out.jpeg.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
    const img = decodeJpeg(out.jpeg);
    expect([img.width, img.height]).toEqual([96, 64]);
    expect(near(pixel(img, 1, 1), BLUE)).toBe(true);
    expect(near(pixel(img, 94, 1), PINK)).toBe(true);
    expect(near(pixel(img, 1, 62), GREEN)).toBe(true);
    expect(near(pixel(img, 94, 62), YELLOW)).toBe(true);
  });

  it('writes no EXIF (no orientation to apply twice, no location)', async () => {
    const { jpeg } = await convertHeic(SAMPLE_HEIC);
    expect(jpeg.indexOf(Buffer.from('Exif\0', 'latin1'))).toBe(-1);
    // APP0 (JFIF) right after the start marker.
    expect(jpeg.subarray(2, 4)).toEqual(Buffer.from([0xff, 0xe0]));
  });

  it('honors the HEIF rotation (irot) the way an iPhone records a sideways photo', async () => {
    // 90° anticlockwise: the top right corner comes to the top left.
    const quarter = await convertHeic(rotated(1));
    expect([quarter.width, quarter.height]).toEqual([64, 96]);
    const q = decodeJpeg(quarter.jpeg);
    expect(near(pixel(q, 1, 1), PINK)).toBe(true);
    expect(near(pixel(q, 62, 1), YELLOW)).toBe(true);
    expect(near(pixel(q, 1, 94), BLUE)).toBe(true);
    expect(near(pixel(q, 62, 94), GREEN)).toBe(true);

    // 90° clockwise (three quarter turns anticlockwise).
    const three = decodeJpeg((await convertHeic(rotated(3))).jpeg);
    expect([three.width, three.height]).toEqual([64, 96]);
    expect(near(pixel(three, 1, 1), GREEN)).toBe(true);
    expect(near(pixel(three, 62, 1), BLUE)).toBe(true);

    // Upside down keeps the size.
    const half = decodeJpeg((await convertHeic(rotated(2))).jpeg);
    expect([half.width, half.height]).toEqual([96, 64]);
    expect(near(pixel(half, 1, 1), YELLOW)).toBe(true);
  });

  it('scales down to maxSide and keeps the aspect ratio', async () => {
    const out = await convertHeic(SAMPLE_HEIC, { maxSide: 48 });
    expect([out.width, out.height]).toEqual([48, 32]);
    const img = decodeJpeg(out.jpeg);
    expect([img.width, img.height]).toEqual([48, 32]);
    expect(near(pixel(img, 0, 0), BLUE, 32)).toBe(true);
    expect(near(pixel(img, 47, 31), YELLOW, 32)).toBe(true);
  });

  it('uses the quality it is given', async () => {
    const low = await convertHeic(SAMPLE_HEIC, { quality: 20 });
    const high = await convertHeic(SAMPLE_HEIC, { quality: 100 });
    expect(low.jpeg.length).toBeLessThan(high.jpeg.length);
    expect(HEIC_JPEG_QUALITY).toBe(86);
    expect(HEIC_MAX_SIDE).toBe(2560);
  });

  it('refuses bytes that are not HEIC/HEIF', async () => {
    const jpeg = (await convertHeic(SAMPLE_HEIC)).jpeg;
    await expect(convertHeic(jpeg)).rejects.toThrow(/Not a HEIC\/HEIF image/);
    await expect(convertHeic(Buffer.from('hello, this is not an image at all'))).rejects.toThrow(/Not a HEIC/);
    await expect(convertHeic(Buffer.alloc(0))).rejects.toThrow(/Not a HEIC/);
    // A HEIF header with nothing decodable after it.
    const broken = Buffer.concat([SAMPLE_HEIC.subarray(0, 40), Buffer.alloc(40)]);
    await expect(convertHeic(broken)).rejects.toThrow();
  });

  it('decodes the next file after a broken one (the decoder is reused)', async () => {
    await expect(convertHeic(Buffer.concat([SAMPLE_HEIC.subarray(0, 60), Buffer.alloc(60)]))).rejects.toThrow();
    const out = await decodeHeic(SAMPLE_HEIC);
    expect([out.width, out.height, out.hasAlpha]).toEqual([96, 64, false]);
    expect(out.data.length).toBe(96 * 64 * 4);
    expect(out.data).toBeInstanceOf(Uint8ClampedArray);
  });

  it('refuses an image over maxPixels before decoding it', async () => {
    await expect(convertHeic(SAMPLE_HEIC, { maxPixels: 96 * 64 - 1 })).rejects.toThrow('The image is too large to convert (96x64)');
    await expect(decodeHeic(SAMPLE_HEIC, { maxPixels: 100 })).rejects.toThrow(/too large/);
    expect((await convertHeic(SAMPLE_HEIC, { maxPixels: 96 * 64 })).width).toBe(96);
  });

  it('converts an iPhone-style photo: a grid of tiles, turned by its orientation, rows padded', async () => {
    // Stored 1202x802 with orientation 6 (turn 90 degrees clockwise): the
    // stored bottom left (green) comes to the top left.
    const out = await convertHeic(GRID_TURNED_HEIC);
    expect([out.width, out.height]).toEqual([802, 1202]);
    const img = decodeJpeg(out.jpeg);
    expect([img.width, img.height]).toEqual([802, 1202]);
    expect(near(pixel(img, 5, 5), GREEN)).toBe(true);
    expect(near(pixel(img, 796, 5), BLUE)).toBe(true);
    expect(near(pixel(img, 5, 1196), YELLOW)).toBe(true);
    expect(near(pixel(img, 796, 1196), PINK)).toBe(true);
    // The padding at the end of libheif's rows never shows: the right
    // edge is the picture's own color all the way down.
    for (const y of [5, 300, 700, 1196]) expect(pixel(img, 801, y)[2]).toBeGreaterThan(100);

    // Scaled down from the padded rows.
    const small = await convertHeic(GRID_TURNED_HEIC, { maxSide: 400 });
    expect([small.width, small.height]).toEqual([267, 400]);
    const s = decodeJpeg(small.jpeg);
    expect(near(pixel(s, 3, 3), GREEN)).toBe(true);
    expect(near(pixel(s, 263, 3), BLUE)).toBe(true);
    expect(near(pixel(s, 3, 396), YELLOW)).toBe(true);
    expect(near(pixel(s, 263, 396), PINK)).toBe(true);

    // decodeHeic hands back packed rows.
    const raw = await decodeHeic(GRID_TURNED_HEIC);
    expect([raw.width, raw.height, raw.data.length]).toEqual([802, 1202, 802 * 1202 * 4]);
    const at = (x, y) => Array.from(raw.data.slice((y * 802 + x) * 4, (y * 802 + x) * 4 + 4));
    expect(near(at(801, 5).slice(0, 3), BLUE, 12)).toBe(true);
    expect(near(at(0, 1201).slice(0, 3), YELLOW, 12)).toBe(true);
    expect(at(801, 1201)[3]).toBe(255);
  });

  it('puts a HEIF with transparency on white', async () => {
    const raw = await decodeHeic(ALPHA_HEIC);
    expect([raw.width, raw.height, raw.hasAlpha]).toEqual([64, 32, true]);
    expect(raw.data[(16 * 64 + 60) * 4 + 3]).toBe(0);
    expect(raw.data[(16 * 64 + 4) * 4 + 3]).toBe(255);

    const out = await convertHeic(ALPHA_HEIC);
    const img = decodeJpeg(out.jpeg);
    expect([img.width, img.height]).toEqual([64, 32]);
    // The opaque half keeps its blue (sRGB 0.1, 0.2, 0.6), the clear half is white.
    expect(near(pixel(img, 4, 16), [26, 51, 153], 12)).toBe(true);
    expect(near(pixel(img, 60, 16), [255, 255, 255], 4)).toBe(true);
  });

  it('converts file after file on the one decoder', async () => {
    for (let i = 0; i < 20; i += 1) {
      const out = await convertHeic(i % 2 ? GRID_TURNED_HEIC : SAMPLE_HEIC, { maxSide: 200 });
      expect([out.width, out.height]).toEqual(i % 2 ? [133, 200] : [96, 64]);
    }
  });
});

describe('isHeifBuffer', () => {
  it('goes by the ftyp major brand', () => {
    expect(isHeifBuffer(SAMPLE_HEIC)).toBe(true);
    const brand = (b) => {
      const buf = Buffer.from(SAMPLE_HEIC);
      buf.write(b, 8, 'latin1');
      return buf;
    };
    expect(isHeifBuffer(brand('mif1'))).toBe(true);
    expect(isHeifBuffer(brand('heix'))).toBe(true);
    expect(isHeifBuffer(brand('avif'))).toBe(false);
    expect(isHeifBuffer(brand('isom'))).toBe(false);
    expect(isHeifBuffer(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false);
    expect(isHeifBuffer(null)).toBe(false);
    expect(isHeifBuffer(Buffer.from('ftyp'))).toBe(false);
  });
});

describe('downscaleRgba (area average)', () => {
  it('averages each box of source pixels', () => {
    // 4x2 to 2x1: each output pixel is the mean of a 2x2 block.
    const src = {
      width: 4,
      height: 2,
      data: new Uint8ClampedArray([
        0, 0, 0, 255, 100, 40, 0, 255, 200, 0, 0, 255, 200, 0, 0, 255,
        100, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 40, 80, 120, 255,
      ]),
    };
    const out = downscaleRgba(src, 2);
    expect([out.width, out.height]).toEqual([2, 1]);
    expect(Array.from(out.data)).toEqual([50, 10, 0, 255, 110, 20, 30, 255]);
  });

  it('returns an image that already fits as it is', () => {
    const img = gradient(30, 20);
    expect(downscaleRgba(img, 30)).toBe(img);
    expect(downscaleRgba(img, 2560)).toBe(img);
  });

  it('covers every source pixel once, whatever the ratio', () => {
    // A flat color stays exactly that color at an awkward ratio.
    const W = 1001;
    const H = 333;
    const data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = 17; data[i + 1] = 130; data[i + 2] = 241; data[i + 3] = 255; }
    const out = downscaleRgba({ width: W, height: H, data }, 97);
    expect(out.width).toBe(97);
    expect(out.height).toBe(Math.round(H * (97 / W)));
    for (let i = 0; i < out.data.length; i += 4) {
      expect([out.data[i], out.data[i + 1], out.data[i + 2], out.data[i + 3]]).toEqual([17, 130, 241, 255]);
    }
    // A very long, thin image keeps at least a pixel of height.
    const thin = downscaleRgba(gradient(6000, 2), 100);
    expect([thin.width, thin.height]).toEqual([100, 1]);
  });

  it('reads rows `stride` bytes apart and never the padding between them', () => {
    // 3x2 red-green gradient with 8 bytes of junk (bright blue, opaque)
    // after each row, as libheif pads rows.
    const W = 3;
    const H = 2;
    const stride = W * 4 + 8;
    const data = new Uint8Array(stride * H).fill(255);
    const put = (x, y, rgba) => data.set(rgba, y * stride + x * 4);
    put(0, 0, [0, 0, 0, 255]); put(1, 0, [30, 0, 0, 255]); put(2, 0, [60, 0, 0, 255]);
    put(0, 1, [0, 90, 0, 255]); put(1, 1, [30, 90, 0, 255]); put(2, 1, [60, 90, 0, 255]);
    for (let y = 0; y < H; y += 1) data.set([0, 0, 255, 255, 0, 0, 255, 255], y * stride + W * 4);

    // 3x2 to 2x1 (maxSide 2): boxes [0,2) and [2,3) across, both rows down.
    const out = downscaleRgba({ width: W, height: H, stride, data }, 2);
    expect([out.width, out.height]).toEqual([2, 1]);
    expect(Array.from(out.data)).toEqual([15, 45, 0, 255, 60, 45, 0, 255]);

    // Fits as it is: encoded from the packed rows, no blue from the padding.
    const enc = encodeJpeg({ width: W, height: H, stride, data }, { quality: 100 });
    expect([enc.width, enc.height]).toEqual([3, 2]);
    const img = decodeJpeg(enc.jpeg);
    for (let i = 0; i < img.data.length; i += 4) expect(img.data[i + 2]).toBeLessThan(40);
  });

  it('brings a 12 MP decode down to 2560 on the long side and keeps the picture', () => {
    // What decodeHeic hands back for a 4032x3024 iPhone photo.
    const big = gradient(4032, 3024);
    const out = encodeJpeg(big);
    expect([out.width, out.height]).toEqual([2560, 1920]);
    expect(isJpeg(out.jpeg)).toBe(true);
    const img = decodeJpeg(out.jpeg);
    expect([img.width, img.height]).toEqual([2560, 1920]);
    // The gradient survives: dark red at the left, full red at the right,
    // green growing downwards.
    expect(pixel(img, 0, 0)[0]).toBeLessThan(12);
    expect(pixel(img, 2559, 0)[0]).toBeGreaterThan(243);
    expect(pixel(img, 1280, 0)[1]).toBeLessThan(12);
    expect(pixel(img, 1280, 1919)[1]).toBeGreaterThan(243);
    expect(Math.abs(pixel(img, 1280, 960)[0] - 128)).toBeLessThan(10);

    // Portrait the other way round, and a smaller maxSide.
    const tall = encodeJpeg(gradient(3024, 4032), { maxSide: 1000 });
    expect([tall.width, tall.height]).toEqual([750, 1000]);
    expect([decodeJpeg(tall.jpeg).width, decodeJpeg(tall.jpeg).height]).toEqual([750, 1000]);
  });
});

describe('flattenOnWhite', () => {
  it('puts see-through pixels on white (JPEG has no transparency)', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255, 0, 0, 0, 0, 0, 0, 0, 128]);
    flattenOnWhite(data);
    expect(Array.from(data.slice(0, 4))).toEqual([10, 20, 30, 255]);
    expect(Array.from(data.slice(4, 8))).toEqual([255, 255, 255, 255]);
    expect(Array.from(data.slice(8, 12))).toEqual([127, 127, 127, 255]);
  });

  it('touches only the pixels of padded rows, and rounds in a plain Uint8Array', () => {
    // Two rows of one pixel, each followed by 4 bytes of padding.
    const data = new Uint8Array([
      0, 0, 0, 128, 9, 9, 9, 0,
      200, 100, 0, 51, 9, 9, 9, 0,
    ]);
    flattenOnWhite(data, { width: 1, height: 2, stride: 8 });
    expect(Array.from(data)).toEqual([
      127, 127, 127, 255, 9, 9, 9, 0,
      // 200 * 0.2 + 204 = 244, 100 * 0.2 + 204 = 224, 0 + 204 = 204.
      244, 224, 204, 255, 9, 9, 9, 0,
    ]);
    // 1 * 128/255 + 127 = 127.5: rounded up in either kind of array (a plain
    // Uint8Array would truncate it to 127).
    expect(Array.from(flattenOnWhite(new Uint8Array([1, 1, 1, 128])))).toEqual([128, 128, 128, 255]);
    expect(Array.from(flattenOnWhite(new Uint8ClampedArray([1, 1, 1, 128])))).toEqual([128, 128, 128, 255]);
  });

  it('applies to images with alpha before encoding', () => {
    const img = { width: 2, height: 1, hasAlpha: true, data: new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0]) };
    const out = decodeJpeg(encodeJpeg(img).jpeg);
    expect(near(pixel(out, 0, 0), [255, 255, 255], 4)).toBe(true);
  });
});
