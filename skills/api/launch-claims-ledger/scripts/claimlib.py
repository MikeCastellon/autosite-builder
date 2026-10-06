"""Shared code of the launch-claims-ledger scripts: reading claims-input.json,
comparing text the way the server does, splitting text into sentences and
the regex pre-pass that finds candidate claims.

The text rules (normalize, quote_in, numbers) are ports of the server's
src/lib/kit/claims.js (normalizeClaimText, quoteInText, claimNumbers), so a
ledger that validates here is stored exactly as written. tests/parity.json
is written from the JS side and test_claims.py checks both agree.
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

INPUT_NAME = 'claims-input.json'
PRINT_PREFIX = 'kit-print-'

# src/lib/kit/claims.js: LEDGER_VERSION, CLAIM_STATUSES, CLAIM_WHERE,
# CLAIM_KINDS, CLAIM_LIMITS, REVIEW_FIELD, BUSINESS_INFO_PREFIX.
LEDGER_VERSION = 1
STATUSES = ('needs-rewrite', 'unsourced', 'sourced')
WHERE = ('site', 'gbp', 'seo', 'social', 'print')
KINDS = ('price', 'rating', 'review', 'years', 'number', 'award', 'certification', 'guarantee', 'warranty', 'brand',
         'area', 'superlative', 'availability', 'other')
LIMITS = {'claims': 200, 'text': 300, 'quote': 300, 'suggestion': 300, 'path': 120, 'note': 200}
REVIEW_FIELD = 'testimonials'
BUSINESS_INFO_PREFIX = 'businessInfo.'


# ─── Comparing text (ports of src/lib/kit/claims.js) ─────────────────

_SINGLE = re.compile('[\u2018\u2019\u201a\u201b\u2032]')
_DOUBLE = re.compile('[\u201c\u201d\u201e\u201f\u2033]')
_DASHES = re.compile('[\u2010-\u2015\u2212]')
_ZERO_WIDTH = re.compile('[\u200b-\u200d\ufeff]')
_WS = re.compile(r'\s+')
_TRIM_QUOTE = re.compile('^["\'\\s.\u2026]+|["\'\\s.\u2026]+$')


def normalize(s):
    """normalizeClaimText: NFKC, straight quotes and dashes, no zero-width
    characters, lower case, single spaces, trimmed."""
    s = unicodedata.normalize('NFKC', str(s or ''))
    s = _SINGLE.sub("'", s)
    s = _DOUBLE.sub('"', s)
    s = _DASHES.sub('-', s)
    s = _ZERO_WIDTH.sub('', s)
    return _WS.sub(' ', s.lower()).strip()


def quote_in(quote, text):
    """quoteInText: is `quote` a word-for-word excerpt of `text`? Case and
    spacing don't count; wrapping quote marks, ellipses and a final period
    are ignored; under 4 characters never matches."""
    q = _TRIM_QUOTE.sub('', normalize(quote))
    return len(q) >= 4 and q in normalize(text)


NUMBER_WORDS = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16,
    'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
    'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
}
_TENS = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety'
_UNITS = 'one|two|three|four|five|six|seven|eight|nine'
# Same order of alternatives as the JS (insertion order of NUMBER_WORDS).
_WORD_NUMBER = re.compile(r'\b(?:(%s)[ -](%s)|(%s))\b' % (_TENS, _UNITS, '|'.join(NUMBER_WORDS)), re.A)
_DIGITS = re.compile(r'\d+(?:,\d{3})*(?:\.\d+)?', re.A)


def _canonical(s):
    whole, _, frac = s.replace(',', '').partition('.')
    whole = re.sub(r'^0+(?=\d)', '', whole)
    frac = frac.rstrip('0')
    return '%s.%s' % (whole, frac) if frac else whole


def numbers(text):
    """claimNumbers: the numbers a text states, digits or words, as sorted
    unique strings ("five-year" and "5 year" both give "5")."""
    t = normalize(text)
    out = set(_canonical(m.group(0)) for m in _DIGITS.finditer(t))
    for m in _WORD_NUMBER.finditer(t):
        out.add(str(NUMBER_WORDS[m.group(3)] if m.group(3) else NUMBER_WORDS[m.group(1)] + NUMBER_WORDS[m.group(2)]))
    return sorted(out)


def one_line(v):
    """launchKit.js oneLine() without the cap."""
    return _WS.sub(' ', re.sub('[\x00-\x1f\x7f\u2028\u2029]+', ' ', v)).strip() if isinstance(v, str) else ''


# ─── Inputs ──────────────────────────────────────────────────────────

LIKELY = ['/mnt/user-data/uploads', '/mnt/user-data', '/mnt/data', '/mnt/inputs', '/mnt/uploads', '/mnt',
          '/workspace', '/uploads', '/input', '/inputs', '/files', '/data', '/home', '/tmp']
SKIP_DIRS = {'/proc', '/sys', '/dev', '/usr', '/lib', '/lib32', '/lib64', '/libx32', '/bin', '/sbin', '/etc',
             '/var', '/opt', '/run', '/boot', '/snap', '/srv', '/skills', '/tmp/claims', '/nix'}
SKIP_NAMES = {'node_modules', '__pycache__', 'site-packages', 'dist-packages', '.cache', '.git', '.local',
              '.config', '.npm', '.ipython', '.matplotlib'}


def _wanted(name):
    return name == INPUT_NAME or (name.startswith(PRINT_PREFIX) and name.lower().endswith('.pdf'))


def _walk(root, depth, found, skip):
    if depth < 0 or not os.path.isdir(root):
        return
    try:
        entries = sorted(os.scandir(root), key=lambda e: e.name)
    except OSError:
        return
    for e in entries:
        try:
            if e.is_dir(follow_symlinks=False):
                if e.path in SKIP_DIRS or e.name in SKIP_NAMES or e.path in skip:
                    continue
                _walk(e.path, depth - 1, found, skip)
            elif e.is_file() and _wanted(e.name):
                found.setdefault(e.name, e.path)
        except OSError:
            continue


def find_inputs(extra_roots=()):
    """{file name: path} of claims-input.json and the kit-print-*.pdf files.
    The API puts uploads in the container without documenting a folder:
    the usual places first, then the filesystem a few levels deep."""
    found = {}
    skip = {os.environ.get('OUTPUT_DIR') or ''}
    usual = [os.environ.get('INPUT_DIR') or '', os.getcwd(), os.path.expanduser('~')] + LIKELY
    for root in list(extra_roots) + [r for r in usual if r and r not in SKIP_DIRS and r not in skip]:
        _walk(root, 3, found, skip)
    if INPUT_NAME not in found:
        _walk('/', 3, found, skip)
    return found


def load_input(path):
    """claims-input.json as the server wrote it (see references/inputs.md)."""
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError('%s is not a JSON object' % path)
    data.setdefault('sources', [])
    data.setdefault('checked', [])
    data.setdefault('printFiles', [])
    return data


def load_lexicon():
    with open(os.path.join(DATA_DIR, 'claim_lexicon.json'), encoding='utf-8') as f:
        return json.load(f)


def pdf_units(path, name):
    """The text of a print PDF as checked units, one per page."""
    try:
        import logging
        logging.getLogger('pypdf').setLevel(logging.ERROR)
        from pypdf import PdfReader
        reader = PdfReader(path)
    except Exception as e:  # noqa: BLE001 - any unreadable PDF is reported, not fatal
        return [], 'could not read %s: %s' % (name, str(e)[:120])
    units = []
    for i, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ''
        except Exception:  # noqa: BLE001
            text = ''
        if text.strip():
            units.append({'where': 'print', 'path': 'print:%s p%d' % (name[len(PRINT_PREFIX):], i + 1), 'text': text})
    return units, '' if units else '%s has no text the PDF reader can extract' % name


# ─── Sentences ───────────────────────────────────────────────────────

_ABBREV = re.compile(r'(?:^|[\s(])(?:st|dr|mr|mrs|ms|no|est|inc|co|ltd|jr|sr|mt|ft|ave|blvd|rd|hwy|vs|etc|approx|'
                     r'e\.g|i\.e|u\.s|a\.m|p\.m)\.$', re.I)
_BOUNDARY = re.compile(r'[.!?\u2026]+["\')\]]*(?=\s+["\'(\[]?[A-Z0-9$#\u201c])')


def sentences(text):
    """(start, end) spans of the sentences in `text`: lines first, then
    sentence ends inside a line ("St. Pete", "No. 1", "$4.99" stay whole).
    Spans index the original text, so a slice is a word-for-word quote."""
    spans = []
    pos = 0
    for line in str(text).split('\n'):
        start = pos
        end = pos + len(line)
        pos = end + 1
        cut = start
        for m in _BOUNDARY.finditer(text, start, end):
            if _ABBREV.search(text[max(start, m.start() - 12):m.end()]):
                continue
            spans.append((cut, m.end()))
            cut = m.end()
        spans.append((cut, end))
    out = []
    for a, b in spans:
        while a < b and text[a].isspace():
            a += 1
        while b > a and text[b - 1].isspace():
            b -= 1
        if b > a:
            out.append((a, b))
    return out


def window(text, a, b, limit):
    """A slice of text[a:b] of at most `limit` characters, still verbatim."""
    if b - a <= limit:
        return text[a:b]
    cut = text.rfind(' ', a, a + limit)
    return text[a:cut if cut > a + limit // 2 else a + limit].rstrip()


# ─── The pre-pass ────────────────────────────────────────────────────

_NUM_WORDS = '|'.join(NUMBER_WORDS)
PATTERNS = [
    ('price', r'\$\s?\d[\d,]*(?:\.\d{2})?\+?'),
    ('price', r'\b\d[\d,]*(?:\.\d{2})?\s?(?:dollars|bucks|usd)\b'),
    ('price', r'(?<![\w-])free(?![\w-])'),
    ('price', r'\b\d{1,3}\s?%\s?off\b|\bdiscounts?\b|\bcoupons?\b|\bspecials?\b|\bdeals?\b|\bstarting (?:at|from)\b'
              r'|\bprice[- ]match\w*|\bno hidden fees\b|\bfinancing\b|\bno extra (?:charge|cost)\b'
              r'|\bat no (?:extra )?cost\b|\bcomplimentary\b'),
    ('rating', r'\b[0-5](?:\.\d)?\s?(?:/\s?5|out of (?:5|five))\b|\b(?:[1-5]|one|two|three|four|five)[- ]stars?\b'
               r'|\u2605|\u2b50|\b(?:top|highly|best)[- ]rated\b|\brated\b|\bratings?\b'),
    ('rating', r'\b\d[\d,]*\+?\s+(?:(?:five|5)[- ]star\s+|google\s+|happy\s+|positive\s+|verified\s+|real\s+)*reviews?\b'),
    ('years', r'\b(?:since|est\.?|established(?: in)?|founded(?: in)?)\s+(?:19|20)\d{2}\b'),
    ('years', r'\b\d{1,3}\+?\s*(?:years?|yrs?)\b|\b(?:%s)[- ]years?\b|\bdecades?\b' % _NUM_WORDS),
    ('number', r'\b\d[\d,]*\+(?![\w])|\b(?:over|more than|nearly|almost)\s+\d[\d,]*|\b(?:thousands|hundreds|dozens) of\b'),
    ('number', r'\b\d[\d,]*\+?\s+(?:cars|vehicles|customers|clients|jobs|details|coatings|installs|installations'
               r'|projects|wheels|rims|tires|repairs|washes|members|locations|technicians|techs|employees|bays'
               r'|families|businesses|fleets|boats|rvs)\b'),
    ('number', r'\b\d{1,3}(?:\.\d+)?\s?%'),
    ('number', r'\b\d+(?:\.\d+)?\s?(?:-\s?\d+\s?)?(?:hours?|hrs?|minutes?|mins?|days?|weeks?)\b'),
    ('award', r'\bawards?\b|\baward[- ]winning\b|\bawarded\b|\bwinners?\b|\bvoted\b|\bbest of\b|\breaders\'? choice\b'
              r'|\bhall of fame\b|\bfeatured (?:in|on)\b|\bas seen (?:on|in)\b|\brecogni[sz]ed\b|\bnominee\b|\bfinalist\b'),
    ('certification', r'\bcertifi(?:ed|cation|cations|cate|cates)\b|\blicen[cs]ed\b|\binsured\b|\bbonded\b'
                      r'|\baccredit(?:ed|ation)\b|\bauthori[sz]ed\b|\bapproved (?:installer|dealer|shop|provider)\b'
                      r'|\bfactory[- ]trained\b|\bmaster (?:detailer|technician|tech|installer|mechanic)\b'
                      r'|\b(?:preferred|official|elite) (?:installer|dealer|partner)\b'),
    ('guarantee', r'\bguarantee[ds]?\b|\bguaranty\b|\bsatisfaction\b|\bmoney[- ]back\b|\bpromise[sd]?\b|\bno[- ]risk\b'
                  r'|\brisk[- ]free\b|\b100\s?%|\bmake it right\b'),
    ('warranty', r'\bwarrant(?:y|ies|ied)\b|\blifetime\b|\b(?:years?|yrs?) of protection\b|\bcoverage\b|\bbacked by\b'),
    ('superlative', r'\bbest\b|#\s?1\b|\bnumber one\b|\bno\.\s?1\b|\btop[- ](?:rated|notch|quality|tier|choice|pick)\b'
                    r'|\btop \d+\b|\bthe top\b|\bleading\b|\bpremier\b|\bfinest\b|\b(?:the|our) only\b'
                    r'|\bonly (?:shop|company|business|detailer|installer|one|team)\b|\b(?:the )?first (?:in|to)\b'
                    r'|\bfirst[- ]ever\b|\bunmatched\b|\bunbeatable\b|\bunrivall?ed\b|\bunparalleled\b'
                    r'|\bmost (?:trusted|experienced|reliable|popular|affordable|reviewed)\b|\bcheapest\b|\blowest\b'
                    r'|\bfastest\b|\bhighest\b|\blargest\b|\bbiggest\b|\bperfect\b|\bflawless\b|\bworld[- ]class\b'
                    r'|\bindustry[- ]leading\b|\bgo[- ]to\b|\btrusted by\b|\b(?:area|city|town|county|region)\'s\b'),
    ('availability', r'\b24\s?/\s?7\b|\b24 hours\b|\bsame[- ]day\b|\bnext[- ]day\b|\bopen (?:7|seven) days\b'
                     r'|\b(?:7|seven) days a week\b|\bopen now\b|\bon[- ]time\b|\bemergency\b|\bwhile you wait\b'
                     r'|\bwalk[- ]ins? welcome\b'),
    ('area', r'\bserv(?:e|es|ed|ing|icing)\b|\bservice areas?\b|\bthroughout\b|\bacross\b|\banywhere in\b'
             r'|\ball (?:of|over|around)\b|\bstatewide\b|\bnationwide\b|\bcounty\b|\bcounties\b|\bmetro\b'
             r'|\bsurrounding (?:areas?|cities|towns|communities)\b|\b\d+[- ]?miles?\b|\bwe come to you\b'),
    ('other', r'\beco[- ]?friendly\b|\benvironmentally (?:friendly|safe)\b|\bnon[- ]toxic\b|\bbiodegradable\b'
              r'|\bwaterless\b|\bwater[- ]saving\b|\bscratch[- ]free\b|\bswirl[- ]free\b|\bpaint[- ]safe\b'
              r'|\bph[- ]neutral\b|\b(?:pro|professional|military|hospital|commercial)[- ]grade\b|\bOEM\b'
              r'|\bgenuine (?:parts|oem)\b|\b(?:family|veteran|woman|women|minority|locally|black|latino|hispanic'
              r'|employee)[- ]owned\b|\bowner[- ]operated\b'),
]
COMPILED = [(kind, re.compile(p, re.I)) for kind, p in PATTERNS]
# A list of two or more capitalized names after "in", "near", ... is
# usually a list of places ("in Tampa, Brandon and Riverview"): an area
# claim even when none of them is a place the sources name.
_NAME = r"[A-Z][a-z]+(?:\.?[ ][A-Z][a-z]+)?"
PLACE_LIST = re.compile(r"\b(?:in|near|around|across|throughout|to|from|including)[ ]+(?:the[ ]+)?%s"
                        r"(?:,[ ]*(?:and[ ]+|or[ ]+)?%s|[ ]+(?:and|or|&)[ ]+%s)+" % (_NAME, _NAME, _NAME))

# A unit whose path says it is a review shown on the page (the text of one
# of the site's testimonials). Section titles and the Words kit's review
# replies are not reviews. src/lib/kit/claims.js isReviewPath (parity.json).
REVIEW_PATH = re.compile(r'testimonial\w*\[\d+\](?:\.(?:text|quote|review|body))?$', re.I | re.A)
# Business facts the site shows are claims whatever their wording
# ("yearsInBusiness: 8" has no pattern word): the kind by business_info key
# (a path "businessInfo.<key>..." or "businessInfo.googlePlace.rating").
INFO_KINDS = {
    'yearsInBusiness': 'years', 'warranty': 'warranty', 'awards': 'award', 'certifications': 'certification',
    'insured': 'certification', 'serviceAreas': 'area', 'serviceArea': 'area', 'services': 'price',
    'packages': 'price', 'tagline': 'other', 'specialties': 'other', 'brands': 'brand', 'filmBrands': 'brand',
    'tireBrands': 'brand', 'priceRange': 'price', 'googlePlace.rating': 'rating', 'googlePlace.reviewCount': 'rating',
}
_INFO_PATH = re.compile(r'^businessInfo\.([A-Za-z]\w*)(?:\.(\w+))?')


def info_kind(path):
    """The kind of claim a business_info line always is, or None."""
    m = _INFO_PATH.match(path or '')
    if not m:
        return None
    return INFO_KINDS.get('%s.%s' % (m.group(1), m.group(2)) if m.group(2) else m.group(1)) or (
        None if m.group(2) else INFO_KINDS.get(m.group(1)))


# The source fields that name places, for the "area" pre-pass.
PLACE_FIELDS = ('serviceArea', 'address', 'businessInfo.city', 'businessInfo.state', 'businessInfo.serviceArea',
                'businessInfo.serviceAreas', 'businessInfo.address')


def _term_regex(terms, exact_case=False):
    """One regex for a list of names; acronyms (all capitals) always match
    in their own case ("NAPA" the parts store, not Napa the town)."""
    pats_i, pats_c = [], []
    for t in sorted(set(t for t in terms if t), key=len, reverse=True):
        p = r'(?<![\w])%s(?![\w])' % re.escape(t)
        (pats_c if exact_case or re.fullmatch(r'[A-Z0-9&.\- ]+', t) else pats_i).append(p)
    out = []
    if pats_i:
        out.append(re.compile('|'.join(pats_i), re.I))
    if pats_c:
        out.append(re.compile('|'.join(pats_c)))
    return out


def place_terms(sources, lexicon):
    """Place names from the sources that name places: "Tampa", "St. Pete",
    "FL". Capitalized words and word runs, minus street words."""
    stop = set(lexicon.get('placeStopWords', []))
    terms = set()
    for s in sources:
        field = s.get('field') or ''
        if field not in PLACE_FIELDS:
            continue
        lines = str(s.get('text') or '').split('\n')
        if field.startswith(BUSINESS_INFO_PREFIX):
            # "city: Tampa" lines: the value only.
            lines = [re.sub(r'^[A-Za-z][\w.\[\]]*:\s*', '', line) for line in lines]
        if field.endswith('address'):
            # "12 Main St, Tampa, FL 33602": the town and state, not the street.
            lines = [line.split(',', 1)[1] if ',' in line else '' for line in lines]
        for run in re.findall(r"\b[A-Z][A-Za-z.'\-]*(?:[ \t]+[A-Z][A-Za-z.'\-]*)*", '\n'.join(lines)):
            words = [w for w in run.split() if w.lower().strip(".'") not in stop]
            if not words:
                continue
            phrase = ' '.join(words).strip(".'")
            if len(phrase) >= 2 and not re.fullmatch(r'[\d\W]+', phrase):
                terms.add(phrase)
    return sorted(terms)


class Matcher:
    """The pre-pass over one run's inputs: kinds of claim in a sentence."""

    def __init__(self, sources, lexicon=None):
        self.lexicon = lexicon or load_lexicon()
        self.brand_rx = (_term_regex(self.lexicon.get('brands', []))
                         + _term_regex(self.lexicon.get('brandsExactCase', []), exact_case=True))
        self.body_rx = _term_regex(self.lexicon.get('bodies', []))
        self.places = place_terms(sources, self.lexicon)
        self.place_rx = _term_regex(self.places, exact_case=True)

    def matches(self, sentence):
        """[(kind, matched text)] in the sentence, in pattern order."""
        found = []
        for kind, rx in COMPILED:
            for m in rx.finditer(sentence):
                found.append((kind, m.group(0).strip()))
        for rx in self.brand_rx:
            found.extend(('brand', m.group(0)) for m in rx.finditer(sentence))
        for rx in self.body_rx:
            found.extend(('certification', m.group(0)) for m in rx.finditer(sentence))
        for rx in self.place_rx:
            found.extend(('area', m.group(0)) for m in rx.finditer(sentence))
        found.extend(('area', m.group(0)) for m in PLACE_LIST.finditer(sentence))
        return found


