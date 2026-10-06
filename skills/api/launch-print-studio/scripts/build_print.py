"""Builds the print pieces and print.json from print-inputs.json.

  build_print.py --inputs <dir>/print-inputs.json --out /tmp/print [--copy /tmp/print/copy.json]

Reads the logo and font files named in print-inputs.json from the same folder
(or --files-dir). Writes into --out: one PDF per piece (0.125 in bleed, crop
marks, TrimBox/BleedBox, vector QR codes) and print.json (the pieces, every
code's exact target, every printed line, fonts, colors, notes). The review
pieces are only made when links.review is set; otherwise print.json says why.

Exit 1 with the problems listed when copy.json is invalid or a printed line
carries a claim the facts don't back (fix copy.json and run it again).
"""
import argparse
import json
import math
import os
import tempfile
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import printkit as K  # noqa: E402

I = K.INCH


def colors_mod():
    from reportlab.lib import colors
    return colors


# ─── Logo ───────────────────────────────────────────────────────────────

class Logo:
    """The customer's logo, cropped to its visible part and saved as RGBA PNG."""

    def __init__(self, path, workdir):
        import numpy as np
        from PIL import Image
        im = Image.open(path)
        if getattr(im, 'is_animated', False):
            im.seek(0)
        im = im.convert('RGBA')
        arr = np.asarray(im).astype(int)
        alpha = arr[:, :, 3]
        self.has_alpha = int(alpha.min()) < 250
        if self.has_alpha:
            visible = alpha > 128
            self.bg = None
        else:
            corners = [arr[0, 0, :3], arr[0, -1, :3], arr[-1, 0, :3], arr[-1, -1, :3]]
            bg = np.median(np.array(corners), axis=0)
            self.bg = K.rgb_to_hex(bg)
            visible = np.abs(arr[:, :, :3] - bg).sum(axis=2) > 36
        ys, xs = np.nonzero(visible)
        if len(xs):
            x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            if not self.has_alpha:
                # Keep a little of its own background around an opaque logo.
                m = int(0.04 * max(x1 - x0, y1 - y0))
                x0, y0 = max(0, x0 - m), max(0, y0 - m)
                x1, y1 = min(im.width, x1 + m), min(im.height, y1 + m)
            im = im.crop((int(x0), int(y0), int(x1), int(y1)))
            ink = arr[visible][:, :3].mean(axis=0)
            self.ink = K.rgb_to_hex(ink)
            # The visible pixels' luminance, to see how much of the logo a
            # background would swallow (a mean color hides white lettering
            # next to a red badge).
            px = arr[visible][:, :3] / 255.0
            lin = np.where(px <= 0.03928, px / 12.92, ((px + 0.055) / 1.055) ** 2.4)
            lum = 0.2126 * lin[:, 0] + 0.7152 * lin[:, 1] + 0.0722 * lin[:, 2]
            step = max(1, len(lum) // 20000)
            self.lum = lum[::step]
        else:
            self.ink = '#000000'
            self.lum = np.array([0.0])
        self.px = im.size
        self.path = os.path.join(workdir, '_logo.png')
        im.save(self.path)
        self.min_ppi = None

    def aspect(self):
        return self.px[0] / float(self.px[1])

    def pad_for(self, on, mode):
        """The pad color behind the logo on `on`, or None."""
        if mode == 'never':
            return None
        if not self.has_alpha:
            if mode == 'always' or K.contrast(self.bg, on) > 1.15:
                return self.bg
            return None
        if mode == 'always' or self.lost_on(on) > 0.12:
            return min(('#ffffff', '#111111'), key=self.lost_on)
        return None

    def lost_on(self, bg):
        """The share of the logo's visible pixels that barely show on bg (under 1.6:1)."""
        import numpy as np
        lb = K.luminance(bg)
        ratio = (np.maximum(self.lum, lb) + 0.05) / (np.minimum(self.lum, lb) + 0.05)
        return float((ratio < 1.6).mean()) if len(self.lum) else 0.0


# ─── Sheet: one PDF ─────────────────────────────────────────────────────

class Sheet:
    def __init__(self, path, piece, fonts, business):
        from reportlab.pdfgen import canvas
        colors = colors_mod()
        self.piece = piece
        self.W, self.H = float(piece['w']), float(piece['h'])
        self.fonts = fonts
        pw, ph = (self.W + 2 * K.SLUG) * I, (self.H + 2 * K.SLUG) * I
        self.c = canvas.Canvas(path, pagesize=(pw, ph), initialFontName=fonts.names['B'], initialFontSize=8, pageCompression=1)
        self.c.setTitle('%s - %s' % (business, piece['name']))
        self.c.setAuthor(business)
        self.c.setSubject('%s, trim %s, bleed %.3f in, crop marks' % (piece['name'], piece['size'], K.BLEED))
        self.c.setCreator('launch-print-studio')
        s, b = K.SLUG * I, (K.SLUG - K.BLEED) * I
        self.c.setTrimBox([s, s, pw - s, ph - s])
        self.c.setBleedBox([b, b, pw - b, ph - b])
        self.qr_count = 0
        self.black = colors.CMYKColor(0, 0, 0, 1)
        self.registration = colors.CMYKColorSep(1, 1, 1, 1, spotName='All', density=1)
        self.diecut = colors.CMYKColorSep(0, 1, 0, 0, spotName='DieCut', density=1)
        self.slug_ink = colors.CMYKColor(0, 0, 0, 0.7)

    def col(self, h):
        return colors_mod().HexColor(h)

    def begin(self):
        c = self.c
        c.saveState()
        c.translate(K.SLUG * I, K.SLUG * I)
        p = c.beginPath()
        p.rect(-K.BLEED * I, -K.BLEED * I, (self.W + 2 * K.BLEED) * I, (self.H + 2 * K.BLEED) * I)
        c.clipPath(p, stroke=0, fill=0)

    def end(self, label):
        c = self.c
        c.restoreState()
        c.saveState()
        c.translate(K.SLUG * I, K.SLUG * I)
        self.crop_marks()
        r = K.fit(self.fonts, label, 'B', self.W - 0.3, 5, 3.5)
        c.setFillColor(self.slug_ink)
        c.setFont(r['name'], r['size'])
        c.drawCentredString(self.W / 2 * I, -(K.BLEED + K.MARK_OFFSET + K.MARK_LEN / 2 + 0.02) * I, r['lines'][0])
        c.restoreState()
        c.showPage()

    def crop_marks(self):
        # In the page itself, not a form: reportlab gives forms no
        # /ColorSpace resource, and the marks use the /All separation.
        c = self.c
        c.setStrokeColor(self.registration)
        c.setLineWidth(0.25)
        a = K.BLEED + K.MARK_OFFSET
        b = a + K.MARK_LEN
        for x in (0.0, self.W):
            for y in (0.0, self.H):
                sx = -1 if x == 0 else 1
                sy = -1 if y == 0 else 1
                c.line((x + sx * a) * I, y * I, (x + sx * b) * I, y * I)
                c.line(x * I, (y + sy * a) * I, x * I, (y + sy * b) * I)

    # Drawing in inches from the trim's lower-left corner.
    def rect(self, x, y, w, h, color, r=0):
        c = self.c
        c.setFillColor(self.col(color))
        if r:
            c.roundRect(x * I, y * I, w * I, h * I, r * I, stroke=0, fill=1)
        else:
            c.rect(x * I, y * I, w * I, h * I, stroke=0, fill=1)

    def flood(self, color):
        self.rect(-K.BLEED, -K.BLEED, self.W + 2 * K.BLEED, self.H + 2 * K.BLEED, color)

    def text(self, res, x, y_top, color, align='center'):
        """Draws a fit() result from y_top down; returns the bottom."""
        c = self.c
        a, d = self.fonts.metrics(res['name'], res['size'])
        lead = res['size'] * 1.18 / I
        c.setFillColor(self.col(color))
        c.setFont(res['name'], res['size'])
        y = y_top - a
        for line in res['lines']:
            if align == 'left':
                c.drawString(x * I, y * I, line)
            elif align == 'right':
                c.drawRightString(x * I, y * I, line)
            else:
                c.drawCentredString(x * I, y * I, line)
            y -= lead
        return y_top - text_height(self.fonts, res)

    def qr(self, kind, payload, x, y, size):
        """A vector code, its quiet zone on a white pad: { modules, ... }."""
        c = self.c
        modules, version = K.qr_matrix(payload)
        n = len(modules)
        module = size / float(n)
        quiet = K.QUIET * module
        c.setFillColor(self.col('#ffffff'))
        c.roundRect((x - quiet) * I, (y - quiet) * I, (size + 2 * quiet) * I, (size + 2 * quiet) * I, min(quiet, 0.06) * I, stroke=0, fill=1)
        self.qr_count += 1
        name = 'QR_%s_%d' % (kind, self.qr_count)
        c.beginForm(name, 0, 0, n, n)
        c.setFillColor(self.black)
        p = c.beginPath()
        for r, row in enumerate(modules):
            col = 0
            while col < n:
                if row[col]:
                    start = col
                    while col < n and row[col]:
                        col += 1
                    p.rect(start, n - 1 - r, col - start, 1)
                else:
                    col += 1
        c.drawPath(p, stroke=0, fill=1)
        c.endForm()
        c.saveState()
        c.translate(x * I, y * I)
        c.scale(module * I, module * I)
        c.doForm(name)
        c.restoreState()
        return {'modules': n, 'version': version, 'moduleIn': module, 'quietIn': quiet}

    def logo(self, logo, x, y, w, h, pad, pad_in):
        c = self.c
        if pad:
            self.rect(x - pad_in, y - pad_in, w + 2 * pad_in, h + 2 * pad_in, pad, r=min(0.08, pad_in))
        c.drawImage(logo.path, x * I, y * I, w * I, h * I, mask='auto')
        ppi = logo.px[0] / w
        logo.min_ppi = ppi if logo.min_ppi is None else min(logo.min_ppi, ppi)

    def die_line(self):
        piece = self.piece
        c = self.c
        c.setStrokeColor(self.diecut)
        c.setLineWidth(0.5)
        p = c.beginPath()
        p.roundRect(0, 0, self.W * I, self.H * I, piece.get('cornerIn', 0) * I)
        hole = piece.get('hole')
        if hole:
            cx, cy, rad = hole['cx'], self.H - hole['fromTop'], hole['d'] / 2.0
            p.circle(cx * I, cy * I, rad * I)
            a = math.radians(hole.get('slitDeg', 45))
            x0, y0 = cx + rad * math.cos(a), cy + rad * math.sin(a)
            t = min((self.W - x0) / math.cos(a), (self.H - y0) / math.sin(a))
            p.moveTo(x0 * I, y0 * I)
            p.lineTo((x0 + t * math.cos(a)) * I, (y0 + t * math.sin(a)) * I)
        c.drawPath(p, stroke=1, fill=0)

    def save(self):
        self.c.save()


def text_height(fonts, res):
    a, d = fonts.metrics(res['name'], res['size'])
    return a - d + (len(res['lines']) - 1) * res['size'] * 1.18 / I


# ─── Vertical stacks ────────────────────────────────────────────────────
# A page side is a column of items (text, a code, the logo, a rule) laid out
# top to bottom in a box; items are fitted at a scale, and the scale drops
# until the column fits.

class Builder:
    def __init__(self, ctx, sheet):
        self.ctx = ctx
        self.sheet = sheet
        self.fonts = ctx['fonts']
        self.lines = []      # every printed line (logical text), for print.json
        self.codes = []      # [{ kind, label, url, vcard, sizeIn, page }]
        self.problems = []   # clipped text and the like

    def text_item(self, text, role, width, max_size, min_size, color, max_lines=1, gap=0.06, align='center', optional=False):
        text = self.fonts.printable(K.one_line(text, 200))
        if not text:
            return None
        return {'type': 'text', 'text': text, 'role': role, 'width': width, 'max': max_size, 'min': min_size,
                'color': color, 'lines': max_lines, 'gap': gap, 'align': align, 'optional': optional}

    def measure(self, item, scale):
        if item['type'] == 'text':
            res = K.fit(self.fonts, item['text'], item['role'], item['width'], max(item['min'], item['max'] * scale), item['min'], item['lines'])
            item['res'] = res
            return text_height(self.fonts, res)
        return item['h']

    def column(self, items, x, width, top, bottom, page):
        items = [it for it in items if it]
        avail = top - bottom
        for scale in (1, 0.92, 0.85, 0.78, 0.7, 0.62):
            heights = [self.measure(it, scale) for it in items]
            gaps = [it.get('gap', 0.06) for it in items[1:]]
            need = sum(heights) + sum(gaps)
            if need <= avail + 1e-6:
                break
        extra = max(0.0, avail - need)
        # Spread the room: gaps grow up to 2.5x, the rest centers the column.
        grow = min(extra, sum(gaps) * 1.5) if gaps else 0.0
        gaps = [g + (grow * g / sum(gaps) if sum(gaps) else 0) for g in gaps]
        y = top - (extra - grow) / 2.0
        if need > avail + 1e-6:
            self.problems.append('%s: the %s side is %.2f in too tall' % (self.sheet.piece['name'], page, need - avail))
        for i, it in enumerate(items):
            if i:
                y -= gaps[i - 1]
            h = heights[i]
            cx = x + width / 2.0
            if it['type'] == 'text':
                res = it['res']
                ax = cx if it['align'] == 'center' else (x if it['align'] == 'left' else x + width)
                self.sheet.text(res, ax, y, it['color'], it['align'])
                # The text as written; a cut one as printed.
                printed = (' '.join(res['lines']) if res['clipped'] else it['text'])[:K.LIMITS['text']]
                self.lines.append(printed)
                if res['clipped']:
                    shown = it['text'] if len(it['text']) <= 50 else it['text'][:48].rstrip() + '…'
                    self.problems.append('%s, %s: "%s" was cut to fit%s' % (
                        self.sheet.piece['name'], page, shown, ' (shorten or drop it in copy.json)' if it['optional'] else ''))
            elif it['type'] == 'qr':
                size = it['size']
                qx = cx - size / 2.0 if it.get('align', 'center') == 'center' else x
                quiet = it['quiet']
                info = self.sheet.qr(it['kind'], it['payload'], qx, y - quiet - size, size)
                self.code(it, info, page)
            elif it['type'] == 'logo':
                lx = cx - it['w'] / 2.0
                self.sheet.logo(self.ctx['logo'], lx, y - it['pad'] - it['lh'], it['w'], it['lh'], it['padColor'], it['pad'])
            elif it['type'] == 'rule':
                rx = it['left'] if it.get('left') is not None else cx - it['w'] / 2.0
                self.sheet.rect(rx, y - h, it['w'], h, it['color'])
            y -= h
        return y

    def code(self, it, info, page):
        kind = it['kind']
        self.codes.append({
            'label': it['label'], 'kind': kind,
            'url': '' if kind == 'contact' else it['payload'],
            'vcard': it['payload'] if kind == 'contact' else '',
            'sizeIn': round(it['size'], 3), 'page': page,
            'modules': info['modules'], 'moduleMm': round(info['moduleIn'] * 25.4, 3),
        })

    def qr_item(self, kind, payload, size, label, gap=0.1):
        # The quiet zone is part of the item, so spacing never eats into it.
        n = qr_modules(payload)
        quiet = K.QUIET * size / n
        return {'type': 'qr', 'kind': kind, 'payload': payload, 'size': size, 'label': label, 'quiet': quiet,
                'h': size + 2 * quiet, 'gap': gap}

    def logo_item(self, max_w, max_h, on, gap=0.06):
        logo = self.ctx['logo']
        if not logo:
            return None
        pad_color = logo.pad_for(on, self.ctx['copy'].get('logoPad', 'auto'))
        pad = 0.07 if max_h < 1 else 0.1
        if pad_color:
            max_w, max_h = max_w - 2 * pad, max_h - 2 * pad
        w = min(max_w, max_h * logo.aspect())
        lh = w / logo.aspect()
        if not pad_color:
            pad = 0.0
        return {'type': 'logo', 'w': w, 'lh': lh, 'h': lh + 2 * pad, 'pad': pad, 'padColor': pad_color, 'gap': gap}

    def rule(self, w, color, gap=0.06, h=0.025):
        return {'type': 'rule', 'w': w, 'h': h, 'color': color, 'gap': gap}


def qr_modules(payload):
    return len(K.qr_matrix(payload)[0])


# ─── Words ──────────────────────────────────────────────────────────────

def word(ctx, key):
    choice = ctx['copy'].get(key) or K.WORDING[key][0]
    return choice.replace('{name}', ctx['business']['name'])


def place_line(b):
    if b.get('address'):
        return b['address'] if not b.get('city') or b['city'].lower() in b['address'].lower() else '%s, %s' % (b['address'], ', '.join(x for x in (b.get('city'), b.get('state')) if x))
    if b.get('serviceArea') and len(b['serviceArea']) <= 40:
        return 'Serving %s' % b['serviceArea']
    return ', '.join(x for x in (b.get('city'), b.get('state')) if x)


def default_tagline(b):
    t = b.get('type') or ''
    where = ', '.join(x for x in (b.get('city'), b.get('state')) if x)
    if t and where and len('%s in %s' % (t, where)) <= K.LIMITS['tagline']:
        return '%s in %s' % (t, where)
    return t


def rebook_ask(kind):
    return K.WORDING['rebookAsk'].get(kind, '')


# ─── The pieces ─────────────────────────────────────────────────────────

def hang_tag(ctx, sheet):
    t, b, links = ctx['theme'], ctx['business'], ctx['links']
    piece = sheet.piece
    W, H = sheet.W, sheet.H
    hole = piece['hole']
    top = H - hole['fromTop'] - hole['d'] / 2.0 - hole['clearIn']
    x, width = K.SAFE + 0.1, W - 2 * (K.SAFE + 0.1)
    bld = Builder(ctx, sheet)
    review_size = piece['qr']['front']['sizeIn']
    rebook_size = piece['qr']['back']['sizeIn']

    sheet.begin()
    sheet.flood(t.panel)
    items = [
        bld.text_item(word(ctx, 'reviewHeadline'), 'H', width, 26, 14, t.ink, 2),
        bld.text_item(word(ctx, 'reviewAsk'), 'B', width, 11, 8, t.ink, 2, gap=0.08),
        bld.qr_item('review', links['review'], review_size, word(ctx, 'reviewAsk'), gap=0.16),
        bld.text_item(word(ctx, 'reviewHelp'), 'B', width, 8, 6.5, t.muted, 2, gap=0.1),
        bld.text_item(word(ctx, 'reviewThanks'), 'B', width, 9.5, 7, t.ink, 3, gap=0.2),
        # The thanks line names the business, so the logo (or the name) closes the column.
        bld.logo_item(2.3, 0.75, t.panel, gap=0.16) if ctx['logo'] else bld.text_item(b['name'], 'H', width, 16, 9, t.ink, 2, gap=0.16),
        bld.text_item(ctx['siteLabel'], 'B', width, 8, 6.5, t.muted, 2, gap=0.05),
    ]
    bld.column(items, x, width, top, 0.62, 'front')
    rm = bld.text_item(K.WORDING['removeBeforeDriving'], 'B', width, 7, 6, t.muted)
    bld.column([rm], x, width, 0.5, K.SAFE + 0.12, 'front')
    sheet.end('%s | front | trim %s | bleed %.3f in' % (piece['name'], piece['size'], K.BLEED))

    sheet.begin()
    sheet.flood(t.paper)
    rebook = ctx['rebook']
    items = [
        bld.text_item(word(ctx, 'rebookHeadline'), 'H', width, 22, 12, t.ink_paper, 2),
        bld.rule(0.6, t.rule_paper, gap=0.08),
        bld.text_item(rebook_ask(rebook), 'B', width, 10.5, 8, t.ink_paper, 2, gap=0.1) if rebook else None,
        bld.qr_item(rebook, links[rebook], rebook_size, rebook_ask(rebook), gap=0.14) if rebook else None,
        bld.text_item(b.get('phone'), 'BB', width, 13, 8, t.ink_paper, 1, gap=0.18),
        bld.text_item(ctx['siteLabel'], 'B', width, 9, 6.5, t.accent_on_paper, 2, gap=0.05),
        bld.text_item(ctx['tagline'], 'B', width, 8.5, 6.5, t.muted_paper, 2, gap=0.12, optional=True),
        bld.logo_item(2.2, 0.65, t.paper, gap=0.2) if ctx['logo'] else bld.text_item(b['name'], 'H', width, 13, 8, t.ink_paper, 2, gap=0.2),
    ]
    bld.column(items, x, width, top, 0.62, 'back')
    rm = bld.text_item(K.WORDING['removeBeforeDriving'], 'B', width, 7, 6, t.muted_paper)
    bld.column([rm], x, width, 0.5, K.SAFE + 0.12, 'back')
    sheet.end('%s | back | trim %s | bleed %.3f in' % (piece['name'], piece['size'], K.BLEED))

    sheet.begin()
    sheet.die_line()
    sheet.end('DIE-LINE, cut path only (spot color DieCut): do not print | %s | hole %.2f in' % (piece['size'], hole['d']))
    return bld


def counter_card(ctx, sheet):
    t, b, links = ctx['theme'], ctx['business'], ctx['links']
    piece = sheet.piece
    W, H = sheet.W, sheet.H
    x, width = K.SAFE + 0.15, W - 2 * (K.SAFE + 0.15)
    bld = Builder(ctx, sheet)
    band_h = 0.85
    band = t.panel if t.panel != t.paper else t.accent
    band_ink = t.ink if band == t.panel else t.on_accent
    band_muted = t.muted if band == t.panel else t.on_accent

    sheet.begin()
    sheet.flood(t.paper)
    sheet.rect(-K.BLEED, -K.BLEED, W + 2 * K.BLEED, band_h + K.BLEED, band)
    head = bld.logo_item(2.6, 0.7, t.paper, gap=0.06) if ctx['logo'] else bld.text_item(b['name'], 'H', width, 20, 10, t.ink_paper, 2)
    items = [
        head,
        bld.text_item(word(ctx, 'reviewHeadline'), 'H', width, 28, 14, t.ink_paper, 2, gap=0.2),
        bld.text_item(word(ctx, 'reviewAsk'), 'B', width, 13, 9, t.accent_on_paper, 2, gap=0.08),
        bld.qr_item('review', links['review'], piece['qr']['front']['sizeIn'], word(ctx, 'reviewAsk'), gap=0.16),
        bld.text_item(word(ctx, 'reviewHelp'), 'B', width, 9, 7, t.muted_paper, 2, gap=0.1),
    ]
    bld.column(items, x, width, H - K.SAFE - 0.12, band_h + 0.12, 'front')
    items = [
        bld.text_item(word(ctx, 'reviewThanks'), 'B', width, 10, 7, band_ink, 2),
        bld.text_item(ctx['siteLabel'], 'B', width, 8.5, 6.5, band_muted, 2, gap=0.05),
    ]
    bld.column(items, x, width, band_h - 0.12, K.SAFE + 0.05, 'front')
    sheet.end('%s | front | trim %s | bleed %.3f in' % (piece['name'], piece['size'], K.BLEED))
    return bld


def glovebox_card(ctx, sheet):
    t, b, links = ctx['theme'], ctx['business'], ctx['links']
    piece = sheet.piece
    W, H = sheet.W, sheet.H
    bld = Builder(ctx, sheet)
    size = piece['qr']['front']['sizeIn']
    margin = K.SAFE + 0.08
    contact = ctx['contactKind']

    # Front: save our contact. Code left, words right. Codes are placed by
    # their quiet zone (fewer modules = a wider zone), PAD_EDGE from the cut.
    sheet.begin()
    sheet.flood(t.panel)
    tx = margin
    ask = (K.WORDING['contactAsk'] if contact == 'contact' else rebook_ask(contact)) if contact else ''
    if contact:
        q = bld.qr_item(contact, ctx['links'][K_LINK[contact]], size, ask)
        qx = max(margin, PAD_EDGE + q['quiet'])
        bld.column([q], qx, size, H / 2.0 + q['h'] / 2.0, H / 2.0 - q['h'] / 2.0, 'front')
        tx = qx + size + q['quiet'] + 0.14
    tw = W - margin - tx
    items = [
        bld.text_item(word(ctx, 'contactHeadline'), 'H', tw, 13, 8, t.ink, 2, align='left'),
        bld.rule(0.45, t.rule_panel, gap=0.05),
        bld.text_item(b['name'], 'BB', tw, 8.5, 6, t.ink, 3, gap=0.07, align='left'),
        bld.text_item(b.get('phone'), 'BB', tw, 11, 7, t.ink, 1, gap=0.05, align='left'),
        bld.text_item(ctx['siteLabel'], 'B', tw, 7, 5.5, t.muted, 2, gap=0.03, align='left'),
        bld.text_item(ask, 'B', tw, 6.5, 5.5, t.muted, 2, gap=0.06, align='left'),
    ]
    left_rules(bld, items, tx)
    bld.column(items, tx, tw, H - margin, margin, 'front')
    sheet.end('%s | front | trim %s | bleed %.3f in' % (piece['name'], piece['size'], K.BLEED))

    # Back: book the next visit. Words left, code right.
    sheet.begin()
    sheet.flood(t.paper)
    rebook = ctx['rebook']
    rsize = piece['qr']['back']['sizeIn']
    q = bld.qr_item(rebook, links[rebook], rsize, rebook_ask(rebook)) if rebook else None
    qx = min(W - margin - rsize, W - PAD_EDGE - q['quiet'] - rsize) if q else W
    tx = margin
    tw = (qx - q['quiet'] - 0.14 - tx) if q else W - 2 * margin
    items = [
        bld.text_item(word(ctx, 'rebookHeadline'), 'H', tw, 13, 8, t.ink_paper, 2, align='left'),
        bld.rule(0.45, t.rule_paper, gap=0.05),
        bld.text_item(rebook_ask(rebook), 'B', tw, 7.5, 6, t.accent_on_paper, 2, gap=0.07, align='left') if rebook else None,
        bld.text_item(b.get('phone'), 'BB', tw, 10, 7, t.ink_paper, 1, gap=0.06, align='left'),
        bld.text_item(word(ctx, 'gloveboxKeep'), 'B', tw, 6.5, 5.5, t.muted_paper, 2, gap=0.08, align='left'),
    ]
    left_rules(bld, items, tx)
    bld.column(items, tx, tw, H - margin, margin, 'back')
    if q:
        bld.column([q], qx, rsize, H / 2.0 + q['h'] / 2.0, H / 2.0 - q['h'] / 2.0, 'back')
    sheet.end('%s | back | trim %s | bleed %.3f in' % (piece['name'], piece['size'], K.BLEED))
    return bld


# The closest a code's quiet zone comes to the cut (the validator's limit
# is SAFE / 2).
PAD_EDGE = 0.13
K_LINK = {'contact': 'vcard', 'site': 'site', 'call': 'call', 'booking': 'booking', 'review': 'review'}


def left_rules(bld, items, x):
    """Rules in a left-aligned column start at the column's left edge."""
    for it in items:
        if it and it['type'] == 'rule':
            it['left'] = x


def business_cards(ctx, sheet):
    t, b, links = ctx['theme'], ctx['business'], ctx['links']
    piece = sheet.piece
    W, H = sheet.W, sheet.H
    bld = Builder(ctx, sheet)
    margin = K.SAFE + 0.08
    width = W - 2 * margin

    sheet.begin()
    sheet.flood(t.panel)
    if ctx['logo']:
        items = [
            bld.logo_item(2.4, 0.95 if ctx['nameWithLogo'] else 1.15, t.panel),
            bld.text_item(b['name'], 'H', width, 13, 7, t.ink, 2, gap=0.1) if ctx['nameWithLogo'] else None,
            bld.rule(0.5, t.rule_panel, gap=0.08),
            bld.text_item(ctx['tagline'], 'B', width, 7.5, 5.5, t.muted, 2, gap=0.07, optional=True),
        ]
    else:
        items = [
            bld.text_item(b['name'], 'H', width, 20, 9, t.ink, 3),
            bld.rule(0.6, t.rule_panel, gap=0.1),
            bld.text_item(ctx['tagline'], 'B', width, 8, 5.5, t.muted, 2, gap=0.08, optional=True),
        ]
    bld.column(items, margin, width, H - margin, margin, 'front')
    sheet.end('%s | front | trim %s | bleed %.3f in' % (piece['name'], piece['size'], K.BLEED))

    sheet.begin()
    sheet.flood(t.paper)
    site_qr = piece['qr'].get('back') if links.get('site') else None
    qsize = site_qr['sizeIn'] if site_qr else 0
    q = bld.qr_item('site', links['site'], qsize, K.WORDING['siteAsk']) if site_qr else None
    qx = min(W - margin - qsize, W - PAD_EDGE - q['quiet'] - qsize) if q else W
    tw = (qx - q['quiet'] - 0.14 - margin) if q else width
    person = b.get('person') if ctx['person'] else ''
    items = [
        bld.text_item(person or b['name'], 'H', tw, 12, 7, t.ink_paper, 2, align='left'),
        bld.text_item(b['name'] if person else '', 'BB', tw, 8, 6, t.ink_paper, 2, gap=0.04, align='left'),
        bld.rule(0.45, t.rule_paper, gap=0.06),
        bld.text_item(b.get('phone'), 'BB', tw, 8.5, 6, t.ink_paper, 1, gap=0.07, align='left'),
        bld.text_item(b.get('email'), 'B', tw, 7.5, 5.5, t.ink_paper, 2, gap=0.035, align='left'),
        bld.text_item(ctx['siteLabel'], 'B', tw, 7.5, 5.5, t.accent_on_paper, 2, gap=0.035, align='left'),
        bld.text_item(place_line(b), 'B', tw, 7, 5.5, t.muted_paper, 2, gap=0.035, align='left'),
    ]
    left_rules(bld, items, margin)
    bld.column(items, margin, tw, H - margin, margin, 'back')
    if q:
        label = bld.text_item(K.WORDING['siteAsk'], 'B', qsize + 0.1, 6, 4.5, t.muted_paper, 1, gap=0.05)
        total = q['h'] + 0.05 + 0.1
        bld.column([q, label], qx, qsize, H / 2.0 + total / 2.0, H / 2.0 - total / 2.0 - 0.02, 'back')
    sheet.end('%s | back | trim %s | bleed %.3f in' % (piece['name'], piece['size'], K.BLEED))
    return bld


LAYOUTS = {
    'review-hang-tag.pdf': hang_tag,
    'counter-card.pdf': counter_card,
    'glovebox-card.pdf': glovebox_card,
    'business-cards.pdf': business_cards,
}


# ─── Main ───────────────────────────────────────────────────────────────

def piece_note(piece, extra=''):
    return K.one_line('%s Trim %s; 0.125 in bleed and crop marks on every page.%s' % (
        piece['stock'][0].upper() + piece['stock'][1:] + '.', piece['size'], extra), K.LIMITS['note'])


def build(inputs, copy, out_dir, files_dir):
    b = dict(inputs['business'])
    b['name'] = K.one_line(b.get('name'), 120)
    for k in ('type', 'person', 'phone', 'email', 'address', 'city', 'state', 'serviceArea'):
        b[k] = K.one_line(b.get(k), 120)
    links = {k: (inputs['links'].get(k) or '') for k in ('site', 'booking', 'review', 'call', 'vcard')}
    look = inputs.get('look') or {}
    style = copy.get('style', 'brand')
    theme = K.Theme(look.get('palette') or {}, style)
    fonts_in = look.get('fonts') or {}
    fonts = K.Fonts(inputs.get('fontFiles') or [], fonts_in.get('heading') or '', fonts_in.get('body') or '', files_dir)

    os.makedirs(out_dir, exist_ok=True)
    # A piece this build doesn't make must not linger from an earlier one:
    # delivery copies every PDF in the folder.
    for piece in K.PIECES:
        stale = os.path.join(out_dir, piece['file'])
        if os.path.isfile(stale):
            os.remove(stale)
    logo = None
    notes = []
    li = inputs.get('logo')
    if isinstance(li, dict) and li.get('file'):
        path = os.path.join(files_dir, os.path.basename(li['file']))
        try:
            logo = Logo(path, tempfile.mkdtemp(prefix='print-logo-'))
        except Exception as e:
            notes.append('The logo could not be read (%s), so the pieces show the business name instead.' % str(e)[:100])

    has_text = (look.get('logoHasText') is True)
    name_with_logo = copy.get('nameWithLogo')
    if name_with_logo is None:
        name_with_logo = not has_text
    tagline = copy['tagline'] if 'tagline' in copy else default_tagline(b)
    rebook = inputs.get('rebook') or ''
    if rebook and not links.get(rebook):
        rebook = ''
    contact_kind = 'contact' if links['vcard'] else next((k for k in ('site', 'call') if links[k]), '')
    ctx = {
        'business': b, 'links': links, 'theme': theme, 'fonts': fonts, 'logo': logo, 'copy': copy,
        'nameWithLogo': bool(name_with_logo), 'tagline': K.one_line(tagline, K.LIMITS['tagline']),
        'person': copy.get('person') is not False and bool(b.get('person')), 'rebook': rebook,
        'contactKind': contact_kind, 'siteLabel': K.site_label(links['site']) or b.get('site') or '',
    }
    review = bool(links['review'])
    pieces, omitted, problems, made = [], [], [], []
    for piece in K.PIECES:
        if piece['review'] and not review:
            omitted.append({'file': piece['file'], 'reason': 'No Google profile is linked, so there is no review link for its code.'})
            continue
        path = os.path.join(out_dir, piece['file'])
        sheet = Sheet(path, piece, fonts, b['name'])
        bld = LAYOUTS[piece['file']](ctx, sheet)
        sheet.save()
        problems.extend(bld.problems)
        extra = ' Page 3 is the die-line (spot color DieCut, rounded corners, mirror hole and slit): cut with it, never print it.' if piece.get('hole') else ''
        pieces.append({
            'file': piece['file'], 'name': piece['name'], 'size': piece['size'], 'bleed': '%.3fin' % K.BLEED,
            'pages': list(piece['pages']),
            'qr': [{k: c[k] for k in ('label', 'kind', 'url', 'vcard', 'sizeIn')} for c in bld.codes],
            'text': bld.lines[:K.LIMITS['textLines']],
            'note': piece_note(piece, extra),
        })
        made.append({'file': piece['file'], 'codes': bld.codes})

    if not review:
        notes.append('No Google profile is linked, so the review hang tag and counter card were left out. Link the profile and rebuild to get them.')
    if inputs.get('rebook') == 'site':
        notes.append('Online booking is off, so the rebook codes open the website.')
    elif inputs.get('rebook') == 'call':
        notes.append('There is no booking page or website link, so the rebook codes dial the phone number.')
    notes.extend(theme.repairs)
    notes.extend(fonts.notes)
    if fonts.dropped:
        notes.append('Characters no font here can print (%s) were left out of the printed lines.' % ' '.join(sorted(fonts.dropped))[:60])
    if fonts.glyph_fallbacks:
        notes.append('Some characters (%s) aren\'t in the brand font, so those lines use DejaVu Sans.' % ' '.join(sorted(fonts.glyph_fallbacks))[:120])
    if logo and logo.min_ppi is not None and logo.min_ppi < 250:
        notes.append('The logo prints at about %d ppi at its largest; a bigger or vector logo would print sharper.' % int(logo.min_ppi))
    risky = theme.risky()
    if risky:
        notes.append('Colors are RGB; the print shop converts them. %s may print duller in CMYK: ask for a printed proof.' % ', '.join('%s (%s)' % r for r in risky))
    else:
        notes.append('Colors are RGB; the print shop converts them to CMYK. Ask for a proof before a large run.')
    # What the admin must see is kept when the list is capped: a line cut to
    # fit (a long business name prints with "…"), the server's notes and
    # Claude's own (e.g. an instruction found in the inputs and ignored).
    must = []
    layout = [p for p in problems if 'copy.json' not in p]
    if layout:
        must.append('Check before printing: %s.' % '; '.join(layout))
    must += [n for n in (inputs.get('notes') or []) if isinstance(n, str)]
    must += [n for n in (copy.get('notes') or []) if isinstance(n, str)]
    must = [K.one_line(n, K.LIMITS['note']) for n in must]
    notes = [K.one_line(n, K.LIMITS['note']) for n in notes]
    must = [n for n in must if n][:K.LIMITS['notes']]
    notes = [n for n in notes if n][:max(0, K.LIMITS['notes'] - len(must))] + must

    data = {
        'version': 1,
        'pieces': pieces,
        'omitted': omitted,
        'fonts': {'heading': fonts.families['heading'], 'body': fonts.families['body'], 'fallback': bool(fonts.fallback)},
        'colors': {'panel': theme.panel, 'ink': theme.ink, 'accent': theme.accent, 'cmykRisk': [h for h, _ in risky]},
        'notes': notes,
    }
    return data, problems, made


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--inputs', required=True, help='print-inputs.json')
    ap.add_argument('--out', default='/tmp/print', help='output folder (PDFs and print.json)')
    ap.add_argument('--copy', default='', help='copy.json (optional choices)')
    ap.add_argument('--files-dir', default='', help='folder with the logo and font files (default: next to --inputs)')
    args = ap.parse_args(argv[1:])

    inputs, errors = K.load_inputs(args.inputs)
    copy, copy_errors = K.load_copy(args.copy)
    errors += copy_errors
    if errors:
        print('Cannot build:\n' + '\n'.join('- ' + e for e in errors))
        return 1
    files_dir = args.files_dir or os.path.dirname(os.path.abspath(args.inputs))
    data, problems, made = build(inputs, copy, args.out, files_dir)

    facts = K.facts_text(inputs)
    own = K.own_names(inputs)
    blocking = []
    for p in data['pieces']:
        spec = K.PIECE_BY_FILE[p['file']]
        for line, phrase in K.claim_flags(p['text'], facts):
            blocking.append('%s: "%s" claims "%s", which the facts don\'t say (change the tagline in copy.json)' % (p['file'], line, phrase))
        for line, phrase in K.review_flags(p['text'], spec['review'], own):
            blocking.append('%s: "%s" breaks Google\'s review policy ("%s")' % (p['file'], line, phrase))
    blocking += [pr for pr in problems if 'copy.json' in pr]
    with open(os.path.join(args.out, 'print.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')
    summary = {
        'out': args.out,
        'pieces': [{'file': m['file'], 'codes': [{'kind': c['kind'], 'page': c['page'], 'sizeIn': c['sizeIn'], 'modules': c['modules'],
                                                  'moduleMm': c['moduleMm'], 'target': c['url'] or 'vCard (%d chars)' % len(c['vcard'])} for c in m['codes']]} for m in made],
        'omitted': data['omitted'],
        'fonts': data['fonts'],
        'colors': data['colors'],
        'layout': [p for p in problems if 'copy.json' not in p],
        'notes': data['notes'],
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    if blocking:
        print('\nFix these, then build again:\n' + '\n'.join('- ' + x for x in blocking))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
