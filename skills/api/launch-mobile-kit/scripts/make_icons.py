"""Makes the phone and browser icons from the customer's logo (or a monogram
when there is none), all on one background color.

  make_icons.py --logo LOGO --inputs mobile-inputs.json --out-dir /tmp/mobile [options]
  make_icons.py --monogram GB --inputs mobile-inputs.json --out-dir /tmp/mobile [--font font.ttf]
  make_icons.py --logo LOGO --parts      the logo's separate parts (emblem, words) as crop boxes

  --bg auto|'#rrggbb'   icon background. auto (default): the brand background when the
                        logo stands out on it, else the next palette color it stands out on
  --plate auto|logo|none  for a logo on its own solid background (a JPEG on white):
                        logo = keep that background as the icon color (seamless, safe),
                        none = lift the logo off it onto --bg,
                        auto = lift it only when it still stands out there
  --crop x,y,w,h        use only this part of the logo (fractions 0-1 of the image),
                        e.g. the emblem of a wide wordmark
  --favicon-crop x,y,w,h  a different part for the 32 px favicon only
  --monogram TEXT       1-3 letters (the business initials) when there is no logo
  --font PATH           TTF for the monogram (the brand heading font when sent; else DejaVu Sans Bold)
  --ink '#rrggbb'       monogram color (default: the accent, else the brand text color, when it reads
                        at 4.5:1; else white or black). Letters must read at 4.5:1 to pass
  --report PATH         JSON report (default <out-dir>/icons.json)
  --parts               print the logo's parts, left to right and top to bottom, as
                        --crop boxes (fractions of the image), and stop

Writes apple-touch-icon.png (180, opaque: iOS fills transparency with black,
12% padding inside its rounded square), icon-192.png and icon-512.png (opaque,
maskable: the mark fits inside the centered circle of radius 40% that Android
keeps under every mask), favicon-32.png (a rounded tile) and the report:
the background and why, the logo's own background, the safe-zone fit, the
favicon mark's size in px, how much of the logo stands out (2:1) on the
background, warnings, and the scorecard's icon checks. Exit 1 when the icons
could not be made.
"""
import argparse
import json
import os
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFont, ImageOps  # noqa: E402

from common import LIMITS, RULES, contrast, hex_to_rgb, luminance, norm_hex, rgb_to_hex  # noqa: E402

SAFE_R = RULES['maskableSafeRadius']
APPLE_PAD = RULES['applePadding']
PIXEL_CONTRAST = RULES['logoContrastPixel']
VISIBLE_SHARE = RULES['logoVisibleShare']
FAVICON_MIN = RULES['faviconMinContentPx']
# The mark stays a little inside the maskable circle: resampling spreads
# edge pixels by a pixel or two.
SAFE_MARGIN = 0.94
FAVICON_WORK = 256
FAVICON_RADIUS = 0.1875  # 6 px of 32
FAVICON_PAD = 0.07
MAX_SIDE = 2048

FONT_CANDIDATES = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/Library/Fonts/Arial Bold.ttf',
]


def parse_box(s, where):
    try:
        x, y, w, h = [float(v) for v in s.split(',')]
    except ValueError:
        raise SystemExit('%s must be x,y,w,h fractions, e.g. 0,0,0.3,1' % where)
    if not (0 <= x < 1 and 0 <= y < 1 and 0 < w <= 1 and 0 < h <= 1 and x + w <= 1.0001 and y + h <= 1.0001):
        raise SystemExit('%s %s is outside the image (fractions 0-1)' % (where, s))
    return [x, y, w, h]


def resize_rgba(im, size):
    """Resampling with premultiplied alpha: no dark fringes around a transparent logo."""
    return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def load_logo(path):
    im = Image.open(path)
    try:
        im.seek(0)
    except EOFError:
        pass
    im = ImageOps.exif_transpose(im).convert('RGBA')
    if max(im.size) > MAX_SIDE:
        k = MAX_SIDE / float(max(im.size))
        im = resize_rgba(im, (max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))))
    return im


