"""Checks mobile.json against mobile-inputs.json (the confirmed facts) and,
with --dir, the icon files and contact.vcf next to it. Exit 0 = valid
(warnings may still print), 1 = errors to fix, 2 = unreadable file.

  validate_mobile.py /tmp/mobile/mobile.json --inputs mobile-inputs.json --dir /tmp/mobile

Errors (all must be fixed):
  - shape: exactly the contract's keys (references/mobile-json.md), version 1
  - themeColor is one of the brand palette's colors
  - phoneHeadline: one line, at most 40 characters, only the site's own
    words (numbers, claims and new words are errors); shortName: at most
    12 characters from the business name
  - phoneSectionOrder: every section the site shows, once, hero first
  - actions: allowed kinds, once each, only those the facts support, with
    exactly the links build_plan.py makes (tel:, the sms: link, the booking
    page, Google Maps, contact.vcf); labels short and claim-free
  - smsQuote: the body (one line, at most 160 characters, no claims) and the
    sms:<number>?&body=<encoded> link iPhone and Android both read; null
    only when there is no phone number
  - vcard equals the facts; contact.vcf is a valid vCard 3.0 with exactly
    them (no other line, value or parameter; its PHOTO is apple-touch-icon.png)
  - scorecard: every check in data/rules.json order; the ones that follow
    from the inputs say what the inputs say; the browser's are null
  - icons: exact sizes, opaque where a phone needs it, one flat background,
    the mark inside the maskable circle, not empty
"""
import base64
import json
import os
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from common import (  # noqa: E402
    ACTION_KINDS, CHECK_FROM, CHECK_IDS, ICONS, LIMITS, RULES, action_hrefs, claim_problems, headline_problems,
    headline_sources, line_problem, norm_hex, order_problems, parse_sms_href, scorecard, short_name_problems,
    sms_href, vcard_of,
)

TOP_KEYS = ('version', 'themeColor', 'shortName', 'phoneHeadline', 'phoneSectionOrder', 'actions', 'smsQuote',
            'vcard', 'icons', 'scorecard', 'notes')
VCARD_KEYS = ('fn', 'org', 'tel', 'email', 'url', 'adr')
ICON_KEYS = ('bg', 'source', 'logo', 'monogram')
CHECK_KEYS = ('id', 'check', 'pass', 'note')
MAX_BYTES = 64 * 1024
PALETTE_ROLES = ('bg', 'secondary', 'text', 'muted', 'accent')


def _keys(obj, want, where, errors):
    if not isinstance(obj, dict):
        errors.append('%s must be an object' % where)
        return False
    missing = [k for k in want if k not in obj]
    extra = [k for k in obj if k not in want]
    if missing:
        errors.append('%s is missing %s' % (where, ', '.join(missing)))
    if extra:
        errors.append('%s has keys the contract does not allow: %s' % (where, ', '.join(map(str, extra))))
    return not missing


