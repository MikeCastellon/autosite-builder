"""Renders handover.pdf (US Letter) with reportlab from the inputs, the plan
and the words in content.json. Every fact on the page comes from
handover-inputs.json or data/; the only free text is content.json, which
validate_handover.py checks first.

Pages: a cover in the brand colors, then one section per contract section
(data/contract.json): what we built and why, the brand (swatches with hex,
fonts, light and dark versions, the brand board), links with QR codes, how
to edit, the kit inventory (what each file is for), the claims sign-off
(when the ledger is in the inputs), the 5 things for this week and the
30-day checklist.

Fonts: the brand's own TrueType files when the server sent them
(font-<Family>-<weight>.ttf), else Helvetica. Text a font can't draw is
replaced with a plain stand-in rather than an empty box.
"""
import datetime
import os
import re
from xml.sax.saxutils import escape

from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, CondPageBreak, Flowable, Frame, Image, KeepTogether, NextPageTemplate,
                                PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle)

from common import (FILES, HOW_TO_EDIT, PARTS, ascii_fallback, contrast, display_url, ensure_contrast, host_of,
                    kit_file_info, luminance, mix, one_line, readable_on, valid_palette)

PAGE_W, PAGE_H = letter
M = 54
W = PAGE_W - 2 * M
INK = '#18181b'
SOFT = '#52525b'
LINE = '#e4e4e7'
WHITE = '#ffffff'
FALLBACK_PALETTE = {'bg': '#111111', 'secondary': '#1f1f1f', 'text': '#ffffff', 'muted': '#a3a3a3', 'accent': '#cc0000'}
ROLE_INFO = [
    ('bg', 'Background', 'Behind every page'),
    ('secondary', 'Surface', 'Cards and alternate sections'),
    ('text', 'Text', 'Headings and paragraphs'),
    ('muted', 'Soft text', 'Captions and small print'),
    ('accent', 'Accent', 'Buttons, links and highlights'),
]
WHERE_LABEL = {'site': 'Website', 'gbp': 'Google profile', 'seo': 'Search listing', 'social': 'Social', 'print': 'Print'}
STATUS_LABEL = {'unsourced': 'We could not find where you told us this',
                'needs-rewrite': 'Says more than you told us'}
LISTED_MAX = 15


# ─── Fonts ───────────────────────────────────────────────────────────

class Fonts(object):
    """The faces the PDF draws with. heading/body/bold are font names;
    `real` says which roles use the brand's own files."""

    def __init__(self, files, wanted):
        loaded = {}
        for f in files or []:
            fam, weight, path = f.get('family') or '', int(f.get('weight') or 400), f.get('path') or ''
            name = 'HO-%s-%d' % (re.sub(r'[^A-Za-z0-9]', '', fam), weight)
            try:
                if name not in pdfmetrics.getRegisteredFontNames():
                    pdfmetrics.registerFont(TTFont(name, path))
                loaded[(fam, weight)] = name
            except Exception:
                # OpenType/CFF or a broken file: Helvetica stands in.
                continue

        def best(family, want):
            options = [(w, n) for (fam, w), n in loaded.items() if fam == family]
            return min(options, key=lambda o: (abs(o[0] - want), -o[0]))[1] if options else None

        wanted = wanted or {}
        self.heading_family = wanted.get('heading') or ''
        self.body_family = wanted.get('body') or ''
        self.heading = best(self.heading_family, 700) or 'Helvetica-Bold'
        self.body = best(self.body_family, 400) or 'Helvetica'
        self.bold = (best(self.body_family, 700) if self.body != 'Helvetica' else None) or 'Helvetica-Bold'
        if self.body.startswith('HO-'):
            registerFontFamily(self.body, normal=self.body, bold=self.bold, italic=self.body, boldItalic=self.bold)
        self.real = {'heading': self.heading.startswith('HO-'), 'body': self.body.startswith('HO-')}
        self._cover = {}

    def covers(self, font, ch):
        if font not in self._cover:
            face = getattr(pdfmetrics.getFont(font), 'face', None)
            cmap = getattr(face, 'charToGlyph', None)
            if isinstance(cmap, dict):
                self._cover[font] = lambda c, m=cmap: ord(c) in m
            else:
                # The standard 14 fonts draw WinAnsi (cp1252) only.
                def ok(c):
                    try:
                        c.encode('cp1252')
                        return True
                    except UnicodeEncodeError:
                        return False
                self._cover[font] = ok
        return self._cover[font](ch)

    def fit(self, text, font):
        """text with every character `font` can't draw swapped for a plain
        stand-in (curly quotes stay where the font has them)."""
        out = []
        for ch in text or '':
            if ch in '\n' or self.covers(font, ch):
                out.append(ch)
            else:
                rep = ascii_fallback(ch)
                out.append(''.join(c for c in rep if self.covers(font, c)) or '?')
        return ''.join(out)


