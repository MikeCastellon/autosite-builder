"""Renders words.json as words.pdf: a clean printable copy deck (US Letter)
with a cover (logo, business name, links, contents), then each section with
headings, the paste-ready text in tinted blocks and the character count of
every piece. Brand fonts and the accent color come from words-inputs.json;
without font files it falls back to DejaVu Sans (matplotlib's copy), then
Helvetica. Never edits the copy: run validate_words.py first.

  render_pdf.py /tmp/words/words.json --inputs <words-inputs.json> --out /tmp/words/words.pdf
                [--logo <logo file>] [--fonts-dir DIR]

Prints JSON: { pages, fonts: { heading, body }, logo, accent, photos (post
thumbnails drawn), droppedGlyphs }. The post photos go in as small JPEG
thumbnails and a large logo as a smaller PNG (both in a thumbs/ folder next
to --out), so the PDF stays small.
"""
import argparse
import datetime
import json
import os
import re
import sys
from xml.sax.saxutils import escape

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from words_lib import LIMITS, REVIEW_PH, js_length, load_inputs  # noqa: E402

from reportlab.lib import colors  # noqa: E402
from reportlab.lib.pagesizes import letter  # noqa: E402
from reportlab.lib.styles import ParagraphStyle  # noqa: E402
from reportlab.lib.units import inch  # noqa: E402
from reportlab.lib.utils import ImageReader  # noqa: E402
from reportlab.pdfbase import pdfmetrics  # noqa: E402
from reportlab.pdfbase.ttfonts import TTFont  # noqa: E402
from reportlab.platypus import (  # noqa: E402
    CondPageBreak, Flowable, Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

INK = '#1a1a1a'
MUTED = '#555555'   # 7.5:1 on white
DEFAULT_ACCENT = '#1f4e79'
CTA_LABELS = {'BOOK': 'Book', 'CALL': 'Call now', 'LEARN_MORE': 'Learn more'}
# Stand-ins for characters a font lacks, before dropping them.
SUBSTITUTES = {'‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-',
               '…': '...', '•': '-', '\u00a0': ' ', '™': '(TM)', '®': '(R)', '★': '*'}


# ─── Colors ─────────────────────────────────────────────────────────────

def _rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def _lum(h):
    def ch(c):
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(c) for c in _rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = sorted((_lum(a), _lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def mix(a, b, t):
    ra, rb = _rgb(a), _rgb(b)
    return '#%02x%02x%02x' % tuple(int(round((x + (y - x) * t) * 255)) for x, y in zip(ra, rb))


def ink_accent(accent):
    """The brand accent, deepened toward black until it reads at 4.5:1 on
    white paper (headings and labels are text)."""
    a = accent if isinstance(accent, str) and re.fullmatch(r'#[0-9a-fA-F]{6}', accent or '') else DEFAULT_ACCENT
    a = a.lower()
    t = 0.0
    while contrast(mix(a, '#000000', t), '#ffffff') < 4.5 and t < 1:
        t += 0.05
    return mix(a, '#000000', min(t, 1.0))


# ─── Fonts ──────────────────────────────────────────────────────────────

def _fallback_files():
    """DejaVu Sans regular and bold: matplotlib ships them, most Linux boxes too."""
    dirs = []
    try:
        import matplotlib
        dirs.append(os.path.join(os.path.dirname(matplotlib.__file__), 'mpl-data', 'fonts', 'ttf'))
    except Exception:
        pass
    dirs += ['/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/dejavu', '/usr/share/fonts/TTF']
    for d in dirs:
        reg, bold = os.path.join(d, 'DejaVuSans.ttf'), os.path.join(d, 'DejaVuSans-Bold.ttf')
        if os.path.isfile(reg):
            return reg, bold if os.path.isfile(bold) else reg
    return None, None


class Fonts:
    """Registered faces: heading / body, regular and bold, with the
    characters each can draw."""

    def __init__(self):
        self.names = {}
        self.cmaps = {}
        self.used = {}

    def _register(self, key, path):
        try:
            f = TTFont(key, path)
            pdfmetrics.registerFont(f)
            self.cmaps[key] = set(f.face.charToGlyph.keys())
            return True
        except Exception:
            return False

    def setup(self, slot, family, files):
        """files: { weight: path }. Brand faces first, then DejaVu, then Helvetica."""
        reg = files.get(400) or files.get(min(files)) if files else None
        bold = files.get(700) or (files.get(max(files)) if files else None)
        key = 'Words%s' % slot.title()
        if reg and self._register(key, reg):
            bold_ok = bool(bold) and bold != reg and self._register(key + '-Bold', bold)
            self.names[slot] = (key, key + '-Bold' if bold_ok else key)
            self.used[slot] = family
            return
        dv, dvb = _fallback_files()
        if dv and self._register(key, dv):
            bold_ok = self._register(key + '-Bold', dvb)
            self.names[slot] = (key, key + '-Bold' if bold_ok else key)
            self.used[slot] = 'DejaVu Sans (stand-in for %s)' % family if family else 'DejaVu Sans'
            return
        self.names[slot] = ('Helvetica', 'Helvetica-Bold')
        self.used[slot] = 'Helvetica (stand-in for %s)' % family if family else 'Helvetica'

    def safe(self, text, face):
        """The text with characters the face can't draw replaced or dropped."""
        cmap = self.cmaps.get(face)
        out, dropped = [], 0
        for ch in str(text):
            if ch == '\n':
                out.append(ch)
                continue
            if cmap is None:
                try:
                    ch.encode('cp1252')
                    ok = True
                except UnicodeEncodeError:
                    ok = False
            else:
                ok = ord(ch) in cmap
            if ok:
                out.append(ch)
            elif ch in SUBSTITUTES:
                out.append(SUBSTITUTES[ch])
            elif ch.isspace():
                out.append(' ')
            else:
                dropped += 1
        self.dropped = getattr(self, 'dropped', 0) + dropped
        return ''.join(out)


_FOUND = None


def find_file(name, dirs):
    """A request file by its container name: in `dirs` first, else where
    find_inputs.py finds uploads (searched once per run)."""
    global _FOUND
    if not name or not isinstance(name, str):
        return None
    if os.path.isabs(name) and os.path.isfile(name):
        return name
    name = os.path.basename(name)
    for d in dirs:
        p = os.path.join(d, name)
        if d and os.path.isfile(p):
            return p
    try:
        if _FOUND is None:
            from find_inputs import find
            _FOUND = find()
        for p in _FOUND:
            if os.path.basename(p) == name:
                return p
    except Exception:
        pass
    return None


def thumbnail(path, out_dir, ref, max_side=480):
    """A small JPEG of one of their photos for the deck (the originals can
    be many megabytes each), upright, transparency on white. (path, (w, h))
    or (None, None) when the photo can't be read."""
    try:
        from PIL import Image as PILImage, ImageOps
        with PILImage.open(path) as im:
            im = ImageOps.exif_transpose(im)
            im.thumbnail((max_side, max_side))
            if im.mode in ('RGBA', 'LA', 'P', 'PA'):
                im = im.convert('RGBA')
                flat = PILImage.new('RGB', im.size, (255, 255, 255))
                flat.paste(im, mask=im.split()[3])
                im = flat
            else:
                im = im.convert('RGB')
            os.makedirs(out_dir, exist_ok=True)
            out = os.path.join(out_dir, 'thumb-%s.jpg' % re.sub(r'[^A-Za-z0-9_-]', '', ref or 'photo'))
            im.save(out, 'JPEG', quality=82)
            return out, im.size
    except Exception:
        return None, None


def logo_copy(path, out_dir, max_side=1200):
    """The logo, at most max_side pixels on a side, as a PNG that keeps its
    transparency (a dark panel may sit behind it): an upload can be a few
    megabytes, the cover shows it about 2 inches wide. The original path
    when it is already small or can't be read."""
    try:
        from PIL import Image as PILImage, ImageOps
        with PILImage.open(path) as im:
            if max(im.size) <= max_side:
                return path
            im = ImageOps.exif_transpose(im)
            im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P', 'PA') else im.convert('RGB')
            im.thumbnail((max_side, max_side))
            os.makedirs(out_dir, exist_ok=True)
            out = os.path.join(out_dir, 'logo.png')
            im.save(out, 'PNG', optimize=True)
            return out
    except Exception:
        return path


# ─── The document ───────────────────────────────────────────────────────

class Rule(Flowable):
    def __init__(self, color, width=1.2):
        super().__init__()
        self.color, self.lw = color, width

    def wrap(self, aw, ah):
        self.aw = aw
        return aw, self.lw + 2

    def draw(self):
        self.canv.setStrokeColor(colors.HexColor(self.color))
        self.canv.setLineWidth(self.lw)
        self.canv.line(0, 1, self.aw, 1)


class Deck:
    def __init__(self, words, inputs, fonts, accent, thumbs=None, width=letter[0] - 1.6 * inch):
        self.w, self.inputs, self.f = words, inputs, fonts
        self.thumbs = thumbs or {}
        self.width = width
        self.accent = accent
        self.tint = mix(accent, '#ffffff', 0.93)
        h, hb = fonts.names['heading']
        b, bb = fonts.names['body']
        self.face = {'h': h, 'hb': hb, 'b': b, 'bb': bb}
        self.st = {
            'title': ParagraphStyle('title', fontName=hb, fontSize=26, leading=31, textColor=colors.HexColor(INK)),
            'subtitle': ParagraphStyle('subtitle', fontName=h, fontSize=14, leading=19, textColor=colors.HexColor(accent)),
            'h1': ParagraphStyle('h1', fontName=hb, fontSize=18, leading=23, textColor=colors.HexColor(accent), spaceBefore=6, spaceAfter=4),
            # Subheadings and a piece's label stay on the page of the text
            # they introduce (keepWithNext), never alone at a page's foot.
            'h2': ParagraphStyle('h2', fontName=hb, fontSize=12.5, leading=16, textColor=colors.HexColor(INK), spaceBefore=12, spaceAfter=4,
                                 keepWithNext=1),
            'label': ParagraphStyle('label', fontName=bb, fontSize=8.5, leading=11, textColor=colors.HexColor(MUTED), spaceBefore=8, spaceAfter=2,
                                    keepWithNext=1),
            'body': ParagraphStyle('body', fontName=b, fontSize=10, leading=14.2, textColor=colors.HexColor(INK)),
            'muted': ParagraphStyle('muted', fontName=b, fontSize=9, leading=12.5, textColor=colors.HexColor(MUTED)),
            'block': ParagraphStyle('block', fontName=b, fontSize=10, leading=14.2, textColor=colors.HexColor(INK),
                                    backColor=colors.HexColor(self.tint), borderPadding=7, leftIndent=7, rightIndent=7,
                                    # The tint reaches 7pt past the text: the space
                                    # before keeps it off the label above.
                                    spaceBefore=11, spaceAfter=10),
        }

    def p(self, text, style, face='b'):
        safe = self.f.safe(text, self.face[face])
        return Paragraph(escape(safe).replace('\n', '<br/>'), self.st[style])

    def label(self, name, text=None, limit=None):
        """'DESCRIPTION  512 / 750 characters' (the count only for a limit)."""
        count = ''
        if text is not None and limit:
            count = '   %d / %d characters' % (js_length(text), limit)
        elif text is not None:
            count = '   %d characters' % js_length(text)
        safe = escape(self.f.safe(name.upper(), self.face['bb']))
        return Paragraph('<font color="%s">%s</font>%s' % (self.accent, safe, escape(count)), self.st['label'])

    def block(self, text):
        return self.p(text, 'block')

    def link_for(self, cta):
        urls = self.inputs.get('urls') or {}
        if cta == 'BOOK':
            return urls.get('booking') or urls.get('site') or ''
        if cta == 'LEARN_MORE':
            return urls.get('site') or ''
        return ''

    def photo_ref(self, ref):
        """The photo's ref for a ref or a container file name ('' when none)."""
        for p in self.inputs.get('photos') or []:
            if isinstance(p, dict) and ref and ref in (p.get('ref'), p.get('file')):
                return p.get('ref') or ''
        return ''

    def photo_name(self, ref):
        for p in self.inputs.get('photos') or []:
            if isinstance(p, dict) and ref and ref in (p.get('ref'), p.get('file')):
                return p.get('name') or p.get('file') or ref
        return ''

    def logo_panel(self, path):
        """The dark color to put a light logo on, or None when the logo
        reads on white paper (its visible pixels are dark enough)."""
        try:
            from PIL import Image as PILImage
            with PILImage.open(path) as im:
                im = im.convert('RGBA')
                im.thumbnail((200, 200))
                px = [p for p in im.getdata() if p[3] > 128]
        except Exception:
            return None
        if not px:
            return None
        dark = sum(1 for r, g, b, _ in px if contrast('#%02x%02x%02x' % (r, g, b), '#ffffff') >= 1.6)
        if dark / len(px) >= 0.08:
            return None
        bg = ((self.inputs.get('brand') or {}).get('palette') or {}).get('bg') or ''
        ok = re.fullmatch(r'#[0-9a-fA-F]{6}', bg or '') and contrast(bg, '#ffffff') >= 4.5
        return bg if ok else INK

    # Sections ------------------------------------------------------------

    def cover(self, logo_path, today):
        biz = self.inputs.get('business') or {}
        urls = self.inputs.get('urls') or {}
        out = []
        if logo_path:
            try:
                iw, ih = ImageReader(logo_path).getSize()
                scale = min(2.2 * inch / iw, 1.1 * inch / ih)
                img = Image(logo_path, width=iw * scale, height=ih * scale)
                img.hAlign = 'LEFT'
                panel = self.logo_panel(logo_path)
                if panel:
                    # A white or light logo disappears on paper: it sits on a
                    # dark panel instead.
                    t = Table([[img]], hAlign='LEFT')
                    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(panel)),
                                           ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12),
                                           ('TOPPADDING', (0, 0), (-1, -1), 10), ('BOTTOMPADDING', (0, 0), (-1, -1), 10)]))
                    img = t
                out += [img, Spacer(1, 18)]
            except Exception:
                logo_path = None
        name = biz.get('name') or 'Your business'
        out += [self.p(name, 'title', 'hb'), Spacer(1, 4), self.p('Launch copy deck', 'subtitle', 'h'),
                Spacer(1, 10), Rule(self.accent), Spacer(1, 10)]
        out.append(self.p('Prepared %s' % today.strftime('%B %d, %Y').replace(' 0', ' '), 'muted'))
        for label, key in (('Website', 'site'), ('Booking', 'booking'), ('Google review link', 'review')):
            if urls.get(key):
                out.append(self.p('%s: %s' % (label, urls[key]), 'muted'))
        out += [Spacer(1, 18), self.p('What is inside', 'h2', 'hb')]
        for line in ('1. Google Business Profile: description, services, category suggestions, 12 starter posts',
                     '2. Website search listing: title, description, keywords',
                     '3. Reviews: request text and email, reply templates for 1 to 5 stars',
                     '4. Social: profile bio and 3 launch captions'):
            out.append(self.p(line, 'body'))
        out += [Spacer(1, 14), self.p('How to use it', 'h2', 'hb'), self.p(
            'Every block is ready to paste. Character counts show how each piece fits its limit. Categories are '
            'suggestions: pick the exact name in your Google Business Profile category box. Review requests go to every '
            'customer, with no reward attached, as Google requires.', 'body')]
        return out, bool(logo_path)

    def gbp(self):
        g = self.w.get('gbp') or {}
        lim = LIMITS['gbp']
        out = [self.p('1. Google Business Profile', 'h1', 'hb'), Rule(self.accent), Spacer(1, 6)]
        d = g.get('description') or ''
        out += [self.label('Business description', d, lim['description']['max']), self.block(d)]
        out.append(self.p('Services', 'h2', 'hb'))
        for s in g.get('services') or []:
            desc = s.get('description') or ''
            out.append(KeepTogether([self.label(s.get('name') or '', desc, lim['services']['description']), self.block(desc)]))
        out.append(self.p('Categories (suggestions, confirm in GBP)', 'h2', 'hb'))
        for i, c in enumerate(g.get('categories') or []):
            tag = 'primary, confirm in GBP' if i == 0 else 'confirm in GBP'
            out.append(self.p('%d. %s  (%s)' % (i + 1, c.get('name') or '', tag), 'body'))
        posts = g.get('posts') or []
        out += [PageBreak(), self.p('Starter posts', 'h1', 'hb'), Rule(self.accent), Spacer(1, 6),
                self.p('Post one a week. Each post names its button and the photo to use.', 'muted')]
        for i, post in enumerate(posts):
            cta = post.get('cta') or ''
            meta = 'Button: %s' % CTA_LABELS.get(cta, cta)
            link = self.link_for(cta)
            if link:
                meta += '  |  Link: %s' % link
            elif cta == 'CALL':
                meta += '  |  Uses the phone on your profile'
            body = post.get('body') or ''
            photo = 'Image: %s' % (post.get('imageHint') or '')
            name = self.photo_name(post.get('photo'))
            if name:
                photo += '  (your photo: %s)' % name
            notes = [self.p(meta, 'muted'), self.p(photo, 'muted')]
            thumb = self.thumbs.get(self.photo_ref(post.get('photo')))
            if thumb:
                # Their photo next to the button and image lines, so the
                # owner sees which picture goes with the post.
                path, (w, h) = thumb
                tw = 1.25 * inch
                th = min(tw * h / float(w), 1.25 * inch)
                img = Image(path, width=th * w / float(h), height=th)
                t = Table([[img, notes]], colWidths=[tw + 10, self.width - tw - 10], hAlign='LEFT')
                t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                                       ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (-1, -1), 0),
                                       ('BOTTOMPADDING', (0, 0), (-1, -1), 0)]))
                notes = [Spacer(1, 4), t]
            out.append(KeepTogether([
                self.label('Post %d of %d' % (i + 1, len(posts)), body, lim['posts']['body']),
                self.p(post.get('title') or '', 'h2', 'hb'),
                self.block(body),
            ] + notes + [Spacer(1, 8)]))
        return out

    def seo(self):
        s = self.w.get('seo') or {}
        lim = LIMITS['seo']
        t, d = s.get('title') or '', s.get('description') or ''
        kw = ', '.join(k for k in s.get('keywords') or [] if isinstance(k, str))
        return [CondPageBreak(3 * inch), self.p('2. Website search listing', 'h1', 'hb'), Rule(self.accent), Spacer(1, 6),
                self.p('How the site can show up in Google search results.', 'muted'),
                self.label('Title', t, lim['title']['max']), self.block(t),
                self.label('Description', d, lim['description']['max']), self.block(d),
                self.label('Keywords'), self.block(kw)]

    def reviews(self):
        rv = self.w.get('reviews') or {}
        lim = LIMITS['reviews']
        review = (self.inputs.get('urls') or {}).get('review') or ''
        email = rv.get('requestEmail') or {}
        out = [CondPageBreak(3 * inch), self.p('3. Reviews', 'h1', 'hb'), Rule(self.accent), Spacer(1, 6)]
        if review:
            out.append(self.p('Your Google review link: %s' % review, 'muted'))
        else:
            out.append(self.p('Put your Google review link where the text says %s.' % REVIEW_PH, 'muted'))
        out.append(self.p('Ask every customer the same way, and never offer anything in return for a review.', 'muted'))
        sms = rv.get('requestSms') or ''
        out += [self.label('Review request: text message', sms, lim['requestSms']), self.block(sms)]
        out += [self.label('Review request: email subject', email.get('subject') or '', lim['subject']), self.block(email.get('subject') or ''),
                self.label('Review request: email', email.get('body') or '', lim['emailBody']), self.block(email.get('body') or '')]
        out.append(self.p('Reply templates', 'h2', 'hb'))
        replies = sorted([r for r in rv.get('replies') or [] if isinstance(r, dict)], key=lambda r: -int(r.get('rating') or 0))
        for r in replies:
            n = int(r.get('rating') or 0)
            txt = r.get('text') or ''
            out.append(KeepTogether([self.label('%d star%s' % (n, '' if n == 1 else 's'), txt), self.block(txt)]))
        return out

    def social(self):
        s = self.w.get('social') or {}
        lim = LIMITS['social']
        bio = s.get('bio') or ''
        out = [CondPageBreak(3 * inch), self.p('4. Social', 'h1', 'hb'), Rule(self.accent), Spacer(1, 6),
               self.label('Profile bio', bio, lim['bio']), self.block(bio)]
        for i, c in enumerate(s.get('captions') or []):
            out.append(KeepTogether([self.label('Launch caption %d' % (i + 1), c), self.block(c)]))
        return out


