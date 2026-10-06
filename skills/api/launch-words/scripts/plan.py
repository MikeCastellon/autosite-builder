"""Turns the request's words-inputs.json into a writing plan: the exact
service names, the buttons a post may use, the links, the photos, suggested
GBP categories and a 12-post plan (themes from data/post_ideas.json, a photo
for the posts it fits). Prints JSON; the plan is a starting point, the
customer's answers and photos decide.

  plan.py <words-inputs.json> [--out /tmp/words/plan.json]
"""
import argparse
import datetime
import json
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from words_lib import CTAS, LIMITS, REVIEW_PH, load_data, load_inputs, norm  # noqa: E402

COUNT = LIMITS['gbp']['posts']['count']
# The order themes take turns in, so the feed doesn't run three spotlights
# in a row. Themes without what they need are skipped.
PATTERN = ['intro', 'service', 'work', 'tip', 'service', 'review', 'season', 'work', 'booking', 'service', 'tip',
           'area', 'website', 'work', 'service', 'review', 'tip', 'work', 'service', 'tip']


def word_re(word):
    """A whole word or phrase, plural or -ing form included ("tire" finds
    "tires", never "tired")."""
    return re.compile(r'(?<![a-z0-9])%s(?:s|es|ing)?(?![a-z0-9])' % re.escape(norm(word)))


def suggest_categories(inputs):
    """The type's usual primary category, then the categories the
    business's own service names point to. Only names count: a service
    description that mentions glass is no auto glass shop."""
    cats = load_data('gbp_categories.json')
    biz = inputs.get('business') or {}
    btype = biz.get('type') if biz.get('type') in cats['byType'] else 'other'
    by_type = cats['byType'][btype]
    names = norm(' | '.join(s.get('name') or '' for s in inputs.get('services') or [] if isinstance(s, dict)))

    def matched(category):
        return any(e['category'] == category and any(word_re(w).search(names) for w in e['words']) for e in cats['byService'])

    out = [by_type[0]]
    for c in by_type[1:]:
        if matched(c) and c not in out:
            out.append(c)
    for e in cats['byService']:
        if e.get('anyType') and e['category'] not in out and matched(e['category']):
            out.append(e['category'])
    return out[:LIMITS['gbp']['categories']['max']]


# How well a photo suits a post theme, by the photo desk's role (when it
# ran): a before/after or gallery shot shows the work, the about photo
# (van, shop, team) introduces the business.
ROLE_FIT = {
    'work': {'before': 3, 'after': 3, 'gallery': 2.5, 'hero': 2},
    'service': {'hero': 1.5, 'gallery': 1.5, 'after': 1, 'before': 1},
    'intro': {'about': 3, 'hero': 1.5},
    'area': {'about': 2.5, 'hero': 1},
    'website': {'hero': 2.5, 'gallery': 1},
    'booking': {'about': 1.5, 'hero': 1},
    'season': {'gallery': 1, 'hero': 1},
}
SKIP_WORDS = {'and', 'the', 'with', 'for', 'full', 'package', 'service', 'services', 'basic', 'deluxe', 'premium'}


def photo_text(p):
    return norm(' '.join(p.get(k) or '' for k in ('note', 'alt', 'name')))


def photo_fit(slot, photo):
    """A score for putting this photo on this post (0 = no reason to)."""
    score = ROLE_FIT.get(slot['theme'], {}).get(photo.get('role') or '', 0)
    if photo.get('role') == 'skip':
        return -1
    if slot['theme'] == 'service':
        text = photo_text(photo)
        words = [w for w in re.findall(r'[a-z0-9]+', norm(slot.get('service') or '')) if len(w) > 2 and w not in SKIP_WORDS]
        score += 3 * sum(1 for w in words if word_re(w).search(text))
    elif slot['theme'] == 'work':
        score += 0.5
    return score


def assign_photos(slots, photos):
    """Each photo on the post it suits best, once, best fits first; posts
    left over get none (their image hint asks for a new photo)."""
    pairs = []
    for si, slot in enumerate(slots):
        if slot['theme'] in ('review', 'tip'):
            continue
        for pi, photo in enumerate(photos):
            fit = photo_fit(slot, photo)
            if fit >= 0:
                pairs.append((-fit, si, pi))
    used_slots, used_photos = set(), set()
    for _, si, pi in sorted(pairs):
        if si in used_slots or pi in used_photos:
            continue
        used_slots.add(si)
        used_photos.add(pi)
        slots[si]['photo'] = photos[pi]['ref']
        slots[si]['photoName'] = photos[pi].get('name') or ''
    uses = {i: (1 if i in used_photos else 0) for i in range(len(photos))}
    # A "recent work" post shows a photo: with fewer photos than posts, it
    # takes the least-used photo that fits best (a photo then appears on two
    # posts, with different words).
    for slot in slots:
        if slot['theme'] == 'work' and 'photo' not in slot:
            options = [(uses[i], -photo_fit(slot, p), i) for i, p in enumerate(photos) if photo_fit(slot, p) >= 0 and uses[i] < 2]
            if options:
                i = min(options)[2]
                uses[i] += 1
                slot['photo'] = photos[i]['ref']
                slot['photoName'] = photos[i].get('name') or ''
    # Photos still unused (more photos than fitting posts) go on tips.
    spare = [p for i, p in enumerate(photos) if not uses[i] and p.get('role') != 'skip']
    for slot in slots:
        if 'photo' not in slot and slot['theme'] == 'tip' and spare:
            p = spare.pop(0)
            slot['photo'] = p['ref']
            slot['photoName'] = p.get('name') or ''
    for slot in slots:
        slot.setdefault('photo', None)
    return slots


