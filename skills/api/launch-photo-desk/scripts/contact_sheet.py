"""Contact sheets: many photos in one image, labeled.

  contact_sheet.py review --analysis /tmp/photos/analysis.json --out-dir /tmp/photos/sheets
      Sheets for YOU to judge from: 12 photos each (4 x 3), 1568 px wide so
      nothing is scaled down when you view it. Every photo carries its
      number (#n from analyze.py) on the image and its file name, size, tech
      score and flags below. Prints the sheet files and which photos each
      holds. Open each sheet with the file viewer (text editor `view`).

  contact_sheet.py final /tmp/photos/photos.json --analysis /tmp/photos/analysis.json --out /tmp/photos/contact_sheet.png
      The deliverable contact_sheet.png for the admin: every pick in role
      order (hero, about, gallery, pairs, skipped dimmed) with its role and
      score, the desktop crop (solid), the phone crop (dashed), proposed
      blur boxes (red) and the focal point. 1600 px wide, kept under 8 MB.

Exit 1 on a missing or unreadable input file.
"""
import argparse
import io
import math
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROLES, fit_text, font, load_json, open_photo  # noqa: E402

PAGE = (24, 24, 26)
CELL = (44, 44, 48)
WHITE = (255, 255, 255)
MUTED = (190, 190, 196)
BAD = (255, 138, 128)
SOFT = (255, 209, 128)
BAD_FLAGS = {'blurry', 'dark', 'small', 'graphic', 'unreadable', 'duplicate'}
ROLE_COLORS = {
    'hero': (204, 0, 0), 'about': (30, 90, 200), 'gallery': (0, 130, 90),
    'before': (150, 90, 20), 'after': (120, 40, 160), 'skip': (90, 90, 90),
}
MAX_FINAL_BYTES = 8 * 1024 * 1024


def thumb(path, box):
    """The photo scaled to fit box (w, h), or None when it won't open."""
    try:
        im, _ = open_photo(path, max_side=max(box) * 2)
    except Exception:
        return None
    im.thumbnail(box)
    return im


def badge(draw, xy, text, fnt, fill, color=WHITE, pad=(7, 3)):
    x, y = xy
    w = draw.textlength(text, font=fnt)
    h = fnt.size if hasattr(fnt, 'size') else 12
    draw.rounded_rectangle([x, y, x + w + pad[0] * 2, y + h + pad[1] * 2 + 2], radius=5, fill=fill)
    draw.text((x + pad[0], y + pad[1]), text, font=fnt, fill=color)
    return x + w + pad[0] * 2


# ─── Review sheets ────────────────────────────────────────────────────

