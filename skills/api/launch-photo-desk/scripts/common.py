"""Shared helpers for the photo desk scripts.

- Photos are opened the way a browser shows them: EXIF orientation applied,
  so every fraction (focal point, crops, blur boxes) means the same spot in
  the admin's view and on the site.
- The contract's constants and checks mirror src/lib/kit/photos.js (the
  server's sanitizer), so a photos.json that passes validate_photos.py is
  stored exactly as written.
"""
import json
import math
import os
import re
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', 'data'))

VERSION = 1
ROLES = ('hero', 'about', 'gallery', 'before', 'after', 'skip')
BLUR_KINDS = ('plate', 'face')
ASPECTS = {'desktop': (16, 9), 'phone': (4, 5)}
ASPECT_TOLERANCE = 0.02
# src/lib/kit/photos.js PHOTO_LIMITS.
LIMITS = {
    'picks': 60, 'hero': 1, 'about': 1, 'gallery': 12, 'pairs': 6, 'blur': 12, 'shotList': 10, 'notes': 8,
    'reason': 200, 'alt': 160, 'pairNote': 200, 'shot': 200, 'note': 300,
}
MIN_CROP_SIDE = 0.05
MIN_BLUR_SIDE = 0.002
IMAGE_EXTS = ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff')

# JavaScript's \s (what the server's oneLine() collapses), for one_line().
_JS_WS_CHARS = (' \t\n\v\f\r\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008'
                '\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')
_CONTROL = re.compile('[\x00-\x1f\x7f\u2028\u2029]+')
_SPACES = re.compile('[%s]+' % re.escape(_JS_WS_CHARS))


def one_line(v):
    """launchKit.js oneLine() without the cap."""
    return _SPACES.sub(' ', _CONTROL.sub(' ', v)).strip(_JS_WS_CHARS)


def js_length(v):
    """String.prototype.length (UTF-16 code units): what the server's caps count."""
    return len(v.encode('utf-16-le')) // 2


def js_round(v, places):
    """Math.round(v * 10**places) / 10**places, as the server rounds."""
    f = 10 ** places
    return math.floor(v * f + 0.5) / f


def floor4(v):
    return math.floor(v * 1e4 + 1e-9) / 1e4


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def write_json(path, obj):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write('\n')


# ─── Claims ───────────────────────────────────────────────────────────

def claim_words():
    return load_json(os.path.join(DATA, 'claim_words.json'))


def _words_re(words):
    # re.A: ASCII case folding and \b, as the server's JavaScript regexes
    # (no u flag) match, so both sides call the same texts claims.
    alts = '|'.join(re.escape(w) for w in sorted(words, key=len, reverse=True))
    return re.compile(r'(?<![A-Za-z0-9])(%s)(?![A-Za-z0-9])' % alts, re.I | re.A)


_CLAIMS = None


def _claim_res():
    global _CLAIMS
    if _CLAIMS is None:
        words = claim_words()
        _CLAIMS = (_words_re(words['errors']), _words_re(words['warnings']))
    return _CLAIMS


def claim_in(text):
    """The claim word (an error in alt text and pair notes) in text, or ''."""
    m = _claim_res()[0].search(text or '')
    return m.group(1) if m else ''


def soft_claim_in(text):
    """A softer word worth a second look (a warning), or ''."""
    m = _claim_res()[1].search(text or '')
    return m.group(1) if m else ''


IMAGE_OF = re.compile(r'^(an?\s+)?(image|photo|picture|photograph|pic)\s+(of|showing)\b', re.I | re.A)
# A token that may be a license plate's characters: 5-8 letters and digits,
# at least 2 of each ("7ABC123", "ABC-1234").
PLATE_LIKE = re.compile(r'(?<![A-Za-z0-9])(?=(?:[A-Z0-9-]*[A-Z]){2})(?=(?:[A-Z0-9-]*[0-9]){2})[A-Z0-9][A-Z0-9-]{3,7}[A-Z0-9](?![A-Za-z0-9])')


# ─── Opening photos ───────────────────────────────────────────────────

def exif_orientation(im):
    try:
        return int(im.getexif().get(0x0112) or 1)
    except Exception:
        return 1


def display_size(im):
    """(width, height) as a browser shows the photo (EXIF 5-8 turn it)."""
    w, h = im.size
    return (h, w) if exif_orientation(im) in (5, 6, 7, 8) else (w, h)


