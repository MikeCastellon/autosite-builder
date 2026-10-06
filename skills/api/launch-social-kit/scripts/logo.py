"""The customer's logo for the images: loading (a flat JPEG/PNG background is
keyed out, so the logo sits on any color), trimming, the parts of a
lockup (an icon next to a wordmark: the profile picture uses the icon,
the "mark"), and how well it reads on a background.

  logo.py inspect /path/logo-1.png
      size, transparency, background, the trimmed box and the candidate
      parts as crop boxes ({x, y, w, h} fractions of the file) for the
      plan's "logoCrop"
"""
import argparse
import json
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import colors as C  # noqa: E402

try:
    import numpy as np
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover
    np = None

KEY_STD = 14.0      # border colors this uniform count as a plain background
KEY_NEAR = 22.0     # distance to that background below which a pixel is background
KEY_SOFT = 40.0     # then fades in over this many units (anti-aliased edges)
LEGIBLE_RATIO = 3.0  # graphics read at 3:1 (WCAG non-text contrast)


def load(path):
    """(RGBA image, info). info.keyed: the background was keyed out;
    info.opaque: the logo has its own busy background (kept whole)."""
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        im.load()
        rgba = im.convert('RGBA')
    a = np.asarray(rgba).astype('float64')
    alpha = a[..., 3]
    info = {'size': list(rgba.size), 'transparent': False, 'keyed': False, 'opaque': False, 'background': None}
    if (alpha < 250).mean() > 0.02:
        info['transparent'] = True
        return rgba, info
    h, w = alpha.shape
    ring = max(1, int(round(min(w, h) * 0.01)))
    border = np.concatenate([
        a[:ring, :, :3].reshape(-1, 3), a[-ring:, :, :3].reshape(-1, 3),
        a[:, :ring, :3].reshape(-1, 3), a[:, -ring:, :3].reshape(-1, 3),
    ])
    if border.std(axis=0).max() <= KEY_STD:
        bg = np.median(border, axis=0)
        dist = np.sqrt(((a[..., :3] - bg) ** 2).sum(axis=2))
        new_alpha = np.clip((dist - KEY_NEAR) / KEY_SOFT, 0.0, 1.0) * 255.0
        if (new_alpha > 128).mean() > 0.003:
            out = a.copy()
            out[..., 3] = new_alpha
            info['keyed'] = True
            info['background'] = C.rgb_to_hex(tuple(bg))
            return Image.fromarray(out.round().astype('uint8')), info
    info['opaque'] = True
    return rgba, info


def content_box(rgba):
    """(x0, y0, x1, y1) of the visible pixels (the whole image when none)."""
    alpha = np.asarray(rgba)[..., 3]
    ys, xs = np.nonzero(alpha > 24)
    if not len(xs):
        return (0, 0, rgba.size[0], rgba.size[1])
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def crop(rgba, box=None):
    """The logo cut to `box` ({x, y, w, h} fractions of the file), then
    trimmed to its visible pixels."""
    if box:
        W, H = rgba.size
        x0 = int(round(max(0.0, min(1.0, float(box['x']))) * W))
        y0 = int(round(max(0.0, min(1.0, float(box['y']))) * H))
        x1 = int(round(max(0.0, min(1.0, float(box['x']) + float(box['w']))) * W))
        y1 = int(round(max(0.0, min(1.0, float(box['y']) + float(box['h']))) * H))
        if x1 - x0 >= 4 and y1 - y0 >= 4:
            rgba = rgba.crop((x0, y0, x1, y1))
    return rgba.crop(content_box(rgba))


def _runs(profile, min_gap):
    """[(start, end)] of True runs in `profile`, gaps shorter than min_gap closed."""
    runs = []
    start = None
    for i, v in enumerate(list(profile) + [False]):
        if v and start is None:
            start = i
        elif not v and start is not None:
            runs.append([start, i])
            start = None
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < min_gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return merged


def parts(rgba):
    """Candidate pieces of a lockup: side by side (icon + wordmark) or
    stacked (icon over name). Boxes in pixels of the file."""
    x0, y0, x1, y1 = content_box(rgba)
    alpha = np.asarray(rgba)[y0:y1, x0:x1, 3] > 24
    out = []
    w, h = x1 - x0, y1 - y0
    cols = _runs(alpha.any(axis=0), max(4, int(w * 0.03)))
    if len(cols) > 1:
        for a, b in cols:
            sub = alpha[:, a:b]
            ys = np.nonzero(sub.any(axis=1))[0]
            out.append(('side', (x0 + a, y0 + int(ys.min()), x0 + b, y0 + int(ys.max()) + 1)))
    rows = _runs(alpha.any(axis=1), max(4, int(h * 0.04)))
    if len(rows) > 1:
        for a, b in rows:
            sub = alpha[a:b, :]
            xs = np.nonzero(sub.any(axis=0))[0]
            out.append(('stack', (x0 + int(xs.min()), y0 + a, x0 + int(xs.max()) + 1, y0 + b)))
    return out


def legibility(logo_rgba, background_rgb):
    """Share of the logo's visible pixels that reach 3:1 against the
    background under them (same size arrays; 1.0 for an opaque logo,
    which brings its own background)."""
    a = np.asarray(logo_rgba).astype('float64')
    mask = a[..., 3] > 128
    if not mask.any():
        return 0.0
    lum_logo = C.luminance_array(a[..., :3].round().astype('uint8'))[mask]
    lum_bg = C.luminance_array(np.asarray(background_rgb)[..., :3])[mask]
    hi = np.maximum(lum_logo, lum_bg)
    lo = np.minimum(lum_logo, lum_bg)
    ratio = (hi + 0.05) / (lo + 0.05)
    return float((ratio >= LEGIBLE_RATIO).mean())


def dominant(rgba, n=3):
    a = np.asarray(rgba)
    px = a[a[..., 3] > 128][:, :3]
    if not len(px):
        return []
    q = (px // 24) * 24 + 12
    keys, counts = np.unique(q, axis=0, return_counts=True)
    order = np.argsort(-counts)[:n]
    return [C.rgb_to_hex(tuple(int(v) for v in keys[i])) for i in order]


def inspect(path):
    rgba, info = load(path)
    W, H = rgba.size
    frac = lambda b: {'x': round(b[0] / W, 4), 'y': round(b[1] / H, 4), 'w': round((b[2] - b[0]) / W, 4), 'h': round((b[3] - b[1]) / H, 4)}
    box = content_box(rgba)
    out = dict(info)
    out['content'] = frac(box)
    out['aspect'] = round((box[2] - box[0]) / float(max(1, box[3] - box[1])), 3)
    out['colors'] = dominant(rgba)
    out['parts'] = []
    for kind, b in parts(rgba):
        out['parts'].append({'kind': kind, 'box': frac(b), 'aspect': round((b[2] - b[0]) / float(max(1, b[3] - b[1])), 3)})
    out['hint'] = ('A part with an aspect near 1 is usually the icon: use its box as the profile\'s logoCrop. '
                   'Without one, the whole logo goes in the circle (wide wordmarks get small).')
    return out


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd')
    i = sub.add_parser('inspect')
    i.add_argument('path')
    args = ap.parse_args(argv[1:])
    if args.cmd != 'inspect':
        ap.print_help()
        return 2
    print(json.dumps(inspect(args.path), indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
