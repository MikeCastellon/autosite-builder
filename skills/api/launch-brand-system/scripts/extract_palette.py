"""Colors of a logo (or any brand image / brand guide) as JSON.

For each file:
  background        'transparent' | 'light' | 'dark' (+ backgroundColor when uniform)
  dominant          the logo's main colors by area, background excluded,
                    neutrals included (a black wordmark is a brand color too)
  accentCandidates  chromatic colors only (transparent, near-white,
                    near-black and grey pixels ignored), clustered on their
                    own so a small red stripe is not swallowed by a big
                    black wordmark
  monochrome        true when nothing chromatic covers >= 2% of the logo
  logoField         ready-made brand.json logo.dominant / logo.background
  textColors, fontNames, svgColors
                    hex/RGB values and font names written in PDFs, SVGs and
                    AI files (brand guides list them)
Each color has hex, share (of the logo's pixels), lightness/chroma/hue
(CIE Lab), neutral, and label/labelRatio: the button label the site would
put on it (white or #111111) and its contrast.

Colors are the most common real fill color of each cluster, not the cluster
mean, so anti-aliased edges don't muddy them. Deterministic: same file, same
output.

Reads PNG/JPG/WebP/GIF/BMP/TIFF/PSD (+ AVIF/HEIC/EPS when this Pillow can),
PDF and PDF-compatible AI (page 1, via pypdfium2), SVG (embedded bitmaps are
analyzed; otherwise colors are read from the source, without areas).

Usage:
  extract_palette.py FILE [FILE ...] [--raster-dir DIR] [--k 8]
  --raster-dir writes each decoded image as DIR/<name>.png (RGBA) for
  brand_board.py --logo.
"""
import argparse
import base64
import io
import json
import logging
import os
import re
import sys

import numpy as np
from PIL import Image, ImageOps

sys.dont_write_bytecode = True
logging.getLogger('pypdf').setLevel(logging.ERROR)  # malformed-PDF chatter on stderr
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from theme import contrast_ratio, hex_to_rgb, is_dark, readable_on, rgb_to_hex  # noqa: E402

ANALYSIS_SIDE = 480     # pixels; NEAREST downscale keeps real fill colors
RASTER_SIDE = 1200      # decoded copy for the brand board
BG_DELTA_E = 12         # how far from the background a pixel must be to count as logo
MERGE_DELTA_E = 10      # clusters closer than this are one color
CHROMA_MIN = 18         # Lab chroma below this is grey

# Pillow's own decompression-bomb limit stays in force (error above ~179M
# pixels): uploads are untrusted, a 4.5 MB flat PNG can claim a huge canvas,
# and the container has 5 GiB of RAM. load_image() reports the error as
# Unsupported, so the run carries on with the image the request shows.


class Unsupported(Exception):
    pass


# ─── Loading ──────────────────────────────────────────────────────────

def _to_rgba(img):
    try:
        img.seek(0)  # first frame of an animation
    except (AttributeError, EOFError):
        pass
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:  # broken EXIF must not lose the image
        pass
    if img.mode in ('I;16', 'I;16B', 'I;16L', 'I'):
        img = img.point(lambda v: v / 256).convert('L')
    return img.convert('RGBA')


def _fit(img, side, resample):
    w, h = img.size
    if max(w, h) <= side:
        return img
    k = side / max(w, h)
    return img.resize((max(1, round(w * k)), max(1, round(h * k))), resample)


def _render_pdf(path):
    try:
        import pypdfium2 as pdfium
    except ImportError:
        raise Unsupported('pypdfium2 is not installed, so PDF/AI files cannot be rendered here')
    try:
        pdf = pdfium.PdfDocument(path)
        page = pdf[0]
        w, h = page.get_size()
        scale = max(0.1, min(8.0, RASTER_SIDE / max(w, h, 1)))
        try:
            # A transparent page keeps "logo on nothing" detectable.
            bitmap = page.render(scale=scale, fill_color=(0, 0, 0, 0))
        except TypeError:
            bitmap = page.render(scale=scale)
        return bitmap.to_pil()
    except Unsupported:
        raise
    except Exception as e:  # pdfium raises its own error types
        raise Unsupported('could not render page 1: %s' % e)