def flatten(im, background=(128, 128, 128)):
    """RGB, transparent parts on a neutral gray (first frame of a GIF)."""
    from PIL import Image
    if getattr(im, 'is_animated', False):
        im.seek(0)
    if im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info):
        rgba = im.convert('RGBA')
        bg = Image.new('RGBA', rgba.size, background + (255,))
        return Image.alpha_composite(bg, rgba).convert('RGB')
    return im.convert('RGB')


def open_photo(path, max_side=None):
    """(RGB image as displayed, (display width, display height)). With
    max_side the image is decoded and scaled down to fit it (JPEG decodes
    at a reduced scale first, which is much faster)."""
    from PIL import Image, ImageOps
    im = Image.open(path)
    size = display_size(im)
    if max_side and im.format == 'JPEG':
        im.draft('RGB', (max_side, max_side))
    im = ImageOps.exif_transpose(im)
    im = flatten(im)
    if max_side and max(im.size) > max_side:
        im.thumbnail((max_side, max_side), Image.LANCZOS)
    return im, size


# ─── Crops ────────────────────────────────────────────────────────────

def crop_for(width, height, focal, aspect, zoom=1.0):
    """src/lib/kit/photos.js cropFor(): the largest `aspect` crop of the
    photo around the focal point (times zoom, 0.3-1), kept inside it, as
    fractions with 4 places; w and h rounded down so x + w never passes 1."""
    W, H = float(width), float(height)
    ar = aspect[0] / aspect[1]
    if W / H > ar:
        cw, ch = H * ar, H
    else:
        cw, ch = W, W / ar
    z = min(1.0, max(0.3, float(zoom or 1)))
    cw *= z
    ch *= z
    fx = min(1.0, max(0.0, float(focal.get('x', 0.5)))) * W
    fy = min(1.0, max(0.0, float(focal.get('y', 0.5)))) * H
    w = floor4(cw / W)
    h = floor4(ch / H)
    x = min(js_round(max(0.0, fx - cw / 2) / W, 4), js_round(1 - w, 4))
    y = min(js_round(max(0.0, fy - ch / 2) / H, 4), js_round(1 - h, 4))
    return {'x': max(0.0, x), 'y': max(0.0, y), 'w': w, 'h': h}


def aspect_error(box, width, height, aspect):
    """How far a crop's pixel aspect is from `aspect` (0 = exact)."""
    if not box or box['h'] <= 0 or not width or not height:
        return None
    return abs((box['w'] * width) / (box['h'] * height) / (aspect[0] / aspect[1]) - 1)


# ─── Fonts (labels on sheets) ─────────────────────────────────────────

_FONT_CACHE = {}


def _dejavu_dir():
    try:
        import importlib.util
        spec = importlib.util.find_spec('matplotlib')
        if spec and spec.origin:
            return os.path.join(os.path.dirname(spec.origin), 'mpl-data', 'fonts', 'ttf')
    except Exception:
        pass
    return ''


def font(size, bold=False):
    """DejaVu Sans from matplotlib (always in the container), else a system
    face, else Pillow's built-in one."""
    key = (size, bold)
    if key in _FONT_CACHE:
        return _FONT_CACHE[key]
    from PIL import ImageFont
    name = 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    candidates = [os.path.join(_dejavu_dir(), name), '/usr/share/fonts/truetype/dejavu/' + name,
                  '/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf',
                  '/Library/Fonts/Arial.ttf']
    f = None
    for c in candidates:
        if c and os.path.isfile(c):
            try:
                f = ImageFont.truetype(c, size)
                break
            except Exception:
                continue
    if f is None:
        try:
            f = ImageFont.load_default(size=size)
        except TypeError:
            f = ImageFont.load_default()
    _FONT_CACHE[key] = f
    return f


def text_width(draw, text, fnt):
    try:
        return draw.textlength(text, font=fnt)
    except Exception:
        return len(text) * getattr(fnt, 'size', 10) * 0.6


def fit_text(draw, text, fnt, max_width):
    """text cut with an ellipsis to fit max_width pixels."""
    if text_width(draw, text, fnt) <= max_width:
        return text
    while text and text_width(draw, text + '…', fnt) > max_width:
        text = text[:-1]
    return text + '…'