# ─── Small flowables ─────────────────────────────────────────────────

class Bar(Flowable):
    def __init__(self, width, height, color):
        Flowable.__init__(self)
        self.width, self.height, self.color = width, height, color

    def draw(self):
        self.canv.setFillColor(HexColor(self.color))
        self.canv.rect(0, 0, self.width, self.height, stroke=0, fill=1)


class Badge(Flowable):
    """A filled circle with a number in it."""

    def __init__(self, n, size, fill, ink, font):
        Flowable.__init__(self)
        self.n, self.size, self.fill, self.ink, self.font = n, size, fill, ink, font
        self.width = self.height = size

    def draw(self):
        c, r = self.canv, self.size / 2.0
        c.setFillColor(HexColor(self.fill))
        c.circle(r, r, r, stroke=0, fill=1)
        c.setFillColor(HexColor(self.ink))
        fs = self.size * 0.5
        c.setFont(self.font, fs)
        c.drawCentredString(r, r - fs * 0.35, str(self.n))


class CheckBox(Flowable):
    def __init__(self, size=11):
        Flowable.__init__(self)
        self.width = self.height = size

    def draw(self):
        self.canv.setStrokeColor(HexColor(SOFT))
        self.canv.setLineWidth(1)
        self.canv.roundRect(0, 0, self.width, self.height, 2, stroke=1, fill=0)


class Swatches(Flowable):
    """The five site colors as tiles with hex, role and where each is used."""

    def __init__(self, palette, fonts):
        Flowable.__init__(self)
        self.palette, self.fonts = palette, fonts
        self.width, self.height = W, 132

    def draw(self):
        c, f = self.canv, self.fonts
        gap = 10
        tw = (W - gap * 4) / 5.0
        for i, (role, label, use) in enumerate(ROLE_INFO):
            x = i * (tw + gap)
            hexv = self.palette[role]
            c.setFillColor(HexColor(hexv))
            near_white = contrast(hexv, WHITE) < 1.2
            c.setStrokeColor(HexColor(LINE))
            c.roundRect(x, 50, tw, 82, 8, stroke=1 if near_white else 0, fill=1)
            c.setFillColor(HexColor(readable_on(hexv)))
            c.setFont(f.bold, 10)
            c.drawString(x + 9, 60, hexv.upper())
            c.setFillColor(HexColor(INK))
            c.setFont(f.bold, 9)
            c.drawString(x, 36, f.fit(label, f.bold))
            c.setFillColor(HexColor(SOFT))
            c.setFont(f.body, 7.5)
            for j, line in enumerate(simpleSplit(f.fit(use, f.body), f.body, 7.5, tw)[:2]):
                c.drawString(x, 25 - j * 9.5, line)


class PaletteStrip(Flowable):
    """One palette as five small chips with their hex values."""

    def __init__(self, label, palette, fonts):
        Flowable.__init__(self)
        self.label, self.palette, self.fonts = label, palette, fonts
        self.width, self.height = W, 46

    def draw(self):
        c, f = self.canv, self.fonts
        c.setFillColor(HexColor(INK))
        c.setFont(f.bold, 9)
        c.drawString(0, 26, f.fit(self.label, f.bold))
        x = 90
        for role, _, _ in ROLE_INFO:
            hexv = self.palette[role]
            c.setFillColor(HexColor(hexv))
            c.setStrokeColor(HexColor(LINE))
            c.roundRect(x, 16, 72, 26, 5, stroke=1, fill=1)
            c.setFillColor(HexColor(SOFT))
            c.setFont(f.body, 7.5)
            c.drawString(x, 5, hexv.upper())
            x += 82


def qr(url, size):
    w = QrCodeWidget(url)
    w.barLevel = 'M'
    x0, y0, x1, y1 = w.getBounds()
    d = Drawing(size, size, transform=[size / (x1 - x0), 0, 0, size / (y1 - y0), 0, 0])
    d.add(w)
    return d


# ─── The document ────────────────────────────────────────────────────

