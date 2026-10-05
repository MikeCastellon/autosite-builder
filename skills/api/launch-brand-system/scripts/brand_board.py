"""Renders brand_board.png (1600x1000) from a validated brand.json.

  brand_board.py /tmp/brand/brand.json --out /tmp/brand/brand_board.png \
      [--logo LOGO_FILE] [--meta /tmp/brand/board_meta.json] [--fonts-dir DIR]

--meta is a JSON file {"name": "Business name", "headline": "..."}: customer
text goes through a file, never through the shell command line (quotes or
$(...) in a business name must not reach the shell). --name/--headline exist
for tests.

Top band: the logo, a sample headline in the heading font, body text in the
body font, an accent button and a card, all painted with the tokens the site
derives (theme.py = kit/theme.js), so the board shows what the site shows.
Bottom: the 5 swatches with hex and their contrast pairs, the light and dark
alternates, the font names.

The container has no internet and the skill bundles no font files, so the
real Google Fonts are used only when a TTF/OTF for the family is found
(--fonts-dir, /usr/share/fonts). Otherwise samples use a stand-in (DejaVu
from matplotlib, else Pillow's default font) and the board says so: the
site itself always loads the real family.
"""
import argparse
import importlib.util
import json
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from theme import contrast_ratio, derive_theme, hex_to_rgb, mix  # noqa: E402
from fonts import FAMILIES  # noqa: E402

W, H = 1600, 1000
M = 56            # outer margin
SPLIT = 470       # top band height
INK = '#18181b'   # board chrome on the light lower half
INK_SOFT = '#52525b'
LINE = '#e4e4e7'
PASS = '#15803d'
FAIL = '#b91c1c'
ROLE_INFO = {
    'bg': 'Page background',
    'secondary': 'Cards & sections',
    'text': 'Headings & body',
    'muted': 'Secondary text',
    'accent': 'Buttons & links',
}


# ─── Fonts ────────────────────────────────────────────────────────────

def _norm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())


class FontBook:
    """Finds a real TTF/OTF for a catalog family, else a stand-in."""

    def __init__(self, extra_dirs):
        dirs = list(extra_dirs) + [os.path.join(HERE, '..', 'fonts'), '/usr/share/fonts', '/usr/local/share/fonts',
                                   os.path.expanduser('~/.fonts'), os.path.expanduser('~/.local/share/fonts')]
        self.files = {}
        for d in dirs:
            if not os.path.isdir(d):
                continue
            for root, _, names in os.walk(d):
                for n in names:
                    if n.lower().endswith(('.ttf', '.otf')):
                        self.files.setdefault(_norm(os.path.splitext(n)[0]), os.path.join(root, n))
        self.standin_used = set()   # catalog families drawn with a stand-in
        self.standin_faces = set()  # the faces that stood in for them
        self._cache = {}

    def _real(self, family, bold):
        key = _norm(family)
        names = sorted(k for k in self.files if k.startswith(key))
        if not names:
            return None, False
        weight_words = ('thin', 'light', 'medium', 'semibold', 'extrabold', 'black', 'italic', 'condensed')
        if bold:
            for n in names:
                if n.endswith('bold') and not any(w in n[len(key):] for w in ('semibold', 'extrabold', 'italic')):
                    return self.files[n], False
        for n in names:
            rest = n[len(key):]
            if rest in ('', 'regular') or (not bold and rest == 'book'):
                return self.files[n], False
        for n in names:  # variable font: Family[wght] / Family-VariableFont_wght
            if 'variable' in n or 'wght' in n:
                return self.files[n], True
        plain = [n for n in names if not any(w in n[len(key):] for w in weight_words)]
        return (self.files[(plain or names)[0]], False)

    def _standin_path(self, category, bold):
        base = {'serif': 'DejaVuSerif', 'mono': 'DejaVuSansMono'}.get(category, 'DejaVuSans')
        name = base + ('-Bold' if bold else '') + '.ttf'
        spec = importlib.util.find_spec('matplotlib')
        dirs = []
        if spec and spec.origin:
            dirs.append(os.path.join(os.path.dirname(spec.origin), 'mpl-data', 'fonts', 'ttf'))
        dirs += ['/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/dejavu', '/usr/share/fonts/TTF']
        for d in dirs:
            p = os.path.join(d, name)
            if os.path.isfile(p):
                return p
        return None

    def get(self, family, size, bold=False):
        """(font, label of the face actually drawn)."""
        ck = (family, size, bold)
        if ck in self._cache:
            return self._cache[ck]
        category = FAMILIES.get(family, {}).get('category', 'sans')
        path, variable = self._real(family, bold)
        if path:
            try:
                font = ImageFont.truetype(path, size)
                if variable and bold:
                    try:
                        font.set_variation_by_axes([700])
                    except Exception:
                        pass
                out = (font, family)
                self._cache[ck] = out
                return out
            except OSError:
                pass
        self.standin_used.add(family)
        sp = self._standin_path(category, bold)
        if sp:
            face = re.sub(r'-Bold$', '', os.path.splitext(os.path.basename(sp))[0])
            face = {'DejaVuSans': 'DejaVu Sans', 'DejaVuSerif': 'DejaVu Serif', 'DejaVuSansMono': 'DejaVu Sans Mono'}.get(face, face)
            out = (ImageFont.truetype(sp, size), face)
        else:
            try:
                out = (ImageFont.load_default(size=size), "Pillow's default font")
            except TypeError:  # Pillow < 10.1: fixed-size bitmap font
                out = (ImageFont.load_default(), "Pillow's default font")
        self.standin_faces.add(out[1])
        self._cache[ck] = out
        return out

    def chrome(self, size, bold=False):
        """Board labels: always the stand-in sans, never counted as a sample."""
        sp = self._standin_path('sans', bold)
        if sp:
            return ImageFont.truetype(sp, size)
        try:
            return ImageFont.load_default(size=size)
        except TypeError:
            return ImageFont.load_default()