def check_plan(plan, facts):
    """(errors, warnings) for mobile.json against the facts, files aside."""
    errors, warnings = [], []
    if not _keys(plan, TOP_KEYS, 'mobile.json', errors):
        if not isinstance(plan, dict):
            return errors, warnings
    if plan.get('version') != 1 or isinstance(plan.get('version'), bool):
        errors.append('version must be 1')

    palette = {r: norm_hex((facts.get('palette') or {}).get(r)) for r in PALETTE_ROLES}
    colors = [c for c in palette.values() if c]
    tc = plan.get('themeColor')
    if not isinstance(tc, str) or norm_hex(tc) != tc:
        errors.append('themeColor must be a lowercase #rrggbb color (got %r)' % (tc,))
    elif colors and tc not in colors:
        errors.append('themeColor %s is not one of the brand colors (%s); the brand bg %s is the usual pick' % (tc, ', '.join(colors), palette['bg']))

    business = (facts.get('business') or {}).get('name', '')
    if 'shortName' in plan:
        errors += short_name_problems(plan['shortName'], business)
    sources = headline_sources(facts)
    if 'phoneHeadline' in plan:
        errors += headline_problems(plan['phoneHeadline'], sources)
    if 'phoneSectionOrder' in plan:
        errors += order_problems(plan['phoneSectionOrder'], facts)

    sms = plan.get('smsQuote')
    dial = (facts.get('phone') or {}).get('dial') or ''
    body = None
    if 'smsQuote' in plan:
        if sms is None:
            if dial:
                errors.append('smsQuote is null but the site has a phone number: write the text-for-a-quote body')
        elif _keys(sms, ('body', 'href'), 'smsQuote', errors):
            if not dial:
                errors.append('smsQuote must be null: the site has no phone number to text')
            p = line_problem(sms['body'], 'smsQuote.body', LIMITS['smsBody'])
            if p:
                errors.append(p)
            else:
                body = sms['body']
                errors += claim_problems(body, sources, 'smsQuote.body')
                if dial and sms['href'] != sms_href(dial, body):
                    errors.append('smsQuote.href must be exactly %s (build_plan.py makes it)' % sms_href(dial, body))
                number, decoded, problems = parse_sms_href(sms['href']) if isinstance(sms['href'], str) else (None, None, ['smsQuote.href must be a string'])
                errors += ['smsQuote.href: ' + p for p in problems]
                if any(ord(c) > 0xffff for c in body):
                    warnings.append('smsQuote.body has emoji: some phones send it as several messages')

    hrefs = action_hrefs(facts, body)
    actions = plan.get('actions')
    if 'actions' in plan:
        if not isinstance(actions, list):
            errors.append('actions must be a list')
        else:
            seen = []
            for i, a in enumerate(actions):
                where = 'actions[%d]' % i
                if not _keys(a, ('kind', 'label', 'href'), where, errors):
                    continue
                kind = a['kind']
                if kind not in ACTION_KINDS:
                    errors.append('%s.kind %r must be one of %s' % (where, kind, ', '.join(ACTION_KINDS)))
                    continue
                if kind in seen:
                    errors.append('%s: "%s" is listed twice' % (where, kind))
                seen.append(kind)
                p = line_problem(a['label'], where + '.label', LIMITS['label'])
                errors += [p] if p else claim_problems(a['label'], sources + list(RULES['defaultLabels'].values()), where + '.label')
                if kind not in hrefs:
                    errors.append('%s: no "%s" action, the inputs do not support it (%s)' % (where, kind, {
                        'call': 'no phone number', 'text': 'no phone number', 'book': 'the site takes no bookings',
                        'directions': 'no shop street address'}.get(kind, '')))
                elif a['href'] != hrefs[kind]:
                    errors.append('%s.href must be exactly %s' % (where, hrefs[kind]))
            for kind in ('call', 'text'):
                if kind in hrefs and kind not in seen:
                    warnings.append('actions: no "%s" action although the site has a phone number (say why in notes)' % kind)

    if 'vcard' in plan and _keys(plan['vcard'], VCARD_KEYS, 'vcard', errors):
        want = vcard_of(facts)
        for k in VCARD_KEYS:
            if plan['vcard'][k] != want[k]:
                errors.append('vcard.%s must be %r (from the inputs, build_plan.py fills it)' % (k, want[k]))

    icons = plan.get('icons')
    if 'icons' in plan and _keys(icons, ICON_KEYS, 'icons', errors):
        if not norm_hex(icons['bg']) or icons['bg'] != norm_hex(icons['bg']):
            errors.append('icons.bg must be a lowercase #rrggbb color')
        if icons['source'] not in ('logo', 'monogram', 'none'):
            errors.append('icons.source must be logo, monogram or none')
        if icons['source'] == 'logo' and icons['logo'] not in ((facts.get('logos') or [])):
            errors.append('icons.logo must be one of the logo files sent: %s' % (', '.join(facts.get('logos') or []) or 'none'))
        if icons['source'] != 'logo' and icons['logo'] is not None:
            errors.append('icons.logo must be null unless the icons come from a logo')
        mono = icons['monogram']
        if not isinstance(mono, str) or (icons['source'] == 'monogram') != bool(mono) or len(mono) > LIMITS['monogram']:
            errors.append('icons.monogram: the letters (1-%d) for a monogram, else ""' % LIMITS['monogram'])

    card = plan.get('scorecard')
    if 'scorecard' in plan:
        if not isinstance(card, list):
            errors.append('scorecard must be a list')
        else:
            ids = [c.get('id') if isinstance(c, dict) else None for c in card]
            if ids != list(CHECK_IDS):
                errors.append('scorecard must list every check of data/rules.json in its order: %s' % ', '.join(CHECK_IDS))
            skill = {c['id']: c for c in card if isinstance(c, dict) and CHECK_FROM.get(c.get('id')) == 'skill'}
            expected = {c['id']: c for c in scorecard(facts, plan, skill)}
            for i, c in enumerate(card):
                where = 'scorecard[%d]' % i
                if not _keys(c, CHECK_KEYS, where, errors) or c['id'] not in expected:
                    continue
                src = CHECK_FROM[c['id']]
                p = line_problem(c['check'], where + '.check', 80)
                if p:
                    errors.append(p)
                p = line_problem(c['note'], where + '.note', LIMITS['checkNote'], required=False)
                if p:
                    errors.append(p)
                if src in ('manual', 'preview'):
                    if c['pass'] is not None:
                        errors.append('%s (%s): pass must be null, the browser or a person checks it' % (where, c['id']))
                elif src == 'skill':
                    if not isinstance(c['pass'], bool):
                        errors.append('%s (%s): pass must be true or false (from make_icons.py)' % (where, c['id']))
                elif c['pass'] != expected[c['id']]['pass']:
                    errors.append('%s (%s): pass must be %s: %s' % (where, c['id'], json.dumps(expected[c['id']]['pass']), expected[c['id']]['note']))

    notes = plan.get('notes')
    if 'notes' in plan:
        if not isinstance(notes, list) or len(notes) > LIMITS['notes']:
            errors.append('notes must be a list of at most %d strings' % LIMITS['notes'])
        else:
            for i, n in enumerate(notes):
                p = line_problem(n, 'notes[%d]' % i, LIMITS['note'])
                if p:
                    errors.append(p)
    return errors, warnings


