"""Font choices for a brand system, limited to the site's font catalog.

data/fonts.json is generated from src/lib/fontCatalog.js (FONT_CATALOG),
src/data/fontPairings.js (curated pairings, style moods) and
src/data/fontOptions.js; a family outside the catalog silently falls back on
the published page, so nothing here invents families. rank() is a port of
fontPairings.js rankPairings(), so the skill ranks pairings exactly as the
Design Studio's picker does (tests/test_theme.py checks it against
tests/fonts_fixtures.json).

CLI:
  fonts.py rank --styles '["Bold & sporty","Dark & moody"]' [--type wheel_shop] [--mood "..."] [--top 6]
  fonts.py list [--role body|heading] [--category sans|serif|display|mono]
  fonts.py match --file /tmp/brand/fonts.txt  catalog family or nearest look-alikes
                                              (customer text goes in a file, not the command line)
  fonts.py check HEADING BODY                 exit 1 when the pair is not allowed
"""
import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, '..', 'data')


def load_fonts():
    with open(os.path.join(DATA_DIR, 'fonts.json'), encoding='utf-8') as f:
        return json.load(f)


def load_lookalikes():
    with open(os.path.join(DATA_DIR, 'font_lookalikes.json'), encoding='utf-8') as f:
        return json.load(f)['lookalikes']


FONTS = load_fonts()
FAMILIES = FONTS['families']
PAIRINGS = FONTS['pairings']
STYLE_MOODS = FONTS['styleMoods']
BUSINESS_TYPES = FONTS['businessTypes']
_BY_LOWER = {name.lower(): name for name in FAMILIES}


def business_type_id(value):
    """'Detailing shop' (the intake label) or 'detailing_shop' -> 'detailing_shop'.
    Anything else passes through; rank() simply finds no pairing for it."""
    if not isinstance(value, str) or not value.strip():
        return None
    v = value.strip().lower()
    for t in BUSINESS_TYPES:
        if v in (t['value'], t['label'].lower()):
            return t['value']
    return value.strip()


def catalog_family(name):
    """Canonical catalog name (case-insensitive), or None."""
    if not isinstance(name, str):
        return None
    return _BY_LOWER.get(name.strip().lower())


def is_body_family(family):
    """A text face (sans/serif) with a regular and a bold weight."""
    f = FAMILIES.get(family)
    return bool(f and f['body'])


# ─── Port of fontPairings.js rankPairings() ───────────────────────────

def _mood_words(text):
    # String(text || '').toLowerCase().split(/[^a-z-]+/).filter(Boolean)
    return [w for w in re.split(r'[^a-z-]+', str(text or '').lower()) if w]


def _hits(pairing_mood, words):
    return [m for m in pairing_mood if any(w == m or m in w.split('-') for w in words)]


def _style_words(style):
    return STYLE_MOODS[style] if style in STYLE_MOODS else _mood_words(style)


def _style_list(styles):
    if isinstance(styles, list):
        items = styles
    elif isinstance(styles, str):
        items = styles.split(',')
    else:
        items = []
    seen = set()
    out = []
    for s in items:
        v = s.strip() if isinstance(s, str) else ''
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def rank(styles=None, business_type=None, mood=None):
    """Pairings best first: [{...pairing, fits, score, reasons}]."""
    picks = _style_list(styles)
    template_words = _mood_words(mood)
    rows = []
    for index, p in enumerate(PAIRINGS):
        fits = 0
        score = 0
        reasons = []
        for style in picks:
            matched = _hits(p['mood'], _style_words(style))
            if not matched:
                continue
            fits += 1
            score += len(matched)
            reasons.append(style)
        if business_type and business_type in p['types']:
            score += 1
            reasons.append('Suits this business type')
        shared = _hits(p['mood'], template_words)
        if shared:
            score += len(shared)
            reasons.append("Matches the template's mood")
        rows.append((p, index, fits, score, reasons))
    rows.sort(key=lambda r: (-r[2], -r[3], r[1]))
    return [dict(p, fits=fits, score=score, reasons=reasons) for p, _, fits, score, reasons in rows]


# ─── Helpers for the skill ────────────────────────────────────────────

