"""Shared helpers for build_print.py and validate_print.py.

Units: layout code works in inches from the trim's lower-left corner; the
PDF is in points (72 per inch). Every page is the trim plus a 0.5 in slug on
each side: 0.125 in of it is bleed (art runs to it), the rest holds the crop
marks and a one-line label for the print shop. TrimBox and BleedBox are set
on every page, so a print shop's software can crop either way.

Colors: brand colors stay RGB (the print shop converts them; the notes name
the ones that may shift). QR modules are 100% K, crop marks are the
registration color (/All separation), the die-line is a spot color named
DieCut. Fonts are the brand TTFs the request sent, with DejaVu (matplotlib's
copy) for anything missing; every font is embedded.
"""
import colorsys
import glob
import json
import os
import re
import sys

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', 'data'))
INCH = 72.0


def load_data(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return json.load(f)


PIECES_DATA = load_data('pieces.json')
PIECES = PIECES_DATA['pieces']
PIECE_BY_FILE = {p['file']: p for p in PIECES}
BLEED = PIECES_DATA['bleedIn']
SLUG = PIECES_DATA['slugIn']
SAFE = PIECES_DATA['safeIn']
QR_MIN_IN = PIECES_DATA['qrMinIn']
QUIET = PIECES_DATA['quietModules']
CLAIMS = load_data('claims.json')
LIMITS = CLAIMS['limits']
WORDING = load_data('wording.json')
MARK_OFFSET = 0.0625   # gap between the bleed edge and a crop mark
MARK_LEN = 0.25
# A printed QR module under 0.25 mm is past what phone cameras read
# reliably; under 0.4 mm it wants good light and a steady hand.
MODULE_MIN_MM = 0.25
MODULE_WARN_MM = 0.4
QR_KINDS = ('review', 'booking', 'site', 'call', 'contact')
REBOOK_ORDER = ('booking', 'site', 'call')


# ─── Colors ─────────────────────────────────────────────────────────────

HEX_RE = re.compile(r'^#[0-9a-f]{6}$')


def norm_hex(v):
    s = str(v or '').strip().lower()
    if re.match(r'^#[0-9a-f]{3}$', s):
        s = '#' + ''.join(ch * 2 for ch in s[1:])
    return s if HEX_RE.match(s) else ''


def hex_to_rgb(h):
    h = norm_hex(h) or '#000000'
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def rgb_to_hex(rgb):
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(c)))) for c in rgb)


def luminance(h):
    def ch(c):
        c /= 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = hex_to_rgb(h)
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def mix(a, b, t):
    """a toward b by t (0..1)."""
    ra, rb = hex_to_rgb(a), hex_to_rgb(b)
    return rgb_to_hex([ra[i] + (rb[i] - ra[i]) * t for i in range(3)])


def readable_on(bg):
    """White or near-black, whichever reads better on bg, at 4.5:1 or more.
    A mid-tone (around #787878, or a teal like #008787) reads under 4.5:1
    with both white and #111111; pure black always reaches it there."""
    best = '#ffffff' if contrast('#ffffff', bg) >= contrast('#111111', bg) else '#111111'
    if contrast(best, bg) >= 4.5:
        return best
    return '#ffffff' if contrast('#ffffff', bg) >= contrast('#000000', bg) else '#000000'


def ensure_contrast(fg, bg, minimum=4.5):
    """fg moved toward black or white (the side that can reach it) until it
    reads on bg at `minimum`; fg itself when it already does."""
    if contrast(fg, bg) >= minimum:
        return fg
    target = readable_on(bg)
    lo, hi = 0.0, 1.0
    for _ in range(24):
        mid = (lo + hi) / 2
        if contrast(mix(fg, target, mid), bg) >= minimum:
            hi = mid
        else:
            lo = mid
    return mix(fg, target, hi)


def cmyk_risk(h):
    """Why a brand color may print visibly duller in CMYK, or ''. A rule of
    thumb (no ICC profile in the container): bright, saturated greens,
    blues, purples and oranges sit outside a press's gamut; reds, magentas,
    yellows and muted or dark colors print close."""
    r, g, b = (c / 255.0 for c in hex_to_rgb(h))
    hue, sat, val = colorsys.rgb_to_hsv(r, g, b)
    deg = hue * 360
    if sat < 0.6 or val < 0.6:
        return ''
    if 75 <= deg < 170:
        return 'bright green'
    if 170 <= deg < 200 and sat >= 0.85 and val >= 0.85:
        return 'electric cyan'
    if 200 <= deg < 290:
        return 'bright blue or purple'
    if 15 <= deg < 40 and sat >= 0.8 and val >= 0.9:
        return 'bright orange'
    return ''


