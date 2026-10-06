"""Renders the social images from the brief and your plan, then writes
social.json next to them.

  compose.py --brief /tmp/social/brief.json --plan /tmp/social/plan.json --out /tmp/social/out
  compose.py ... --check      # the plan's rules only (text sources, claims, roles), nothing drawn

What it does for you (references/plan.md has the plan format):
- places the customer's photo with cover cropping around the focal point
  (yours, else the photo desk's, else the middle) and blurs the plate and
  face areas the photo desk marked;
- sets every text in the brand fonts (DejaVu stand-in when no TTF came),
  at the largest size from data/formats.json that fits its lines, with
  balanced line breaks;
- measures each text's contrast on the pixels behind it (1st percentile,
  so 99% of the background reaches the ratio) and picks the role's color
  that reaches 4.5:1; over a photo it strengthens the scrim until every
  text does;
- keeps text and logo inside each format's safe box and out of the parts
  a platform covers (the Facebook profile picture over the cover);
- puts the logo on a contrasting plate when it would not read (3:1).

Writes <out>/<file>.png for each planned image, <out>/social.json and
/tmp/social/render.json (what was measured; validate_social.py reads it).
Exit 1 with every problem listed when the plan breaks a rule or a text
doesn't fit; nothing is written to <out> then.
"""
import argparse
import math
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import colors as C  # noqa: E402
import common  # noqa: E402
import fonts as F  # noqa: E402
import logo as L  # noqa: E402
import textrules as TR  # noqa: E402

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter, ImageOps  # noqa: E402

MIN_TEXT = 4.5
MIN_LOGO = 0.7          # share of the logo's pixels that must reach 3:1
STACK = ['eyebrow', 'headline', 'quote', 'cite', 'sub', 'items', 'cta']
QUOTE_MARK = '\u201c'
PHOTO_LAYOUTS = {'photo-left', 'photo-right', 'photo-full', 'photo-only', 'photo-overlay', 'photo-band', 'photo-top'}
OPTIONAL_PHOTO = {'quote', 'services'}
SURFACES = ('bg', 'secondary', 'accent')
PROFILE_BACKGROUNDS = ('auto', 'bg', 'secondary', 'accent', 'white', 'text')
LINE_HEIGHT = {'eyebrow': 1.25, 'headline': 1.08, 'quote': 1.24, 'cite': 1.3, 'sub': 1.3, 'items': 1.3, 'cta': 1.0, 'footer': 1.3}
TRACKING = {'eyebrow': 0.12}
SCRIM_START = 0.55
ATTEMPTS = 6
ENLARGED_WARN = 1.6


# ─── Geometry per format and layout ──────────────────────────────────

def geometry(kind, layout, has_photo):
    """Where things go. Rects are (x0, y0, x1, y1)."""
    g = {'photo': None, 'panel': None, 'rule': None, 'scrim': None, 'logo': None, 'logo_align': 'left',
         'text': None, 'align': 'left', 'valign': 'center', 'decor': False}
    if kind == 'share':
        if layout == 'photo-left':
            g.update(photo=(0, 0, 560, 630), panel=(560, 0, 1200, 630), rule=(560, 0, 568, 630),
                     logo=(616, 60, 1140, 128), text=(616, 148, 1140, 582))
        elif layout == 'photo-right':
            g.update(photo=(640, 0, 1200, 630), panel=(0, 0, 640, 630), rule=(632, 0, 640, 630),
                     logo=(60, 60, 584, 128), text=(60, 148, 584, 582))
        elif layout == 'photo-full':
            g.update(photo=(0, 0, 1200, 630), scrim={'side': 'left', 'pad': 90, 'fade': 300},
                     logo=(60, 60, 640, 128), text=(60, 148, 680, 582))
        elif layout == 'brand':
            g.update(panel=(0, 0, 1200, 630), decor=True, logo=(60, 60, 640, 160), text=(60, 190, 1140, 582), valign='bottom')
    elif kind == 'cover':
        if layout == 'photo-left':
            g.update(photo=(0, 0, 800, 624), panel=(800, 0, 1640, 624), rule=(800, 0, 808, 624),
                     logo=(856, 80, 1340, 146), text=(856, 166, 1340, 544))
        elif layout == 'photo-right':
            g.update(photo=(880, 0, 1640, 624), panel=(0, 0, 880, 624), rule=(872, 0, 880, 624),
                     logo=(300, 80, 820, 146), text=(300, 166, 820, 384), valign='top')
        elif layout == 'photo-full':
            g.update(photo=(0, 0, 1640, 624), scrim={'side': 'right', 'pad': 90, 'fade': 320},
                     logo=(600, 80, 1340, 146), text=(600, 166, 1340, 544))
        elif layout == 'photo-only':
            g.update(photo=(0, 0, 1640, 624), logo=(1140, 80, 1340, 160), logo_align='right')
        elif layout == 'brand':
            g.update(panel=(0, 0, 1640, 624), decor=True, logo=(300, 100, 540, 360), logo_align='center',
                     text=(600, 80, 1340, 544))
    elif kind == 'post':
        if layout == 'photo-overlay':
            g.update(photo=(0, 0, 1080, 1080), scrim={'side': 'bottom', 'pad': 70, 'fade': 320},
                     logo=(150, 72, 930, 168), text=(150, 560, 930, 1008), valign='bottom')
        elif layout == 'photo-band':
            g.update(photo=(0, 0, 1080, 620), panel=(0, 620, 1080, 1080), rule=(0, 612, 1080, 620),
                     logo=(150, 72, 930, 168), text=(150, 664, 930, 1008))
        elif layout == 'brand':
            g.update(panel=(0, 0, 1080, 1080), decor=True, logo=(150, 96, 930, 236), logo_align='center',
                     text=(150, 276, 930, 1008), align='center')
        elif layout in ('quote', 'services'):
            if has_photo:
                g.update(photo=(0, 0, 1080, 380), panel=(0, 380, 1080, 1080), rule=(0, 372, 1080, 380),
                         text=(150, 428, 930, 1008))
            else:
                g.update(panel=(0, 0, 1080, 1080), decor=True, logo=(150, 72, 930, 168), text=(150, 208, 930, 1008))
    elif kind == 'story':
        if layout == 'photo-top':
            g.update(photo=(0, 0, 1080, 1060), panel=(0, 1060, 1080, 1920), rule=(0, 1052, 1080, 1060),
                     logo=(96, 300, 984, 420), text=(96, 1110, 984, 1650))
        elif layout == 'photo-full':
            g.update(photo=(0, 0, 1080, 1920), scrim={'side': 'bottom', 'pad': 90, 'fade': 420},
                     logo=(96, 300, 984, 420), text=(96, 860, 984, 1650), valign='bottom')
        elif layout == 'brand':
            g.update(panel=(0, 0, 1080, 1920), decor=True, logo=(96, 330, 984, 560), logo_align='center',
                     text=(96, 620, 984, 1650), align='center')
    return g