# ─── Drawing helpers ──────────────────────────────────────────────────

def text_w(draw, s, font):
    try:
        return draw.textlength(s, font=font)
    except AttributeError:
        return draw.textbbox((0, 0), s, font=font)[2]


def put(draw, xy, s, font, fill, anchor='la'):
    """draw.text with an anchor; Pillow's old bitmap font has no anchors,
    so center it by its bounding box instead."""
    try:
        draw.text(xy, s, font=font, fill=fill, anchor=anchor)
    except ValueError:
        x0, y0, x1, y1 = draw.textbbox((0, 0), s, font=font)
        x, y = xy
        if anchor[0] == 'm':
            x -= (x1 - x0) / 2
        if anchor[1] == 'm':
            y -= (y1 - y0) / 2
        draw.text((x, y), s, font=font, fill=fill)


def wrap(draw, s, font, width, max_lines):
    words, lines, cur = s.split(), [], ''
    for word in words:
        trial = (cur + ' ' + word).strip()
        if text_w(draw, trial, font) <= width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while lines[-1] and text_w(draw, lines[-1] + '…', font) > width:
            lines[-1] = lines[-1][:-1]
        lines[-1] = lines[-1].rstrip() + '…'
    return lines


def fit_lines(draw, book, family, s, width, max_lines, size, min_size, bold):
    """Largest size (down to min_size) at which s fits in max_lines."""
    while True:
        font, _ = book.get(family, size, bold)
        lines = wrap(draw, s, font, width, max_lines + 1)
        if len(lines) <= max_lines or size <= min_size:
            return font, wrap(draw, s, font, width, max_lines), size
        size -= 4


def line_h(font, size):
    try:
        a, d = font.getmetrics()
        return a + d
    except Exception:
        return size + 4