def render(words, inputs, out_path, logo=None, fonts_dir=None, today=None):
    if today is None:
        try:
            today = datetime.date.fromisoformat(inputs.get('today') or '')
        except ValueError:
            today = datetime.date.today()
    dirs = [d for d in (fonts_dir, os.path.dirname(os.path.abspath(inputs.get('_path') or '')) if inputs.get('_path') else None) if d]
    brand = inputs.get('brand') or {}
    fonts = Fonts()
    for slot in ('heading', 'body'):
        spec = (brand.get('fonts') or {}).get(slot) or {}
        files = {}
        for weight, name in (spec.get('files') or {}).items():
            path = find_file(name, dirs)
            if path:
                try:
                    files[int(weight)] = path
                except ValueError:
                    pass
        fonts.setup(slot, spec.get('family') or '', files)
    accent = ink_accent(((brand.get('palette') or {}).get('accent')))
    logo_path = logo if logo and os.path.isfile(logo) else find_file(inputs.get('logo') or '', dirs)
    work_dir = os.path.join(os.path.dirname(os.path.abspath(out_path)), 'thumbs')
    if logo_path:
        logo_path = logo_copy(logo_path, work_dir)

    # Thumbnails of the photos the posts use (each made once).
    thumbs = {}
    used = {p.get('photo') for p in ((words.get('gbp') or {}).get('posts') or []) if isinstance(p, dict)}
    for p in inputs.get('photos') or []:
        if isinstance(p, dict) and p.get('ref') and (p['ref'] in used or p.get('file') in used):
            src = find_file(p.get('file') or '', dirs)
            if src:
                path, size = thumbnail(src, work_dir, p['ref'])
                if path:
                    thumbs[p['ref']] = (path, size)

    deck = Deck(words, inputs, fonts, accent, thumbs)
    biz_name = (inputs.get('business') or {}).get('name') or ''
    cover, has_logo = deck.cover(logo_path, today)
    story = cover + [PageBreak()] + deck.gbp() + deck.seo() + deck.reviews() + deck.social()

    footer_face = fonts.names['body'][0]
    footer_name = fonts.safe(biz_name, footer_face)

    def footer(canv, doc):
        canv.saveState()
        # A thin accent band across the top of every page.
        canv.setFillColor(colors.HexColor(accent))
        canv.rect(0, letter[1] - 6, letter[0], 6, stroke=0, fill=1)
        canv.setFont(footer_face, 8)
        canv.setFillColor(colors.HexColor(MUTED))
        canv.drawString(doc.leftMargin, 0.5 * inch, ('%s  |  Launch copy deck' % footer_name) if footer_name else 'Launch copy deck')
        canv.drawRightString(letter[0] - doc.rightMargin, 0.5 * inch, 'Page %d' % canv.getPageNumber())
        canv.restoreState()

    doc = SimpleDocTemplate(out_path, pagesize=letter, leftMargin=0.8 * inch, rightMargin=0.8 * inch,
                            topMargin=0.8 * inch, bottomMargin=0.85 * inch,
                            title=('%s launch copy deck' % biz_name).strip(), author=biz_name or 'Launch copy deck',
                            subject='Google Business Profile, search, reviews and social copy')
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return {'pages': doc.page, 'fonts': fonts.used, 'logo': has_logo, 'accent': accent, 'photos': len(thumbs),
            'droppedGlyphs': getattr(fonts, 'dropped', 0)}


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('words')
    ap.add_argument('--inputs', default='')
    ap.add_argument('--out', required=True)
    ap.add_argument('--logo', default='')
    ap.add_argument('--fonts-dir', default='')
    args = ap.parse_args(argv[1:])
    try:
        with open(args.words, encoding='utf-8') as f:
            words = json.load(f)
        inputs = load_inputs(args.inputs)
    except (OSError, ValueError) as e:
        print('FAIL: %s' % e)
        return 2
    if args.inputs:
        inputs['_path'] = args.inputs
    info = render(words, inputs, args.out, logo=args.logo or None, fonts_dir=args.fonts_dir or None)
    print(json.dumps(info))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