class Theme:
    """The colors a piece uses, from the five brand roles. Text pairs are
    repaired to 4.5:1; `repairs` says what moved."""

    def __init__(self, palette, style='brand'):
        p = {k: norm_hex((palette or {}).get(k)) for k in ('bg', 'secondary', 'text', 'muted', 'accent')}
        self.repairs = []
        self.source = dict(p)
        if not all(p.values()):
            # No usable brand palette: a neutral, print-safe set.
            p = {'bg': '#14161a', 'secondary': '#22252b', 'text': '#ffffff', 'muted': '#c3c7cf', 'accent': p.get('accent') or '#c8102e'}
            self.repairs.append('No complete brand palette came with the request, so the cards use a neutral dark set.')
        self.paper = '#ffffff'
        self.panel = self.paper if style == 'light' else p['bg']
        self.accent = p['accent']
        self.on_accent = readable_on(self.accent)
        if contrast(p['text'], self.panel) >= 4.5:
            self.ink = p['text']
        else:
            self.ink = readable_on(self.panel)
            if style != 'light':
                self.repairs.append('The brand text color is too faint on the brand background, so the panels use %s text.' % self.ink)
        self.muted = p['muted'] if contrast(p['muted'], self.panel) >= 4.5 else ensure_contrast(mix(self.ink, self.panel, 0.3), self.panel)
        darks = [c for c in (p['bg'], p['text'], p['secondary']) if contrast(c, self.paper) >= 7]
        self.ink_paper = min(darks, key=luminance) if darks else '#1a1a1a'
        self.muted_paper = p['muted'] if contrast(p['muted'], self.paper) >= 4.5 else ensure_contrast(mix(self.ink_paper, self.paper, 0.35), self.paper)
        self.accent_on_panel = self.accent if contrast(self.accent, self.panel) >= 4.5 else self.ink
        self.accent_on_paper = ensure_contrast(self.accent, self.paper)
        # A rule or band of accent on the panel only when it shows.
        self.rule_panel = self.accent if contrast(self.accent, self.panel) >= 1.6 else self.muted
        self.rule_paper = self.accent if contrast(self.accent, self.paper) >= 1.6 else self.muted_paper

    def risky(self):
        """[(hex, reason)] for the colors these pieces print that may shift."""
        out = []
        for h in (self.panel, self.accent, self.ink, self.ink_paper, self.accent_on_paper):
            why = cmyk_risk(h)
            if why and h not in [x[0] for x in out]:
                out.append((h, why))
        return out[:LIMITS['risk']]


# ─── Fonts ──────────────────────────────────────────────────────────────

def dejavu_paths():
    """{regular, bold} DejaVu Sans TTF paths (matplotlib ships them)."""
    dirs = []
    try:
        import matplotlib
        dirs.append(os.path.join(matplotlib.get_data_path(), 'fonts', 'ttf'))
    except Exception:
        pass
    dirs += ['/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/dejavu', '/usr/share/fonts/TTF', '/usr/local/share/fonts']
    out = {}
    for d in dirs:
        for key, name in (('regular', 'DejaVuSans.ttf'), ('bold', 'DejaVuSans-Bold.ttf')):
            path = os.path.join(d, name)
            if key not in out and os.path.isfile(path):
                out[key] = path
    if 'regular' not in out:
        hits = glob.glob('/usr/**/DejaVuSans.ttf', recursive=True)
        if hits:
            out['regular'] = hits[0]
    if 'regular' in out and 'bold' not in out:
        out['bold'] = out['regular']
    return out


