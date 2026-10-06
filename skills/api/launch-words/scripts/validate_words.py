"""Checks words.json against its contract (references/words-json.md) and
the request's facts (words-inputs.json). Exit 0 = valid (warnings may still
print), 1 = errors to fix, 2 = unreadable file or bad arguments.

  validate_words.py /tmp/words/words.json --inputs <path to words-inputs.json>

Errors (all must be fixed):
  - shape: exactly the contract's keys, the right types, 12 posts, 3
    captions, one reply per star rating 1-5
  - lengths (data/limits.json, counted like the server: an emoji counts 2)
    and plain text (no tabs, no spaces at line ends, titles on one line)
  - GBP description: no links and no prices or offers (Google's rules)
  - GBP services: the site's service names, exactly, every one of them
  - posts: a CALL button only with a business phone, no phone numbers in
    the post text (Google rejects those posts), photo refs the request gave
  - review requests: the review link when the request has one (else the
    [review link] placeholder), no incentives and no asking for a rating
  - no invented facts: claim words, prices, percentages, counts, years and
    ratings that the customer's answers don't contain (data/claim_terms.json),
    quotes that aren't word for word from the pasted reviews
  - phone numbers and links: only the business's own; "book online" only
    when the request has a booking link
Warnings (judgement calls): short texts, a claim only the site copy makes,
soft claim words, categories outside data/gbp_categories.json, few photos, a
price in a GBP service description (GBP has a price field for it).
"""
import argparse
import json
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from words_lib import (  # noqa: E402
    CTAS, LIMITS, NAME_PH, ONLINE_BOOKING, REVIEW_PH, Sources, check_text, claim_findings, clean_block, gating_hits, incentive_hits, js_length,
    load_data, load_inputs, money_hits, name_key, norm, one_line, phone_hits, photo_refs, placeholders, url_hits,
)

TOP = ('gbp', 'seo', 'reviews', 'social', 'notes')
MAX_BYTES = 1024 * 1024
L = LIMITS


class Report:
    def __init__(self):
        self.errors, self.warnings, self.lengths = [], [], []

    def err(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)


def keys(obj, want, where, r):
    if not isinstance(obj, dict):
        r.err('%s must be an object' % where)
        return False
    missing = [k for k in want if k not in obj]
    extra = [k for k in obj if k not in want]
    if missing:
        r.err('%s is missing %s' % (where, ', '.join(missing)))
    if extra:
        r.err('%s has keys the contract does not allow: %s' % (where, ', '.join(map(str, extra))))
    return not missing


def text(v, where, r, max_len, min_len=0, multiline=False, required=True, count=False):
    """A string field: present, plain, within its limits. Returns the text
    ('' when unusable)."""
    if not isinstance(v, str):
        r.err('%s must be a string' % where)
        return ''
    if not v.strip():
        if required:
            r.err('%s is empty' % where)
        return ''
    n = js_length(v)
    if count:
        r.lengths.append('%s %d/%d' % (where, n, max_len))
    if n > max_len:
        r.err('%s is %d characters (emoji count 2), max %d' % (where, n, max_len))
    elif min_len and n < min_len:
        r.warn('%s is only %d characters (aim for %d or more)' % (where, n, min_len))
    clean = clean_block(v) if multiline else one_line(v)
    if clean != v:
        r.err('%s must be plain text: %s' % (where, 'no tabs, control characters, spaces at line ends or more than one blank line in a row'
                                             if multiline else 'one line, no tabs, doubled spaces or spaces at the ends'))
    return v


class Ctx:
    def __init__(self, inputs):
        self.inputs = inputs
        self.sources = Sources.from_inputs(inputs)
        biz = inputs.get('business') or {}
        self.phone_digits = re.sub(r'\D', '', biz.get('phone') or '')[-10:]
        urls = inputs.get('urls') or {}
        self.urls = {k: (urls.get(k) or '') for k in ('site', 'booking', 'review')}
        self.hosts = {host(u) for u in self.urls.values() if u}
        self.photos = photo_refs(inputs)
        self.services = [s for s in (inputs.get('services') or []) if isinstance(s, dict) and (s.get('name') or '').strip()]


