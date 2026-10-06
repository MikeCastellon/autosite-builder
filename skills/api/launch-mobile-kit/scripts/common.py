"""Shared rules for the mobile kit scripts: the limits and word lists in
data/rules.json, text checks, the tap links (tel:, sms:, maps), the "no new
claims" test for short copy, the section-order and action rules and the
phone scorecard.

This is a mirror of src/lib/kit/mobile.js on the server, which sanitizes
mobile.json with the same rules (src/lib/kit/mobile.test.js keeps the two
equal through data/rules.json and tests/cases.json). A mobile.json that
passes validate_mobile.py is stored exactly as written.
"""
import json
import os
import re
import unicodedata
from urllib.parse import quote, unquote

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, '..', 'data', 'rules.json'), encoding='utf-8') as _f:
    RULES = json.load(_f)

LIMITS = RULES['limits']
ACTION_KINDS = tuple(RULES['actionKinds'])
DEFAULT_LABELS = RULES['defaultLabels']
CHECKS = RULES['checks']
CHECK_IDS = tuple(c['id'] for c in CHECKS)
CHECK_FROM = {c['id']: c['from'] for c in CHECKS}
CHECK_LABEL = {c['id']: c['label'] for c in CHECKS}
ICONS = RULES['icons']
CLAIM_WORDS = frozenset(RULES['claimWords'])
GLUE_WORDS = frozenset(RULES['glueWords'])
SAVE_HREF = RULES['saveHref']
INPUTS_FILE = RULES['inputsFile']
ALWAYS_FIRST = 'hero'

# ─── Text ─────────────────────────────────────────────────────────────

# What JavaScript's \s matches: the server's oneLine() collapses these, so a
# string with any other spacing would be stored differently from the file.
JS_WS = ('\t\n\x0b\x0c\r \xa0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a'
         '\u2028\u2029\u202f\u205f\u3000\ufeff')
_CONTROL = re.compile('[\x00-\x1f\x7f\u2028\u2029]+')
_SPACES = re.compile('[%s]+' % re.escape(JS_WS))


def one_line(v):
    """The server's oneLine() without the cap."""
    return _SPACES.sub(' ', _CONTROL.sub(' ', v)).strip(JS_WS)


def js_length(v):
    """String.prototype.length (UTF-16 code units): an emoji counts 2."""
    return len(v.encode('utf-16-le')) // 2


def line_problem(v, where, max_len, required=True):
    """Why `v` isn't a plain one-line string of at most max_len, or None."""
    if not isinstance(v, str):
        return '%s must be a string' % where
    if not v.strip():
        return '%s is empty' % where if required else None
    if js_length(v) > max_len:
        return '%s is %d characters (emoji count 2), max %d' % (where, js_length(v), max_len)
    if one_line(v) != v:
        return '%s must be one plain line: no line breaks, tabs, doubled spaces or spaces at the ends' % where
    return None


# ─── Colors ───────────────────────────────────────────────────────────

HEX6 = re.compile(r'#[0-9a-f]{6}\Z')


def norm_hex(v):
    """'#rrggbb' (lowercase) for #rgb / #rrggbb in any case, else ''."""
    s = v.strip().lower() if isinstance(v, str) else ''
    if re.fullmatch(r'#[0-9a-f]{3}', s):
        s = '#' + ''.join(c * 2 for c in s[1:])
    return s if HEX6.match(s) else ''


def hex_to_rgb(h):
    h = norm_hex(h)
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def rgb_to_hex(rgb):
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(c)))) for c in rgb[:3])