# ─── Plan checks ─────────────────────────────────────────────────────

def undrawable(value):
    """Characters a text font has no glyph for (emoji, pictographs,
    symbols): Pillow would draw empty boxes. Letters with accents, dashes,
    quotes, currency signs and the like are fine."""
    odd = []
    for ch in str(value):
        if (ord(ch) >= 0x2190 or ord(ch) < 0x20) and ch not in odd:
            odd.append(ch if ord(ch) >= 0x20 else 'U+%04X' % ord(ch))
    return odd[:5]


def text_items(text):
    """[(role, value)] in drawing order; items expand to one entry each."""
    out = []
    for role in STACK + ['footer']:
        v = (text or {}).get(role)
        if role == 'items':
            for item in v if isinstance(v, list) else []:
                out.append((role, item))
        elif v is not None:
            out.append((role, v))
    return out


def check_plan(plan, brief, index):
    """(images to draw, captions, problems)."""
    fm = common.formats()
    problems = []
    images = plan.get('images') if isinstance(plan, dict) else None
    if not isinstance(images, list) or not images:
        return [], [], ['plan.images must list the images to make']
    seen = set()
    ok = []
    has_logo = bool((brief.get('logo') or {}).get('file')) and (brief['logo']['file'] in brief.get('paths', {}))
    for i, im in enumerate(images):
        where = 'images[%d]' % i
        if not isinstance(im, dict):
            problems.append('%s is not an object' % where)
            continue
        name = im.get('file')
        fmt = fm['formats'].get(name)
        if not fmt:
            problems.append('%s: unknown file "%s" (one of %s)' % (where, name, ', '.join(fm['order'])))
            continue
        where = name
        if name in seen:
            problems.append('%s is planned twice' % name)
            continue
        seen.add(name)
        layout = im.get('layout')
        if layout not in fmt['layouts']:
            problems.append('%s: layout "%s" is not one of %s' % (name, layout, ', '.join(fmt['layouts'])))
            continue
        photo = im.get('photo')
        if layout in PHOTO_LAYOUTS or (layout in OPTIONAL_PHOTO and photo):
            p = common.photo_of(brief, photo) if isinstance(photo, str) else None
            if not p:
                problems.append('%s: "photo" must be one of the brief\'s photos (%s)' % (
                    name, ', '.join(x['file'] for x in brief.get('photos') or []) or 'none were sent: use a brand layout'))
                continue
            if photo not in brief.get('paths', {}):
                problems.append('%s: %s was not found in the container' % (name, photo))
                continue
        elif photo:
            problems.append('%s: layout %s takes no photo' % (name, layout))
        if fmt['kind'] == 'profile':
            if not has_logo:
                problems.append('%s needs the logo, and none was sent: leave it out and say so in notes' % name)
                continue
            if im.get('background', 'auto') not in PROFILE_BACKGROUNDS:
                problems.append('%s: background must be one of %s' % (name, ', '.join(PROFILE_BACKGROUNDS)))
        if im.get('surface', 'bg') not in SURFACES:
            problems.append('%s: surface must be one of %s' % (name, ', '.join(SURFACES)))
        text = im.get('text') or {}
        if not isinstance(text, dict):
            problems.append('%s: text must be an object of roles' % name)
            continue
        for role, v in text.items():
            if role not in fmt['text']:
                problems.append('%s: no "%s" text on this image (roles: %s)' % (name, role, ', '.join(fmt['text']) or 'none'))
            elif role == 'items':
                if not isinstance(v, list) or not all(isinstance(x, str) for x in v):
                    problems.append('%s: items must be a list of strings' % name)
                elif len(v) > fmt['text']['items'][2]:
                    problems.append('%s: at most %d items' % (name, fmt['text']['items'][2]))
            elif not isinstance(v, str):
                problems.append('%s: %s must be a string' % (name, role))
        if any(p.startswith(name + ':') and ('must be' in p or 'no "' in p or 'at most' in p) for p in problems):
            continue
        for role, v in text_items(text):
            for p in TR.line_problems(role, v, index):
                problems.append('%s: %s' % (name, p))
            odd = undrawable(v)
            if odd:
                problems.append('%s: %s "%s" has characters the fonts can\'t draw (%s): leave emoji and symbols out of image text' % (
                    name, role, v, ' '.join(odd)))
        if layout == 'photo-only' and text:
            problems.append('%s: photo-only carries no text (use photo-full for text over the photo)' % name)
        if layout == 'quote' and not text.get('quote'):
            problems.append('%s: the quote layout needs a quote (a pasted review)' % name)
        if layout == 'services' and len(text.get('items') or []) < 2:
            problems.append('%s: the services layout needs at least 2 items' % name)
        if fmt['kind'] not in ('profile',) and layout != 'photo-only' and not (text.get('headline') or text.get('quote') or text.get('items')):
            problems.append('%s needs a headline, a quote or items' % name)
        for p in TR.image_problems(text_items(text), index):
            problems.append('%s: %s' % (name, p))
        for p in TR.alt_problems(im.get('alt'), index, '%s alt' % name):
            problems.append(p)
        focal = im.get('focal')
        if focal is not None and not (isinstance(focal, dict) and all(isinstance(focal.get(k), (int, float)) and 0 <= focal[k] <= 1 for k in ('x', 'y'))):
            problems.append('%s: focal must be {"x": 0-1, "y": 0-1}' % name)
        zoom = im.get('zoom', 1)
        if not isinstance(zoom, (int, float)) or not 1 <= zoom <= 2.5:
            problems.append('%s: zoom must be 1 to 2.5' % name)
        crop = im.get('logoCrop')
        if crop is not None and not (isinstance(crop, dict) and all(isinstance(crop.get(k), (int, float)) for k in ('x', 'y', 'w', 'h'))
                                     and crop['w'] > 0 and crop['h'] > 0):
            problems.append('%s: logoCrop must be {"x", "y", "w", "h"} fractions (logo.py inspect gives them)' % name)
        ok.append(im)
    for req in [n for n in fm['order'] if fm['formats'][n]['required']]:
        if req not in seen:
            problems.append('%s is required' % req)

    captions = plan.get('captions') or []
    planned_posts = [im['file'] for im in ok if fm['formats'][im['file']]['kind'] == 'post']
    clean_captions = []
    if not isinstance(captions, list):
        problems.append('captions must be a list')
        captions = []
    cap_seen = set()
    for i, c in enumerate(captions):
        if not isinstance(c, dict) or c.get('file') not in planned_posts:
            problems.append('captions[%d]: "file" must be one of the planned posts (%s)' % (i, ', '.join(planned_posts) or 'none'))
            continue
        if c['file'] in cap_seen:
            problems.append('%s has two captions' % c['file'])
            continue
        cap_seen.add(c['file'])
        for p in TR.caption_problems(c.get('text'), index, '%s caption' % c['file']):
            problems.append(p)
        if isinstance(c.get('text'), str):
            clean_captions.append({'file': c['file'], 'text': c['text'].strip()})
    for post in planned_posts:
        if post not in cap_seen:
            problems.append('%s has no caption' % post)
    notes = plan.get('notes') or []
    if not isinstance(notes, list) or not all(isinstance(n, str) for n in notes):
        problems.append('notes must be a list of strings')
    return ok, clean_captions, problems