def paste_logo(board, draw, logo_path, box, page_bg):
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    img = None
    if logo_path:
        try:
            from extract_palette import load_image
            img = load_image(logo_path)[0]
        except Exception as e:
            print('logo not drawn: %s' % e, file=sys.stderr)
    if img is None:
        draw.rounded_rectangle(box, radius=16, outline=mix(page_bg, '#888888', 0.6), width=2)
        return 'unreadable' if logo_path else 'none'
    # The logo on its own transparent pixels needs a tile it shows up on.
    # Pick the tile (page color first) on which the most logo pixels stay
    # visible: a black wordmark vanishes on a dark page, a white one on white.
    rgba = img.convert('RGBA')
    sample = rgba.resize((96, 96), Image.NEAREST)
    opaque = [px[:3] for px in sample.getdata() if px[3] > 128]
    has_alpha = any(px[3] < 250 for px in sample.getdata())
    tile = page_bg
    if has_alpha and opaque:
        def visible(bg):
            return sum(contrast_ratio('#%02x%02x%02x' % c, bg) >= 1.6 for c in opaque) / len(opaque)
        best = max(('#f4f4f5', '#18181b'), key=visible)
        if visible(page_bg) < 0.95 and visible(best) > visible(page_bg):
            tile = best
    draw.rounded_rectangle(box, radius=16, fill=tile, outline=mix(page_bg, '#888888', 0.35), width=1)
    pad = 24
    k = min((bw - 2 * pad) / rgba.width, (bh - 2 * pad) / rgba.height)
    thumb = rgba.resize((max(1, int(rgba.width * k)), max(1, int(rgba.height * k))), Image.LANCZOS)
    board.paste(thumb, (x0 + (bw - thumb.width) // 2, y0 + (bh - thumb.height) // 2), thumb)
    return 'drawn'


# ─── Board ────────────────────────────────────────────────────────────

def render(brand, out, logo=None, name='', headline='', font_dirs=()):
    pal = brand['palette']
    fonts = brand['fonts']
    t = derive_theme(pal)
    book = FontBook(font_dirs)
    board = Image.new('RGB', (W, H), '#fafafa')
    draw = ImageDraw.Draw(board)

    # Top band: the brand in use.
    draw.rectangle([0, 0, W, SPLIT], fill=t['bg'])
    logo_box = (M, M, M + 380, M + 250)
    logo_state = paste_logo(board, draw, logo, logo_box, t['bg'])
    if logo_state != 'drawn':
        f = book.chrome(22)
        msg = 'No logo provided' if logo_state == 'none' else 'Logo file not drawable here'
        draw.text((M + (380 - text_w(draw, msg, f)) / 2, M + 112), msg, font=f, fill=t['textMuted'])

    x = M + 380 + 48
    width = W - M - x
    eyebrow_font, _ = book.get(fonts['body'], 22, True)
    eyebrow = ('BRAND SYSTEM' + (' · ' + name if name else '')).upper()
    draw.text((x, M), wrap(draw, eyebrow, eyebrow_font, width, 1)[0], font=eyebrow_font, fill=t['accentText'])

    head = headline or name or 'Your headline here'
    hfont, hlines, hsize = fit_lines(draw, book, fonts['heading'], head, width, 2, 76, 40, True)
    y = M + 44
    for ln in hlines:
        draw.text((x, y), ln, font=hfont, fill=t['text'])
        y += int(line_h(hfont, hsize) * 0.98)

    bfont, _ = book.get(fonts['body'], 26, False)
    body = 'Body text sample: services, prices and hours are set in this face, sized for easy reading on a phone.'
    y += 10
    for ln in wrap(draw, body, bfont, width, 2):
        draw.text((x, y), ln, font=bfont, fill=t['textMuted'])
        y += line_h(bfont, 26) + 4

    # Button, link and card on the derived tokens.
    y = max(y + 20, 318)
    btn_font, _ = book.get(fonts['body'], 24, True)
    label = 'Book now'
    bw = int(text_w(draw, label, btn_font)) + 64
    draw.rounded_rectangle([x, y, x + bw, y + 60], radius=10, fill=t['accent'])
    put(draw, (x + 32, y + 30), label, btn_font, t['onAccent'], 'lm')
    lx = x + bw + 32
    link_font, _ = book.get(fonts['body'], 22, True)
    put(draw, (lx, y + 30), 'View services', link_font, t['accentText'], 'lm')
    lw = text_w(draw, 'View services', link_font)
    draw.line([lx, y + 44, lx + lw, y + 44], fill=t['accentText'], width=2)
    cx = int(lx + lw + 40)
    if cx + 260 <= W - M:
        draw.rounded_rectangle([cx, y - 16, W - M, y + 76], radius=12, fill=t['surface'])
        cf, _ = book.get(fonts['heading'], 24, True)
        mf, _ = book.get(fonts['body'], 19, False)
        draw.text((cx + 22, y + 2), 'Card title', font=cf, fill=t['text'])
        draw.text((cx + 22, y + 38), 'Muted detail on the card', font=mf, fill=t['textMuted'])

    # Bottom: swatches.
    label_font = book.chrome(20, True)
    small = book.chrome(18)
    hexf = book.chrome(22)
    draw.text((M, SPLIT + 26), 'PALETTE', font=label_font, fill=INK_SOFT)
    ratios = {
        'bg': [('text', contrast_ratio(t['text'], t['bg'])), ('muted', contrast_ratio(t['textMuted'], t['bg']))],
        'secondary': [('text on it', contrast_ratio(t['text'], t['surface']))],
        'text': [('on bg', contrast_ratio(t['text'], t['bg']))],
        'muted': [('on bg', contrast_ratio(t['textMuted'], t['bg']))],
        'accent': [('label', contrast_ratio(t['onAccent'], t['accent']))],
    }
    sw = (W - 2 * M - 4 * 24) // 5
    top = SPLIT + 62
    shown = {'bg': t['bg'], 'secondary': t['surface'], 'text': t['text'], 'muted': t['textMuted'], 'accent': t['accent']}
    for i, role in enumerate(('bg', 'secondary', 'text', 'muted', 'accent')):
        sx = M + i * (sw + 24)
        draw.rounded_rectangle([sx, top, sx + sw, top + 132], radius=12, fill=shown[role], outline=LINE, width=1)
        if role == 'accent':
            put(draw, (sx + sw / 2, top + 66), 'Aa', book.chrome(34, True), t['onAccent'], 'mm')
        draw.text((sx, top + 146), role, font=label_font, fill=INK)
        dx = text_w(draw, role, label_font) + 10
        draw.text((sx + dx, top + 148), wrap(draw, ROLE_INFO[role], small, sw - dx, 1)[0], font=small, fill=INK_SOFT)
        draw.text((sx, top + 174), shown[role], font=hexf, fill=INK)
        ry = top + 206
        for what, r in ratios[role]:
            ok = r >= 4.5
            s = '%s %.2f:1' % (what, r)
            draw.text((sx, ry), s, font=small, fill=INK_SOFT)
            draw.text((sx + text_w(draw, s, small) + 8, ry), 'AA' if ok else 'FAIL', font=book.chrome(18, True), fill=PASS if ok else FAIL)
            ry += 24

    # Alternates.
    top2 = SPLIT + 320
    pw = (W - 2 * M - 24) // 2
    main_mode = 'dark' if t['isDark'] else 'light'
    for j, mode in enumerate(('light', 'dark')):
        alt = (brand.get('alternates') or {}).get(mode)
        px = M + j * (pw + 24)
        if not isinstance(alt, dict):
            continue
        at = derive_theme(alt)
        draw.rounded_rectangle([px, top2, px + 300, top2 + 136], radius=12, fill=at['bg'], outline=LINE, width=1)
        draw.rounded_rectangle([px + 180, top2 + 18, px + 284, top2 + 118], radius=8, fill=at['surface'])
        hf, _ = book.get(fonts['heading'], 30, True)
        draw.text((px + 18, top2 + 16), 'Aa Title', font=hf, fill=at['text'])
        mf, _ = book.get(fonts['body'], 17, False)
        draw.text((px + 18, top2 + 60), 'Muted line', font=mf, fill=at['textMuted'])
        draw.rounded_rectangle([px + 18, top2 + 90, px + 110, top2 + 120], radius=6, fill=at['accent'])
        put(draw, (px + 64, top2 + 105), 'Book', book.chrome(16, True), at['onAccent'], 'mm')
        draw.text((px + 194, top2 + 40), 'Card', font=book.chrome(16, True), fill=at['text'])
        draw.text((px + 194, top2 + 64), 'detail', font=book.chrome(15), fill=at['textMuted'])
        title = '%s alternate%s' % (mode.capitalize(), ' (this palette)' if mode == main_mode and alt == pal else '')
        draw.text((px + 324, top2 + 2), title, font=label_font, fill=INK)
        for k, role in enumerate(('bg', 'secondary', 'text', 'muted', 'accent')):
            cx0 = px + 324 + k * 80
            draw.rounded_rectangle([cx0, top2 + 38, cx0 + 64, top2 + 92], radius=8, fill=alt[role], outline=LINE, width=1)
            draw.text((cx0, top2 + 100), alt[role], font=book.chrome(14), fill=INK_SOFT)
            draw.text((cx0, top2 + 118), role, font=book.chrome(13), fill=INK_SOFT)

    # Fonts line, and whether the samples above used the real faces.
    hf_meta = FAMILIES.get(fonts['heading'], {})
    bf_meta = FAMILIES.get(fonts['body'], {})
    line = 'Heading: %s (%s)    Body: %s (%s)' % (fonts['heading'], hf_meta.get('category', '?'), fonts['body'], bf_meta.get('category', '?'))
    if book.standin_used:
        note = 'Samples use %s in place of %s; the site loads the real fonts.' % (
            ' and '.join(sorted(book.standin_faces)), ' and '.join(sorted(book.standin_used)))
    else:
        note = 'Samples drawn in the real fonts.'
    nf = book.chrome(16)
    note_w = text_w(draw, note, nf)
    if M + text_w(draw, line, label_font) + 32 + note_w <= W - M:
        draw.text((M, H - 52), line, font=label_font, fill=INK)
        draw.text((W - M - note_w, H - 48), note, font=nf, fill=INK_SOFT)
    else:  # long family names: the note goes on its own line
        draw.text((M, H - 58), line, font=label_font, fill=INK)
        draw.text((M, H - 30), wrap(draw, note, nf, W - 2 * M, 1)[0], font=nf, fill=INK_SOFT)

    board.save(out, 'PNG', optimize=True)
    return {'out': out, 'size': list(board.size), 'standIn': sorted(book.standin_used), 'logo': logo_state}


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('brand')
    ap.add_argument('--out', required=True)
    ap.add_argument('--logo', default=None, help='logo file (any format extract_palette.py decodes)')
    ap.add_argument('--meta', default=None, help='JSON file {"name", "headline"} (preferred for customer text)')
    ap.add_argument('--name', default='', help='business name for the eyebrow and default headline')
    ap.add_argument('--headline', default='', help='sample headline (defaults to the business name)')
    ap.add_argument('--fonts-dir', action='append', default=[], help='folder with real TTF/OTF files (repeatable)')
    args = ap.parse_args(argv[1:])
    with open(args.brand, encoding='utf-8') as f:
        brand = json.load(f)
    pal = brand.get('palette') if isinstance(brand, dict) else None
    if not isinstance(pal, dict) or not all(hex_to_rgb(pal.get(r)) for r in ('bg', 'secondary', 'text', 'muted', 'accent')) \
            or not isinstance(brand.get('fonts'), dict):
        print('brand.json has no usable palette/fonts: run validate_brand.py first', file=sys.stderr)
        return 1
    name, headline = args.name, args.headline
    if args.meta:
        with open(args.meta, encoding='utf-8') as f:
            meta = json.load(f)
        name = str(meta.get('name') or name)
        headline = str(meta.get('headline') or headline)
    # One line each: the board has room for one eyebrow and a 2-line headline.
    name = ' '.join(name.split())[:80]
    headline = ' '.join(headline.split())[:120]
    info = render(brand, args.out, args.logo, name, headline, args.fonts_dir)
    print(json.dumps(info))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