def _channel(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(rgb):
    r, g, b = rgb[:3]
    return 0.2126 * _channel(r) + 0.7152 * _channel(g) + 0.0722 * _channel(b)


def contrast(a, b):
    """WCAG contrast ratio of two '#rrggbb' or (r, g, b) colors."""
    la = luminance(hex_to_rgb(a) if isinstance(a, str) else a)
    lb = luminance(hex_to_rgb(b) if isinstance(b, str) else b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# ─── Tap links ────────────────────────────────────────────────────────

def encode_component(s):
    """JavaScript's encodeURIComponent (UTF-8, unreserved A-Z a-z 0-9 - _ . ! ~ * ' ( ) kept)."""
    return quote(s, safe="!*'()")


def tel_href(dial):
    return 'tel:' + dial if dial else ''


def sms_href(dial, body):
    """The text link both phones read: `sms:<number>?&body=<encoded>`.

    iOS takes the body after '&' (it ignores the '?'), Android takes the
    query '?&body=…' (an empty first parameter). Spaces must be %20: Android
    shows '+' literally."""
    return 'sms:%s?&body=%s' % (dial, encode_component(body)) if dial else ''


_SMS_RE = re.compile(r"sms:(\+?[0-9]{3,15})\?&body=([A-Za-z0-9_.!~*'()%-]*)\Z")


def parse_sms_href(href):
    """(number, body, problems) for a text link; problems empty = it works on iPhone and Android."""
    if not isinstance(href, str) or not href.startswith('sms:'):
        return None, None, ['the text link must start with sms:']
    m = _SMS_RE.match(href)
    if not m:
        problems = []
        if '?&body=' not in href:
            problems.append("the text link must be sms:<number>?&body=<text> ('?&body=' is the form both iPhone and Android read)")
        if '+' in href.split('body=', 1)[-1]:
            problems.append("the body uses '+' for spaces: Android shows the plus signs; use %20")
        if not re.match(r'sms:\+?[0-9]{3,15}\?', href):
            problems.append('the number in the text link must be digits only, with an optional leading +')
        return None, None, problems or ['the body has characters that must be percent-encoded']
    number, encoded = m.groups()
    # decodeURIComponent refuses a '%' without two hex digits; unquote
    # would keep it as text.
    if re.search(r'%(?![0-9A-Fa-f]{2})', encoded):
        return number, None, ['the body is not valid percent-encoded UTF-8']
    try:
        body = unquote(encoded, errors='strict')
    except UnicodeDecodeError:
        return number, None, ['the body is not valid percent-encoded UTF-8']
    problems = []
    if encode_component(body) != encoded:
        problems.append('the body is not encoded the way encodeURIComponent encodes it')
    return number, body, problems


def maps_href(line):
    """Google Maps' cross-platform search link: opens the Maps app on iPhone and Android when installed."""
    return 'https://www.google.com/maps/search/?api=1&query=' + encode_component(line) if line else ''


# ─── No new claims ────────────────────────────────────────────────────

def tokens(text):
    """Lowercase words and numbers, accents and apostrophes dropped (the JS tokens())."""
    s = unicodedata.normalize('NFKD', text if isinstance(text, str) else '')
    s = ''.join(ch for ch in s if not unicodedata.category(ch).startswith('M')).lower()
    s = s.replace("'", '').replace('\u2019', '')
    return re.findall(r'[a-z0-9]+', s)


def forms(w):
    """A word and its plain variants (cars/car, detailing/detail, shined/shine)."""
    out = {w}
    if len(w) > 3:
        if w.endswith('ies'):
            out.add(w[:-3] + 'y')
        if w.endswith('es'):
            out.add(w[:-2])
        if w.endswith('s') and not w.endswith('ss'):
            out.add(w[:-1])
        if w.endswith('ing') and len(w) > 5:
            out.add(w[:-3])
            out.add(w[:-3] + 'e')
        if w.endswith('ed') and len(w) > 4:
            out.add(w[:-2])
            out.add(w[:-1])
    return out


def _source_forms(sources):
    toks = tokens(' '.join(s for s in sources if isinstance(s, str)))
    found = set()
    for t in toks:
        found |= forms(t)
    return set(toks), found


def _dedupe(items):
    out = []
    for i in items:
        if i not in out:
            out.append(i)
    return out


def claim_problems(text, sources, where):
    """Claim words (best, top, free, certified, ...) and numbers ("24/7", "$99",
    "5-star") the sources don't use: action labels and the text message may
    word things freely, never add a fact."""
    raw, src = _source_forms(sources)
    out = []
    for t in tokens(text):
        if any(ch.isdigit() for ch in t):
            if t not in raw:
                out.append('%s: "%s" is a number the site does not state' % (where, t))
        elif t in CLAIM_WORDS and not (forms(t) & src):
            out.append('%s: "%s" is a claim the site does not make' % (where, t))
    return _dedupe(out)


def headline_problems(text, sources, where='phoneHeadline', max_len=None):
    """The phone headline must be short, one line, and made of the site's own words:
    every number and claim word, and every word of 4+ letters (except plain
    glue words like "your", "with"), must appear in the sources."""
    p = line_problem(text, where, max_len or LIMITS['phoneHeadline'])
    if p:
        return [p]
    raw, src = _source_forms(sources)
    out = []
    for t in tokens(text):
        if any(ch.isdigit() for ch in t):
            if t not in raw:
                out.append('%s: "%s" is a number the site does not state' % (where, t))
        elif t in CLAIM_WORDS and not (forms(t) & src):
            out.append('%s: "%s" is a claim the site does not make' % (where, t))
        elif len(t) >= 4 and t not in GLUE_WORDS and not (forms(t) & src):
            out.append('%s: "%s" is not in the site\'s headline or facts (condense, don\'t add)' % (where, t))
    if not tokens(text):
        out.append('%s has no words' % where)
    return _dedupe(out)


def short_name_problems(name, business):
    """The home-screen label: at most 12 characters, made only of the business
    name's words (or two or three of them run together, or its initials)."""
    p = line_problem(name, 'shortName', LIMITS['shortName'])
    if p:
        return [p]
    bt = tokens(business)
    nt = tokens(name)
    if not nt:
        return ['shortName has no letters or digits']
    initials = ''.join(t[0] for t in bt)
    joined = {''.join(bt[i:j]) for i in range(len(bt)) for j in range(i + 2, min(len(bt), i + 3) + 1)}
    out = []
    for t in nt:
        if t in bt or t in joined or (len(t) >= 2 and t in initials):
            continue
        out.append('shortName: "%s" is not part of the business name' % t)
    return out


# ─── Facts ────────────────────────────────────────────────────────────

def headline_sources(facts):
    """The texts the phone headline may draw from: the site's hero, the business facts."""
    site = facts.get('site') or {}
    biz = facts.get('business') or {}
    addr = facts.get('address') or {}
    buttons = site.get('buttons') or {}
    out = [site.get('headline', ''), site.get('subheadline', ''), biz.get('name', ''), biz.get('type', ''),
           addr.get('city', ''), addr.get('state', ''), facts.get('serviceArea', ''),
           buttons.get('primary', ''), buttons.get('secondary', '')]
    out += [s for s in site.get('services', []) if isinstance(s, str)]
    return [s for s in out if isinstance(s, str) and s]


def visible_ids(facts):
    return [s['id'] for s in (facts.get('site') or {}).get('sections', []) if not s.get('hidden')]


def order_problems(order, facts):
    """phoneSectionOrder must list every section the site shows, once, hero first."""
    want = visible_ids(facts)
    if not isinstance(order, list) or not all(isinstance(i, str) for i in order):
        return ['phoneSectionOrder must be a list of section ids']
    out = []
    unknown = [i for i in order if i not in want]
    if unknown:
        out.append('phoneSectionOrder has ids the site does not show: %s (shown: %s)' % (', '.join(unknown), ', '.join(want)))
    missing = [i for i in want if i not in order]
    if missing:
        out.append('phoneSectionOrder leaves out %s' % ', '.join(missing))
    if len(set(order)) != len(order):
        out.append('phoneSectionOrder lists an id twice')
    if ALWAYS_FIRST in want and order and order[0] != ALWAYS_FIRST:
        out.append('phoneSectionOrder must start with "%s"' % ALWAYS_FIRST)
    return out


def default_sms_body(name):
    body = RULES['defaultSmsBody'].replace('{name}', name or '')
    if not name or js_length(body) > LIMITS['smsBody']:
        body = RULES['defaultSmsBodyShort']
    return body


def action_hrefs(facts, sms_body=None):
    """{kind: href} for every action the facts allow ('text' needs the SMS body)."""
    phone = facts.get('phone') or {}
    addr = facts.get('address') or {}
    dial = phone.get('dial') or ''
    out = {}
    if dial:
        out['call'] = tel_href(dial)
        if sms_body is not None:
            out['text'] = sms_href(dial, sms_body)
    if facts.get('booking'):
        out['book'] = facts['booking']
    if addr.get('street') and addr.get('line'):
        out['directions'] = maps_href(addr['line'])
    out['save'] = SAVE_HREF
    return out


def vcard_of(facts):
    """The contact card's fields, from the confirmed facts only. The card's
    phone is a number that dials (E.164, else as the site shows it), never
    text that isn't one number."""
    phone = facts.get('phone') or {}
    addr = facts.get('address') or {}
    name = (facts.get('business') or {}).get('name', '')
    dial = phone.get('dial') or ''
    return {
        'fn': name,
        'org': name,
        'tel': (phone.get('e164') or phone.get('display') or dial) if dial else '',
        'email': facts.get('email') or '',
        'url': facts.get('website') or '',
        'adr': addr.get('line') or '',
    }


# ─── Scorecard ────────────────────────────────────────────────────────

def _check(cid, ok, note):
    return {'id': cid, 'check': CHECK_LABEL[cid], 'pass': ok, 'note': note}


def scorecard(facts, plan, skill_checks=None):
    """The phone checks in rules.json order. 'inputs' checks follow from the
    facts and the plan (the server recomputes them), 'skill' checks come from
    make_icons.py's report, 'manual' and 'preview' ones are null (a person or
    the browser checks them)."""
    skill_checks = skill_checks or {}
    phone = facts.get('phone') or {}
    addr = facts.get('address') or {}
    site = facts.get('site') or {}
    palette = facts.get('palette') or {}
    actions = {a.get('kind'): a for a in plan.get('actions') or [] if isinstance(a, dict)}
    sms = plan.get('smsQuote') if isinstance(plan.get('smsQuote'), dict) else None
    dial = phone.get('dial') or ''
    out = []
    for cid in CHECK_IDS:
        src = CHECK_FROM[cid]
        if src in ('manual', 'preview'):
            out.append(_check(cid, None, RULES['fixedNotes'].get(cid, '')))
            continue
        if src == 'skill':
            given = skill_checks.get(cid) or {}
            ok = given.get('pass') if isinstance(given.get('pass'), bool) else False
            out.append(_check(cid, ok, given.get('note') or ('Not measured' if not given else '')))
            continue
        if cid == 'call':
            if not dial:
                out.append(_check(cid, False, 'No phone number on the site'))
            elif 'call' in actions:
                out.append(_check(cid, True, 'Calls %s' % (phone.get('display') or dial)))
            else:
                out.append(_check(cid, False, 'The Call action is missing'))
        elif cid == 'phone-format':
            if not dial:
                out.append(_check(cid, False, 'No phone number on the site'))
            elif phone.get('e164'):
                out.append(_check(cid, True, 'Dials as %s' % phone['e164']))
            else:
                out.append(_check(cid, False, 'No country code: phones outside the area may not reach it'))
        elif cid == 'text':
            ok = bool(dial and sms and 'text' in actions and sms.get('href')
                      and not parse_sms_href(sms['href'])[2])
            if not dial:
                note = 'No phone number to text'
            elif ok:
                note = 'Opens Messages with the quote text on iPhone and Android'
            else:
                note = 'The Text action is missing or its link is broken'
            out.append(_check(cid, ok, note))
        elif cid == 'book':
            if not facts.get('booking'):
                out.append(_check(cid, False, "The site doesn't take bookings yet: turn on the scheduler for a Book button"))
            elif 'book' in actions:
                out.append(_check(cid, True, 'Opens the booking page'))
            else:
                out.append(_check(cid, False, 'The Book action is missing'))
        elif cid == 'directions':
            if not addr.get('street'):
                out.append(_check(cid, True, 'Not needed: no shop address (mobile service)'))
            elif 'directions' in actions:
                out.append(_check(cid, True, 'Opens maps to %s' % addr.get('line', '')))
            else:
                out.append(_check(cid, False, 'The Directions action is missing'))
        elif cid == 'contact-card':
            v = vcard_of(facts)
            have = [label for k, label in (('tel', 'phone'), ('email', 'email'), ('url', 'website'), ('adr', 'address')) if v[k]]
            ok = bool(v['fn'] and (v['tel'] or v['email']))
            note = 'Name, ' + ', '.join(have) if ok else 'The card has no phone or email'
            out.append(_check(cid, ok, note))
        elif cid == 'phone-headline':
            text = plan.get('phoneHeadline')
            problems = headline_problems(text, headline_sources(facts)) if isinstance(text, str) else ['missing']
            n = js_length(text) if isinstance(text, str) else 0
            out.append(_check(cid, not problems, '%d of %d characters' % (n, LIMITS['phoneHeadline']) if not problems else 'Rewrite it from the site headline'))
        elif cid == 'site-headline':
            text = site.get('headline') or ''
            n = js_length(text)
            if not text:
                out.append(_check(cid, False, 'The site has no headline'))
            elif n <= LIMITS['siteHeadlinePhone']:
                out.append(_check(cid, True, '%d characters' % n))
            else:
                out.append(_check(cid, False, '%d characters: long on a phone; the phone headline is shorter' % n))
        elif cid == 'sections':
            order = plan.get('phoneSectionOrder') if isinstance(plan.get('phoneSectionOrder'), list) else []
            ids = [i for i in order if i in RULES['servicesSectionIds']]
            if not ids:
                out.append(_check(cid, True, 'No services section on this template'))
            else:
                pos = order.index(ids[0]) + 1
                ok = pos <= RULES['servicesWithin']
                out.append(_check(cid, ok, 'Services are section %d of %d' % (pos, len(order))))
        elif cid == 'action-bar':
            if site.get('themeReady'):
                out.append(_check(cid, True, 'The template shows a Call/Book bar at the bottom of phone screens'))
            else:
                out.append(_check(cid, None, 'Check in preview: an older template without the kit action bar'))
        elif cid == 'hours':
            ok = bool(facts.get('hasHours'))
            out.append(_check(cid, ok, 'Hours are on the site' if ok else 'No hours on the site: phone visitors look for them first'))
        elif cid == 'theme-color':
            color = plan.get('themeColor')
            roles = [r for r in ('bg', 'secondary', 'text', 'muted', 'accent') if palette.get(r) == color]
            ok = bool(roles)
            out.append(_check(cid, ok, '%s (brand %s)' % (color, roles[0]) if ok else 'Not one of the brand colors'))
    return out