class Ctx(object):
    """Everything the pages share: colors, fonts, styles, facts."""

    def __init__(self, inputs, plan, content, work_dir):
        self.inputs, self.plan, self.content = inputs, plan, content
        look = inputs.get('look') or {}
        pal = look.get('palette') if valid_palette(look.get('palette')) else FALLBACK_PALETTE
        self.palette = {k: v.lower() for k, v in pal.items()}
        self.fonts = Fonts(plan.get('fonts'), look.get('fonts') or {})
        bg = self.palette['bg']
        self.cover_bg = bg
        self.cover_text = ensure_contrast(self.palette['text'], bg)
        self.cover_soft = ensure_contrast(self.palette['muted'], bg)
        self.cover_eyebrow = ensure_contrast(self.palette['accent'], bg)
        self.accent = self.palette['accent']
        self.tint = mix(self.accent, WHITE, 0.92)
        # Accent text sits on white and on the tinted cards (eyebrows, the
        # claims counts); the tint is the darker of the two, so text that
        # reads on it reads on white too.
        self.accent_ink = ensure_contrast(self.accent, self.tint)
        self.on_accent_ink = readable_on(self.accent_ink)
        b = inputs.get('business') or {}
        self.business = one_line(b.get('name') or 'Your business')
        # The server builds every link; the PDF still only prints, links and
        # encodes web addresses (a QR code to anything else is never drawn).
        self.links = {k: v for k, v in (inputs.get('links') or {}).items()
                      if isinstance(v, str) and re.match(r'https?://[^\s<>"]+$', v)}
        self.logo = prepare_logo(plan.get('logo'), work_dir)
        try:
            d = datetime.datetime.strptime((inputs.get('generatedAt') or '')[:10], '%Y-%m-%d')
            self.date = '%s %d, %d' % (d.strftime('%B'), d.day, d.year)
        except ValueError:
            self.date = ''
        f = self.fonts
        self.s = {
            'body': ParagraphStyle('body', fontName=f.body, fontSize=10.5, leading=15, textColor=HexColor(INK)),
            'lead': ParagraphStyle('lead', fontName=f.body, fontSize=12.5, leading=18, textColor=HexColor(INK)),
            'small': ParagraphStyle('small', fontName=f.body, fontSize=8.5, leading=12, textColor=HexColor(SOFT)),
            'cell': ParagraphStyle('cell', fontName=f.body, fontSize=8.5, leading=11.5, textColor=HexColor(INK)),
            'cellb': ParagraphStyle('cellb', fontName=f.bold, fontSize=8.5, leading=11.5, textColor=HexColor(INK)),
            'url': ParagraphStyle('url', fontName=f.body, fontSize=8.5, leading=11.5, textColor=HexColor(self.accent_ink),
                                  wordWrap='CJK'),
            'eyebrow': ParagraphStyle('eyebrow', fontName=f.bold, fontSize=9, leading=12, textColor=HexColor(self.accent_ink)),
            'h1': ParagraphStyle('h1', fontName=f.heading, fontSize=24, leading=29, textColor=HexColor(INK)),
            'h2': ParagraphStyle('h2', fontName=f.heading, fontSize=14, leading=18, textColor=HexColor(INK),
                                 spaceBefore=6, spaceAfter=6),
            'h3': ParagraphStyle('h3', fontName=f.bold, fontSize=11, leading=15, textColor=HexColor(INK)),
            'bullet': ParagraphStyle('bullet', fontName=f.body, fontSize=10.5, leading=15, textColor=HexColor(INK),
                                     leftIndent=14, bulletIndent=2, spaceAfter=4),
        }

    def p(self, text, style, markup=None):
        """A Paragraph of plain text (escaped, fitted to the font); `markup`
        wraps the escaped text, e.g. '<b>%s</b>'."""
        st = self.s[style] if isinstance(style, str) else style
        t = escape(self.fonts.fit(text or '', st.fontName))
        return Paragraph(markup % t if markup else t, st)

    def bullet(self, text):
        st = self.s['bullet']
        dot = '•' if self.fonts.covers(st.fontName, '•') else '-'
        return Paragraph(escape(self.fonts.fit(text, st.fontName)), st, bulletText=dot)

    def link(self, url, label=None, style='url'):
        st = self.s[style]
        href = escape(url, {'"': '&quot;'})
        return Paragraph('<link href="%s">%s</link>' % (href, escape(self.fonts.fit(label or url, st.fontName))), st)