# ─── Files ────────────────────────────────────────────────────────────

def measure_icon(path, size, purpose):
    """(problems, measured) for one icon file."""
    from PIL import Image
    import numpy as np
    name = os.path.basename(path)
    try:
        im = Image.open(path)
        im.load()
    except Exception as e:
        return ['%s: cannot open (%s)' % (name, e)], {}
    if im.format != 'PNG':
        return ['%s is not a PNG' % name], {}
    if im.size != (size, size):
        return ['%s is %dx%d, must be %dx%d' % (name, im.size[0], im.size[1], size, size)], {}
    problems = []
    rgba = np.asarray(im.convert('RGBA')).astype(int)
    rgb, alpha = rgba[..., :3], rgba[..., 3]
    if purpose == 'favicon':
        solid = alpha > 200
        if not solid.any():
            return ['%s is transparent' % name], {}
        flat = rgb[solid]
        colors, counts = np.unique(flat, axis=0, return_counts=True)
        bg = colors[counts.argmax()]
        if (np.abs(flat - bg).max(axis=1) > 40).mean() < 0.02:
            problems.append('%s looks empty: no mark on the tile' % name)
        return problems, {'bg': '#%02x%02x%02x' % tuple(bg)}
    if (alpha < 255).any():
        problems.append('%s has transparent pixels: phones fill them black (iOS) or crop them (Android); make it opaque' % name)
    corners = [rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]]
    bg = corners[0]
    if any(np.abs(c - bg).max() > 24 for c in corners):
        problems.append('%s: the corners differ, the background must be one flat color' % name)
    diff = np.abs(rgb - bg).max(axis=2)
    yy, xx = np.mgrid[0:size, 0:size]
    d = np.sqrt((xx + 0.5 - size / 2.0) ** 2 + (yy + 0.5 - size / 2.0) ** 2)
    if purpose == 'maskable':
        outside = d > RULES['maskableSafeRadius'] * size + 1
        bad = (diff > 24) & outside
        if bad.any():
            problems.append('%s: the mark reaches outside the safe circle (radius %d%% of the icon), so masks crop it' % (name, round(RULES['maskableSafeRadius'] * 100)))
    else:
        ring = max(1, int(size * 0.06))
        edge = np.ones((size, size), bool)
        edge[ring:-ring, ring:-ring] = False
        if ((diff > 24) & edge).any():
            problems.append('%s: the mark touches the edge; keep about %d%% padding for the rounded corners' % (name, round(RULES['applePadding'] * 100)))
    if (diff > 40).mean() < 0.01:
        problems.append('%s looks empty: the mark does not show on the background' % name)
    return problems, {'bg': '#%02x%02x%02x' % tuple(bg)}