def host(u):
    s = re.sub(r'^[a-z]+://', '', (u or '').strip().lower())
    s = re.split(r'[/?#]', s, 1)[0]
    return s[4:] if s.startswith('www.') else s


def common_checks(v, where, r, c, allowed_ph=(), links='own', phones='own'):
    """Facts, placeholders, phone numbers and links in one piece of copy."""
    if not v:
        return
    if not c.urls['booking'] and ONLINE_BOOKING.search(v):
        r.err('%s says customers can book online, but the site takes no online bookings (no booking link in the request)' % where)
    for level, msg in claim_findings(v, c.sources):
        (r.err if level == 'error' else r.warn)('%s: %s' % (where, msg))
    for ph in placeholders(v):
        if ph not in allowed_ph:
            r.err('%s has the placeholder %s: write the real text (allowed here: %s)' % (where, ph, ', '.join(allowed_ph) or 'none'))
    for p in phone_hits(v):
        if phones == 'none':
            r.err('%s has a phone number (%s): Google rejects posts with phone numbers; use the CALL button instead' % (where, p.strip()))
        elif re.sub(r'\D', '', p)[-10:] != c.phone_digits:
            r.err('%s has a phone number (%s) that is not the business phone' % (where, p.strip()))
    for u in url_hits(v):
        if links == 'none':
            r.err('%s has a link (%s): leave links out here' % (where, u))
        elif host(u) not in c.hosts:
            r.err('%s has a link (%s) that is not one of the business\'s links in the request' % (where, u))
        elif links == 'discouraged':
            r.warn('%s has a link (%s): links in this text are not clickable; the button or profile carries it' % (where, u))
    for span in re.findall(r'"([^"]{20,})"', check_text(v)):
        s = span.strip(' .,!?')
        if s and s not in c.sources.reviews and s not in c.sources.primary:
            r.err('%s quotes "%s...", which is not word for word from the pasted reviews or the customer\'s answers' % (where, span[:40]))