def prepare_logo(path, work_dir):
    """The logo as an RGBA PNG (any format Pillow reads), with whether it is
    light (needs a dark card) or dark. None without a usable logo."""
    if not path:
        return None
    try:
        from PIL import Image as PILImage
        with PILImage.open(path) as im:
            im = im.convert('RGBA')
            im.thumbnail((900, 900))
            px = [p for p in im.getdata() if p[3] > 128]
            if px:
                step = max(1, len(px) // 4000)
                sample = px[::step]
                r = sum(p[0] for p in sample) / len(sample)
                g = sum(p[1] for p in sample) / len(sample)
                b = sum(p[2] for p in sample) / len(sample)
                light = luminance('#%02x%02x%02x' % (int(r), int(g), int(b))) > 0.55
            else:
                light = False
            out = os.path.join(work_dir, 'logo-for-pdf.png')
            im.save(out)
            return {'path': out, 'w': im.size[0], 'h': im.size[1], 'light': light}
    except Exception:
        return None


def draw_cover(c, doc):
    x = doc.ctx
    f = x.fonts
    band = 470
    c.saveState()
    c.setFillColor(HexColor(x.cover_bg))
    c.rect(0, PAGE_H - band, PAGE_W, band, stroke=0, fill=1)
    c.setFillColor(HexColor(x.accent))
    c.rect(0, PAGE_H - band - 6, PAGE_W, 6, stroke=0, fill=1)
    top = PAGE_H - M
    if x.logo:
        max_w, max_h, pad = 210.0, 92.0, 14
        scale = min(max_w / x.logo['w'], max_h / x.logo['h'])
        lw, lh = x.logo['w'] * scale, x.logo['h'] * scale
        card = '#18181b' if x.logo['light'] else WHITE
        if x.logo['light'] and luminance(x.cover_bg) < 0.05:
            card = mix(x.cover_bg, WHITE, 0.08)
        c.setFillColor(HexColor(card))
        c.roundRect(M, top - lh - 2 * pad, lw + 2 * pad, lh + 2 * pad, 10, stroke=0, fill=1)
        c.drawImage(ImageReader(x.logo['path']), M + pad, top - lh - pad, lw, lh, mask='auto')
    y = PAGE_H - 250
    c.setFillColor(HexColor(x.cover_eyebrow))
    c.setFont(f.bold, 10)
    c.drawString(M, y, f.fit('WEBSITE HANDOVER', f.bold))
    name = f.fit(x.business, f.heading)
    size = 40
    while size > 24 and len(simpleSplit(name, f.heading, size, W)) > 3:
        size -= 2
    lines = simpleSplit(name, f.heading, size, W)[:3]
    c.setFillColor(HexColor(x.cover_text))
    c.setFont(f.heading, size)
    y -= size * 1.15
    for line in lines:
        c.drawString(M, y, line)
        y -= size * 1.12
    site = x.links.get('site') or ''
    if site:
        c.setFillColor(HexColor(x.cover_soft))
        c.setFont(f.body, 13)
        c.drawString(M, y - 4, f.fit(host_of(site), f.body))
    # Below the band: the date, what's inside and a code to the site.
    y = PAGE_H - band - 44
    c.setFillColor(HexColor(SOFT))
    c.setFont(f.body, 9)
    if x.date:
        c.drawString(M, y, f.fit('Prepared %s' % x.date, f.body))
    y -= 30
    c.setFillColor(HexColor(INK))
    c.setFont(f.heading, 14)
    c.drawString(M, y, f.fit('Inside this guide', f.heading))
    y -= 22
    titles = [s['title'] for s in x.plan.get('sections') or []]
    half = (len(titles) + 1) // 2
    for i, t in enumerate(titles):
        col, row = divmod(i, half)
        cx, cy = M + col * 190, y - row * 19
        c.setFillColor(HexColor(x.accent_ink))
        c.setFont(f.bold, 9)
        c.drawString(cx, cy, '%02d' % (i + 1))
        c.setFillColor(HexColor(INK))
        c.setFont(f.body, 10)
        c.drawString(cx + 20, cy, f.fit(t, f.body))
    if site:
        size = 96
        d = qr(site, size)
        from reportlab.graphics import renderPDF
        renderPDF.draw(d, c, PAGE_W - M - size, 70)
        c.setFillColor(HexColor(SOFT))
        c.setFont(f.body, 8)
        c.drawCentredString(PAGE_W - M - size / 2.0, 58, f.fit('Scan to open your site', f.body))
    c.restoreState()


def draw_page(c, doc):
    x = doc.ctx
    f = x.fonts
    c.saveState()
    c.setFillColor(HexColor(x.accent))
    c.rect(M, PAGE_H - 34, 40, 3, stroke=0, fill=1)
    c.setStrokeColor(HexColor(LINE))
    c.setLineWidth(0.6)
    c.line(M, 42, PAGE_W - M, 42)
    c.setFillColor(HexColor(SOFT))
    c.setFont(f.body, 8)
    c.drawString(M, 28, f.fit('%s · Website handover' % x.business, f.body))
    c.drawRightString(PAGE_W - M, 28, 'Page %d' % doc.page)
    c.restoreState()


# ─── Sections ────────────────────────────────────────────────────────

def header(x, n, title):
    return [x.p('%02d' % n, 'eyebrow'), Spacer(1, 2), x.p(title, 'h1'), Spacer(1, 8),
            Bar(44, 3, x.accent), Spacer(1, 16)]


def card(x, rows, bg=None, pad=12):
    t = Table([[r] for r in rows], colWidths=[W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor(bg or x.tint)),
        ('LEFTPADDING', (0, 0), (-1, -1), pad), ('RIGHTPADDING', (0, 0), (-1, -1), pad),
        ('TOPPADDING', (0, 0), (0, 0), pad), ('BOTTOMPADDING', (0, -1), (-1, -1), pad),
        ('TOPPADDING', (0, 1), (-1, -1), 2), ('BOTTOMPADDING', (0, 0), (-1, -2), 2),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
    ]))
    return t