class Fonts:
    """The faces the pieces use, registered with reportlab under fixed names:
    H (heading), B (body), BB (body bold), and FB / FBB (DejaVu, for a
    string the brand face has no glyphs for)."""

    def __init__(self, font_files, heading_family, body_family, files_dir):
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        self.pdfmetrics = pdfmetrics
        self.notes = []
        dv = dejavu_paths()
        if 'regular' not in dv:
            raise RuntimeError('No DejaVu Sans font found (matplotlib\'s copy is missing); cannot embed a fallback face.')
        pdfmetrics.registerFont(TTFont('FB', dv['regular']))
        pdfmetrics.registerFont(TTFont('FBB', dv['bold']))
        loaded = {}   # (family, weight) -> registered name
        for i, f in enumerate(font_files or []):
            path = os.path.join(files_dir, os.path.basename(str(f.get('file') or '')))
            fam = str(f.get('family') or '')
            try:
                weight = int(f.get('weight') or 400)
            except (TypeError, ValueError):
                weight = 400
            if not fam or not os.path.isfile(path):
                continue
            name = 'brand%d' % i
            try:
                pdfmetrics.registerFont(TTFont(name, path))
                loaded[(fam, weight)] = name
            except Exception as e:
                self.notes.append('%s %d could not be embedded (%s); DejaVu Sans stands in.' % (fam, weight, str(e)[:80]))

        def pick(family, want):
            have = sorted(((abs(w - want), -w, n) for (fam, w), n in loaded.items() if fam == family))
            return have[0][2] if have else None

        self.names = {}
        self.families = {}
        h = pick(heading_family, 700)
        b = pick(body_family, 400)
        bb = pick(body_family, 700)
        if bb and bb == b:
            bb = None   # a single-weight face: bold falls back to DejaVu Bold only when asked
        self.names['H'] = h or 'FBB'
        self.names['B'] = b or 'FB'
        self.names['BB'] = bb or (b if b else 'FBB')
        self.families['heading'] = heading_family if h else 'DejaVu Sans'
        self.families['body'] = body_family if b else 'DejaVu Sans'
        self.fallback = not h or not b
        for role, fam, got in (('Heading', heading_family, h), ('Body', body_family, b)):
            if not got:
                self.notes.append('%s font: %s wasn\'t sent as a font file, so DejaVu Sans stands in on the print pieces.' % (role, fam or 'none chosen'))
        self.glyph_fallbacks = set()
        self.dropped = set()

    def face(self, role, text):
        """The registered font for `role` that has every glyph of `text`."""
        name = self.names[role]
        if name in ('FB', 'FBB'):
            return name
        font = self.pdfmetrics.getFont(name)
        cmap = getattr(getattr(font, 'face', None), 'charToGlyph', None) or {}
        missing = [ch for ch in text if not ch.isspace() and ord(ch) not in cmap]
        if missing:
            self.glyph_fallbacks.add(''.join(sorted(set(missing)))[:20])
            return 'FB' if role == 'B' else 'FBB'
        return name

    def printable(self, text):
        """`text` without characters no face here can draw (emoji and the
        like would print as empty boxes)."""
        cmap = getattr(getattr(self.pdfmetrics.getFont('FB'), 'face', None), 'charToGlyph', None) or {}
        names = [n for n in (self.names['H'], self.names['B']) if n not in ('FB', 'FBB')]
        maps = [getattr(getattr(self.pdfmetrics.getFont(n), 'face', None), 'charToGlyph', None) or {} for n in names]
        kept = ''.join(ch for ch in text if ch.isspace() or ord(ch) in cmap or any(ord(ch) in m for m in maps))
        if kept != text:
            self.dropped.update(ch for ch in text if ch not in kept)
        return re.sub(r'\s+', ' ', kept).strip()

    def width(self, text, name, size):
        return self.pdfmetrics.stringWidth(text, name, size) / INCH

    def metrics(self, name, size):
        """(ascent, descent) in inches (descent negative)."""
        a, d = self.pdfmetrics.getAscentDescent(name, size)
        return a / INCH, d / INCH


# ─── QR codes ───────────────────────────────────────────────────────────

def qr_matrix(payload):
    """The module matrix (rows top to bottom, True = dark) and version of
    `payload`: reportlab.graphics.barcode.qr's QrCodeWidget encoder, byte
    mode, error correction M (H has a block-table slip at version 15)."""
    from reportlab.graphics.barcode import qrencoder
    from reportlab.graphics.barcode.qr import QrCodeWidget
    widget = QrCodeWidget([qrencoder.QR8bitByte(payload)], barLevel='M', barBorder=0)
    q = widget.qr
    q.make()
    return [[bool(v) for v in row] for row in q.modules], q.version


# ─── Text fitting ───────────────────────────────────────────────────────

# Where a long email or address may break, best first: after "@" or "."
# reads as a break; after "-" it could pass for hyphenation.
BREAK_AFTER = ('@.', '/_-')


def split_long(fonts, word, name, size, width):
    """A word wider than `width` (an email, a domain) cut after @ . / _ -
    into pieces that each fit, or None. Nothing is added or dropped."""
    out, rest = [], word
    while fonts.width(rest, name, size) > width + 1e-6:
        cut = 0
        for chars in BREAK_AFTER:
            for i, ch in enumerate(rest[:-1]):
                if ch in chars and fonts.width(rest[:i + 1], name, size) <= width + 1e-6:
                    cut = i + 1
            if cut:
                break
        if not cut:
            return None
        out.append(rest[:cut])
        rest = rest[cut:]
    return out + [rest]


