"""Measures every photo so you judge them with numbers next to your eyes.

  analyze.py --names "photo-1.jpg,photo-2.png" --out /tmp/photos/analysis.json
  analyze.py <photo files...> --out /tmp/photos/analysis.json

--names finds the request's files wherever the container put them (the
same search as find_inputs.py) and keeps the request's order; a name it
can't find is reported and the rest are still analyzed.

Per photo (all measured on the photo as a browser shows it, EXIF rotation
applied): the displayed pixel size; sharpness (variance of the Laplacian on
a 1024 px copy, the 90th percentile of an 8x8 tile grid, so a sharp subject
on a blurred background still counts as sharp); exposure (mean, spread and
clipped shares of luminance); a 0-10 tech score from those three and the
resolution; flags (blurry, soft, dark, bright, flat, clipped, small,
graphic, unreadable); a suggested focal point (where the detail is, pulled
gently to the center); and a 128-bit difference hash.

Across photos: near-duplicate groups (hashes close AND small thumbnails
nearly equal: the best-scoring one is the keeper, the others name it in
duplicateOf) and "similar" pairs (same framing, visibly different content:
often a before/after pair or a series of one car). Both are hints: look at
the sheets before you act on them.

Prints one line per photo; the JSON holds everything. Exit 1 when no photo
could be read.
"""
import argparse
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import IMAGE_EXTS, open_photo, write_json  # noqa: E402

WORK = 1024
DUP_BITS = 20        # of 128: near-duplicates (same shot, small shift or edit)
SIMILAR_BITS = 40    # of 128: same framing (a series, or before/after)
# Mean difference of two standardized 48x32 color thumbnails. Burst shots
# and re-saved copies stay well under DUP_DIFF; a before/after pair of one
# car from one spot lands above it (dirt, reflections), other cars further.
DUP_DIFF = 0.12
SIMILAR_DIFF = 0.25
HERO_MIN = (1600, 900)
GALLERY_MIN_LONG = 1000
SMALL_LONG = 800


def _gray(arr):
    return arr[..., 0] * 0.2126 + arr[..., 1] * 0.7152 + arr[..., 2] * 0.0722