def built_section(x, n, title):
    out = header(x, n, title)
    c = x.content
    site = x.inputs.get('site') or {}
    out += [x.p(c.get('intro'), 'lead'), Spacer(1, 16)]
    rows = [x.p('YOUR DESIGN', 'eyebrow'), x.p(site.get('templateName') or 'Custom design', 'h2')]
    if site.get('templateAbout'):
        rows.append(x.p(site['templateAbout'], 'body'))
    if site.get('sections'):
        rows.append(Spacer(1, 4))
        rows.append(x.p('On your site, top to bottom: %s' % ' · '.join(site['sections']), 'small'))
    out += [card(x, rows), Spacer(1, 18), x.p('Why we made these choices', 'h2')]
    out += [x.bullet(w) for w in c.get('why') or []]
    dom = x.inputs.get('domain') or {}
    if dom.get('name') and not dom.get('live'):
        out += [Spacer(1, 10), x.p('Your own domain, %s, is still being connected. Until it is, your site is at %s.' % (
            dom['name'], host_of(x.links.get('site') or '')), 'small')]
    return out


def brand_section(x, n, title):
    out = header(x, n, title)
    f = x.fonts
    out += [x.p('Your site\'s colors', 'h2'), Swatches(x.palette, f), Spacer(1, 4)]
    if x.content.get('brandNote'):
        out += [x.p(x.content['brandNote'], 'body'), Spacer(1, 6)]
    out += [x.p('Give these hex codes to anyone who makes something for you (signs, shirts, a van wrap) so it matches.', 'small'),
            Spacer(1, 16), x.p('Your fonts', 'h2')]
    look_fonts = (x.inputs.get('look') or {}).get('fonts') or {}
    cells = []
    for role, family, face, sample, size in (
            ('HEADINGS', look_fonts.get('heading'), f.heading if f.real['heading'] else None, 'Aa Bb Cc 123', 26),
            ('BODY TEXT', look_fonts.get('body'), f.body if f.real['body'] else None, 'The quick brown fox jumps over the lazy dog.', 13)):
        if not family:
            continue
        st = ParagraphStyle('sample-' + role, fontName=face or ('Helvetica-Bold' if role == 'HEADINGS' else 'Helvetica'),
                            fontSize=size, leading=size * 1.2, textColor=HexColor(INK))
        rows = [x.p(role, 'eyebrow'), x.p(family, 'h3'), Spacer(1, 4), x.p(sample, st)]
        if not face:
            rows.append(x.p('Shown here in a stand-in typeface; your site uses %s.' % family, 'small'))
        cells.append(rows)
    if cells:
        t = Table([cells], colWidths=[W / len(cells)] * len(cells))
        t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                               ('BOX', (0, 0), (-1, -1), 0, HexColor(WHITE))]))
        out.append(t)
    brand = x.inputs.get('brand') or {}
    alts = brand.get('alternates') or {}
    strips = [PaletteStrip(label, alts[k], f) for k, label in (('light', 'Light version'), ('dark', 'Dark version'))
              if valid_palette(alts.get(k))]
    if strips:
        out += [Spacer(1, 16), KeepTogether([x.p('Light and dark versions', 'h2'),
                                             x.p('For print, signs and posts that sit on a light or a dark background.', 'small'),
                                             Spacer(1, 6)] + strips)]
    board = x.plan.get('board')
    if board:
        try:
            iw, ih = ImageReader(board).getSize()
            w = float(W)
            h = w * ih / float(iw)
            if h > 480:
                h, w = 480.0, 480.0 * iw / float(ih)
            # Kept whole: on the next page when the rest of this one is too
            # small to show it at a useful size.
            out += [Spacer(1, 16), KeepTogether([
                x.p('Your brand board', 'h2'),
                x.p('Also in the zip as 01-brand/brand-board.png, with the color codes in brand-colors.txt.', 'small'),
                Spacer(1, 8), Image(board, width=w, height=h, hAlign='LEFT')])]
        except Exception:
            pass
    return out