def check_gbp(g, r, c):
    if not keys(g, ('description', 'services', 'categories', 'posts'), 'gbp', r):
        return
    lim = L['gbp']
    d = text(g['description'], 'gbp.description', r, lim['description']['max'], lim['description']['min'], multiline=True, count=True)
    common_checks(d, 'gbp.description', r, c, links='none')
    for m in money_hits(d):
        r.err('gbp.description has a price (%s): Google keeps prices and offers out of the description; they belong in the services and posts' % m)

    services = g['services']
    if not isinstance(services, list) or len(services) > lim['services']['max']:
        r.err('gbp.services must be a list of at most %d services' % lim['services']['max'])
    else:
        site = {name_key(s['name']): s['name'] for s in c.services}
        seen = []
        for i, s in enumerate(services):
            where = 'gbp.services[%d]' % i
            if not keys(s, ('name', 'description'), where, r):
                continue
            name = text(s['name'], where + '.name', r, lim['services']['name'])
            desc = text(s['description'], where + '.description', r, lim['services']['description'], multiline=True)
            common_checks(desc, where + '.description', r, c, links='none')
            for m in money_hits(desc):
                r.warn('%s.description has a price (%s): GBP has its own price field for each service; keep the description about the work'
                       % (where, m))
            k = name_key(name)
            if k in seen:
                r.err('%s: "%s" is listed twice' % (where, name))
            seen.append(k)
            if site:
                if k not in site:
                    r.err('%s: "%s" is not one of the site\'s services (%s)' % (where, name, ', '.join(site.values())))
                elif name != site[k]:
                    r.err('%s: write the site\'s exact name "%s"' % (where, site[k]))
        for k, name in site.items():
            if k not in seen:
                r.err('gbp.services is missing the site\'s service "%s"' % name)
        if site and [k for k in seen if k in site] != [k for k in site if k in seen]:
            r.warn('gbp.services: list them in the site\'s order')
        if not services:
            r.err('gbp.services is empty: list the business\'s services')

    cats = g['categories']
    clim = lim['categories']
    if not isinstance(cats, list) or not clim['min'] <= len(cats) <= clim['max']:
        r.err('gbp.categories must be a list of %d to %d categories (the first is the suggested primary)' % (clim['min'], clim['max']))
    else:
        known = set()
        catalog = load_data('gbp_categories.json')
        for names in catalog['byType'].values():
            known.update(name_key(n) for n in names)
        known.update(name_key(e['category']) for e in catalog['byService'])
        seen = set()
        for i, cat in enumerate(cats):
            where = 'gbp.categories[%d]' % i
            if not keys(cat, ('name', 'confirm'), where, r):
                continue
            name = text(cat['name'], where + '.name', r, clim['name'])
            if cat['confirm'] is not True:
                r.err('%s.confirm must be true: every category is a suggestion the owner confirms in GBP' % where)
            if name and name_key(name) in seen:
                r.err('%s: "%s" is listed twice' % (where, name))
            seen.add(name_key(name))
            if name and name_key(name) not in known:
                r.warn('%s: "%s" is not in data/gbp_categories.json; keep it only if you are sure GBP has it' % (where, name))

    posts = g['posts']
    plim = lim['posts']
    if not isinstance(posts, list) or len(posts) != plim['count']:
        r.err('gbp.posts must be a list of exactly %d posts (got %s)' % (plim['count'], len(posts) if isinstance(posts, list) else type(posts).__name__))
        return
    titles, bodies, with_photo = set(), set(), 0
    for i, p in enumerate(posts):
        where = 'gbp.posts[%d]' % i
        if not keys(p, ('title', 'body', 'cta', 'imageHint', 'photo'), where, r):
            continue
        title = text(p['title'], where + '.title', r, plim['title'])
        body = text(p['body'], where + '.body', r, plim['body'], plim['bodyMin'], multiline=True)
        hint = text(p['imageHint'], where + '.imageHint', r, plim['imageHint'])
        common_checks(title, where + '.title', r, c, links='none', phones='none')
        common_checks(body, where + '.body', r, c, links='discouraged', phones='none')
        common_checks(hint, where + '.imageHint', r, c, links='none')
        if title and norm(title) in titles:
            r.err('%s: the title "%s" is used twice' % (where, title))
        titles.add(norm(title))
        if body and norm(body) in bodies:
            r.err('%s: the same text as an earlier post' % where)
        bodies.add(norm(body))
        if p['cta'] not in CTAS:
            r.err('%s.cta must be one of %s' % (where, ', '.join(CTAS)))
        elif p['cta'] == 'CALL' and not c.phone_digits:
            r.err('%s.cta is CALL but the business has no phone in the request' % where)
        elif p['cta'] in ('BOOK', 'LEARN_MORE') and not (c.urls['site'] or c.urls['booking']):
            r.warn('%s.cta %s needs a link and the site has none yet; the owner adds it when posting' % (where, p['cta']))
        photo = p['photo']
        if photo is None:
            pass
        elif not isinstance(photo, str) or photo not in c.photos:
            r.err('%s.photo must be null or one of the request\'s photo refs (%s)' % (where, ', '.join(sorted({v['ref'] for v in c.photos.values()})) or 'none'))
        else:
            with_photo += 1
    n_photos = len({v['ref'] for v in c.photos.values()})
    if n_photos and not with_photo:
        r.err('gbp.posts: no post uses one of the customer\'s %d photos; set "photo" (and the imageHint) on the posts they fit' % n_photos)
    elif n_photos >= 4 and with_photo < 4:
        r.warn('gbp.posts: only %d posts use a photo, and there are %d' % (with_photo, n_photos))


# Trade words a business name may drop in a title ("Northside Shine" for
# "Northside Shine Mobile Detailing").
TRADE_WORDS = {'mobile', 'auto', 'car', 'cars', 'truck', 'detail', 'detailing', 'detailers', 'detailer', 'tint', 'tinting', 'window',
               'film', 'wheel', 'wheels', 'tire', 'tires', 'wash', 'repair', 'repairs', 'shop', 'garage', 'service', 'services',
               'care', 'spa', 'studio', 'llc', 'inc', 'co', 'company', 'the', 'and'}