def match(text):
    """Fonts named in free text ('We use Gotham Bold and Open Sans') ->
    [{'asked', 'family'|None, 'lookalikes'}] in the order they appear.
    Known names are found anywhere in the text (catalog families, then the
    look-alike table; longest name first, so 'Barlow Condensed' beats
    'Barlow'); a comma/'and'-separated piece with no known name comes back
    with family None and no look-alikes, so nothing the customer asked for
    is silently dropped."""
    text = str(text or '')
    low = text.lower()
    looks = load_lookalikes()
    names = [(n.lower(), n, None) for n in FAMILIES] + [(k, None, v) for k, v in looks.items()]
    names.sort(key=lambda t: -len(t[0]))
    taken = []
    found = []
    for key, family, similar in names:
        for m in re.finditer(r'(?<![a-z0-9])%s(?![a-z0-9])' % re.escape(key), low):
            if any(m.start() < b and a < m.end() for a, b in taken):
                continue
            taken.append((m.start(), m.end()))
            found.append((m.start(), {'asked': text[m.start():m.end()], 'family': family,
                                      'lookalikes': [] if family else list(similar)}))
    pos = 0
    for piece in re.split(r'([,;/\n]+| and | & )', text):
        a, b = pos, pos + len(piece)
        pos = b
        asked = piece.strip().strip('"\'').strip()
        if not re.search(r'[A-Za-z]', asked) or re.fullmatch(r'[,;/\n]+| and | & ', piece):
            continue
        if not any(a <= x < b for x, _ in taken):
            found.append((a, {'asked': asked[:60], 'family': None, 'lookalikes': []}))
    return [entry for _, entry in sorted(found, key=lambda t: t[0])]


def pair_problems(heading, body):
    """[] when heading/body may be written to brand.json."""
    out = []
    for slot, fam in (('heading', heading), ('body', body)):
        if fam not in FAMILIES:
            canon = catalog_family(fam)
            out.append('%s %r is not a catalog family%s' % (slot, fam, ' (did you mean %r?)' % canon if canon else ''))
    if out:
        return out
    if not is_body_family(body):
        out.append("body %r can't carry paragraphs (needs a sans/serif face with 400 and 700)" % body)
    return out


def _print_rank(rows, top):
    for p in rows[:top]:
        h, b = FAMILIES[p['heading']], FAMILIES[p['body']]
        print('%-13s %-20s / %-18s fits=%d score=%d  [%s / %s]  %s' % (
            p['id'], p['heading'], p['body'], p['fits'], p['score'], h['category'], b['category'],
            '; '.join(p['reasons']) or '-'))
        print('              mood: %s' % ', '.join(p['mood']))


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd')
    r = sub.add_parser('rank')
    r.add_argument('--styles', default='[]', help='JSON list or comma-separated intake styles')
    r.add_argument('--type', dest='business_type', default=None, help="business type id or intake label ('Tint / PPF')")
    r.add_argument('--mood', default=None, help='free mood words, e.g. from the brief')
    r.add_argument('--top', type=int, default=6)
    r.add_argument('--json', action='store_true')
    lp = sub.add_parser('list')
    lp.add_argument('--role', choices=['heading', 'body'])
    lp.add_argument('--category', choices=['sans', 'serif', 'display', 'mono'])
    m = sub.add_parser('match')
    m.add_argument('text', nargs='?', default='')
    m.add_argument('--file', default=None, help='read the font names from this file')
    c = sub.add_parser('check')
    c.add_argument('heading')
    c.add_argument('body')
    args = ap.parse_args(argv[1:])

    if args.cmd == 'rank':
        try:
            styles = json.loads(args.styles)
        except ValueError:
            styles = args.styles
        rows = rank(styles, business_type_id(args.business_type), args.mood)
        if args.json:
            print(json.dumps(rows[:args.top], indent=2))
        else:
            _print_rank(rows, args.top)
        return 0
    if args.cmd == 'list':
        for name, f in FAMILIES.items():
            if args.category and f['category'] != args.category:
                continue
            if args.role == 'body' and not f['body']:
                continue
            print('%-22s %-8s body=%-5s %s' % (name, f['category'], 'yes' if f['body'] else 'no', ', '.join(f['mood']) or '-'))
        return 0
    if args.cmd == 'match':
        text = args.text
        if args.file:
            with open(args.file, encoding='utf-8') as f:
                text = f.read()
        print(json.dumps(match(text), indent=2))
        return 0
    if args.cmd == 'check':
        problems = pair_problems(args.heading, args.body)
        for p in problems:
            print('- ' + p)
        if not problems:
            print('OK')
        return 1 if problems else 0
    ap.print_help()
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv))