def links_section(x, n, title):
    out = header(x, n, title)
    rows = []
    entries = [
        ('site', 'Your website', 'Share it everywhere: your Google profile, social bios, invoices and email signature.', True),
        ('booking', 'Your booking page', 'Customers pick a time here. Put it in your bios and texts next to your website.', True),
        ('review', 'Your Google review page', 'Send this to happy customers to ask for a review. Never offer anything in return: Google does not allow it.', True),
        ('signIn', 'Edit your site', 'Sign in here to change your site (next page).', False),
    ]
    for key, label, note, with_qr in entries:
        url = x.links.get(key) or ''
        if not url:
            continue
        shown = display_url(url) if key != 'review' else url
        text = [x.p(label, 'h3'), x.link(url, shown), Spacer(1, 2), x.p(note, 'small')]
        rows.append([qr(url, 74) if with_qr else '', text])
    if rows:
        t = Table(rows, colWidths=[92, W - 92])
        t.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LINEBELOW', (0, 0), (-1, -2), 0.6, HexColor(LINE)),
        ]))
        out.append(t)
    dom = x.inputs.get('domain') or {}
    if dom.get('name') and not dom.get('live'):
        out += [Spacer(1, 8), x.p('Your domain %s is still being connected; these links will keep working once it is.' % dom['name'], 'small')]
    return out


def edit_section(x, n, title):
    out = header(x, n, title)
    site_host = host_of(x.links.get('site') or '') or 'your site'
    sign_in = x.links.get('signIn') or 'the sign-in page'
    rows = []
    for i, step in enumerate(HOW_TO_EDIT['steps'], 1):
        text = step['text'].replace('{signIn}', host_of(sign_in) if sign_in.startswith('http') else sign_in).replace('{siteHost}', site_host)
        rows.append([Badge(i, 20, x.accent_ink, x.on_accent_ink, x.fonts.bold), [x.p(step['title'], 'h3'), x.p(text, 'body')]])
    t = Table(rows, colWidths=[34, W - 34])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                           ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 6)]))
    out += [t, Spacer(1, 8), x.p('Good to know', 'h2')]
    tips = list(HOW_TO_EDIT['tips'])
    if x.links.get('booking'):
        tips.append(HOW_TO_EDIT['bookingTip'])
    out += [x.bullet(tip) for tip in tips]
    return out


def kit_section(x, n, title, files, left):
    out = header(x, n, title)
    out += [x.p('Everything below is in %s, sorted into folders. Open it on a computer, or in the Files app on a phone.' % FILES['zip'], 'body'),
            Spacer(1, 12)]
    groups = [('', 'root', 'Start here')] + [(p['folder'], p['key'], p['label']) for p in PARTS]
    for folder, key, label in groups:
        names = [f.split('/', 1)[1] if '/' in f else f for f in files if (f.split('/', 1)[0] if '/' in f else '') == folder]
        if not names:
            continue
        head = x.p('%s%s' % ('%s · ' % folder if folder else '', label), 'h2')
        data = [[x.p('File', 'cellb'), x.p('What it is', 'cellb'), x.p('How to use it', 'cellb')]]
        for name in names:
            info = kit_file_info(key, name)
            data.append([[x.p(name, 'cellb'), x.p(info['label'], 'small')], x.p(info['what'], 'cell'), x.p(info['use'], 'cell')])
        t = Table(data, colWidths=[150, (W - 150) / 2.0, (W - 150) / 2.0], repeatRows=1)
        t.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BACKGROUND', (0, 0), (-1, 0), HexColor(x.tint)),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, HexColor(LINE)),
            ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        # The heading and at least its first rows stay together; a long
        # table then continues on the next page under its repeated header.
        out += [CondPageBreak(150), head, Spacer(1, 4), t, Spacer(1, 12)]
    if left:
        out += [x.p('Not in the zip', 'h3')]
        out += [x.bullet('%s: %s' % (l['file'], l['reason'])) for l in left]
    return out