def wrap(fonts, text, name, size, width, max_lines):
    """Greedy word wrap, or None when it needs more lines or a word is too
    wide (a long email or address may break after @ . / - _)."""
    words = []
    for w in text.split():
        pieces = split_long(fonts, w, name, size, width) if fonts.width(w, name, size) > width + 1e-6 else [w]
        if pieces is None:
            return None
        # Pieces of one word join without a space.
        words.extend([(p, i > 0) for i, p in enumerate(pieces)])
    if not words:
        return []
    lines, cur = [], ''
    for w, glued in words:
        if glued:
            lines.append(cur)
            cur = w
            continue
        trial = (cur + ' ' + w).strip()
        if fonts.width(trial, name, size) <= width + 1e-6:
            cur = trial
            continue
        if not cur or fonts.width(w, name, size) > width + 1e-6:
            return None
        lines.append(cur)
        cur = w
    lines.append(cur)
    return lines if len(lines) <= max_lines else None


def fit(fonts, text, role, width, max_size, min_size, max_lines=1):
    """{ name, size, lines, clipped } for `text` in `width` inches: the
    biggest size from max_size down to min_size that wraps into max_lines;
    at min_size it is cut with an ellipsis (clipped)."""
    name = fonts.face(role, text)
    # One line when that costs at most a quarter of the size: a headline
    # that wraps to leave one word alone reads worse than a smaller one.
    if max_lines > 1:
        size = max_size
        while size >= max(min_size, max_size * 0.75) - 1e-6:
            if wrap(fonts, text, name, size, width, 1) is not None:
                return {'name': name, 'size': size, 'lines': [text.strip()], 'clipped': False}
            size = round(size - 0.25, 2)
    size = max_size
    while size >= min_size - 1e-6:
        lines = wrap(fonts, text, name, size, width, max_lines)
        if lines is not None:
            return {'name': name, 'size': size, 'lines': lines, 'clipped': False}
        size = round(size - 0.25, 2)
    size = min_size
    words, lines, cur = text.split(), [], ''
    for w in words:
        trial = (cur + ' ' + w).strip()
        if fonts.width(trial, name, size) <= width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    lines = lines[:max_lines]
    last = lines[-1]
    while last and fonts.width(last + '…', name, size) > width:
        last = last[:-1]
    lines[-1] = last.rstrip() + '…'
    return {'name': name, 'size': size, 'lines': lines, 'clipped': True}


# ─── Claims ─────────────────────────────────────────────────────────────

FLAGS = re.IGNORECASE | re.ASCII
CLAIM_RES = [re.compile(p, FLAGS) for p in CLAIMS['patterns']]
REVIEW_BANNED_RES = [re.compile(p, FLAGS) for p in CLAIMS['reviewBanned']]
REVIEW_WORD = re.compile(r'\breview', FLAGS)


def norm_text(s):
    s = str(s or '').lower().replace('‘', "'").replace('’', "'")
    return re.sub(r'\s+', ' ', s).strip()


def facts_text(inputs):
    """What a printed claim may come from: the request's facts plus the
    business fields themselves (a name like "Best Choice Auto" is a fact)."""
    b = inputs.get('business') or {}
    parts = [str(inputs.get('facts') or '')]
    for k in ('name', 'type', 'person', 'phone', 'email', 'site', 'address', 'city', 'state', 'serviceArea'):
        if b.get(k):
            parts.append(str(b[k]))
    return norm_text('\n'.join(parts))


def claim_flags(lines, facts):
    """[(line, phrase)]: claim-like phrases the facts don't contain."""
    out = []
    for line in lines:
        for rx in CLAIM_RES:
            for m in rx.finditer(line):
                phrase = norm_text(m.group(0))
                if phrase and phrase not in facts and (line, phrase) not in out:
                    out.append((line, phrase))
    return out


def own_names(inputs):
    """The business's own name and address as printed: never read as a review
    incentive ("Thanks for choosing 5 Star Auto Spa" on a review piece is the
    shop's name, not a request for five stars)."""
    b = inputs.get('business') or {}
    links = inputs.get('links') or {}
    names = [one_line(b.get('name'), 120), one_line(b.get('site'), 200), site_label(links.get('site'))]
    return [n for i, n in enumerate(names) if n and n not in names[:i]]