def sharpness(gray):
    """90th percentile of per-tile Laplacian variance on an 8x8 grid, on a
    copy stretched to a common tonal range (so a dark or hazy photo isn't
    called blurry for its low contrast alone; at most 4x)."""
    import numpy as np
    lo, hi = np.percentile(gray, 2), np.percentile(gray, 98)
    g = (gray - lo) * (160.0 / max(40.0, hi - lo))
    lap = -4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
    h, w = lap.shape
    vals = []
    for i in range(8):
        for j in range(8):
            tile = lap[i * h // 8:(i + 1) * h // 8, j * w // 8:(j + 1) * w // 8]
            if tile.size:
                vals.append(float(tile.var()))
    return float(np.percentile(vals, 90)) if vals else 0.0, float(lap.var())


def sharp_score(v):
    """0 at a variance of 20 (mush), 10 at 600 and up (crisp detail)."""
    import math
    return max(0.0, min(10.0, (math.log10(max(v, 1.0)) - math.log10(20)) / (math.log10(600) - math.log10(20)) * 10))


def exposure(gray):
    import numpy as np
    return {
        'mean': round(float(gray.mean()), 1),
        'std': round(float(gray.std()), 1),
        'p2': round(float(np.percentile(gray, 2)), 1),
        'p98': round(float(np.percentile(gray, 98)), 1),
        'clippedHigh': round(float((gray >= 250).mean()), 3),
        'clippedLow': round(float((gray <= 5).mean()), 3),
    }


def exposure_score(e):
    s = 10.0
    if e['mean'] < 85:
        s -= (85 - e['mean']) / 8
    if e['mean'] > 185:
        s -= (e['mean'] - 185) / 7
    s -= max(0.0, e['clippedHigh'] - 0.02) * 30
    s -= max(0.0, e['clippedLow'] - 0.08) * 15
    if e['std'] < 35:
        s -= (35 - e['std']) / 5
    return max(0.0, min(10.0, s))


def resolution_score(w, h):
    long_side = max(w, h)
    if long_side >= 2400:
        return 10.0
    if long_side >= HERO_MIN[0]:
        return 8.5
    if long_side >= 1200:
        return 7.0
    if long_side >= SMALL_LONG:
        return 5.0
    return 2.0


def focal_point(arr):
    """Where the detail and color are, on a 256 px copy, pulled toward the
    center (subjects rarely sit at the very edge)."""
    import numpy as np
    from PIL import Image
    im = Image.fromarray(arr.astype('uint8')).copy()
    im.thumbnail((256, 256))
    a = np.asarray(im, dtype=np.float32)
    g = _gray(a)
    gx = np.abs(np.diff(g, axis=1))[:-1, :]
    gy = np.abs(np.diff(g, axis=0))[:, :-1]
    mag = gx + gy
    sat = (a.max(axis=2) - a.min(axis=2))[:-1, :-1]
    sal = mag / (mag.mean() + 1e-6) + 0.5 * sat / (sat.mean() + 1e-6)
    # Two box blurs: detail clusters, single specks don't.
    for _ in range(2):
        p = np.pad(sal, 4, mode='edge')
        c = p.cumsum(0).cumsum(1)
        c = np.pad(c, ((1, 0), (1, 0)))
        k = 9
        sal = (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)
    h, w = sal.shape
    ys, xs = np.mgrid[0:h, 0:w]
    cx, cy = (xs + 0.5) / w, (ys + 0.5) / h
    sal = sal * (1.0 - 0.6 * ((cx - 0.5) ** 2 + (cy - 0.5) ** 2))
    top = sal >= np.percentile(sal, 85)
    wts = sal * top
    total = wts.sum()
    if total <= 0:
        return {'x': 0.5, 'y': 0.5}
    fx = float((cx * wts).sum() / total)
    fy = float((cy * wts).sum() / total)
    return {'x': round(min(0.95, max(0.05, fx)), 3), 'y': round(min(0.95, max(0.05, fy)), 3)}


def dhash(arr):
    """128 bits: 64 horizontal + 64 vertical gradient signs on a 9x8 gray copy."""
    import numpy as np
    from PIL import Image
    im = Image.fromarray(arr.astype('uint8')).convert('L')
    h = np.asarray(im.resize((9, 8), Image.LANCZOS), dtype=np.int16)
    v = np.asarray(im.resize((8, 9), Image.LANCZOS), dtype=np.int16)
    bits = list((h[:, 1:] > h[:, :-1]).flatten()) + list((v[1:, :] > v[:-1, :]).flatten())
    n = 0
    for b in bits:
        n = (n << 1) | int(b)
    return '%032x' % n


def thumb(arr):
    """A 48x32 color thumbnail, each channel standardized (brightness and
    contrast changes don't count), for telling duplicates from pairs."""
    import numpy as np
    from PIL import Image
    a = np.asarray(Image.fromarray(arr.astype('uint8')).resize((48, 32), Image.BILINEAR), dtype=np.float32)
    return (a - a.mean(axis=(0, 1))) / (a.std(axis=(0, 1)) + 1e-6)


def graphic_signals(arr):
    """Screenshots, flyers and text graphics have large flat areas and few
    colors; photos (sensor noise, light falloff) almost never do. Pure black
    and white pixels don't count as flat (a dark photo clips to black)."""
    import numpy as np
    from PIL import Image
    im = Image.fromarray(arr.astype('uint8'))
    im.thumbnail((256, 256))
    a = np.asarray(im, dtype=np.int16)
    lum = a.mean(axis=2)[:, 1:]
    mid = (lum > 10) & (lum < 245)
    same = np.abs(np.diff(a, axis=1)).sum(axis=2) == 0
    flat = (same & mid).sum() / max(1, mid.sum())
    small = np.asarray(im.resize((64, 64)), dtype=np.int32) // 8
    colors = len(np.unique(small[..., 0] * 1024 + small[..., 1] * 32 + small[..., 2]))
    return round(float(flat), 3), int(colors)


def analyze_one(path):
    import numpy as np
    out = {'name': os.path.basename(path), 'path': path, 'bytes': os.path.getsize(path)}
    try:
        im, (w, h) = open_photo(path, max_side=WORK)
    except Exception as e:
        out.update({'unreadable': str(e)[:160], 'flags': ['unreadable'], 'techScore': 0.0})
        return out, None
    arr = np.asarray(im, dtype=np.float32)
    gray = _gray(arr)
    sharp, global_var = sharpness(gray)
    e = exposure(gray)
    ss, es, rs = sharp_score(sharp), exposure_score(e), resolution_score(w, h)
    tech = 0.55 * ss + 0.3 * es + 0.15 * rs
    if max(w, h) < SMALL_LONG:
        tech = min(tech, 5.0)
    flat, colors = graphic_signals(arr)
    flags = []
    if ss < 3:
        flags.append('blurry')
    elif ss < 5:
        flags.append('soft')
    if e['mean'] < 60 and e['p98'] < 190:
        flags.append('dark')
    if e['mean'] > 200 or e['clippedHigh'] > 0.2:
        flags.append('bright')
    elif e['clippedHigh'] > 0.06:
        flags.append('clipped')
    if e['std'] < 28:
        flags.append('flat')
    if max(w, h) < SMALL_LONG:
        flags.append('small')
    # A dark photo loses its noise to the quantization too: not a graphic.
    if flat > 0.45 and colors < 300 and ss >= 5 and 'dark' not in flags:
        flags.append('graphic')
    orientation = 'landscape' if w > h * 1.05 else 'portrait' if h > w * 1.05 else 'square'
    out.update({
        'width': w, 'height': h, 'orientation': orientation,
        'sharpness': round(sharp, 1), 'sharpScore': round(ss, 1),
        'exposure': e, 'exposureScore': round(es, 1), 'resolutionScore': rs,
        'techScore': round(tech, 1),
        'flags': flags,
        'fits': {
            'hero': orientation == 'landscape' and w >= HERO_MIN[0] and h >= HERO_MIN[1] and ss >= 5,
            'gallery': max(w, h) >= GALLERY_MIN_LONG and ss >= 3,
        },
        'focal': focal_point(arr),
        'dhash': dhash(arr),
        'flatShare': flat, 'colors': colors,
    })
    return out, thumb(arr)


def hamming(a, b):
    return bin(int(a, 16) ^ int(b, 16)).count('1')


def group(photos, thumbs):
    """Near-duplicate groups (union-find) and similar pairs."""
    import numpy as np
    ok = [i for i, p in enumerate(photos) if 'dhash' in p]
    parent = {i: i for i in ok}

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    similar = []
    for x in range(len(ok)):
        for y in range(x + 1, len(ok)):
            i, j = ok[x], ok[y]
            bits = hamming(photos[i]['dhash'], photos[j]['dhash'])
            diff = float(np.abs(thumbs[i] - thumbs[j]).mean())
            if bits <= DUP_BITS and diff <= DUP_DIFF:
                parent[find(i)] = find(j)
            elif bits <= SIMILAR_BITS and diff <= SIMILAR_DIFF:
                similar.append({'a': photos[i]['name'], 'b': photos[j]['name'], 'bits': bits, 'difference': round(diff, 3)})
    members = {}
    for i in ok:
        members.setdefault(find(i), []).append(i)
    groups = []
    for idxs in members.values():
        if len(idxs) < 2:
            continue
        keeper = max(idxs, key=lambda k: (photos[k]['techScore'], photos[k]['width'] * photos[k]['height']))
        gid = chr(ord('A') + len(groups)) if len(groups) < 26 else 'G%d' % (len(groups) + 1)
        groups.append({'id': gid, 'members': [photos[k]['name'] for k in idxs], 'keeper': photos[keeper]['name']})
        for k in idxs:
            photos[k]['dupGroup'] = gid
            photos[k]['duplicateOf'] = None if k == keeper else photos[keeper]['name']
            if k != keeper:
                photos[k]['flags'].append('duplicate')
    return groups, similar


def summary(photos):
    ok = [p for p in photos if 'unreadable' not in p]
    return {
        'count': len(photos),
        'readable': len(ok),
        'landscape': sum(p['orientation'] == 'landscape' for p in ok),
        'portrait': sum(p['orientation'] == 'portrait' for p in ok),
        'square': sum(p['orientation'] == 'square' for p in ok),
        'heroReady': sum(p['fits']['hero'] for p in ok),
        'galleryReady': sum(p['fits']['gallery'] for p in ok),
        'flagged': {f: sum(f in p['flags'] for p in photos)
                    for f in ('blurry', 'soft', 'dark', 'bright', 'clipped', 'flat', 'small', 'graphic', 'duplicate', 'unreadable')},
    }


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('files', nargs='*')
    ap.add_argument('--names', default='', help='comma-separated file names the request lists')
    ap.add_argument('--root', action='append', default=[], help='extra folder to search first (with --names)')
    ap.add_argument('--out', required=True)
    args = ap.parse_args(argv[1:])
    wanted = list(args.files)
    if args.names:
        from find_inputs import find
        by_name = {}
        for path in find(args.root):
            by_name.setdefault(os.path.basename(path), path)
        for name in [n.strip() for n in args.names.split(',') if n.strip()]:
            wanted.append(by_name.get(name, name))
    if not wanted:
        print('give the photo files, or --names', file=sys.stderr)
        return 2
    files = []
    for f in wanted:
        if os.path.isfile(f) and f.lower().endswith(IMAGE_EXTS) and f not in files:
            files.append(f)
    missing = [f for f in wanted if f not in files]
    photos, thumbs = [], []
    for n, path in enumerate(files, 1):
        p, t = analyze_one(path)
        p['n'] = n
        photos.append(p)
        thumbs.append(t)
    for p in photos:
        p.setdefault('dupGroup', None)
        p.setdefault('duplicateOf', None)
    groups, similar = group(photos, thumbs)
    out = {'photos': photos, 'groups': groups, 'similar': similar, 'summary': summary(photos), 'skippedArgs': missing}
    write_json(args.out, out)
    for p in photos:
        if 'unreadable' in p:
            print('#%-3d %-16s UNREADABLE %s' % (p['n'], p['name'], p['unreadable']))
            continue
        print('#%-3d %-16s %5dx%-5d %-9s tech %4.1f sharp %4.1f exp %4.1f focal %.2f,%.2f %s%s' % (
            p['n'], p['name'], p['width'], p['height'], p['orientation'], p['techScore'], p['sharpScore'],
            p['exposureScore'], p['focal']['x'], p['focal']['y'], ' '.join(p['flags']),
            (' dup-of %s' % p['duplicateOf']) if p['duplicateOf'] else ''))
    for s in similar[:20]:
        print('similar: %s ~ %s (%d bits, difference %.2f)' % (s['a'], s['b'], s['bits'], s['difference']))
    if missing:
        print('not analyzed (missing or not an image): %s' % ', '.join(missing))
    print('wrote %s: %d photos, %d duplicate groups' % (args.out, len(photos), len(groups)))
    return 0 if any('unreadable' not in p for p in photos) else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