def claims_section(x, n, title):
    out = header(x, n, title)
    claims = (x.inputs.get('parts') or {}).get('claims') or {}
    counts = claims.get('counts') or {}
    items = [c for c in claims.get('toConfirm') or [] if isinstance(c, dict) and c.get('text')]
    to_confirm = max(int(counts.get('toConfirm') or 0), len(items))
    sourced = int(counts.get('sourced') or 0)
    total = max(int(counts.get('total') or 0), sourced + to_confirm)
    out += [x.p('Before launch we checked the statements on your site and in this kit against what you told us. '
                'Anything we could not trace back to you is listed here for you to confirm or correct.', 'body')]
    reviewed = str(claims.get('reviewedAt') or '')[:10]
    if len(reviewed) == 10 and reviewed[4] == '-' and reviewed[7] == '-':
        out += [x.p('Our team reviewed this check on %s.' % reviewed, 'small')]
    out += [Spacer(1, 12)]
    big = ParagraphStyle('big', fontName=x.fonts.heading, fontSize=26, leading=30, textColor=HexColor(x.accent_ink))
    tiles = [[x.p(str(total), big), x.p('statements checked', 'small')],
             [x.p(str(sourced), big), x.p('traced to your own answers', 'small')],
             [x.p(str(to_confirm), big), x.p('for you to confirm', 'small')]]
    t = Table([tiles], colWidths=[W / 3.0] * 3)
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), HexColor(x.tint)), ('ROUNDEDCORNERS', [8, 8, 8, 8]),
                           ('LEFTPADDING', (0, 0), (-1, -1), 14), ('TOPPADDING', (0, 0), (-1, -1), 10),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 12), ('LINEAFTER', (0, 0), (1, 0), 0.6, HexColor(WHITE))]))
    out += [t, Spacer(1, 16)]
    if items:
        listed = items[:LISTED_MAX]
        data = [[x.p('#', 'cellb'), x.p('Statement', 'cellb'), x.p('What we suggest', 'cellb')]]
        for i, item in enumerate(listed, 1):
            where = WHERE_LABEL.get(item.get('where'), 'Kit')
            status = STATUS_LABEL.get(item.get('status'), '')
            data.append([x.p(str(i), 'cell'),
                         [x.p(item['text'], 'cell'), x.p('%s%s' % (where, ' · %s' % status if status else ''), 'small')],
                         x.p(item.get('suggestion') or 'Confirm it, or tell us what to change.', 'cell')])
        t = Table(data, colWidths=[22, 270, W - 292], repeatRows=1)
        t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BACKGROUND', (0, 0), (-1, 0), HexColor(x.tint)),
                               ('LINEBELOW', (0, 0), (-1, -1), 0.5, HexColor(LINE)),
                               ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]))
        out.append(t)
        if to_confirm > len(listed):
            out += [Spacer(1, 6), x.p('And %d more: ask us for the full list.' % (to_confirm - len(listed)), 'small')]
    elif to_confirm:
        out.append(x.p('%d statement%s could not be traced back to your answers: ask us for the list.' % (
            to_confirm, '' if to_confirm == 1 else 's'), 'body'))
    else:
        out.append(x.p('Every statement traced back to your own answers: nothing to confirm.', 'body'))
    sign = [[x.p('I have read the statements above. They are accurate, or I have marked what to change.', 'body'), '', ''],
            [x.p('Name', 'small'), x.p('Signature', 'small'), x.p('Date', 'small')]]
    t = Table(sign, colWidths=[W * 0.38, W * 0.38, W * 0.24], rowHeights=[None, 40])
    t.setStyle(TableStyle([('SPAN', (0, 0), (-1, 0)), ('VALIGN', (0, 1), (-1, 1), 'BOTTOM'),
                           ('LINEABOVE', (0, 1), (0, 1), 0, HexColor(WHITE)),
                           ('LINEBELOW', (0, 1), (-1, 1), 0.8, HexColor(SOFT)),
                           ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 1), (-1, 1), 18),
                           ('TOPPADDING', (0, 1), (-1, 1), 24)]))
    out += [Spacer(1, 18), KeepTogether([x.p('Sign-off', 'h2'), t])]
    return out