def distinctive(name):
    """The part of a business name a title must keep (its name_key)."""
    words = re.findall(r'[a-z0-9&]+', norm(name))
    keep = [w for w in words if w not in TRADE_WORDS]
    return name_key(' '.join(keep or words))


def check_seo(s, r, c):
    if not keys(s, ('title', 'description', 'keywords'), 'seo', r):
        return
    lim = L['seo']
    t = text(s['title'], 'seo.title', r, lim['title']['max'], lim['title']['min'], count=True)
    d = text(s['description'], 'seo.description', r, lim['description']['max'], lim['description']['min'], count=True)
    common_checks(t, 'seo.title', r, c, links='none', phones='none')
    common_checks(d, 'seo.description', r, c, links='none')
    name = ((c.inputs.get('business') or {}).get('name') or '').strip()
    if t and name and distinctive(name) not in name_key(t):
        r.warn('seo.title does not name the business ("%s")' % name)
    kw = s['keywords']
    klim = lim['keywords']
    if not isinstance(kw, list) or not kw or len(kw) > klim['max']:
        r.err('seo.keywords must be a list of 1 to %d phrases' % klim['max'])
        return
    if len(kw) < klim['min']:
        r.warn('seo.keywords has %d phrases (aim for %d to %d)' % (len(kw), klim['min'], klim['max']))
    seen = set()
    for i, k in enumerate(kw):
        v = text(k, 'seo.keywords[%d]' % i, r, klim['each'])
        common_checks(v, 'seo.keywords[%d]' % i, r, c, links='none', phones='none')
        if v and norm(v) in seen:
            r.err('seo.keywords[%d]: "%s" is listed twice' % (i, v))
        seen.add(norm(v))


def check_request_link(v, where, r, c):
    if not v:
        return
    review = c.urls['review']
    if review:
        if review not in v:
            r.err('%s must include the review link exactly: %s' % (where, review))
        if REVIEW_PH in v:
            r.err('%s: replace %s with the review link %s' % (where, REVIEW_PH, review))
    elif REVIEW_PH not in v:
        r.err('%s: the request has no Google review link, so write the placeholder %s where the link goes' % (where, REVIEW_PH))


def check_reviews(rv, r, c):
    if not keys(rv, ('requestSms', 'requestEmail', 'replies'), 'reviews', r):
        return
    lim = L['reviews']
    sms = text(rv['requestSms'], 'reviews.requestSms', r, lim['requestSms'], multiline=True, count=True)
    subject = body = ''
    if keys(rv['requestEmail'], ('subject', 'body'), 'reviews.requestEmail', r):
        subject = text(rv['requestEmail']['subject'], 'reviews.requestEmail.subject', r, lim['subject'])
        body = text(rv['requestEmail']['body'], 'reviews.requestEmail.body', r, lim['emailBody'], multiline=True, count=True)
    for v, where in ((sms, 'reviews.requestSms'), (subject, 'reviews.requestEmail.subject'), (body, 'reviews.requestEmail.body')):
        common_checks(v, where, r, c, allowed_ph=(NAME_PH, REVIEW_PH))
        for hit in incentive_hits(v):
            r.err('%s offers or hints at something in return for a review ("%s"): Google forbids review incentives' % (where, hit))
        for hit in gating_hits(v):
            r.err('%s asks for a particular kind of review ("%s"): ask every customer for an honest review' % (where, hit))
    check_request_link(sms, 'reviews.requestSms', r, c)
    check_request_link(body, 'reviews.requestEmail.body', r, c)

    replies = rv['replies']
    if not isinstance(replies, list) or len(replies) != lim['replies']:
        r.err('reviews.replies must be a list of exactly %d replies, one per star rating 1 to 5' % lim['replies'])
        return
    ratings = []
    for i, rep in enumerate(replies):
        where = 'reviews.replies[%d]' % i
        if not keys(rep, ('rating', 'text'), where, r):
            continue
        rating = rep['rating']
        if isinstance(rating, bool) or not isinstance(rating, int) or not 1 <= rating <= 5:
            r.err('%s.rating must be a whole number from 1 to 5' % where)
        else:
            ratings.append(rating)
        v = text(rep['text'], where + '.text', r, lim['reply'], multiline=True)
        common_checks(v, where + '.text', r, c, allowed_ph=(NAME_PH,))
        for hit in incentive_hits(v):
            r.err('%s offers something ("%s"): replies never offer anything in return for a review or to change one' % (where, hit))
        if c.urls['review'] and c.urls['review'] in v:
            r.warn('%s carries the review link; a reply does not need it' % where)
    if sorted(ratings) != [1, 2, 3, 4, 5]:
        r.err('reviews.replies must have one reply for each rating 1, 2, 3, 4 and 5 (got %s)' % sorted(ratings))


