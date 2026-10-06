"""Shared helpers for the launch-handover scripts: the contract (data/),
finding the uploaded inputs, text rules that match the server's sanitizer
(src/lib/kit/handover.js oneLine), color math for readable text, and the
no-invented-facts checks the validator runs on the words Claude writes.
"""
import json
import os
import re
import sys
import unicodedata

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(HERE)
DATA_DIR = os.path.join(SKILL_DIR, 'data')
WORK_DIR = '/tmp/handover'
PLAN_PATH = os.path.join(WORK_DIR, 'plan.json')


def load_data(name):
    with open(os.path.join(DATA_DIR, name), encoding='utf-8') as f:
        return json.load(f)


CONTRACT = load_data('contract.json')
KIT_FILES = load_data('kit_files.json')['files']
HOW_TO_EDIT = load_data('how_to_edit.json')
LIMITS = CONTRACT['limits']
CONTENT_LIMITS = CONTRACT['content']
INPUTS_FILE = CONTRACT['inputsFile']
FILES = CONTRACT['files']
SECTIONS = CONTRACT['sections']
SECTION_TITLE = {s['id']: s['title'] for s in SECTIONS}
PARTS = CONTRACT['zipParts']
PART_BY_KEY = {p['key']: p for p in PARTS}
ROOT_FILES = CONTRACT['rootFiles']
BRAND_BOARD = CONTRACT['brandBoard']
GENERATED = CONTRACT['generated']
ZIP_PATH_RE = re.compile(CONTRACT['zipPathPattern'], re.A)
PLAIN_NAME_RE = re.compile(r'[A-Za-z0-9][A-Za-z0-9._()+-]{0,150}', re.A)
LINK_KEYS = ('site', 'booking', 'review', 'signIn')


def read_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def write_json(path, data):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


# ─── Text ────────────────────────────────────────────────────────────

# JavaScript's \s, so one_line() is exactly the server's oneLine().
JS_WS = ('\t\n\x0b\x0c\r \xa0\u1680' + ''.join(chr(c) for c in range(0x2000, 0x200b))
         + '\u2028\u2029\u202f\u205f\u3000\ufeff')
_CONTROL = re.compile('[\x00-\x1f\x7f\u2028\u2029]+')
_SPACES = re.compile('[%s]+' % re.escape(JS_WS))


def one_line(v):
    """oneLine() without the cap: control characters and whitespace runs
    become one space, the ends are trimmed."""
    return _SPACES.sub(' ', _CONTROL.sub(' ', v)).strip(JS_WS)


def js_length(v):
    """String.prototype.length (UTF-16 code units): the server's caps count
    these, so an emoji counts 2."""
    return len(v.encode('utf-16-le')) // 2


def clip(v, max_len):
    """A one-line string cut to max_len UTF-16 units without splitting a
    character (for text the scripts take from the inputs)."""
    s = one_line(v) if isinstance(v, str) else ''
    while js_length(s) > max_len:
        s = s[:-1]
    return s.rstrip(JS_WS)


def host_of(url):
    """'glossboss.com' for 'https://www.glossboss.com/', for display."""
    s = re.sub(r'^https?://', '', url or '', flags=re.I)
    s = re.sub(r'^www\.', '', s, flags=re.I)
    return s.rstrip('/')


def display_url(url):
    """A link as people read it: host_of() without the '#book' a booking
    link carries (the printed and linked URL keeps it; it only matters to
    the page)."""
    return host_of((url or '').split('#', 1)[0])


# ─── Finding the inputs ──────────────────────────────────────────────

LIKELY = ['/mnt/user-data/uploads', '/mnt/user-data', '/mnt/data', '/mnt/inputs', '/mnt/uploads', '/mnt',
          '/workspace', '/uploads', '/input', '/inputs', '/files', '/data', '/home', '/tmp']
SKIP_DIRS = {'/proc', '/sys', '/dev', '/usr', '/lib', '/lib32', '/lib64', '/libx32', '/bin', '/sbin', '/etc',
             '/var', '/opt', '/run', '/boot', '/snap', '/srv', '/skills', WORK_DIR, '/nix'}