# ─── Source hints ────────────────────────────────────────────────────

_WORD = re.compile(r"[a-z0-9][a-z0-9'&+\-]*")


def keywords(phrases, stop):
    out = set()
    for p in phrases:
        for w in _WORD.findall(normalize(p)):
            w = w.strip("'-")
            if len(w) >= 3 and w not in stop and not w.isdigit():
                out.add(w)
    return out


class SourceIndex:
    """The sources split into quotable pieces (sentences of the intake and
    reviews, lines of the business info), each a verbatim slice."""

    def __init__(self, sources, lexicon=None):
        self.stop = set((lexicon or load_lexicon()).get('keywordStopWords', []))
        self.pieces = []
        for s in sources:
            text = str(s.get('text') or '')
            field = s.get('field') or ''
            spans = ([(m.start(), m.end()) for m in re.finditer(r'[^\n]+', text)]
                     if field.startswith(BUSINESS_INFO_PREFIX) else sentences(text))
            for a, b in spans:
                quote = window(text, a, b, LIMITS['quote'])
                norm = normalize(quote)
                self.pieces.append({'field': field, 'quote': quote, 'norm': norm,
                                    'numbers': set(numbers(quote)), 'words': set(_WORD.findall(norm))})

    def hints(self, sentence, phrases, limit=3):
        """The source pieces that share numbers or claim words with the
        sentence, best first: [{field, quote}]. A shared number or a word of
        what the patterns matched ("Gtechniq", "warranty") is a lead on its
        own; other words of the sentence count when two or more are shared."""
        nums = set(numbers(sentence))
        strong = keywords(phrases, self.stop)
        weak = keywords([sentence], self.stop) - strong
        scored = []
        for i, p in enumerate(self.pieces):
            shared_n = len(nums & p['numbers'])
            shared_s = len(strong & p['words'])
            shared_w = len(weak & p['words'])
            if shared_n or shared_s or shared_w >= 2:
                scored.append((-(3 * shared_n + 2 * shared_s + shared_w), i, p))
        scored.sort(key=lambda x: (x[0], x[1]))
        return [{'field': p['field'], 'quote': p['quote']} for _, _, p in scored[:limit]]

    def search(self, terms, any_term=False):
        """Pieces containing every term (or any, with any_term), terms
        compared as normalized text; numbers match as numbers."""
        want = [normalize(t) for t in terms if normalize(t)]
        out = []
        for p in self.pieces:
            hits = [t in p['norm'] or (numbers(t) and set(numbers(t)) <= p['numbers']) for t in want]
            if want and (any(hits) if any_term else all(hits)):
                out.append({'field': p['field'], 'quote': p['quote']})
        return out