# ─── Drawing helpers ─────────────────────────────────────────────────

def rgb(hex_color):
    return C.hex_to_rgb(hex_color)


def smooth(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def load_photo(path, blur_boxes):
    """The photo upright, decoded at a sensible size, with the marked
    plate/face areas blurred. Returns (image, original (w, h), blurred count)."""
    im = Image.open(path)
    orig = im.size
    try:
        turned = im.getexif().get(0x0112, 1) in (5, 6, 7, 8)
    except Exception:
        turned = False
    upright = (orig[1], orig[0]) if turned else orig
    try:
        im.draft('RGB', (2400, 2400))
    except Exception:
        pass
    im = ImageOps.exif_transpose(im).convert('RGB')
    W, H = im.size
    blurred = 0
    for b in blur_boxes or []:
        try:
            x0 = int(max(0, b['x']) * W)
            y0 = int(max(0, b['y']) * H)
            x1 = int(min(1, b['x'] + b['w']) * W)
            y1 = int(min(1, b['y'] + b['h']) * H)
        except (KeyError, TypeError):
            continue
        if x1 - x0 < 2 or y1 - y0 < 2:
            continue
        pad = int(max(x1 - x0, y1 - y0) * 0.12)
        box = (max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad))
        region = im.crop(box)
        radius = max(6, int(min(box[2] - box[0], box[3] - box[1]) * 0.35))
        small = region.resize((max(1, region.size[0] // 8), max(1, region.size[1] // 8)), Image.BILINEAR)
        region = small.resize(region.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(radius / 4.0))
        im.paste(region, box)
        blurred += 1
    return im, upright, blurred


def cover(photo, rect, focal, zoom):
    """The photo cropped to fill `rect`, the focal point as central as the
    edges allow. Returns (image, scale against the decoded photo)."""
    w, h = rect[2] - rect[0], rect[3] - rect[1]
    pw, ph = photo.size
    scale = max(w / float(pw), h / float(ph)) * zoom
    sw, sh = pw * scale, ph * scale
    fx, fy = focal['x'] * sw, focal['y'] * sh
    left = min(max(fx - w / 2.0, 0.0), sw - w)
    top = min(max(fy - h / 2.0, 0.0), sh - h)
    box = (left / scale, top / scale, (left + w) / scale, (top + h) / scale)
    return photo.resize((w, h), Image.LANCZOS, box=box), scale


def scrim_mask(size, side, edge, fade, alpha):
    """An L mask: `alpha` from the anchored side up to `edge`, fading to 0
    over `fade` px beyond it."""
    W, H = size
    if side in ('bottom', 'top'):
        ys = np.arange(H, dtype='float64')
        t = (ys - (edge - fade)) / fade if side == 'bottom' else ((edge + fade) - ys) / fade
        col = smooth(t) * alpha * 255.0
        m = np.repeat(col[:, None], W, axis=1)
    else:
        xs = np.arange(W, dtype='float64')
        t = ((edge + fade) - xs) / fade if side == 'left' else (xs - (edge - fade)) / fade
        row = smooth(t) * alpha * 255.0
        m = np.repeat(row[None, :], H, axis=0)
    return Image.fromarray(np.clip(m, 0, 255).astype('uint8'))


def glow(size, rect, base, accent, strength):
    """A soft accent light in the panel's top right corner."""
    W, H = size
    x0, y0, x1, y1 = rect
    cx, cy = x1 - (x1 - x0) * 0.08, y0 + (y1 - y0) * 0.05
    r = max(x1 - x0, y1 - y0) * 0.75
    ys, xs = np.mgrid[0:H, 0:W]
    d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / r
    a = smooth(1.0 - d) * 0.16 * strength
    col = np.array(rgb(accent), dtype='float64')
    basec = np.array(rgb(base), dtype='float64')
    img = basec + (col - basec) * a[..., None]
    out = Image.fromarray(np.clip(img.round(), 0, 255).astype('uint8'))
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).rectangle(rect, fill=255)
    return out, mask


def region_contrast(arr, bbox, color):
    """(1st percentile, min) contrast of `color` against the pixels of
    `arr` inside bbox."""
    H, W = arr.shape[:2]
    x0, y0, x1, y1 = [int(round(v)) for v in bbox]
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if x1 <= x0 or y1 <= y0:
        return 0.0, 0.0
    lum = C.luminance_array(arr[y0:y1, x0:x1, :3])
    c = C.contrast_array(lum, color)
    return float(np.percentile(c, 1)), float(c.min())


def inside(b, box, tol=3):
    """Within `box`, give or take a glyph's side bearing."""
    return b[0] >= box[0] - tol and b[1] >= box[1] - tol and b[2] <= box[2] + tol and b[3] <= box[3] + tol


def overlaps(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


# ─── Text layout ─────────────────────────────────────────────────────

def draw_value(role, value):
    v = ' '.join(str(value).split())
    if role == 'eyebrow':
        return v.upper()
    if role == 'cite':
        return '\u2014 ' + v
    return v


def layout_text(text, fmt, box, faces, file_name):
    """Fits the text into `box`: the largest common scale at which every
    role fits its lines and all of it fits the box. Returns (blocks,
    problem); blocks carry fonts, lines and positions (top-left based)."""
    sizes = fmt['text']
    entries = [(r, (text or {}).get(r)) for r in STACK if (text or {}).get(r)]
    footer = (text or {}).get('footer')
    x0, y0, x1, y1 = box
    width = x1 - x0
    worst = None
    k = 1.0
    while True:
        blocks = []
        failed = None
        for role, value in entries + ([('footer', footer)] if footer else []):
            big, small, most = sizes[role]
            size = max(small, int(round(big * k)))
            font = faces.font(role, size)
            track = TRACKING.get(role, 0.0)
            if role == 'items':
                indent = size * 0.95
                lines = []
                for item in value:
                    one = F.wrap(draw_value(role, item), font, width - indent, 1, track, balance=False)
                    if one is None:
                        failed = (role, item, size, width - indent, 1)
                        break
                    lines.append(one[0])
                if failed:
                    break
                blocks.append({'role': role, 'size': size, 'font': font, 'lines': lines, 'indent': indent, 'track': track,
                               'values': list(value)})
                continue
            if role == 'cta':
                pad = size * 1.1
                one = F.wrap(draw_value(role, value), font, width - 2 * pad, 1, track, balance=False)
                if one is None:
                    failed = (role, value, size, width - 2 * pad, 1)
                    break
                blocks.append({'role': role, 'size': size, 'font': font, 'lines': one, 'pad': pad, 'track': track, 'values': [value]})
                continue
            lines = F.wrap(draw_value(role, value), font, width, most, track, balance=role in ('headline', 'quote', 'sub'))
            if lines is None:
                failed = (role, value, size, width, most)
                break
            block = {'role': role, 'size': size, 'font': font, 'lines': lines, 'track': track, 'values': [value]}
            if role == 'quote':
                # A big opening quotation mark in the accent color above it.
                mfont = faces.font('quote', int(size * 3.2))
                l, t, r, b = tight_ink(mfont, QUOTE_MARK)
                block['mark'] = {'font': mfont, 'l': l, 't': t, 'r': r, 'b': b}
                block['pre'] = (b - t) + size * 0.25
            blocks.append(block)
        if not failed:
            total = stack_height(blocks) + 2 * inset_of(blocks)
            if total <= y1 - y0:
                return place(blocks, box, fmt), None
            worst = ('height', total, y1 - y0)
        else:
            worst = failed
        at_min = all(max(sizes[r][1], int(round(sizes[r][0] * k))) == sizes[r][1] for r, _ in entries + ([('footer', 1)] if footer else []))
        if at_min:
            break
        k -= 0.04
    if worst and worst[0] == 'height':
        return None, ('%s: the text does not fit the %d px tall text area (needs %d px at the smallest sizes): '
                      'shorten the headline or drop the sub, items or footer' % (file_name, worst[2], worst[1]))
    role, value, size, w, most = worst
    font = faces.font(role, size)
    avg = F.text_width(font, 'abcdefghijklmnopqrstuvwxyz') / 26.0
    per_line = max(4, int(w / max(1.0, avg)))
    return None, ('%s: %s "%s" is too long (%d line%s of about %d characters fit at the smallest size)' % (
        file_name, role, value if isinstance(value, str) else value, most, '' if most == 1 else 's', per_line))


def line_h(block):
    if block['role'] == 'cta':
        return block['size'] * 2.3
    return block['size'] * LINE_HEIGHT[block['role']]


def block_h(block):
    return block.get('pre', 0) + line_h(block) * len(block['lines'])


def gap_before(prev, block):
    if prev is None:
        return 0
    if prev['role'] == 'eyebrow':
        return prev['size'] * 0.8
    if block['role'] == 'cta':
        return block['size'] * 1.1
    if block['role'] == 'cite':
        return block['size'] * 0.45
    return max(10, block['size'] * 0.55)


def stack_height(blocks):
    total = 0
    prev = None
    body = [b for b in blocks if b['role'] != 'footer']
    for b in body:
        total += gap_before(prev, b) + block_h(b)
        prev = b
    foot = [b for b in blocks if b['role'] == 'footer']
    if foot:
        total += (foot[0]['size'] * 1.4 if body else 0) + line_h(foot[0])
    return int(math.ceil(total))


def inset_of(blocks):
    """Room kept free at the top and bottom of the text box: glyphs reach a
    little past their line box (tight headline leading)."""
    return int(math.ceil(0.12 * max([b['size'] for b in blocks] or [0])))


def place(blocks, box, fmt):
    """Sets each block's top; the footer sits at the bottom of the box."""
    x0, y0, x1, y1 = box
    inset = inset_of(blocks)
    y0, y1 = y0 + inset, y1 - inset
    body = [b for b in blocks if b['role'] != 'footer']
    foot = [b for b in blocks if b['role'] == 'footer']
    body_h = 0
    prev = None
    for b in body:
        body_h += gap_before(prev, b) + block_h(b)
        prev = b
    foot_h = line_h(foot[0]) if foot else 0
    room = (y1 - y0) - foot_h - (foot[0]['size'] * 1.4 if foot and body else 0)
    valign = fmt.get('_valign', 'center')
    if valign == 'top':
        top = y0
    elif valign == 'bottom':
        top = y0 + room - body_h
    else:
        top = y0 + (room - body_h) / 2.0
    y = top
    prev = None
    for b in body:
        y += gap_before(prev, b)
        b['top'] = y
        y += block_h(b)
        prev = b
    if foot:
        foot[0]['top'] = y1 - foot_h
    return blocks


def line_boxes(block, x0, x1, align):
    """[(line, x, baseline, bbox)] for a block (bbox from the font metrics)."""
    font = block['font']
    ascent, descent = font.getmetrics()
    out = []
    lh = line_h(block)
    for i, line in enumerate(block['lines']):
        w = F.text_width(font, line, block['track'])
        left = x0 + block.get('indent', 0)
        if block['role'] == 'cta':
            pill_w = w + 2 * block['pad']
            px = x0 if align == 'left' else (x0 + x1 - pill_w) / 2.0
            top = block['top']
            base = top + (lh - (ascent + descent)) / 2.0 + ascent
            x = px + block['pad']
            out.append((line, x, base, ink(font, line, x, base, w), (px, top, px + pill_w, top + lh)))
            continue
        if align == 'center':
            left = (x0 + x1 - w) / 2.0 + (block.get('indent', 0) / 2.0 if block['role'] == 'items' else 0)
        top = block['top'] + block.get('pre', 0) + i * lh
        base = top + (lh - (ascent + descent)) / 2.0 + ascent
        out.append((line, left, base, ink(font, line, left, base, w), None))
    return out


_INK = {}


def tight_ink(font, text):
    """The exact drawn box of `text` relative to its left baseline point
    (font.getbbox is loose for marks that sit high, like a quotation mark)."""
    key = (getattr(font, 'path', ''), font.size, text)
    if key not in _INK:
        w = int(font.getlength(text) + font.size * 2)
        h = int(font.size * 3)
        mask = Image.new('L', (w, h), 0)
        ImageDraw.Draw(mask).text((font.size, font.size * 2), text, font=font, fill=255, anchor='ls')
        box = mask.getbbox() or (font.size, font.size * 2, font.size, font.size * 2)
        _INK[key] = (box[0] - font.size, box[1] - font.size * 2, box[2] - font.size, box[3] - font.size * 2)
    return _INK[key]


def ink(font, line, x, base, width):
    """The drawn pixels' box of a line set at (x, baseline)."""
    try:
        l, t, r, b = font.getbbox(line, anchor='ls')
    except Exception:
        ascent, descent = font.getmetrics()
        l, t, r, b = 0, -ascent, width, descent
    return (x + min(0, l), base + t, x + max(width, r), base + b)


def draw_line(draw, line, x, base, font, color, track):
    if not track:
        draw.text((x, base), line, font=font, fill=color, anchor='ls')
        return
    cx = x
    for ch in line:
        draw.text((cx, base), ch, font=font, fill=color, anchor='ls')
        cx += font.getlength(ch) + track * font.size


# ─── Colors per surface ──────────────────────────────────────────────

def candidates(role, surface, pal):
    text = C.ensure_contrast(pal['text'], surface)
    readable = C.readable_on(surface)
    accent = C.ensure_contrast(pal['accent'], surface)
    muted = C.ensure_contrast(pal['muted'], surface)
    if role == 'eyebrow':
        out = [accent, text, readable]
    elif role in ('sub', 'cite', 'footer'):
        out = [muted, text, readable]
    else:
        out = [text, readable]
    seen = []
    for c in out:
        if c not in seen:
            seen.append(c)
    return seen


def pill_fill(surface, pal):
    if C.contrast(pal['accent'], surface) >= 3.0:
        return pal['accent']
    return C.ensure_contrast(pal['text'], surface, 3.0)


# ─── Logo ────────────────────────────────────────────────────────────

def fit_logo(mark, box, align):
    bw, bh = box[2] - box[0], box[3] - box[1]
    w, h = mark.size
    # Small uploads are enlarged at most 3x (more looks soft).
    s = min(bw / float(w), bh / float(h), 3.0)
    nw, nh = max(1, int(w * s)), max(1, int(h * s))
    img = mark.resize((nw, nh), Image.LANCZOS)
    if align == 'center':
        x = box[0] + (bw - nw) // 2
    elif align == 'right':
        x = box[2] - nw
    else:
        x = box[0]
    return img, (x, box[1] + (bh - nh) // 2)


def place_logo(canvas, mark, info, box, align, pal, chip_inside=None):
    """Draws the logo; on a plate when it would not read. Returns its report."""
    pad = 0
    img, (x, y) = fit_logo(mark, box, align)
    arr = np.asarray(canvas.convert('RGB'))
    region = arr[y:y + img.size[1], x:x + img.size[0]]
    leg = 1.0 if info.get('opaque') else L.legibility(img, region)
    chip = None
    if leg < MIN_LOGO and not info.get('opaque'):
        # A plate: shrink the logo inside the same box so the plate fits too.
        pad = int(max(8, min(img.size) * 0.22))
        inner = (box[0] + pad, box[1] + pad, box[2] - pad, box[3] - pad)
        img, (x, y) = fit_logo(mark, inner, align)
        if align == 'left':
            x = box[0] + pad
        best = None
        for c in ['#ffffff', pal['bg'], pal['text'], '#111111', pal['secondary']]:
            plate = np.zeros((img.size[1], img.size[0], 3), dtype='uint8') + np.array(rgb(c), dtype='uint8')
            score = L.legibility(img, plate)
            if best is None or score > best[1] + 1e-9:
                best = (c, score)
        chip, leg = best
        r = int(min(img.size[1] + 2 * pad, img.size[0] + 2 * pad) * 0.22)
        ImageDraw.Draw(canvas).rounded_rectangle((x - pad, y - pad, x + img.size[0] + pad, y + img.size[1] + pad), radius=r, fill=rgb(chip) + (255,))
    canvas.alpha_composite(img.convert('RGBA'), (x, y))
    bbox = (x - pad, y - pad, x + img.size[0] + pad, y + img.size[1] + pad)
    return {'type': 'logo', 'bbox': [int(v) for v in bbox], 'legibility': round(leg, 3), 'chip': chip}


# ─── One image ───────────────────────────────────────────────────────

class Context(object):
    def __init__(self, brief, faces):
        self.brief = brief
        self.faces = faces
        self.pal = common.palette_of(brief)
        self.logo = None
        self.logo_info = None
        lg = brief.get('logo') or {}
        if lg.get('file') and lg['file'] in brief.get('paths', {}):
            self.logo, self.logo_info = L.load(brief['paths'][lg['file']])
        self.photos = {}

    def photo(self, name):
        if name not in self.photos:
            p = common.photo_of(self.brief, name) or {}
            self.photos[name] = load_photo(self.brief['paths'][name], p.get('blur') or [])
        return self.photos[name]


def surface_color(name, pal):
    return pal.get(name) or pal['bg']


def render_profile(im, fmt, ctx):
    W, H = fmt['size']
    cx, cy, R = fmt['circle']
    mark = L.crop(ctx.logo, im.get('logoCrop'))
    pal = ctx.pal
    options = {'bg': pal['bg'], 'secondary': pal['secondary'], 'accent': pal['accent'], 'white': '#ffffff', 'text': pal['text']}
    opaque = bool(ctx.logo_info.get('opaque'))
    # Size: the farthest visible pixel from the middle sits at 80% of the
    # circle (an opaque logo: its corners at 92%), never wider than 70%.
    a = np.asarray(mark)[..., 3] > (0 if opaque else 128)
    ys, xs = np.nonzero(a)
    if not len(xs):
        ys, xs = np.mgrid[0:mark.size[1], 0:mark.size[0]].reshape(2, -1)
    mx, my = mark.size[0] / 2.0, mark.size[1] / 2.0
    far = float(np.sqrt(((xs + 0.5 - mx) ** 2 + (ys + 0.5 - my) ** 2).max()))
    s = (R * (0.92 if opaque else 0.80)) / max(1.0, far)
    s = min(s, W * 0.7 / mark.size[0], H * 0.7 / mark.size[1])
    img = mark.resize((max(1, int(mark.size[0] * s)), max(1, int(mark.size[1] * s))), Image.LANCZOS)
    x, y = int(round(cx - img.size[0] / 2.0)), int(round(cy - img.size[1] / 2.0))
    choice = im.get('background', 'auto')
    if choice == 'auto':
        best = None
        for name in ('bg', 'secondary', 'white', 'accent', 'text'):
            plate = np.zeros((img.size[1], img.size[0], 3), dtype='uint8') + np.array(rgb(options[name]), dtype='uint8')
            score = 1.0 if opaque else L.legibility(img, plate)
            if score >= 0.85:
                best = (name, score)
                break
            if best is None or score > best[1]:
                best = (name, score)
        choice = best[0]
    bgc = options[choice]
    canvas = Image.new('RGBA', (W, H), rgb(bgc) + (255,))
    region = np.asarray(canvas.convert('RGB'))[y:y + img.size[1], x:x + img.size[0]]
    leg = 1.0 if opaque else L.legibility(img, region)
    if opaque:
        m = Image.new('L', img.size, 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, img.size[0] - 1, img.size[1] - 1), radius=int(min(img.size) * 0.12), fill=255)
        canvas.paste(img.convert('RGBA'), (x, y), m)
    else:
        canvas.alpha_composite(img.convert('RGBA'), (x, y))
    alpha = np.asarray(img)[..., 3] > (0 if opaque else 128)
    ys, xs = np.nonzero(alpha)
    reach = float(np.sqrt(((xs + x + 0.5 - cx) ** 2 + (ys + y + 0.5 - cy) ** 2).max())) if len(xs) else 0.0
    report = {'type': 'logo', 'bbox': [x, y, x + img.size[0], y + img.size[1]], 'legibility': round(leg, 3),
              'chip': None, 'reach': round(reach, 1), 'background': bgc}
    return canvas, [report], {'scrim': None, 'photo': None, 'blurred': 0, 'warnings': [], 'surface': bgc}


def render_image(im, fmt, ctx, attempt):
    W, H = fmt['size']
    kind = fmt['kind']
    layout = im['layout']
    pal = ctx.pal
    photo_name = im.get('photo') if (layout in PHOTO_LAYOUTS or layout in OPTIONAL_PHOTO) else None
    g = geometry(kind, layout, bool(photo_name))
    surface = surface_color(im.get('surface', 'bg'), pal)
    canvas = Image.new('RGBA', (W, H), rgb(pal['bg']) + (255,))
    extra = {'scrim': None, 'photo': None, 'blurred': 0, 'warnings': [], 'surface': surface}

    if g['panel']:
        if g['decor']:
            strength = max(0.0, 1.0 - 0.5 * attempt)
            lit, mask = glow((W, H), g['panel'], surface, pal['accent'], strength)
            canvas.paste(lit.convert('RGBA'), (0, 0), mask)
        else:
            ImageDraw.Draw(canvas).rectangle(g['panel'], fill=rgb(surface) + (255,))
    if photo_name:
        photo, upright, blurred = ctx.photo(photo_name)
        meta = common.photo_of(ctx.brief, photo_name) or {}
        focal = im.get('focal') or meta.get('focal') or {'x': 0.5, 'y': 0.5}
        part, scale = cover(photo, g['photo'], focal, float(im.get('zoom', 1)))
        canvas.paste(part.convert('RGBA'), g['photo'][:2])
        enlarged = scale * photo.size[0] / float(max(1, upright[0]))
        extra['photo'] = {'file': photo_name, 'focal': focal, 'enlarged': round(enlarged, 2)}
        extra['blurred'] = blurred
        if enlarged > ENLARGED_WARN:
            extra['warnings'].append('%s is enlarged %.1fx for %s and may look soft: pick a larger photo or another layout' % (
                photo_name, enlarged, im['file']))
    if g['rule']:
        ImageDraw.Draw(canvas).rectangle(g['rule'], fill=rgb(pal['accent']) + (255,))

    elements = []
    # The logo, unless the plan turned it off (drawn after the scrim, so
    # the scrim never dims it); without it the text may start higher.
    text_box = g['text']
    with_logo = bool(g['logo']) and ctx.logo is not None and im.get('logo', True) is not False
    if not with_logo and g['logo'] and text_box:
        lb = g['logo']
        if lb[3] <= text_box[1] and lb[0] < text_box[2] and text_box[0] < lb[2]:
            text_box = (text_box[0], lb[1], text_box[2], text_box[3])

    blocks = []
    if text_box and im.get('text'):
        fmt2 = dict(fmt)
        fmt2['_valign'] = im.get('valign') or g['valign']
        blocks, problem = layout_text(im['text'], fmt2, text_box, ctx.faces, im['file'])
        if problem:
            return None, None, extra, problem
    align = im.get('align') or g['align']

    # A scrim behind text over the photo, sized to the text it carries.
    scrim_color = C.hero_scrim_base(pal['bg'])
    if g['scrim'] and blocks:
        alpha = min(0.95, SCRIM_START + 0.1 * attempt)
        top = min(b['top'] for b in blocks)
        bottom = max(b['top'] + block_h(b) for b in blocks)
        lefts, rights = [], []
        for b in blocks:
            for line, x, base, bb, pill in line_boxes(b, text_box[0], text_box[2], align):
                lefts.append((pill or bb)[0])
                rights.append((pill or bb)[2])
        sc = g['scrim']
        edge = {'bottom': top - sc['pad'], 'top': bottom + sc['pad'], 'left': max(rights) + sc['pad'],
                'right': min(lefts) - sc['pad']}[sc['side']]
        mask = scrim_mask((W, H), sc['side'], edge, sc['fade'], alpha)
        layer = Image.new('RGBA', (W, H), rgb(scrim_color) + (0,))
        layer.putalpha(mask)
        canvas.alpha_composite(layer)
        extra['scrim'] = {'side': sc['side'], 'alpha': round(alpha, 2), 'color': scrim_color}
        surface_for_text = scrim_color
    elif g['panel']:
        surface_for_text = surface
    else:
        surface_for_text = scrim_color

    if with_logo:
        mark = L.crop(ctx.logo, im.get('logoCrop'))
        elements.append(place_logo(canvas, mark, ctx.logo_info, g['logo'], g['logo_align'], pal))

    draw = ImageDraw.Draw(canvas)
    # Shapes first (pills, bullets): they are the background of their text.
    placed = []
    for b in blocks:
        boxes = line_boxes(b, text_box[0], text_box[2], align)
        fill = None
        if b['role'] == 'cta':
            fill = pill_fill(surface_for_text, pal)
            pill = boxes[0][4]
            draw.rounded_rectangle(pill, radius=(pill[3] - pill[1]) / 2.0, fill=rgb(fill) + (255,))
        if b.get('mark'):
            m = b['mark']
            mark_color = C.ensure_contrast(pal['accent'], surface_for_text, 3.0)
            mw = m['r'] - m['l']
            mx = text_box[0] - m['l'] if align == 'left' else (text_box[0] + text_box[2] - mw) / 2.0 - m['l']
            mbase = b['top'] - m['t']
            draw.text((mx, mbase), QUOTE_MARK, font=m['font'], fill=rgb(mark_color) + (255,), anchor='ls')
            elements.append({'type': 'mark', 'bbox': [int(mx + m['l']), int(mbase + m['t']), int(math.ceil(mx + m['r'])), int(math.ceil(mbase + m['b']))],
                             'color': mark_color})
        if b['role'] == 'items':
            bullet = C.ensure_contrast(pal['accent'], surface_for_text, 3.0)
            for line, x, base, bb, _ in boxes:
                s = b['size'] * 0.32
                cy = (bb[1] + bb[3]) / 2.0
                bx = x - b['indent'] + s * 0.2
                draw.rectangle((bx, cy - s / 2.0, bx + s, cy + s / 2.0), fill=rgb(bullet) + (255,))
        placed.append((b, boxes, fill))
    snapshot = np.asarray(canvas.convert('RGB')).copy()

    ok = True
    for b, boxes, fill in placed:
        cands = [C.readable_on(fill), C.ensure_contrast(C.readable_on(fill), fill)] if fill else candidates(b['role'], surface_for_text, pal)
        best = None
        for color in cands:
            worst = (99.0, 99.0)
            for line, x, base, bb, _ in boxes:
                p01, mn = region_contrast(snapshot, bb, color)
                worst = (min(worst[0], p01), min(worst[1], mn))
            if best is None or worst[0] > best[1][0]:
                best = (color, worst)
            if worst[0] >= MIN_TEXT:
                best = (color, worst)
                break
        color, (p01, mn) = best
        if p01 < MIN_TEXT:
            ok = False
        for line, x, base, bb, _ in boxes:
            draw_line(draw, line, x, base, b['font'], rgb(color) + (255,), b['track'])
        for i, (line, x, base, bb, pill) in enumerate(boxes):
            value = b['values'][i] if b['role'] == 'items' else b['values'][0]
            if b['role'] != 'items' and i > 0:
                continue
            union = bb if b['role'] == 'items' else (
                min(t[3][0] for t in boxes), min(t[3][1] for t in boxes), max(t[3][2] for t in boxes), max(t[3][3] for t in boxes))
            elements.append({
                'type': 'text', 'role': b['role'], 'text': value, 'lines': b['lines'] if b['role'] != 'items' else [line],
                'size': b['size'], 'color': color, 'bbox': [int(math.floor(union[0])), int(math.floor(union[1])), int(math.ceil(union[2])), int(math.ceil(union[3]))],
                'box': [int(v) for v in (pill or union)], 'contrast': round(p01, 2), 'contrastMin': round(mn, 2),
            })
    return canvas, elements, extra, (None if ok else 'contrast')


def render(im, fmt, ctx):
    """(image, report, problem). Retries with a stronger scrim (or a
    quieter decoration) until every text reaches 4.5:1."""
    if fmt['kind'] == 'profile':
        canvas, elements, extra = render_profile(im, fmt, ctx)
        return canvas, dict(extra, elements=elements, attempts=1), None
    last = None
    for attempt in range(ATTEMPTS):
        canvas, elements, extra, problem = render_image(im, fmt, ctx, attempt)
        if canvas is None:
            return None, None, problem
        last = (canvas, dict(extra, elements=elements, attempts=attempt + 1))
        if problem is None:
            return last[0], last[1], None
    low = [e for e in last[1]['elements'] if e['type'] == 'text' and e['contrast'] < MIN_TEXT]
    return last[0], last[1], '%s: %s still below 4.5:1 at the strongest scrim (pick a calmer photo area, another photo or a panel layout)' % (
        im['file'], ', '.join('%s %.2f' % (e['role'], e['contrast']) for e in low))


def zone_problems(name, fmt, elements):
    out = []
    safe = fmt['safe']
    for e in elements:
        box = e.get('box') or e['bbox']
        if not inside(box, safe):
            out.append('%s: the %s sits outside the safe area %s' % (name, e.get('role') or e['type'], safe))
        for a in fmt.get('avoid') or []:
            if overlaps(box, a):
                out.append('%s: the %s overlaps an area the platform covers %s' % (name, e.get('role') or e['type'], a))
    return out


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--brief', required=True)
    ap.add_argument('--plan', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--report', default=os.path.join(common.WORK, 'render.json'))
    ap.add_argument('--check', action='store_true', help='check the plan only; draw nothing')
    args = ap.parse_args(argv[1:])

    brief = common.load_brief(args.brief)
    try:
        plan = common.read_json(args.plan)
    except Exception as e:
        print('ERROR the plan is not readable JSON: %s' % e)
        return 1
    index = TR.index_of(brief)
    images, captions, problems = check_plan(plan, brief, index)
    if args.check or problems:
        for p in problems:
            print('ERROR ' + p)
        print('Plan OK' if not problems else '%d problem(s): fix the plan and run again' % len(problems))
        return 1 if problems else 0

    fm = common.formats()
    faces = F.Faces(brief)
    ctx = Context(brief, faces)
    order = {n: i for i, n in enumerate(fm['order'])}
    images = sorted(images, key=lambda im: order[im['file']])
    rendered = []
    reports = []
    for im in images:
        fmt = fm['formats'][im['file']]
        canvas, report, problem = render(im, fmt, ctx)
        if problem:
            problems.append(problem)
        if canvas is None:
            continue
        problems.extend(zone_problems(im['file'], fmt, report['elements']))
        rendered.append((im, fmt, canvas))
        reports.append(dict(report, file=im['file'], layout=im['layout'], size=list(fmt['size'])))

    render_report = {'version': 1, 'fonts': faces.report(), 'images': reports}
    common.write_json(args.report, render_report)
    for r in reports:
        texts = [e for e in r['elements'] if e['type'] == 'text']
        logo = [e for e in r['elements'] if e['type'] == 'logo']
        print('%-22s %-14s %s%s%s%s' % (
            r['file'], r['layout'],
            'contrast min %.2f' % min(e['contrast'] for e in texts) if texts else 'no text',
            ', scrim %.2f' % r['scrim']['alpha'] if r.get('scrim') else '',
            ', logo %.2f%s' % (logo[0]['legibility'], ' on a %s plate' % logo[0]['chip'] if logo[0].get('chip') else '') if logo else '',
            ', blurred %d' % r['blurred'] if r.get('blurred') else ''))
        for w in r.get('warnings') or []:
            print('  WARNING ' + w)
    if problems:
        for p in problems:
            print('ERROR ' + p)
        print('%d problem(s): nothing written to %s' % (len(problems), args.out))
        return 1

    os.makedirs(args.out, exist_ok=True)
    for name in os.listdir(args.out):
        if name.endswith('.png') or name == 'social.json':
            os.remove(os.path.join(args.out, name))
    out_images = []
    for im, fmt, canvas in rendered:
        canvas.convert('RGB').save(os.path.join(args.out, im['file']), 'PNG', optimize=True)
        out_images.append({
            'file': im['file'],
            'size': '%dx%d' % tuple(fmt['size']),
            'purpose': fmt['purpose'],
            'alt': ' '.join(str(im.get('alt') or '').split()),
            'layout': im['layout'],
            'photo': im.get('photo') if (im['layout'] in PHOTO_LAYOUTS or im['layout'] in OPTIONAL_PHOTO) and im.get('photo') else None,
            'text': [{'role': role, 'text': ' '.join(str(v).split())} for role, v in text_items(im.get('text'))],
        })
    notes = [n.strip() for n in plan.get('notes') or [] if isinstance(n, str) and n.strip()]
    # Per photo, not per image: one plate shown on two images is one area.
    blurred = sum(dict((r['photo']['file'], r.get('blurred') or 0) for r in reports if r.get('photo')).values())
    if blurred:
        notes.append('Blurred the plate and face areas the photo desk marked (%d area%s across the photos used).' % (
            blurred, '' if blurred == 1 else 's'))
    if faces.report()['standIn']:
        notes.append('The brand font files were not in the request: the text is set in DejaVu Sans as a stand-in.')
    social = {
        'version': 1,
        'images': out_images,
        'captions': captions,
        'fonts': faces.report(),
        'notes': notes[:8],
    }
    common.write_json(os.path.join(args.out, 'social.json'), social)
    print('Wrote %d image(s) and social.json to %s' % (len(out_images), args.out))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
