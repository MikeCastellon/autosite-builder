"""Color math for the social images: the same formulas the site's theme uses
(src/components/preview/templates/kit/theme.js): WCAG 2.x luminance and
contrast, an sRGB blend, readable_on (white or #111111), ensure_contrast
(the smallest blend toward white or black that reaches the ratio) and the
hero scrim base. Rounding follows JS Math.round (halves up), so a color
the site derives and one these images use are the same hex.

On top: luminance_array() / contrast_array() for numpy pixel blocks, which
compose.py uses to measure text over a photo.
"""
import math
import re

HEX_RE = re.compile(r'^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$')
MIN_RATIO = 4.5


def _round(x):
    return int(math.floor(x + 0.5))


def _clamp(n):
    return max(0, min(255, _round(n)))


def hex_to_rgb(value):
    """'#abc' / '#aabbcc' -> (r, g, b), else None."""
    if not isinstance(value, str):
        return None
    m = HEX_RE.match(value.strip())
    if not m:
        return None
    h = m.group(1)
    if len(h) == 3:
        h = ''.join(ch * 2 for ch in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def rgb_to_hex(rgb):
    return '#' + ''.join('%02x' % _clamp(c) for c in rgb[:3])


def normalize(color, fallback='#000000'):
    rgb = hex_to_rgb(color)
    return rgb_to_hex(rgb) if rgb else fallback


def mix(a, b, t=0.5):
    """Linear blend in sRGB: t=0 -> a, t=1 -> b (theme.js mix)."""
    ca, cb = hex_to_rgb(a), hex_to_rgb(b)
    if not ca or not cb:
        return normalize(a, None) or normalize(b, None) or '#000000'
    k = max(0.0, min(1.0, float(t)))
    return rgb_to_hex(tuple(ca[i] + (cb[i] - ca[i]) * k for i in range(3)))


def _lin(v):
    s = v / 255.0
    return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4


def luminance(color):
    c = hex_to_rgb(color) if isinstance(color, str) else tuple(color)
    if not c:
        return 0.0
    return 0.2126 * _lin(c[0]) + 0.7152 * _lin(c[1]) + 0.0722 * _lin(c[2])


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def is_dark(color):
    return contrast(color, '#ffffff') > contrast(color, '#000000')


def readable_on(bg, light='#ffffff', dark='#111111'):
    return light if contrast(light, bg) >= contrast(dark, bg) else dark


def ensure_contrast(fg, bg, min_ratio=MIN_RATIO):
    """fg when it reads on bg; else the smallest blend toward white or black
    that does (theme.js ensureContrast)."""
    if not hex_to_rgb(bg):
        return normalize(fg)
    if not hex_to_rgb(fg):
        return readable_on(bg)
    fg = normalize(fg)
    if contrast(fg, bg) >= min_ratio:
        return fg

    def solve(target):
        if contrast(target, bg) < min_ratio:
            return None
        lo, hi = 0.0, 1.0
        for _ in range(18):
            mid = (lo + hi) / 2
            if contrast(mix(fg, target, mid), bg) >= min_ratio:
                hi = mid
            else:
                lo = mid
        t = hi
        out = mix(fg, target, t)
        while contrast(out, bg) < min_ratio and t < 1:
            t = min(1.0, t + 0.01)
            out = mix(fg, target, t)
        return t, out

    up, down = solve('#ffffff'), solve('#000000')
    if up and down:
        return up[1] if up[0] <= down[0] else down[1]
    if up:
        return up[1]
    if down:
        return down[1]
    return '#ffffff' if contrast('#ffffff', bg) >= contrast('#000000', bg) else '#000000'


def hero_scrim_base(bg):
    """The scrim the site puts over hero photos (theme.js heroScrimBase):
    the page color deepened on dark themes, near-black on light ones."""
    return mix(bg, '#000000', 0.35) if is_dark(bg) else '#0b0c10'


# ─── Pixel blocks (numpy) ─────────────────────────────────────────────

def luminance_array(rgb):
    """WCAG luminance of an (h, w, 3) uint8 array."""
    import numpy as np
    s = rgb.astype('float64') / 255.0
    lin = np.where(s <= 0.03928, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]


def contrast_array(lum, color):
    """Contrast of `color` against every luminance in `lum`."""
    import numpy as np
    lc = luminance(color)
    hi = np.maximum(lum, lc)
    lo = np.minimum(lum, lc)
    return (hi + 0.05) / (lo + 0.05)