def _svg_embedded_bitmap(text):
    m = re.search(r'data:image/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)', text)
    if not m:
        return None
    try:
        return Image.open(io.BytesIO(base64.b64decode(re.sub(r'\s+', '', m.group(2)))))
    except Exception:
        return None


def load_image(path):
    """(RGBA image, how) for anything this container can decode; raises
    Unsupported with a reason otherwise."""
    ext = os.path.splitext(path)[1].lower().lstrip('.')
    if ext in ('pdf', 'ai'):
        return _to_rgba(_render_pdf(path)), 'pdf-page-1'
    if ext == 'svg':
        with open(path, encoding='utf-8', errors='replace') as f:
            embedded = _svg_embedded_bitmap(f.read())
        if embedded is None:
            raise Unsupported('vector SVG: no rasterizer in this container (colors are read from the source instead)')
        return _to_rgba(embedded), 'svg-embedded-bitmap'
    try:
        img = Image.open(path)
        if img.format == 'JPEG':
            img.draft('RGB', (RASTER_SIDE * 2, RASTER_SIDE * 2))
        img.load()
        return _to_rgba(img), 'raster'
    except Exception as e:
        hint = ' (EPS needs Ghostscript, HEIC needs pillow-heif)' if ext in ('eps', 'heic', 'heif') else ''
        raise Unsupported('Pillow cannot read it: %s%s' % (e, hint))


# ─── Color math (Lab for perceptual distances) ───────────────────────

_M = np.array([[0.4124564, 0.3575761, 0.1804375],
               [0.2126729, 0.7151522, 0.0721750],
               [0.0193339, 0.1191920, 0.9503041]])
_WHITE = np.array([0.95047, 1.0, 1.08883])


def srgb_to_lab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    # einsum, not @: some BLAS builds (macOS Accelerate) warn spuriously on matmul.
    xyz = np.einsum('nj,ij->ni', lin, _M) / _WHITE
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], axis=1)


def _bin_keys(rgb, shift=3):
    q = rgb.astype(np.int32) >> shift  # shift 3 = 32 levels per channel
    levels = 256 >> shift
    return (q[:, 0] * levels + q[:, 1]) * levels + q[:, 2]


def _describe(rgb_mean, share, extra=None):
    hx = rgb_to_hex(*[float(v) for v in rgb_mean])
    lab = srgb_to_lab(np.array([rgb_mean]))[0]
    chroma = float(np.hypot(lab[1], lab[2]))
    neutral = bool(chroma < CHROMA_MIN or lab[0] > 96 or lab[0] < 8)
    out = {
        'hex': hx,
        'share': round(float(share), 4),
        'lightness': round(float(lab[0]), 1),
        'chroma': round(chroma, 1),
        'hue': None if neutral else round(float(np.degrees(np.arctan2(lab[2], lab[1])) % 360)),
        'neutral': neutral,
        'label': readable_on(hx),
        'labelRatio': round(contrast_ratio(readable_on(hx), hx), 2),
    }
    if extra:
        out.update(extra)
    return out


def drop_blends(colors, bg_rgb=None, max_dist=14.0):
    """Remove colors that are only anti-aliasing: a small cluster lying on
    the straight sRGB line between a bigger color and the background (or two
    bigger colors), e.g. the grey fringe around white letters on black.
    colors = [(rgb, share)] largest first."""
    kept = []
    for rgb, share in colors:
        ends = [c for c, _ in kept] + ([np.asarray(bg_rgb, dtype=np.float64)] if bg_rgb is not None else [])
        blend = False
        for i, a in enumerate(ends):
            for b in ends[i + 1:]:
                ab = b - a
                denom = float(ab @ ab)
                if denom < 1:
                    continue
                t = float((rgb - a) @ ab) / denom
                if 0.12 < t < 0.88 and np.linalg.norm(a + t * ab - rgb) < max_dist:
                    blend = True
                    break
            if blend:
                break
        if not blend or share >= 0.15:
            kept.append((np.asarray(rgb, dtype=np.float64), share))
    return kept


