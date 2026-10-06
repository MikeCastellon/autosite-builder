"""Shared helpers for the launch-words scripts: the data files, lengths as
the server counts them, text checks (unsourced claims, review incentives,
phone numbers and links) and the request's words-inputs.json.

The same rules live in src/lib/kit/words.js (the server's sanitizer), which
mirrors data/limits.json and data/claim_terms.json; a test keeps them equal.
"""
import json
import os
import re
import sys

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')


def load_data(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return json.load(f)


LIMITS = load_data('limits.json')
TERMS = load_data('claim_terms.json')
CTAS = tuple(LIMITS['ctas'])
NAME_PH = LIMITS['placeholders']['name']
REVIEW_PH = LIMITS['placeholders']['reviewLink']

# ─── Lengths and lines ──────────────────────────────────────────────────

# JavaScript's whitespace, which oneLine()/trim() in the sanitizer collapse.
_JS_WS = '\t\n\x0b\x0c\r \xa0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'
_CONTROL = re.compile('[\x00-\x08\x0b-\x1f\x7f\u2028\u2029]')
_SPACES = re.compile('[%s]+' % re.escape(_JS_WS))


def js_length(v):
    """String.prototype.length: UTF-16 code units (an emoji counts 2), the
    way the server measures every limit."""
    return len(v.encode('utf-16-le')) // 2


def one_line(v):
    """The sanitizer's one-line form: control characters and whitespace runs
    become one space, ends trimmed."""
    return _SPACES.sub(' ', _CONTROL.sub(' ', v.replace('\n', ' '))).strip(_JS_WS)


def clean_block(v):
    """The sanitizer's multi-line form: \\r\\n made \\n, no control
    characters, no spaces at line ends, at most one blank line in a row."""
    v = v.replace('\r\n', '\n').replace('\r', '\n').replace('\t', ' ')
    v = _CONTROL.sub(' ', v)
    lines = [re.sub(r'[ \xa0]+$', '', ln) for ln in v.split('\n')]
    v = re.sub(r'\n{3,}', '\n\n', '\n'.join(lines))
    return v.strip(_JS_WS)


# ─── Normalized text for the checks ─────────────────────────────────────

_QUOTES = {'‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'",
           '“': '"', '”': '"', '„': '"', '‟': '"', '″': '"'}
_HYPHENS = {'‐': '-', '‑': '-', '‒': '-', '⁃': '-', '−': '-'}


def norm(text):
    """Lowercase, straight quotes, ASCII hyphens, one space between words."""
    s = str(text or '').lower()
    for a, b in list(_QUOTES.items()) + list(_HYPHENS.items()):
        s = s.replace(a, b)
    return _SPACES.sub(' ', s).strip()


_NEUTRAL = [re.compile(r'(?<![a-z0-9-])' + re.escape(norm(p)) + r'(?![a-z0-9-])') for p in TERMS['neutral']]


def check_text(text):
    """The form the checks read: norm() with the neutral phrases ('feel
    free') blanked, so a figure of speech never counts as a claim."""
    s = norm(text)
    for rx in _NEUTRAL:
        s = rx.sub(' ', s)
    return _SPACES.sub(' ', s).strip()


def name_key(v):
    """A service or category name for matching: lowercase letters and digits
    only, '&' read as 'and'."""
    return re.sub(r'[^a-z0-9]+', '', norm(v).replace('&', 'and'))


def _term_re(term):
    return re.compile(r'(?<![a-z0-9-])' + re.escape(term) + r'(?![a-z0-9-])')


_GROUPS = {level: [[(t, _term_re(norm(t))) for t in group] for group in TERMS[level]] for level in ('hard', 'soft')}
_NUM = {k: re.compile(v, re.I) for k, v in TERMS['numbers'].items()}
INCENTIVES = [re.compile(p, re.I) for p in TERMS['incentives']]
GATING = [re.compile(p, re.I) for p in TERMS['gating']]
PHONE_RE = re.compile(TERMS['phone'], re.I)
ONLINE_BOOKING = re.compile(TERMS['onlineBooking'], re.I)
URL_RE = re.compile(TERMS['url'], re.I)
_NUMBER_TOKEN = re.compile(r'\d[\d,]*(?:\.\d+)?')
_PLACEHOLDER = re.compile(r'\[[^\[\]\n]{1,40}\]')


def _num(v):
    """'1,250.00' -> '1250', '4.9' -> '4.9'."""
    s = v.replace(',', '')
    if '.' in s:
        s = s.rstrip('0').rstrip('.')
    return s


def numbers_in(text):
    return {_num(m.group(0)) for m in _NUMBER_TOKEN.finditer(text or '')}


def strip_links(text):
    """Text without links and phone numbers, so their digits and words are
    never read as claims."""
    return PHONE_RE.sub(' ', URL_RE.sub(' ', text or ''))


class Sources:
    """What the copy may rest on. primary: the customer's intake answers and
    the site's business facts; reviews: the pasted reviews (claims from
    them only as word-for-word quotes); site: the written site copy (a
    claim found only there is a warning: the claims ledger checks it)."""

    def __init__(self, primary='', reviews='', site=''):
        self.primary = check_text(primary)
        self.reviews = check_text(reviews)
        self.site = check_text(site)
        self.numbers = numbers_in(self.primary) | numbers_in(self.reviews)
        self.site_numbers = numbers_in(self.site)
        self.percents = {_num(re.sub(r'[^\d.,]', '', m.group(0))) for m in _NUM['percent'].finditer(self.primary + ' ' + self.reviews)}

    @classmethod
    def from_inputs(cls, inputs):
        src = (inputs or {}).get('sources') or {}
        return cls(primary='\n'.join([src.get('intake') or '', src.get('business') or '']),
                   reviews=src.get('reviews') or '', site=src.get('site') or '')


def _quoted_spans(text):
    """Passages inside straight or curly double quotes."""
    return [m.group(1) for m in re.finditer(r'"([^"]{3,})"', check_text(text))]


def _in_reviews_quote(text, term_re, sources):
    """Is the term inside a quoted passage that is word for word a pasted
    review (or part of one)?"""
    for span in _quoted_spans(text):
        if term_re.search(span) and span.strip(' .,!?') and span.strip(' .,!?') in sources.reviews:
            return True
    return False


def claim_findings(text, sources):
    """Unsourced claims in one piece of copy: [(level, message)], level
    'error' or 'warning'."""
    out = []
    raw = strip_links(text)
    t = check_text(raw)
    terms = set()
    for level in ('hard', 'soft'):
        for group in _GROUPS[level]:
            used = next((term for term, rx in group if rx.search(t)), None)
            if not used:
                continue
            terms.add(norm(used))
            if any(rx.search(sources.primary) for _, rx in group):
                continue
            if any(rx.search(sources.reviews) for _, rx in group):
                if level == 'hard' and not _in_reviews_quote(raw, _term_re(norm(used)), sources):
                    out.append(('error', '"%s": only a pasted review says this; quote that review word for word, or leave it out' % used))
                continue
            if any(rx.search(sources.site) for _, rx in group):
                out.append(('warning', '"%s": only the written site says this, not the customer; keep it only if you are sure' % used))
                continue
            out.append(('error' if level == 'hard' else 'warning',
                        '"%s" is not in the customer\'s answers%s' % (used, '' if level == 'hard' else ' (judge it: keep only if the inputs support it)')))
    for m in _NUM['money'].finditer(t):
        n = _num(re.sub(r'[^\d.,]', '', m.group(0)))
        if n not in sources.numbers:
            out.append(('error', 'price "%s" is not in the customer\'s answers' % m.group(0).strip()))
    for m in _NUM['percent'].finditer(t):
        n = _num(re.sub(r'[^\d.,]', '', m.group(0)))
        if n not in sources.percents:
            out.append(('error', '"%s" is not in the customer\'s answers' % m.group(0).strip()))
    for m in _NUM['count'].finditer(t):
        if _num(m.group(1)) not in sources.numbers:
            out.append(('error', '"%s" is not in the customer\'s answers' % m.group(0).strip()))
    for m in _NUM['since'].finditer(t):
        if m.group(1) not in sources.numbers:
            out.append(('error', '"%s" is not in the customer\'s answers' % m.group(0).strip()))
    for m in _NUM['rating'].finditer(t):
        n = m.group(1) or m.group(2)
        if norm(m.group(0)) in terms:
            continue  # "5-star" was already reported as a claim word
        if n and _num(n) not in sources.numbers:
            out.append(('error', 'rating "%s" is not in the customer\'s answers' % m.group(0).strip()))
    seen, uniq = set(), []
    for item in out:
        if item not in seen:
            seen.add(item)
            uniq.append(item)
    return uniq


def money_hits(text):
    """Prices in the text ('$220', '$1,200.00')."""
    return [m.group(0).strip().rstrip(',') for m in _NUM['money'].finditer(strip_links(text))]


def incentive_hits(text):
    t = check_text(text)
    return [m.group(0) for rx in INCENTIVES for m in [rx.search(t)] if m]


def gating_hits(text):
    t = check_text(text)
    return [m.group(0) for rx in GATING for m in [rx.search(t)] if m]


def phone_hits(text):
    """Phone numbers outside links (a link's digits are no phone number)."""
    return [m.group(0) for m in PHONE_RE.finditer(URL_RE.sub(' ', text or ''))]


def url_hits(text):
    return [m.group(0) for m in URL_RE.finditer(text or '')]


def placeholders(text):
    return _PLACEHOLDER.findall(text or '')


# ─── The request's inputs ───────────────────────────────────────────────

def load_inputs(path):
    """words-inputs.json as a dict ({} without a path)."""
    if not path:
        return {}
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {}


def photo_refs(inputs):
    """{ ref and container file name: photo } for the request's photos."""
    out = {}
    for p in (inputs or {}).get('photos') or []:
        if isinstance(p, dict) and p.get('ref'):
            out[p['ref']] = p
            if p.get('file'):
                out[p['file']] = p
    return out