# ─── Units → candidates ──────────────────────────────────────────────

def checked_units(data, pdf_paths):
    """Every text to check: claims-input.json `checked`, plus the print
    PDFs' pages. Returns (units, problems)."""
    units = []
    for u in data.get('checked') or []:
        if isinstance(u, dict) and isinstance(u.get('text'), str) and u['text'].strip() and u.get('where') in WHERE:
            units.append({'where': u['where'], 'path': str(u.get('path') or ''), 'text': u['text']})
    problems = []
    for name in data.get('printFiles') or []:
        path = pdf_paths.get(name)
        if not path:
            problems.append('%s was sent but is not in the container' % name)
            continue
        more, problem = pdf_units(path, name)
        units.extend(more)
        if problem:
            problems.append(problem)
    return units, problems


CANDIDATE_LIMIT = 400


def candidates(units, sources, lexicon=None, limit=CANDIDATE_LIMIT):
    """The pre-pass: every sentence with something that looks like a claim,
    as [{id, where, path, text, kinds, matches, hints, review?}]. A review
    shown on the page is one candidate as a whole, with `verbatim` (is it
    word for word in the pasted reviews?). limit=None keeps them all (ids
    are the same either way: c1, c2, ... in text order)."""
    lexicon = lexicon or load_lexicon()
    matcher = Matcher(sources, lexicon)
    index = SourceIndex(sources, lexicon)
    reviews = ' \n'.join(str(s.get('text') or '') for s in sources if s.get('field') == REVIEW_FIELD)
    out = []
    for u in units:
        text = u['text']
        if u['where'] == 'site' and REVIEW_PATH.search(u['path']):
            found = matcher.matches(text)
            out.append({
                'where': u['where'], 'path': u['path'], 'text': text.strip(), 'kinds': ['review'],
                'matches': sorted(set(m for _, m in found))[:8], 'review': True,
                'verbatim': bool(reviews) and quote_in(text, reviews),
                'hints': index.hints(text, [text]) if reviews else [],
            })
            continue
        fact = info_kind(u['path'])
        for a, b in sentences(text):
            sentence = text[a:b]
            found = matcher.matches(sentence) + ([(fact, '')] if fact else [])
            if not found:
                continue
            kinds = sorted(set(k for k, _ in found), key=KINDS.index)
            phrases = sorted(set(m for _, m in found if m))
            if fact:
                # The value, not the key, is what to find in the sources.
                phrases.append(sentence.split(': ', 1)[-1])
            out.append({'where': u['where'], 'path': u['path'], 'text': sentence, 'kinds': kinds,
                        'matches': sorted(set(phrases))[:8], 'hints': index.hints(sentence, phrases)})
    if limit is not None:
        out = out[:limit]
    for i, c in enumerate(out):
        c['id'] = 'c%d' % (i + 1)
    return out