def check_files(plan, facts, folder):
    from vcard import card_fields, extra_problems, parse_vcard
    errors, warnings = [], []
    measured = {}
    for spec in ICONS:
        path = os.path.join(folder, spec['name'])
        if not os.path.isfile(path):
            errors.append('%s is missing in %s' % (spec['name'], folder))
            continue
        problems, info = measure_icon(path, spec['size'], spec['purpose'])
        errors += problems
        measured[spec['name']] = (problems, info)
    icons = plan.get('icons') if isinstance(plan.get('icons'), dict) else {}
    big = measured.get('icon-512.png')
    if big and big[1].get('bg') and norm_hex(icons.get('bg')):
        from common import hex_to_rgb
        a, b = hex_to_rgb(big[1]['bg']), hex_to_rgb(icons['bg'])
        if max(abs(x - y) for x, y in zip(a, b)) > 6:
            errors.append('icons.bg is %s but icon-512.png is on %s' % (icons['bg'], big[1]['bg']))
    card = {c.get('id'): c for c in plan.get('scorecard') or [] if isinstance(c, dict)}
    if card.get('icons', {}).get('pass') is True and any(measured.get(s['name'], ([1], {}))[0] for s in ICONS if s['purpose'] != 'favicon'):
        errors.append('scorecard icons says pass, but the icon files have problems (above)')

    vcf = os.path.join(folder, 'contact.vcf')
    if not os.path.isfile(vcf):
        errors.append('contact.vcf is missing in %s' % folder)
    else:
        data = open(vcf, 'rb').read()
        if len(data) > 200 * 1024:
            errors.append('contact.vcf is %d bytes; keep it under 200 KB (leave the photo out)' % len(data))
        props, problems = parse_vcard(data)
        errors += ['contact.vcf: ' + p for p in problems]
        if not problems:
            errors += ['contact.vcf: ' + p for p in extra_problems(props, facts)]
            # The card's picture is the 180 px icon build_plan.py embeds, never another image.
            icon = os.path.join(folder, 'apple-touch-icon.png')
            for p in props:
                if p['name'] == 'PHOTO':
                    same = os.path.isfile(icon) and base64.b64decode(p['raw']) == open(icon, 'rb').read()
                    if not same:
                        errors.append('contact.vcf: PHOTO is not apple-touch-icon.png (run build_plan.py again after make_icons.py)')
            fields = card_fields(props)
            want = vcard_of(facts)
            for k in ('fn', 'org', 'tel', 'email', 'url', 'adr'):
                if fields[k] != want[k]:
                    errors.append('contact.vcf %s is %r, the inputs say %r' % (k.upper(), fields[k], want[k]))
    return errors, warnings


def validate(plan, facts, folder=None):
    errors, warnings = check_plan(plan, facts)
    if folder:
        e, w = check_files(plan, facts, folder)
        errors += e
        warnings += w
    return errors, warnings


def main(argv):
    import argparse
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('plan')
    ap.add_argument('--inputs', required=True)
    ap.add_argument('--dir', help='folder with the icons and contact.vcf (default: next to mobile.json)')
    ap.add_argument('--no-files', action='store_true', help='check mobile.json only')
    args = ap.parse_args(argv[1:])
    try:
        raw = open(args.plan, 'rb').read()
        plan = json.loads(raw.decode('utf-8'))
        with open(args.inputs, encoding='utf-8') as f:
            facts = json.load(f)
    except (OSError, ValueError) as e:
        print('FAIL: cannot read the files as UTF-8 JSON: %s' % e)
        return 2
    folder = None if args.no_files else (args.dir or os.path.dirname(os.path.abspath(args.plan)))
    errors, warnings = validate(plan, facts, folder)
    if len(raw) > MAX_BYTES:
        errors.append('mobile.json is %d bytes, max %d' % (len(raw), MAX_BYTES))
    for w in warnings:
        print('WARN  ' + w)
    for e in errors:
        print('ERROR ' + e)
    if errors:
        print('FAIL: %d error(s). Fix choices.json (or the icons), run build_plan.py, then this again.' % len(errors))
        return 1
    print('OK: mobile.json is valid%s.' % (' (%d warning(s))' % len(warnings) if warnings else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