def analyze(im):
    """('transparent' | 'solid' | 'edge', background '#rrggbb' or None) of a logo:
    transparent = a cut-out logo, solid = a logo on one flat color (border
    pixels agree), edge = artwork that runs to the edges (a photo or a
    filled badge)."""
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    ring = max(1, min(w, h) // 50)
    border = np.concatenate([a[:ring].reshape(-1, 4), a[-ring:].reshape(-1, 4),
                             a[:, :ring].reshape(-1, 4), a[:, -ring:].reshape(-1, 4)])
    if (a[..., 3] < 250).mean() > 0.02 and (border[:, 3] < 128).mean() > 0.5:
        return 'transparent', None
    rgb = border[:, :3]
    med = np.median(rgb, axis=0)
    close = (np.sqrt(((rgb - med) ** 2).sum(axis=1)) <= 40).mean()
    if close >= 0.9:
        return 'solid', rgb_to_hex(med)
    return 'edge', None


def content_layer(im, kind, bg_hex):
    """The mark as RGBA over nothing: a cut-out keeps its alpha; a logo on a
    flat color is un-mixed from it (alpha from the distance to that color,
    the color solved from p = a*c + (1-a)*bg), so it composites cleanly onto
    any background, and onto its own color exactly as it was."""
    a = np.asarray(im).astype(np.float32)
    if kind == 'transparent':
        return im, a[..., 3] / 255.0
    if kind == 'edge':
        out = a.copy()
        out[..., 3] = 255
        return Image.fromarray(out.astype(np.uint8)), np.ones(a.shape[:2], np.float32)
    bg = np.array(hex_to_rgb(bg_hex), np.float32)
    rgb = a[..., :3]
    d = np.abs(rgb - bg).max(axis=2)
    alpha = np.clip((d - 12.0) / 48.0, 0.0, 1.0)
    safe = np.maximum(alpha, 1e-3)[..., None]
    fg = np.clip((rgb - (1.0 - alpha[..., None]) * bg) / safe, 0, 255)
    out = np.dstack([fg, alpha * 255.0]).astype(np.uint8)
    return Image.fromarray(out), alpha


def crop_box(size, box):
    w, h = size
    x0, y0 = int(round(box[0] * w)), int(round(box[1] * h))
    x1, y1 = int(round((box[0] + box[2]) * w)), int(round((box[1] + box[3]) * h))
    return max(0, x0), max(0, y0), min(w, max(x1, x0 + 1)), min(h, max(y1, y0 + 1))


def trim(layer, mask, box=None):
    """The mark cropped to `box` (fractions) and then to its own pixels."""
    if box:
        x0, y0, x1, y1 = crop_box(layer.size, box)
        layer, mask = layer.crop((x0, y0, x1, y1)), mask[y0:y1, x0:x1]
    ys, xs = np.nonzero(mask > 0.06)
    if not len(xs):
        return None, None
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    return layer.crop((int(x0), int(y0), int(x1), int(y1))), mask[y0:y1, x0:x1]


def _runs(profile, gap):
    """[start, end) runs where profile is set, joining gaps shorter than `gap`."""
    runs = []
    idx = np.nonzero(profile)[0]
    if not len(idx):
        return runs
    start = prev = int(idx[0])
    for i in idx[1:]:
        i = int(i)
        if i - prev > gap:
            runs.append((start, prev + 1))
            start = i
        prev = i
    runs.append((start, prev + 1))
    return runs


def logo_parts(mask):
    """The mark's separate pieces: columns split by empty gaps (an emblem
    beside a wordmark), then each column split by empty rows (a tagline
    under it). Boxes are fractions of the whole image, padded a little."""
    h, w = mask.shape
    solid = mask > 0.06
    rows = np.nonzero(solid.any(axis=1))[0]
    if not len(rows):
        return []
    # Letters sit closer than 15% of the mark's height; an emblem and a
    # wordmark, or two words, sit further apart.
    gap = max(2, int(0.15 * (rows.max() - rows.min() + 1)))
    parts = []
    for x0, x1 in _runs(solid.any(axis=0), gap):
        col = solid[:, x0:x1]
        for y0, y1 in _runs(col.any(axis=1), max(2, h // 25)):
            xs = np.nonzero(col[y0:y1].any(axis=0))[0]
            bx0, bx1 = x0 + int(xs.min()), x0 + int(xs.max()) + 1
            pad = max(2, int(0.02 * max(w, h)))
            X0, Y0 = max(0, bx0 - pad), max(0, y0 - pad)
            X1, Y1 = min(w, bx1 + pad), min(h, y1 + pad)
            parts.append({
                'crop': '%.3f,%.3f,%.3f,%.3f' % (X0 / w, Y0 / h, (X1 - X0) / float(w), (Y1 - Y0) / float(h)),
                'px': [bx1 - bx0, y1 - y0],
                'aspect': round((bx1 - bx0) / float(max(1, y1 - y0)), 2),
                'share': round(float(mask[y0:y1, bx0:bx1].sum() / max(1e-6, mask.sum())), 3),
            })
    return parts


def mark_radius(mask):
    """How far the mark reaches from its box's center, in source px: a round
    badge fits the maskable circle bigger than its box would."""
    ys, xs = np.nonzero(mask > 0.3)
    if not len(xs):
        ys, xs = np.nonzero(mask > 0)
    h, w = mask.shape
    d = np.sqrt((xs + 0.5 - w / 2.0) ** 2 + (ys + 0.5 - h / 2.0) ** 2)
    return float(d.max()) + 0.5


def visible_share(layer, mask, bg_hex):
    """Share of the mark's solid pixels that read at PIXEL_CONTRAST:1 or more on bg."""
    a = np.asarray(layer).astype(np.float64)[..., :3] / 255.0
    solid = mask > 0.5
    if not solid.any():
        return 0.0
    c = np.where(a <= 0.03928, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    lum = 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
    lb = luminance(hex_to_rgb(bg_hex))
    hi, lo = np.maximum(lum, lb), np.minimum(lum, lb)
    ratio = (hi + 0.05) / (lo + 0.05)
    return float((ratio[solid] >= PIXEL_CONTRAST).mean())


def near(a, b, limit=30):
    """Are two colors within `limit` of each other (RGB distance)?"""
    return sum((x - y) ** 2 for x, y in zip(hex_to_rgb(a), hex_to_rgb(b))) ** 0.5 < limit


def render(layer, mask, bg_hex, size, purpose):
    """One opaque square icon. Returns (image, scale, box in px)."""
    w, h = layer.size
    if purpose == 'maskable':
        scale = SAFE_R * size * SAFE_MARGIN / mark_radius(mask)
    else:
        room = size * (1 - 2 * APPLE_PAD)
        scale = min(room / w, room / h)
    tw, th = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    canvas = Image.new('RGBA', (size, size), hex_to_rgb(bg_hex) + (255,))
    x, y = (size - tw) // 2, (size - th) // 2
    canvas.alpha_composite(resize_rgba(layer, (tw, th)), (x, y))
    return canvas.convert('RGB'), scale, [x, y, tw, th]


def render_favicon(layer, bg_hex):
    """The 32 px favicon: the mark on a rounded tile, drawn at 256 and scaled down."""
    S = FAVICON_WORK
    tile = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(tile).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * FAVICON_RADIUS), fill=hex_to_rgb(bg_hex) + (255,))
    w, h = layer.size
    room = S * (1 - 2 * FAVICON_PAD)
    scale = min(room / w, room / h)
    tw, th = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    mark = resize_rgba(layer, (tw, th))
    over = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    over.paste(mark, ((S - tw) // 2, (S - th) // 2))
    # The mark stays inside the tile's rounded corners.
    over.putalpha(Image.fromarray(np.minimum(np.asarray(over.getchannel('A')), np.asarray(tile.getchannel('A')))))
    tile.alpha_composite(over)
    # An area average for the last 8x step: Lanczos rings (dark halos) at 32 px.
    small = tile.convert('RGBa').reduce(S // 32).convert('RGBA')
    return small, [tw * 32.0 / S, th * 32.0 / S]


def find_font(path):
    if path:
        return path
    try:
        import matplotlib
        p = os.path.join(matplotlib.get_data_path(), 'fonts', 'ttf', 'DejaVuSans-Bold.ttf')
        if os.path.isfile(p):
            return p
    except Exception:
        pass
    for p in FONT_CANDIDATES:
        if os.path.isfile(p):
            return p
    return None


def monogram_layer(text, ink_hex, font_path):
    size = 640
    path = find_font(font_path)
    try:
        font = ImageFont.truetype(path, size) if path else ImageFont.load_default(size)
    except Exception:
        font = ImageFont.load_default(size)
    probe = ImageDraw.Draw(Image.new('L', (1, 1)))
    x0, y0, x1, y1 = probe.textbbox((0, 0), text, font=font)
    w, h = x1 - x0 + 40, y1 - y0 + 40
    mask_im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask_im).text((20 - x0, 20 - y0), text, font=font, fill=255)
    layer = Image.new('RGBA', (w, h), hex_to_rgb(ink_hex) + (0,))
    layer.putalpha(mask_im)
    return layer, np.asarray(mask_im).astype(np.float32) / 255.0, path or 'Pillow default font'


def palette_of(inputs):
    p = (inputs or {}).get('palette') or {}
    return {r: norm_hex(p.get(r)) for r in ('bg', 'secondary', 'text', 'muted', 'accent') if norm_hex(p.get(r))}


TEXT_CONTRAST = 4.5


def choose_ink(bg_hex, palette, given):
    """The monogram's color: --ink, else the first brand color that reads at
    4.5:1 on the background (the letters are text), else white or black,
    whichever reads better (one of them always reaches 4.5:1)."""
    if given:
        return norm_hex(given)
    for role in ('accent', 'text'):
        c = palette.get(role)
        if c and contrast(c, bg_hex) >= TEXT_CONTRAST:
            return c
    for c in ('#ffffff', '#111111'):
        if contrast(c, bg_hex) >= TEXT_CONTRAST:
            return c
    return '#ffffff' if contrast('#ffffff', bg_hex) >= contrast('#000000', bg_hex) else '#000000'


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--logo')
    ap.add_argument('--monogram')
    ap.add_argument('--inputs')
    ap.add_argument('--out-dir')
    ap.add_argument('--bg', default='auto')
    ap.add_argument('--plate', default='auto', choices=['auto', 'logo', 'none'])
    ap.add_argument('--crop')
    ap.add_argument('--favicon-crop')
    ap.add_argument('--font')
    ap.add_argument('--ink')
    ap.add_argument('--report')
    ap.add_argument('--parts', action='store_true')
    args = ap.parse_args(argv[1:])

    if args.parts:
        if not args.logo:
            print('FAIL: --parts needs --logo')
            return 2
        im = load_logo(args.logo)
        kind, own_bg = analyze(im)
        _, mask = content_layer(im, kind, own_bg)
        print(json.dumps({'logo': os.path.basename(args.logo), 'px': list(im.size), 'background': kind,
                          'backgroundColor': own_bg, 'parts': logo_parts(mask)}, indent=2))
        return 0
    if bool(args.logo) == bool(args.monogram):
        print('FAIL: pass --logo or --monogram (one of them)')
        return 2
    if not args.out_dir:
        print('FAIL: --out-dir is required')
        return 2
    inputs = {}
    if args.inputs:
        with open(args.inputs, encoding='utf-8') as f:
            inputs = json.load(f)
    palette = palette_of(inputs)
    if args.bg != 'auto' and not norm_hex(args.bg):
        print('FAIL: --bg must be auto or a #rrggbb color')
        return 2
    if args.ink and not norm_hex(args.ink):
        print('FAIL: --ink must be a #rrggbb color')
        return 2
    explicit_bg = norm_hex(args.bg) if args.bg != 'auto' else ''
    brand_bg = explicit_bg or palette.get('bg') or '#ffffff'
    crop = parse_box(args.crop, '--crop') if args.crop else None
    fav_crop = parse_box(args.favicon_crop, '--favicon-crop') if args.favicon_crop else None
    os.makedirs(args.out_dir, exist_ok=True)
    warnings = []
    report = {'source': 'logo' if args.logo else 'monogram', 'logo': os.path.basename(args.logo) if args.logo else None,
              'monogram': '', 'logoBackground': None, 'logoBackgroundColor': None, 'crop': crop, 'faviconCrop': fav_crop}

    if args.monogram:
        text = args.monogram.strip()
        if not text or len(text) > LIMITS['monogram'] or not text.isalnum():
            print('FAIL: --monogram must be 1-%d letters or digits' % LIMITS['monogram'])
            return 2
        bg = brand_bg
        ink = choose_ink(bg, palette, args.ink)
        layer, mask, font_used = monogram_layer(text, ink, args.font)
        layer, mask = trim(layer, mask)
        report.update(monogram=text, ink=ink, font=os.path.basename(font_used), bgReason='brand background' if not explicit_bg else 'chosen background')
        share = visible_share(layer, mask, bg)
        fav_layer, fav_mask = layer, mask
        source_px = None
    else:
        im = load_logo(args.logo)
        kind, own_bg = analyze(im)
        report.update(logoBackground=kind, logoBackgroundColor=own_bg, logoPx=list(im.size))
        full, full_mask = content_layer(im, kind, own_bg)
        layer, mask = trim(full, full_mask, crop)
        if layer is None:
            print('FAIL: the logo%s looks empty: nothing in it differs from its background' % (' crop' if crop else ''))
            return 1
        if kind == 'solid':
            if args.plate == 'logo':
                bg, why = own_bg, "the logo's own background (--plate logo)"
            elif args.plate == 'none' or explicit_bg:
                bg, why = brand_bg, 'chosen background, logo lifted off its own %s' % own_bg
            elif near(own_bg, brand_bg):
                bg, why = brand_bg, 'brand background (the logo already sits on a color close to it)'
            elif visible_share(layer, mask, brand_bg) >= VISIBLE_SHARE:
                bg, why = brand_bg, 'brand background, logo lifted off its own %s' % own_bg
            else:
                bg, why = own_bg, "the logo's own background: lifted onto the brand background it would not stand out"
        elif kind == 'edge':
            bg, why = brand_bg, 'brand background (the artwork brings its own)' if not explicit_bg else 'chosen background'
        elif explicit_bg:
            bg, why = explicit_bg, 'chosen background'
        else:
            candidates = [(palette[r], 'brand ' + r) for r in ('bg', 'secondary', 'accent', 'text') if r in palette]
            candidates += [('#ffffff', 'white'), ('#111111', 'near-black')]
            scored = [(visible_share(layer, mask, c), c, label) for c, label in candidates]
            ok = [s for s in scored if s[0] >= VISIBLE_SHARE]
            pick = ok[0] if ok else max(scored, key=lambda s: s[0])
            bg = pick[1]
            why = pick[2] + ('' if pick is scored[0] else ' (the logo does not stand out on the brand background)')
        report['bgReason'] = why
        share = 1.0 if kind == 'edge' else visible_share(layer, mask, bg)
        source_px = [layer.size[0], layer.size[1]]
        report['markPx'] = source_px
        fav_layer, fav_mask = (trim(full, full_mask, fav_crop) if fav_crop else (layer, mask))
        if fav_layer is None:
            print('FAIL: the --favicon-crop part of the logo looks empty')
            return 1

    report['bg'] = bg
    report['visibleShare'] = round(share, 3)
    w, h = layer.size
    report['markAspect'] = round(w / float(h), 2)

    files = {}
    upscale = 0.0
    fits = True
    for spec in RULES['icons']:
        name, size, purpose = spec['name'], spec['size'], spec['purpose']
        path = os.path.join(args.out_dir, name)
        if purpose == 'favicon':
            img, mark = render_favicon(fav_layer, bg)
            img.save(path, optimize=True)
            files[name] = {'size': size, 'markPx': [round(mark[0], 1), round(mark[1], 1)]}
            report['faviconMarkPx'] = files[name]['markPx']
            continue
        img, scale, box = render(layer, mask, bg, size, purpose)
        img.save(path, optimize=True)
        upscale = max(upscale, scale)
        files[name] = {'size': size, 'box': box}
        if purpose == 'maskable':
            r = mark_radius(mask) * scale
            files[name]['markRadius'] = round(r / size, 3)
            fits = fits and r <= SAFE_R * size + 0.5
    report['files'] = files

    if source_px and upscale > 1.5:
        warnings.append('The logo is small (%dx%d px of mark): the 512 icon enlarges it %.1fx and may look soft. A larger logo file would be sharper.' % (source_px[0], source_px[1], upscale))
    if report['markAspect'] >= 2.5 and not crop:
        warnings.append('The logo is %.1f times wider than tall: on a square icon it comes out small. If it has an emblem or initials, pass --crop on that part.' % report['markAspect'])
    fav_min = min(report['faviconMarkPx'])
    fav_ok = bool(args.monogram) or fav_min >= FAVICON_MIN
    if not fav_ok:
        warnings.append('At 32 px the mark is %.0f px on its short side (under %d): too small to read. Pass --favicon-crop on the emblem or initials.' % (fav_min, FAVICON_MIN))
    if args.monogram:
        # Letters are text: 4.5:1, not the logo's 2:1 pixel share.
        seen_ok = contrast(report['ink'], bg) >= TEXT_CONTRAST
        if not seen_ok:
            warnings.append('The monogram in %s on %s is %.1f:1, under %.1f:1. Drop --ink, or pass one that reads.' % (
                report['ink'], bg, contrast(report['ink'], bg), TEXT_CONTRAST))
    else:
        seen_ok = share >= VISIBLE_SHARE
        if not seen_ok:
            warnings.append('Only %d%% of the logo reads at %.0f:1 on %s. Try --bg with another palette color, or --plate logo.' % (round(share * 100), PIXEL_CONTRAST, bg))
    report['warnings'] = warnings

    if args.monogram:
        contrast_note = 'Monogram in %s on %s (%.1f:1)' % (report['ink'], bg, contrast(report['ink'], bg))
    elif report['logoBackground'] == 'edge':
        contrast_note = 'The logo artwork brings its own background'
    else:
        contrast_note = '%d%% of the logo reads at %.0f:1 or more on %s' % (round(share * 100), PIXEL_CONTRAST, bg)
    report['checks'] = {
        'icons': {'pass': fits, 'note': ('Mark inside the round safe zone on Android and padded on iPhone' if fits
                                         else 'The mark reaches outside the maskable safe circle')},
        'favicon': {'pass': fav_ok, 'note': ('Monogram' if args.monogram else 'Mark is %.0fx%.0f px at 32 px' % tuple(report['faviconMarkPx']))},
        'logo-contrast': {'pass': seen_ok, 'note': contrast_note},
    }
    report_path = args.report or os.path.join(args.out_dir, 'icons.json')
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