SKIP_NAMES = {'node_modules', '__pycache__', 'site-packages', 'dist-packages', '.cache', '.git', '.local',
              '.config', '.npm', '.ipython', '.matplotlib'}


def _walk_for(root, name, depth, skip, found):
    if depth < 0 or not os.path.isdir(root):
        return
    try:
        entries = sorted(os.scandir(root), key=lambda e: e.name)
    except OSError:
        return
    for e in entries:
        try:
            if e.is_file() and e.name == name:
                found.append(e.path)
        except OSError:
            continue
    for e in entries:
        try:
            if e.is_dir(follow_symlinks=False) and e.path not in SKIP_DIRS and e.name not in SKIP_NAMES \
                    and e.path not in skip:
                _walk_for(e.path, name, depth - 1, skip, found)
        except OSError:
            continue


def search_roots(extra=()):
    skip = {os.environ.get('OUTPUT_DIR') or ''}
    usual = [os.environ.get('INPUT_DIR') or '', os.getcwd(), os.path.expanduser('~')] + LIKELY
    roots = []
    for r in list(extra) + [u for u in usual if u not in SKIP_DIRS and u not in skip]:
        if r and r not in roots:
            roots.append(r)
    return roots, skip


def find_named(name, first_dirs=()):
    """The path of an uploaded file by its exact name, or None. Looks next
    to `first_dirs` first (the uploads share one folder), then in the usual
    upload folders, then a few levels into the whole filesystem."""
    for d in first_dirs:
        p = os.path.join(d, name)
        if d and os.path.isfile(p):
            return p
    roots, skip = search_roots()
    for root in roots:
        found = []
        _walk_for(root, name, 3, skip, found)
        if found:
            return found[0]
    found = []
    _walk_for('/', name, 3, skip, found)
    return found[0] if found else None


def find_inputs_file(explicit=None):
    if explicit:
        return explicit if os.path.isfile(explicit) else None
    return find_named(INPUTS_FILE)


# ─── Zip paths ───────────────────────────────────────────────────────

def zip_path(key, name):
    part = PART_BY_KEY.get(key)
    if not part or not isinstance(name, str) or not PLAIN_NAME_RE.fullmatch(name):
        return ''
    return '%s/%s' % (part['folder'], name)


def is_zip_path(p):
    return isinstance(p, str) and js_length(p) <= LIMITS['path'] and bool(ZIP_PATH_RE.fullmatch(p)) and '..' not in p


def kit_file_info(key, name):
    """data/kit_files.json's entry for a zip file ('root' for the top)."""
    return KIT_FILES.get('%s/%s' % (key, name)) or {'label': name, 'what': '', 'use': '', 'keep': 9}


# ─── Colors ──────────────────────────────────────────────────────────

HEX6 = re.compile(r'#[0-9a-fA-F]{6}', re.A)


def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb_to_hex(rgb):
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(c)))) for c in rgb)