def week_section(x, n, title):
    out = header(x, n, title)
    out += [x.p('Start at the top and tick each one off as you go.', 'body'), Spacer(1, 14)]
    rows = []
    for i, item in enumerate(x.content.get('thisWeek') or [], 1):
        title_st = ParagraphStyle('wk', parent=x.s['h3'], fontSize=12.5, leading=16)
        rows.append([Badge(i, 28, x.accent_ink, x.on_accent_ink, x.fonts.bold),
                     [x.p(item['title'], title_st), Spacer(1, 2), x.p(item['detail'], 'body')], CheckBox(14)])
    t = Table(rows, colWidths=[46, W - 46 - 40, 40])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor(x.tint)), ('ROUNDEDCORNERS', [10, 10, 10, 10]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (0, -1), 14),
        ('TOPPADDING', (0, 0), (-1, -1), 12), ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LINEBELOW', (0, 0), (-1, -2), 0.8, HexColor(WHITE)), ('ALIGN', (2, 0), (2, -1), 'CENTER'),
    ]))
    out.append(t)
    return out


def month_section(x, n, title):
    out = header(x, n, title)
    out += [x.p('One small step a week keeps the site, your Google profile and your reviews moving.', 'body'), Spacer(1, 12)]
    weeks = {}
    for c in x.content.get('checklist') or []:
        weeks.setdefault(c['week'], []).append(c['task'])
    cells = []
    for w in range(1, 5):
        rows = [[CheckBox(10), x.p(task, 'cell')] for task in weeks.get(w, [])]
        inner = Table(rows or [['', '']], colWidths=[18, W / 2.0 - 46])
        inner.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                                   ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
        cells.append([x.p('WEEK %d' % w, 'eyebrow'), Spacer(1, 4), inner])
    grid = Table([[cells[0], cells[1]], [cells[2], cells[3]]], colWidths=[W / 2.0, W / 2.0])
    grid.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOX', (0, 0), (-1, -1), 0.6, HexColor(LINE)),
        ('INNERGRID', (0, 0), (-1, -1), 0.6, HexColor(LINE)),
        ('LEFTPADDING', (0, 0), (-1, -1), 12), ('TOPPADDING', (0, 0), (-1, -1), 12), ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    out.append(grid)
    closing = x.content.get('closing')
    if closing:
        out += [Spacer(1, 22), card(x, [x.p(closing, 'lead')])]
    return out


# ─── Build ───────────────────────────────────────────────────────────

class HandoverDoc(BaseDocTemplate):
    def __init__(self, path, ctx):
        BaseDocTemplate.__init__(self, path, pagesize=letter, leftMargin=M, rightMargin=M, topMargin=60, bottomMargin=60,
                                 title='%s: website handover' % ctx.business, author='Genius Websites',
                                 subject='Website handover and Launch Kit')
        self.ctx = ctx
        cover = Frame(M, 60, W, 1, id='cover', showBoundary=0)
        body = Frame(M, 60, W, PAGE_H - 60 - 52, id='body', showBoundary=0)
        self.addPageTemplates([PageTemplate('cover', [cover], onPage=draw_cover),
                               PageTemplate('body', [body], onPage=draw_page)])


def build_pdf(path, inputs, plan, content, files, left, work_dir):
    """Writes handover.pdf. Returns (section titles, page count)."""
    ctx = Ctx(inputs, plan, content, work_dir)
    story = [NextPageTemplate('body'), PageBreak()]
    titles = []
    for i, s in enumerate(plan.get('sections') or [], 1):
        sid, title = s['id'], s['title']
        if i > 1:
            story.append(PageBreak())
        if sid == 'built':
            story += built_section(ctx, i, title)
        elif sid == 'brand':
            story += brand_section(ctx, i, title)
        elif sid == 'links':
            story += links_section(ctx, i, title)
        elif sid == 'edit':
            story += edit_section(ctx, i, title)
        elif sid == 'kit':
            story += kit_section(ctx, i, title, files, left)
        elif sid == 'claims':
            story += claims_section(ctx, i, title)
        elif sid == 'week':
            story += week_section(ctx, i, title)
        elif sid == 'month':
            story += month_section(ctx, i, title)
        else:
            continue
        titles.append(title)
    doc = HandoverDoc(path, ctx)
    doc.build(story)
    return titles, doc.page, ctx
