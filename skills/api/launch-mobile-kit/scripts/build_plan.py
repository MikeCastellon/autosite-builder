"""Builds mobile.json and contact.vcf from the facts, your choices and the
icon report, then validates them (exit 1 lists what to fix).

  build_plan.py --inputs mobile-inputs.json --choices /tmp/mobile/choices.json \
      --icons /tmp/mobile/icons.json --out-dir /tmp/mobile [--no-photo]

You decide the words and the order (choices.json, see references/mobile-json.md):
  phoneHeadline, shortName, phoneSectionOrder (required), and optionally
  smsBody, themeColor, actions (which kinds, in order), labels, notes.
This script fills in everything that follows from the facts, so nothing is
retyped: the tap links (tel:, the sms: link both phones read, the booking
page, Google Maps, contact.vcf), the vCard (only the facts; the 180 px icon
as its photo unless --no-photo), the icon summary from make_icons.py's
report and the phone scorecard.
"""
import argparse
import json
import os
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from common import ACTION_KINDS, DEFAULT_LABELS, action_hrefs, default_sms_body, norm_hex, scorecard, sms_href, vcard_of  # noqa: E402
from vcard import build_vcard  # noqa: E402
from validate_mobile import validate  # noqa: E402


def build(facts, choices, icons_report=None):
    """mobile.json's content (no files written)."""
    palette = facts.get('palette') or {}
    report = icons_report or {}
    business = (facts.get('business') or {}).get('name', '')
    dial = (facts.get('phone') or {}).get('dial') or ''

    theme = norm_hex(choices.get('themeColor')) or norm_hex(palette.get('bg')) or norm_hex(report.get('bg')) or '#ffffff'
    body = choices.get('smsBody') if isinstance(choices.get('smsBody'), str) else default_sms_body(business)
    hrefs = action_hrefs(facts, body)
    wanted = choices.get('actions') if isinstance(choices.get('actions'), list) else list(ACTION_KINDS)
    labels = choices.get('labels') if isinstance(choices.get('labels'), dict) else {}
    actions, dropped = [], []
    for kind in wanted:
        if kind not in ACTION_KINDS or any(a['kind'] == kind for a in actions):
            continue
        if kind not in hrefs:
            dropped.append(kind)
            continue
        label = labels.get(kind) if isinstance(labels.get(kind), str) else DEFAULT_LABELS[kind]
        actions.append({'kind': kind, 'label': label, 'href': hrefs[kind]})

    source = report.get('source') or 'none'
    plan = {
        'version': 1,
        'themeColor': theme,
        'shortName': choices.get('shortName', ''),
        'phoneHeadline': choices.get('phoneHeadline', ''),
        'phoneSectionOrder': choices.get('phoneSectionOrder', []),
        'actions': actions,
        'smsQuote': {'body': body, 'href': sms_href(dial, body)} if dial else None,
        'vcard': vcard_of(facts),
        'icons': {
            'bg': norm_hex(report.get('bg')) or theme,
            'source': source if source in ('logo', 'monogram') else 'none',
            'logo': report.get('logo') if source == 'logo' else None,
            'monogram': (report.get('monogram') or '') if source == 'monogram' else '',
        },
        'scorecard': [],
        'notes': [n for n in choices.get('notes', []) if isinstance(n, str)] if isinstance(choices.get('notes'), list) else [],
    }
    plan['scorecard'] = scorecard(facts, plan, report.get('checks') or {})
    return plan, dropped


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--inputs', required=True)
    ap.add_argument('--choices', required=True)
    ap.add_argument('--icons', help="make_icons.py's report (icons.json)")
    ap.add_argument('--out-dir', required=True)
    ap.add_argument('--no-photo', action='store_true', help='leave the icon out of the contact card')
    args = ap.parse_args(argv[1:])
    try:
        with open(args.inputs, encoding='utf-8') as f:
            facts = json.load(f)
        with open(args.choices, encoding='utf-8') as f:
            choices = json.load(f)
        report = None
        if args.icons:
            with open(args.icons, encoding='utf-8') as f:
                report = json.load(f)
    except (OSError, ValueError) as e:
        print('FAIL: cannot read the inputs: %s' % e)
        return 2
    if not isinstance(choices, dict):
        print('FAIL: choices.json must be an object')
        return 2

    plan, dropped = build(facts, choices, report)
    for kind in dropped:
        print('NOTE  left out the "%s" action: the inputs do not support it' % kind)
    os.makedirs(args.out_dir, exist_ok=True)
    photo = None
    icon = os.path.join(args.out_dir, 'apple-touch-icon.png')
    if not args.no_photo and os.path.isfile(icon):
        photo = open(icon, 'rb').read()
    try:
        card = build_vcard(facts, photo)
    except ValueError as e:
        print('FAIL: %s' % e)
        return 1
    with open(os.path.join(args.out_dir, 'contact.vcf'), 'w', encoding='utf-8', newline='') as f:
        f.write(card)
    with open(os.path.join(args.out_dir, 'mobile.json'), 'w', encoding='utf-8') as f:
        json.dump(plan, f, indent=2, ensure_ascii=False)
        f.write('\n')

    errors, warnings = validate(plan, facts, args.out_dir if report else None)
    for w in warnings:
        print('WARN  ' + w)
    for e in errors:
        print('ERROR ' + e)
    bad = [c for c in plan['scorecard'] if c['pass'] is False]
    print('Scorecard: %d pass, %d to fix, %d to check by hand or in preview.' % (
        sum(1 for c in plan['scorecard'] if c['pass'] is True), len(bad), sum(1 for c in plan['scorecard'] if c['pass'] is None)))
    for c in bad:
        print('  FIX   %s: %s' % (c['check'], c['note']))
    if errors:
        print('FAIL: %d error(s). Fix choices.json and run this again.' % len(errors))
        return 1
    print('OK: wrote mobile.json and contact.vcf in %s' % args.out_dir)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