def cluster(rgb, k_max=8, min_share=0.01):
    """Deterministic k-means in Lab, seeded from the most common real colors.
    Returns [(representative rgb, share)] largest first."""
    n = len(rgb)
    if n == 0:
        return []
    lab = srgb_to_lab(rgb)
    keys = _bin_keys(rgb)

    # Seeds: frequent bins that differ from every seed already taken. Flat
    # logo colors fill a few fine bins; photos and gradients spread over
    # thousands, so retry with coarser bins when the fine ones yield too few.
    for shift in (3, 5, 6):
        bins = keys if shift == 3 else _bin_keys(rgb, shift)
        _, inv, counts = np.unique(bins, return_inverse=True, return_counts=True)
        inv = inv.reshape(-1)
        bin_lab = np.stack([np.bincount(inv, weights=lab[:, i]) / counts for i in range(3)], axis=1)
        seeds = []
        for idx in np.argsort(-counts, kind='stable'):
            if counts[idx] < max(2, 0.002 * n) and seeds:
                break
            if all(np.linalg.norm(bin_lab[idx] - s) >= 2 * MERGE_DELTA_E for s in seeds):
                seeds.append(bin_lab[idx])
                if len(seeds) == k_max:
                    break
        if len(seeds) >= 3 or counts.max() >= 0.5 * n:
            break
    centers = np.array(seeds)

    labels = None
    for _ in range(30):
        d = ((lab[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
        new = d.argmin(axis=1)
        if labels is not None and np.array_equal(new, labels):
            break
        labels = new
        centers = np.array([lab[labels == j].mean(axis=0) if np.any(labels == j) else centers[j] for j in range(len(centers))])

    # Merge near-duplicates (largest absorbs smallest).
    groups = {j: [j] for j in range(len(centers))}
    sizes = {j: int((labels == j).sum()) for j in range(len(centers))}
    merged = True
    while merged:
        merged = False
        ids = sorted(groups, key=lambda j: -sizes[j])
        for i, a in enumerate(ids):
            for b in ids[i + 1:]:
                if np.linalg.norm(centers[a] - centers[b]) < MERGE_DELTA_E:
                    groups[a] += groups.pop(b)
                    total = sizes[a] + sizes[b]
                    centers[a] = (centers[a] * sizes[a] + centers[b] * sizes[b]) / max(total, 1)
                    sizes[a] = total
                    sizes.pop(b)
                    merged = True
                    break
            if merged:
                break

    out = []
    for a, members in groups.items():
        mask = np.isin(labels, members)
        share = mask.sum() / n
        if share < min_share:
            continue
        # The cluster's most common real color, not its mean.
        sub_keys = keys[mask]
        u, c = np.unique(sub_keys, return_counts=True)
        top = u[np.argmax(c)]
        rep = rgb[mask][sub_keys == top].mean(axis=0)
        out.append((rep, share))
    out.sort(key=lambda t: -t[1])
    return out


# ─── Analysis ─────────────────────────────────────────────────────────

def analyze(img, k_max=8):
    small = _fit(img, ANALYSIS_SIDE, Image.NEAREST)
    arr = np.asarray(small, dtype=np.uint8)
    h, w = arr.shape[:2]
    px = arr.reshape(-1, 4)
    alpha_ch = px[:, 3]
    notes = []

    b = max(1, round(min(h, w) * 0.02))
    ring = np.concatenate([arr[:b].reshape(-1, 4), arr[-b:].reshape(-1, 4),
                           arr[:, :b].reshape(-1, 4), arr[:, -b:].reshape(-1, 4)])
    transparent_share = float((alpha_ch < 16).mean())
    ring_clear = float((ring[:, 3] < 16).mean())

    bg_rgb = None
    uniform = False
    if ring_clear > 0.5 or transparent_share > 0.2:
        background = 'transparent'
    else:
        opaque_ring = ring[ring[:, 3] >= 16][:, :3]
        rk = _bin_keys(opaque_ring)
        u, c = np.unique(rk, return_counts=True)
        top = u[np.argmax(c)]
        uniform = c.max() / len(rk) >= 0.5
        bg_rgb = (opaque_ring[rk == top] if uniform else opaque_ring).astype(np.float64)
        bg_rgb = np.median(bg_rgb, axis=0)
        background = 'dark' if is_dark(rgb_to_hex(*bg_rgb)) else 'light'
        if not uniform:
            notes.append('busy edges: this looks like a photo or a logo on a pattern, not a logo on a plain background')

    fg_mask = alpha_ch >= 128
    if bg_rgb is not None and uniform:
        lab_all = srgb_to_lab(px[:, :3])
        bg_lab = srgb_to_lab(np.array([bg_rgb]))[0]
        fg_mask &= np.linalg.norm(lab_all - bg_lab, axis=1) > BG_DELTA_E
    fg = px[fg_mask][:, :3].astype(np.float64)
    if len(fg) < max(50, 0.002 * len(px)):
        notes.append('almost nothing differs from the background; colors below are from every opaque pixel')
        fg = px[alpha_ch >= 128][:, :3].astype(np.float64)

    dominant = [_describe(rgb, share) for rgb, share in drop_blends(cluster(fg, k_max=k_max, min_share=0.01), bg_rgb)]

    accents = []
    chroma_share = 0.0
    if len(fg):
        lab_fg = srgb_to_lab(fg)
        chroma = np.hypot(lab_fg[:, 1], lab_fg[:, 2])
        chromatic = (chroma >= CHROMA_MIN) & (lab_fg[:, 0] > 10) & (lab_fg[:, 0] < 96)
        chroma_share = float(chromatic.mean())
        if chromatic.sum() >= 20:
            for rgb, share in drop_blends(cluster(fg[chromatic], k_max=6, min_share=0.03), bg_rgb):
                accents.append(_describe(rgb, share * chroma_share, {'shareOfChromatic': round(float(share), 4)}))
    monochrome = chroma_share < 0.02

    return {
        'size': [img.width, img.height],
        'background': background,
        'backgroundColor': rgb_to_hex(*bg_rgb) if bg_rgb is not None and uniform else None,
        'foregroundShare': round(float(len(fg)) / len(px), 4),
        'dominant': dominant,
        'accentCandidates': accents,
        'monochrome': monochrome,
        'notes': notes,
    }


# ─── Text in brand documents ─────────────────────────────────────────

# '#C8102E', or 'HEX C8102E' (a bare 6-letter word like 'facade' is not a color).
HEX_IN_TEXT = re.compile(r'(?:#|\bhex\b[^0-9A-Za-z]{0,4})([0-9A-Fa-f]{6})(?![0-9A-Za-z])', re.I)
RGB_IN_TEXT = re.compile(r'\bRGB\b[^0-9]{0,6}(\d{1,3})[\s,/]+(\d{1,3})[\s,/]+(\d{1,3})', re.I)
SVG_COLOR = re.compile(r'(?:fill|stroke|stop-color|color)\s*[:=]\s*["\']?\s*(#[0-9A-Fa-f]{3,8}\b|rgba?\([^)]*\))', re.I)


def _font_names(text):
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, '..', 'data', 'fonts.json'), encoding='utf-8') as f:
        families = list(json.load(f)['families'])
    with open(os.path.join(here, '..', 'data', 'font_lookalikes.json'), encoding='utf-8') as f:
        looks = list(json.load(f)['lookalikes'])
    low = text.lower()
    found = [fam for fam in families if re.search(r'\b%s\b' % re.escape(fam.lower()), low)]
    found += [k for k in looks if re.search(r'\b%s\b' % re.escape(k), low) and k not in [x.lower() for x in found]]
    return found


def scan_text(path):
    """Colors and font names written in a PDF/AI/SVG (a brand guide's
    'Primary red #C8102E, font: Gotham'). [] when there is no text layer."""
    ext = os.path.splitext(path)[1].lower().lstrip('.')
    text = ''
    if ext == 'svg':
        with open(path, encoding='utf-8', errors='replace') as f:
            src = f.read()
        counts = {}
        for m in SVG_COLOR.finditer(re.sub(r'data:image/[^"\')]+', '', src)):
            hx = rgb_to_hex(*_parse_color(m.group(1)))
            counts[hx] = counts.get(hx, 0) + 1
        text = ' '.join(re.findall(r'>([^<]{1,200})<', src))
        return {'svgColors': [{'hex': k, 'uses': v} for k, v in sorted(counts.items(), key=lambda kv: -kv[1])][:12],
                'textColors': [], 'fontNames': _font_names(src)}
    if ext in ('pdf', 'ai'):
        try:
            from pypdf import PdfReader
            reader = PdfReader(path)
            text = '\n'.join((page.extract_text() or '') for page in reader.pages[:12])
        except Exception:
            text = ''
    colors = []
    for m in HEX_IN_TEXT.finditer(text):
        hx = '#' + m.group(1).lower()
        if hx not in colors:
            colors.append(hx)
    for m in RGB_IN_TEXT.finditer(text):
        vals = [int(v) for v in m.groups()]
        if all(v <= 255 for v in vals):
            hx = rgb_to_hex(*vals)
            if hx not in colors:
                colors.append(hx)
    return {'textColors': colors[:16], 'fontNames': _font_names(text) if text else []}


def _parse_color(s):
    c = hex_to_rgb(s) or {'r': 0, 'g': 0, 'b': 0}
    return c['r'], c['g'], c['b']


# ─── CLI ──────────────────────────────────────────────────────────────

def report(path, k_max=8, raster_dir=None):
    out = {'file': path}
    ext = os.path.splitext(path)[1].lower().lstrip('.')
    try:
        img, how = load_image(path)
        out['decoded'] = how
        out.update(analyze(img, k_max=k_max))
        if raster_dir:
            os.makedirs(raster_dir, exist_ok=True)
            dest = os.path.join(raster_dir, os.path.splitext(os.path.basename(path))[0] + '.png')
            _fit(img, RASTER_SIDE, Image.LANCZOS).save(dest)
            out['raster'] = dest
        if out['dominant']:
            out['logoField'] = {
                'dominant': [c['hex'] for c in out['dominant'][:5]]
                + [c['hex'] for c in out['accentCandidates'] if c['hex'] not in [d['hex'] for d in out['dominant'][:5]]][:1],
                'background': out['background'],
            }
    except Unsupported as e:
        out['decoded'] = None
        out['error'] = str(e)
    if ext in ('pdf', 'ai', 'svg'):
        out.update(scan_text(path))
    return out


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('files', nargs='+')
    ap.add_argument('--k', type=int, default=8, help='most colors per cluster pass (default 8)')
    ap.add_argument('--raster-dir', default=None)
    args = ap.parse_args(argv[1:])
    results = []
    for path in args.files:
        if not os.path.isfile(path):
            results.append({'file': path, 'decoded': None, 'error': 'no such file'})
            continue
        results.append(report(path, args.k, args.raster_dir))
    print(json.dumps(results if len(results) > 1 else results[0], indent=2))
    return 0 if all(r.get('decoded') or r.get('svgColors') or r.get('textColors') for r in results) else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