def review_flags(lines, review_piece, exempt=()):
    """[(line, phrase)]: review incentives or gating (Google policy). Every
    line of a review piece, and any line that mentions a review elsewhere.
    `exempt` (own_names) is taken out of a line before it is checked."""
    out = []
    for line in lines:
        check = line
        for name in exempt:
            check = re.sub(re.escape(name), ' ', check, flags=re.IGNORECASE)
        if not review_piece and not REVIEW_WORD.search(check):
            continue
        for rx in REVIEW_BANNED_RES:
            m = rx.search(check)
            if m and (line, m.group(0)) not in out:
                out.append((line, m.group(0)))
    return out


# ─── Inputs ─────────────────────────────────────────────────────────────

def one_line(v, cap):
    return re.sub(r'\s+', ' ', re.sub(r'[\x00-\x1f\x7f  ]', ' ', str(v or ''))).strip()[:cap]


def site_label(url):
    """"https://www.shine.com/" -> "shine.com"; '' for anything else."""
    m = re.match(r'^https?://([^/?#\s]+)([^?#\s]*)', str(url or ''), re.I)
    if not m:
        return ''
    host = re.sub(r'^www\.', '', m.group(1).lower())
    path = m.group(2)
    path = '' if path in ('', '/') else path.rstrip('/')
    return host + path


def load_inputs(path):
    """print-inputs.json, checked: (inputs, errors)."""
    errors = []
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        return None, ['%s: could not read it (%s)' % (path, e)]
    if not isinstance(data, dict) or data.get('version') != 1:
        return None, ['%s: not a version 1 print-inputs file' % path]
    b = data.get('business')
    if not isinstance(b, dict) or not one_line(b.get('name'), 200):
        errors.append('business.name is missing')
    links = data.get('links')
    if not isinstance(links, dict):
        errors.append('links is missing')
        data['links'] = links = {}
    for k in QR_KINDS:
        key = 'vcard' if k == 'contact' else k
        v = links.get(key, '')
        if not isinstance(v, str):
            errors.append('links.%s must be a string' % key)
    if data.get('rebook') not in REBOOK_ORDER + ('',):
        errors.append('rebook must be one of %s or ""' % ', '.join(REBOOK_ORDER))
    return data, errors


def link_for(kind, links):
    if kind == 'contact':
        return links.get('vcard') or ''
    return links.get(kind) or ''


def load_copy(path):
    """copy.json (optional): (copy, errors). Unknown keys and wording outside
    data/wording.json are errors, so nothing unchecked reaches the press."""
    if not path:
        return {}, []
    try:
        with open(path, encoding='utf-8') as f:
            copy = json.load(f)
    except Exception as e:
        return {}, ['%s: could not read it (%s)' % (path, e)]
    if not isinstance(copy, dict):
        return {}, ['copy.json must be a JSON object']
    errors = []
    allowed = {'style', 'tagline', 'nameWithLogo', 'person', 'logoPad', 'notes',
               'reviewHeadline', 'reviewAsk', 'reviewHelp', 'reviewThanks', 'rebookHeadline', 'contactHeadline', 'gloveboxKeep'}
    for k in copy:
        if k not in allowed:
            errors.append('copy.json: unknown key "%s" (allowed: %s)' % (k, ', '.join(sorted(allowed))))
    if copy.get('style', 'brand') not in ('brand', 'light'):
        errors.append('copy.json: style is "brand" or "light"')
    if copy.get('logoPad', 'auto') not in ('auto', 'always', 'never'):
        errors.append('copy.json: logoPad is "auto", "always" or "never"')
    for k in ('nameWithLogo', 'person'):
        if k in copy and copy[k] is not None and not isinstance(copy[k], bool):
            errors.append('copy.json: %s is true, false or null' % k)
    if 'tagline' in copy:
        t = copy['tagline']
        if not isinstance(t, str):
            errors.append('copy.json: tagline is a string ("" for none)')
        elif len(one_line(t, 999)) > LIMITS['tagline']:
            errors.append('copy.json: tagline is %d characters (at most %d)' % (len(one_line(t, 999)), LIMITS['tagline']))
    for k in ('reviewHeadline', 'reviewAsk', 'reviewHelp', 'reviewThanks', 'rebookHeadline', 'contactHeadline', 'gloveboxKeep'):
        if k in copy and copy[k] not in WORDING[k]:
            errors.append('copy.json: %s must be one of %s' % (k, json.dumps(WORDING[k])))
    notes = copy.get('notes', [])
    if not isinstance(notes, list) or len(notes) > 3 or not all(isinstance(n, str) for n in notes):
        errors.append('copy.json: notes is a list of at most 3 strings')
    return copy, errors