def review(analysis, out_dir, per_sheet=12, cols=4, width=1568):
    from PIL import Image, ImageDraw
    photos = analysis['photos']
    os.makedirs(out_dir, exist_ok=True)
    margin, gap, header, label = 12, 10, 44, 52
    cw = (width - 2 * margin - (cols - 1) * gap) // cols
    th = cw * 3 // 4
    f_title, f_num, f_name, f_meta = font(20, True), font(26, True), font(17, True), font(14)
    sheets = []
    pages = max(1, math.ceil(len(photos) / per_sheet))
    for page in range(pages):
        chunk = photos[page * per_sheet:(page + 1) * per_sheet]
        rows = max(1, math.ceil(len(chunk) / cols))
        height = header + margin + rows * (th + label + gap)
        sheet = Image.new('RGB', (width, height), PAGE)
        d = ImageDraw.Draw(sheet)
        first, last = chunk[0]['n'] if chunk else 0, chunk[-1]['n'] if chunk else 0
        d.text((margin, 12), 'Sheet %d of %d: photos #%d-#%d' % (page + 1, pages, first, last), font=f_title, fill=WHITE)
        for k, p in enumerate(chunk):
            x = margin + (k % cols) * (cw + gap)
            y = header + (k // cols) * (th + label + gap)
            d.rectangle([x, y, x + cw, y + th], fill=CELL)
            im = None if 'unreadable' in p else thumb(p['path'], (cw, th))
            if im is not None:
                sheet.paste(im, (x + (cw - im.width) // 2, y + (th - im.height) // 2))
            else:
                d.text((x + 12, y + th // 2 - 8), 'could not be read', font=f_meta, fill=BAD)
            badge(d, (x + 6, y + 6), '#%d' % p['n'], f_num, (0, 0, 0))
            d.text((x + 2, y + th + 4), fit_text(d, p['name'], f_name, cw - 4), font=f_name, fill=WHITE)
            if 'unreadable' in p:
                meta, color = 'unreadable', BAD
            else:
                bits = ['%dx%d' % (p['width'], p['height']), 'tech %.1f' % p['techScore']]
                if p.get('duplicateOf'):
                    bits.append('dup of %s' % p['duplicateOf'])
                bits += [f for f in p['flags'] if f != 'duplicate']
                meta = ' · '.join(bits)
                color = BAD if set(p['flags']) & BAD_FLAGS else SOFT if p['flags'] else MUTED
            d.text((x + 2, y + th + 27), fit_text(d, meta, f_meta, cw - 4), font=f_meta, fill=color)
        path = os.path.join(out_dir, 'sheet-%d.jpg' % (page + 1))
        sheet.save(path, 'JPEG', quality=90)
        sheets.append({'file': path, 'photos': ['#%d %s' % (p['n'], p['name']) for p in chunk]})
    return sheets


# ─── The final sheet ──────────────────────────────────────────────────

def dashed_rect(d, box, color, width=2, dash=10):
    x0, y0, x1, y1 = box
    for (ax, ay, bx, by) in ((x0, y0, x1, y0), (x1, y0, x1, y1), (x1, y1, x0, y1), (x0, y1, x0, y0)):
        length = math.hypot(bx - ax, by - ay)
        n = max(1, int(length // dash))
        for i in range(0, n, 2):
            t0, t1 = i / n, min(1.0, (i + 1) / n)
            d.line([(ax + (bx - ax) * t0, ay + (by - ay) * t0), (ax + (bx - ax) * t1, ay + (by - ay) * t1)], fill=color, width=width)


def overlay(im, pick):
    """Crops, blur boxes and the focal point drawn on a thumbnail."""
    from PIL import Image, ImageDraw
    w, h = im.size
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    px = lambda b: (b['x'] * w, b['y'] * h, (b['x'] + b['w']) * w, (b['y'] + b['h']) * h)  # noqa: E731
    for b in pick.get('blur') or []:
        d.rectangle(px(b), fill=(230, 30, 30, 120), outline=(255, 60, 60, 255), width=2)
    crops = pick.get('crops') or {}
    if crops.get('desktop'):
        box = px(crops['desktop'])
        d.rectangle(box, outline=(0, 0, 0, 200), width=4)
        d.rectangle(box, outline=(255, 230, 90, 255), width=2)
    if crops.get('phone'):
        dashed_rect(d, px(crops['phone']), (90, 220, 255, 255), width=2)
    f = pick.get('focal')
    if f:
        cx, cy = f['x'] * w, f['y'] * h
        d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], outline=(0, 0, 0, 255), width=4)
        d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], outline=(255, 255, 255, 255), width=2)
    out = Image.alpha_composite(im.convert('RGBA'), layer)
    if pick.get('role') == 'skip':
        out = Image.alpha_composite(out, Image.new('RGBA', im.size, (0, 0, 0, 120)))
    return out.convert('RGB')


def ordered(picks, pairs):
    """Hero, about, gallery, then each pair (before, after), then the rest."""
    by_path = {p['path']: p for p in picks}
    out, seen = [], set()

    def add(p):
        if p and p['path'] not in seen:
            seen.add(p['path'])
            out.append(p)
    for role in ('hero', 'about', 'gallery'):
        for p in picks:
            if p['role'] == role:
                add(p)
    for pr in pairs:
        add(by_path.get(pr['before']))
        add(by_path.get(pr['after']))
    for role in ROLES:
        for p in picks:
            if p['role'] == role:
                add(p)
    return out


def final(photos_json, analysis, cols=5, width=1600):
    from PIL import Image, ImageDraw
    paths = {p['name']: p['path'] for p in analysis['photos']}
    picks = ordered(photos_json.get('picks') or [], photos_json.get('pairs') or [])
    margin, gap, header, label = 16, 12, 92, 46
    cw = (width - 2 * margin - (cols - 1) * gap) // cols
    th = cw * 3 // 4
    rows = max(1, math.ceil(len(picks) / cols))
    height = header + margin + rows * (th + label + gap)
    sheet = Image.new('RGB', (width, height), PAGE)
    d = ImageDraw.Draw(sheet)
    f_title, f_role, f_name, f_meta = font(24, True), font(15, True), font(15, True), font(13)
    counts = {r: sum(1 for p in picks if p['role'] == r) for r in ROLES}
    d.text((margin, 14), 'Photo desk: %d photos' % len(picks), font=f_title, fill=WHITE)
    summary = '  ·  '.join('%s %d' % (r, counts[r]) for r in ROLES if counts[r]) + '  ·  pairs %d' % len(photos_json.get('pairs') or [])
    d.text((margin, 48), summary, font=f_meta, fill=MUTED)
    lx = width - margin - 520
    d.rectangle([lx, 52, lx + 28, 66], outline=(255, 230, 90), width=2)
    d.text((lx + 36, 51), 'desktop 16:9', font=f_meta, fill=MUTED)
    dashed_rect(d, (lx + 140, 52, lx + 168, 66), (90, 220, 255), width=2, dash=5)
    d.text((lx + 176, 51), 'phone 4:5', font=f_meta, fill=MUTED)
    d.rectangle([lx + 270, 52, lx + 298, 66], fill=(200, 40, 40), outline=(255, 60, 60))
    d.text((lx + 306, 51), 'blur (to confirm)', font=f_meta, fill=MUTED)
    d.ellipse([lx + 440, 53, lx + 452, 65], outline=WHITE, width=2)
    d.text((lx + 458, 51), 'focal', font=f_meta, fill=MUTED)
    missing = []
    for k, p in enumerate(picks):
        x = margin + (k % cols) * (cw + gap)
        y = header + (k // cols) * (th + label + gap)
        d.rectangle([x, y, x + cw, y + th], fill=CELL)
        src = paths.get(p['path'])
        im = thumb(src, (cw, th)) if src else None
        if im is None:
            missing.append(p['path'])
            d.text((x + 10, y + th // 2 - 8), 'not found', font=f_meta, fill=BAD)
        else:
            im = overlay(im, p)
            sheet.paste(im, (x + (cw - im.width) // 2, y + (th - im.height) // 2))
        badge(d, (x + 6, y + 6), p['role'].upper(), f_role, ROLE_COLORS.get(p['role'], (90, 90, 90)))
        score = '%.1f' % float(p.get('score') or 0)
        sw = d.textlength(score, font=f_role) + 14
        badge(d, (x + cw - 6 - sw, y + 6), score, f_role, (0, 0, 0))
        blur = len(p.get('blur') or [])
        name = p['path'] + ('  ·  %d blur' % blur if blur else '')
        d.text((x + 2, y + th + 4), fit_text(d, name, f_name, cw - 4), font=f_name, fill=WHITE)
        d.text((x + 2, y + th + 24), fit_text(d, p.get('reason') or '', f_meta, cw - 4), font=f_meta, fill=MUTED)
    return sheet, missing


def save_capped(sheet, out):
    """PNG under MAX_FINAL_BYTES: scaled down step by step if needed."""
    from PIL import Image
    im = sheet
    for _ in range(6):
        buf = io.BytesIO()
        im.save(buf, 'PNG', optimize=True)
        if buf.tell() <= MAX_FINAL_BYTES:
            break
        im = im.resize((int(im.width * 0.85), int(im.height * 0.85)), Image.LANCZOS)
    with open(out, 'wb') as f:
        f.write(buf.getvalue())
    return im.size, buf.tell()


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('mode', choices=('review', 'final'))
    ap.add_argument('photos_json', nargs='?', help='final: photos.json')
    ap.add_argument('--analysis', required=True)
    ap.add_argument('--out-dir', default='/tmp/photos/sheets')
    ap.add_argument('--out', default='/tmp/photos/contact_sheet.png')
    ap.add_argument('--per-sheet', type=int, default=12)
    args = ap.parse_args(argv[1:])
    analysis = load_json(args.analysis)
    if args.mode == 'review':
        sheets = review(analysis, args.out_dir, per_sheet=max(1, min(20, args.per_sheet)))
        for s in sheets:
            print('%s: %s' % (s['file'], ', '.join(s['photos'])))
        print('Open each sheet with the file viewer (text editor view) to look at the photos.')
        return 0
    if not args.photos_json:
        print('final needs photos.json', file=sys.stderr)
        return 2
    sheet, missing = final(load_json(args.photos_json), analysis)
    size, nbytes = save_capped(sheet, args.out)
    print('wrote %s (%dx%d, %.1f MB)' % (args.out, size[0], size[1], nbytes / 1048576))
    if missing:
        print('not found in analysis.json: %s' % ', '.join(missing), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