def post_plan(inputs, today):
    ideas = load_data('post_ideas.json')
    themes = {t['id']: t for t in ideas['themes']}
    biz = inputs.get('business') or {}
    urls = inputs.get('urls') or {}
    services = [s for s in inputs.get('services') or [] if isinstance(s, dict) and s.get('name')]
    photos = [p for p in inputs.get('photos') or [] if isinstance(p, dict) and p.get('ref')]
    reviews = ((inputs.get('sources') or {}).get('reviews') or '').strip()
    have = {
        'service': bool(services), 'photo': bool(photos), 'reviews': bool(reviews), 'booking': bool(urls.get('booking')),
        'area': bool(biz.get('serviceArea') or biz.get('city')), 'phone': bool((biz.get('phone') or '').strip()),
    }
    btype = biz.get('type') if biz.get('type') in ideas['tipsByType'] else 'other'
    tips = list(ideas['tipsByType'][btype])
    used = {'service': 0, 'work': 0, 'tip': 0, 'review': 0}
    caps = {'service': len(services), 'work': len(photos), 'tip': len(tips), 'review': 2,
            'intro': 1, 'season': 1, 'booking': 1, 'area': 1, 'website': 1}
    taken = {k: 0 for k in caps}
    slots = []
    for _ in range(3):
        for tid in PATTERN:
            if len(slots) >= COUNT:
                break
            t = themes[tid]
            if any(not have[n] for n in t['needs']) or taken[tid] >= caps[tid]:
                continue
            taken[tid] += 1
            slot = {'post': len(slots) + 1, 'theme': tid, 'title': t['title'], 'angle': t['angle'], 'cta': t['cta']}
            if tid == 'service':
                slot['service'] = services[used['service']]['name']
                used['service'] += 1
            elif tid == 'tip':
                slot['tip'] = tips[used['tip']]
                used['tip'] += 1
            elif tid == 'season':
                slot['season'] = ideas['seasonal'][str(today.month)] + ' Adapt it to their area (no road salt where it never snows).'
            slots.append(slot)
    # Still short (few services, photos or reviews): more tips, written fresh.
    while len(slots) < COUNT:
        t = themes['tip']
        slots.append({'post': len(slots) + 1, 'theme': 'tip', 'title': t['title'], 'angle': t['angle'], 'cta': t['cta'],
                      'tip': 'Another general care tip for their trade, different from the others.'})
    for s in slots:
        if s['cta'] == 'CALL' and not have['phone']:
            s['cta'] = 'LEARN_MORE'
    return assign_photos(slots, photos)


def build_plan(inputs, today=None):
    if today is None:
        try:
            today = datetime.date.fromisoformat(inputs.get('today') or '')
        except ValueError:
            today = datetime.date.today()
    biz = inputs.get('business') or {}
    urls = inputs.get('urls') or {}
    phone = (biz.get('phone') or '').strip()
    services = [s for s in inputs.get('services') or [] if isinstance(s, dict) and s.get('name')]
    return {
        'business': {k: biz.get(k) or '' for k in ('name', 'typeLabel', 'city', 'state', 'serviceArea', 'address')},
        'services': [s['name'] for s in services],
        'servicesRule': 'gbp.services: exactly these names, in this order, one description each (<= %d characters).'
                        % LIMITS['gbp']['services']['description'] if services else 'The site lists no services: take them from the intake.',
        'ctas': [c for c in CTAS if c != 'CALL' or phone],
        'links': {
            'site': urls.get('site') or '',
            'booking': urls.get('booking') or '',
            'review': urls.get('review') or '',
            'reviewRule': ('Put %s in the review request text and email.' % urls['review']) if urls.get('review')
            else 'No Google place: write %s where the review link goes.' % REVIEW_PH,
        },
        'photos': [{k: p.get(k) or '' for k in ('ref', 'file', 'name', 'note', 'alt', 'role')}
                   for p in inputs.get('photos') or [] if isinstance(p, dict) and p.get('ref')],
        'categories': suggest_categories(inputs),
        'posts': post_plan(inputs, today),
        'today': today.isoformat(),
        'limits': {
            'gbp.description': LIMITS['gbp']['description']['max'], 'post title': LIMITS['gbp']['posts']['title'],
            'post body': LIMITS['gbp']['posts']['body'], 'seo.title': LIMITS['seo']['title']['max'],
            'seo.description': LIMITS['seo']['description']['max'], 'requestSms': LIMITS['reviews']['requestSms'],
            'social.bio': LIMITS['social']['bio'],
        },
    }


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('inputs')
    ap.add_argument('--out', default='')
    args = ap.parse_args(argv[1:])
    try:
        inputs = load_inputs(args.inputs)
    except (OSError, ValueError) as e:
        print('FAIL: cannot read %s: %s' % (args.inputs, e))
        return 2
    plan = build_plan(inputs)
    text = json.dumps(plan, indent=2, ensure_ascii=False)
    if args.out:
        with open(args.out, 'w', encoding='utf-8') as f:
            f.write(text + '\n')
    print(text)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