def luminance(h):
    def ch(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = hex_to_rgb(h)
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def mix(a, b, t):
    """a moved toward b by t (0..1)."""
    ra, rb = hex_to_rgb(a), hex_to_rgb(b)
    return rgb_to_hex(tuple(x + (y - x) * t for x, y in zip(ra, rb)))


def readable_on(bg):
    """White or near-black, whichever reads better on bg, at 4.5:1 or more.
    A mid-tone (luminance near 0.19) gets only about 4.35:1 from either, so
    then the better of white and pure black, which always reaches 4.58:1."""
    best = max(('#ffffff', '#111111'), key=lambda c: contrast(c, bg))
    if contrast(best, bg) >= 4.5:
        return best
    return '#ffffff' if contrast('#ffffff', bg) >= contrast('#000000', bg) else '#000000'


def ensure_contrast(fg, bg, minimum=4.5):
    """fg, darkened or lightened just enough to reach `minimum` on bg (the
    same idea as the site's ensureContrast); readable_on(bg) when even the
    end of the scale doesn't get there."""
    if contrast(fg, bg) >= minimum:
        return fg
    toward = '#000000' if luminance(bg) > 0.18 else '#ffffff'
    for i in range(1, 21):
        c = mix(fg, toward, i / 20.0)
        if contrast(c, bg) >= minimum:
            return c
    return readable_on(bg)


def valid_palette(p):
    roles = ('bg', 'secondary', 'text', 'muted', 'accent')
    return isinstance(p, dict) and all(isinstance(p.get(r), str) and HEX6.fullmatch(p[r]) for r in roles)


# ─── No invented facts ───────────────────────────────────────────────

# Claims a handover must not add on its own. Each is fine when the site's
# copy, the business facts or the intake already say it (the corpus).
# 'error' claims are about the business; 'warn' ones also show up in plain
# advice ("reply to 1-star reviews too"), so they are flagged, not refused.
CLAIM_PATTERNS = [
    (re.compile(r'\bguarantee[ds]?\b|\bwarrant(y|ies|ied)\b', re.I), 'a guarantee or warranty', 'error'),
    (re.compile(r'\bcertifi(ed|cation|cations)\b|\blicen[cs]ed\b|\binsured\b|\bbonded\b', re.I), 'a certification, license or insurance', 'error'),
    (re.compile(r'\baward(s|ed|-winning)?\b', re.I), 'an award', 'error'),
    (re.compile(r'#\s?1\b|\bnumber one\b|\bno\.\s?1\b|\bbest in\b|\btop[- ]rated\b|\bhighest[- ]rated\b', re.I), 'a "best" or #1 claim', 'error'),
    (re.compile(r'\b\d(\.\d)?\s*(-|\s)?stars?\b|\bfive[- ]stars?\b|\u2605', re.I), 'a star rating', 'warn'),
    (re.compile(r'\b\d+\+?\s*(years?|yrs)\b', re.I), 'a number of years', 'warn'),
    (re.compile(r'\b\d{2,}\+?\s*(happy\s+)?(customers|clients|cars|vehicles|jobs|reviews|details)\b', re.I), 'a count of customers or jobs', 'warn'),
]
# Google doesn't allow anything in return for a review.
INCENTIVE_RE = re.compile(
    r'(discount|% off|\bfree\b|gift card|coupon|reward|raffle|giveaway|enter to win|in exchange|prize)', re.I)
REVIEW_RE = re.compile(r'\breview', re.I)
# The Google profile copy is paste-ready: the owner pastes it, nobody else.
DONE_FOR_YOU_RE = re.compile(
    r"\bwe('ve| have| will|'ll)?\s+(already\s+)?(posted|published|updated|set up|added|uploaded|changed)\b[^.]*\b(google|profile|instagram|facebook|tiktok)",
    re.I)
URL_RE = re.compile(r'(https?://[^\s<>"\')]+|\bwww\.[^\s<>"\')]+)', re.I)
# A web address written without http(s):// ("glossboss-deals.com/promo"):
# the intro names the site that way, so these are checked against the links
# too. Only common web endings, so "words.pdf" or "e.g." never match.
BARE_HOST_RE = re.compile(
    r'(?<![@\w.-])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+'
    r'(?:com|net|org|co|us|io|biz|info|app|site|online|shop|store|auto|autos|car|cars|page|me|ca|uk|au|nz|ie|'
    r'link|xyz|website|services|pro|business|club|live|today|world|ai|tv|ly|gl|to|example|test))\b(/[^\s<>"\')]*)?',
    re.I)
EMAIL_RE = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+', re.A)
# A North American phone number, however it is written.
PHONE_RE = re.compile(r'(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)')
FILE_RE = re.compile(r'\b[A-Za-z0-9][A-Za-z0-9._()+-]*\.(pdf|png|jpe?g|vcf|zip|txt|json)\b', re.I)


def _digits(s):
    d = re.sub(r'\D', '', s)
    return d[1:] if len(d) == 11 and d.startswith('1') else d


def sentences(text):
    return [s for s in re.split(r'(?<=[.!?])\s+', text) if s]


def text_problems(text, where, corpus, links, file_names, hosts=()):
    """(errors, warnings) for one piece of customer-facing text.
    corpus: lowercased facts text (business facts, intake, design reasons).
    links: the links handover-inputs.json allows. file_names: every file
    name the zip will hold. hosts: other addresses the text may name without
    a link (their own domain while it is still being connected)."""
    errors, warnings = [], []
    for pattern, label, level in CLAIM_PATTERNS:
        for m in pattern.finditer(text):
            phrase = m.group(0).lower()
            if phrase.strip() and phrase in corpus:
                continue
            if level == 'warn':
                warnings.append('%s: "%s" looks like %s that the inputs don\'t state; keep it only if they do' % (where, m.group(0), label))
            else:
                errors.append('%s: "%s" is %s that the inputs don\'t state; remove it' % (where, m.group(0), label))
    for s in sentences(text):
        if REVIEW_RE.search(s) and INCENTIVE_RE.search(s) and not re.search(r"\b(never|don'?t|do not|no)\b", s, re.I):
            errors.append('%s: "%s" sounds like something in return for a review; Google doesn\'t allow incentives' % (where, s[:80]))
    if DONE_FOR_YOU_RE.search(text):
        errors.append('%s: the Google profile and social copy is paste-ready (the owner pastes it); never say we posted or updated it' % where)
    allowed = {l.rstrip('/').lower() for l in links if l} | {l.split('#', 1)[0].rstrip('/').lower() for l in links if l}
    allowed_hosts = {host_of(l).lower() for l in links if l} | {display_url(l).lower() for l in links if l}
    for m in URL_RE.finditer(text):
        u = m.group(0).rstrip('.,;:!?').rstrip('/').lower()
        if u not in allowed and host_of(u).lower() not in allowed_hosts:
            errors.append('%s: link "%s" is not one of the links in handover-inputs.json' % (where, m.group(0)))
    # Addresses without http(s)://: the bare host of a given link, or one of
    # the given links as the PDF shows them; nothing else.
    bare_ok = allowed_hosts | {host_of(l).split('/', 1)[0].lower() for l in links if l} | {host_of(h).lower() for h in hosts if h}
    no_scheme = URL_RE.sub(' ', text)
    for m in BARE_HOST_RE.finditer(EMAIL_RE.sub(' ', no_scheme)):
        u = m.group(0).rstrip('.,;:!?').rstrip('/').lower()
        if host_of(u).lower() not in bare_ok:
            errors.append('%s: "%s" looks like a web address that is not one of the links in handover-inputs.json' % (where, m.group(0)))
    # An email address or phone number nobody gave us would send the owner
    # (or their customers) somewhere made up.
    for m in EMAIL_RE.finditer(text):
        if m.group(0).lower() not in corpus:
            errors.append('%s: the email address "%s" is not in the inputs; never invent one (say "reply to any email from us")' % (where, m.group(0)))
    corpus_phones = {_digits(p.group(0)) for p in PHONE_RE.finditer(corpus)}
    for m in PHONE_RE.finditer(text):
        if _digits(m.group(0)) not in corpus_phones:
            errors.append('%s: the phone number "%s" is not in the inputs; never invent one' % (where, m.group(0)))
    for m in FILE_RE.finditer(text):
        name = m.group(0)
        if name not in file_names:
            errors.append('%s: mentions %s, which is not in this kit' % (where, name))
    return errors, warnings


# ─── Fonts and text for the PDF ──────────────────────────────────────

def ascii_fallback(ch):
    """A plain stand-in for a character a font can't draw."""
    repl = {'\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u2013': '-', '\u2014': '-',
            '\u2026': '...', '\u2022': '-', '\u2192': '->', '\u00a0': ' ', '\u2039': '<', '\u203a': '>'}
    if ch in repl:
        return repl[ch]
    base = unicodedata.normalize('NFKD', ch).encode('ascii', 'ignore').decode('ascii')
    return base or ('' if unicodedata.category(ch).startswith(('M', 'C')) else '?')