def check_social(s, r, c):
    if not keys(s, ('bio', 'captions'), 'social', r):
        return
    lim = L['social']
    bio = text(s['bio'], 'social.bio', r, lim['bio'], multiline=True, count=True)
    common_checks(bio, 'social.bio', r, c, links='discouraged')
    caps = s['captions']
    if not isinstance(caps, list) or len(caps) != lim['captions']:
        r.err('social.captions must be a list of exactly %d captions' % lim['captions'])
        return
    for i, cap in enumerate(caps):
        where = 'social.captions[%d]' % i
        v = text(cap, where, r, lim['caption'], multiline=True)
        common_checks(v, where, r, c, links='discouraged')
        tags = re.findall(r'(?<![\w#])#\w+', v)
        if len(tags) > lim['hashtags']:
            r.err('%s has %d hashtags, max %d' % (where, len(tags), lim['hashtags']))
        elif len(tags) > 10:
            r.warn('%s has %d hashtags; 3 to 8 read better' % (where, len(tags)))
    if len({norm(v) for v in caps if isinstance(v, str)}) < len(caps):
        r.err('social.captions repeats a caption')


def validate(data, inputs):
    r = Report()
    c = Ctx(inputs)
    if not keys(data, TOP, 'words.json', r) and not isinstance(data, dict):
        return r
    if 'gbp' in data:
        check_gbp(data['gbp'], r, c)
    if 'seo' in data:
        check_seo(data['seo'], r, c)
    if 'reviews' in data:
        check_reviews(data['reviews'], r, c)
    if 'social' in data:
        check_social(data['social'], r, c)
    notes = data.get('notes')
    if 'notes' in data:
        if not isinstance(notes, list) or len(notes) > L['notes']['max']:
            r.err('notes must be a list of at most %d strings' % L['notes']['max'])
        else:
            for i, n in enumerate(notes):
                text(n, 'notes[%d]' % i, r, L['notes']['each'])
    if not inputs:
        r.warn('no --inputs given: services, links, photos and facts were not checked against the request')
    return r


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('words')
    ap.add_argument('--inputs', default='', help="the request's words-inputs.json")
    try:
        args = ap.parse_args(argv[1:])
    except SystemExit:
        return 2
    try:
        raw = open(args.words, 'rb').read()
        data = json.loads(raw.decode('utf-8'))
    except (OSError, ValueError) as e:
        print('FAIL: cannot read %s as UTF-8 JSON: %s' % (args.words, e))
        return 2
    try:
        inputs = load_inputs(args.inputs)
    except (OSError, ValueError) as e:
        print('FAIL: cannot read the inputs %s: %s' % (args.inputs, e))
        return 2
    r = validate(data, inputs)
    if len(raw) > MAX_BYTES:
        r.err('words.json is %d bytes, max %d' % (len(raw), MAX_BYTES))
    if r.lengths:
        print('LENGTHS ' + ', '.join(r.lengths))
    for w in r.warnings:
        print('WARN  ' + w)
    for e in r.errors:
        print('ERROR ' + e)
    if r.errors:
        print('FAIL: %d error(s). Fix words.json and run this again.' % len(r.errors))
        return 1
    print('OK: words.json is valid%s.' % (' (%d warning(s))' % len(r.warnings) if r.warnings else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
