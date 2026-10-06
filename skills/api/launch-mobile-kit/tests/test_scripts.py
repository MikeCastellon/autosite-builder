"""Checks of the mobile kit's scripts.

Parity: the rules in scripts/common.py and validate_mobile.py against
tests/cases.json, which src/lib/kit/mobile.test.js writes from the server's
sanitizer (src/lib/kit/mobile.js). Standard library only.

End to end: icons, mobile.json and contact.vcf from generated sample logos
and the sample facts in cases.json, then the validator on good and broken
outputs. Needs Pillow and numpy (as in the code-execution container);
skipped without them. Everything is written to a temporary folder.

Run: python3 skills/api/launch-mobile-kit/tests/test_scripts.py
After changing src/lib/kit/mobile.js, first:
  UPDATE_SKILL_FIXTURES=1 npx vitest run src/lib/kit/mobile.test.js
"""
import base64
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(HERE, '..', 'scripts')
sys.path.insert(0, SCRIPTS)
sys.dont_write_bytecode = True

import common  # noqa: E402
import vcard  # noqa: E402
import validate_mobile  # noqa: E402

with open(os.path.join(HERE, 'cases.json'), encoding='utf-8') as _f:
    CASES = json.load(_f)

try:
    from PIL import Image, ImageDraw
    import numpy  # noqa: F401
    HAVE_LIBS = True
except ImportError:
    HAVE_LIBS = False

ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')


def image_info(path_or_bytes):
    """(size, mode) of an image file or PNG bytes, closing the file."""
    src = io.BytesIO(path_or_bytes) if isinstance(path_or_bytes, bytes) else path_or_bytes
    with Image.open(src) as im:
        return im.size, im.mode


def read_bytes(path):
    with open(path, 'rb') as f:
        return f.read()


def run(script, *args):
    p = subprocess.run([sys.executable, os.path.join(SCRIPTS, script)] + list(args),
                       capture_output=True, text=True, env=ENV)
    return p.returncode, p.stdout, p.stderr


class Parity(unittest.TestCase):
    """The Python rules give exactly what the server's JavaScript gives."""

    def test_contract_keys(self):
        self.assertEqual(list(validate_mobile.TOP_KEYS), CASES['constants']['jsonKeys'])
        self.assertEqual(CASES['constants']['schemaRequired'], CASES['constants']['jsonKeys'])

    def test_text(self):
        for text, want in CASES['tokens']:
            self.assertEqual(common.tokens(text), want, text)
        for word, want in CASES['forms']:
            self.assertEqual(sorted(common.forms(word)), want, word)
        for text, want in CASES['oneLine']:
            self.assertEqual(common.one_line(text), want, repr(text))
        for v, limit, want in CASES['lineProblem']:
            self.assertEqual(common.line_problem(v, 'text', limit), want, repr(v))

    def test_claims(self):
        sources = CASES['facts'][0]['sources']
        for text, want in CASES['headline']:
            self.assertEqual(common.headline_problems(text, sources), want, text)
        for text, want in CASES['claims']:
            self.assertEqual(common.claim_problems(text, sources, 'text'), want, text)
        for name, business, want in CASES['shortName']:
            self.assertEqual(common.short_name_problems(name, business), want, name)

    def test_links(self):
        for dial, body, want in CASES['sms']:
            self.assertEqual(common.sms_href(dial, body), want, body)
        for href, want in CASES['parseSms']:
            number, body, problems = common.parse_sms_href(href)
            self.assertEqual({'number': number, 'body': body, 'problems': problems}, want, href)
        for line, want in CASES['maps']:
            self.assertEqual(common.maps_href(line), want, line)
        for name, want in CASES['defaultSms']:
            self.assertEqual(common.default_sms_body(name), want, name)

    def test_facts(self):
        for case in CASES['facts']:
            facts, plan = case['facts'], case['plan']
            body = plan['smsQuote']['body'] if plan.get('smsQuote') else None
            name = facts['business']['name']
            self.assertEqual(common.headline_sources(facts), case['sources'], name)
            self.assertEqual(common.visible_ids(facts), case['visible'], name)
            self.assertEqual(common.action_hrefs(facts, body), case['hrefs'], name)
            self.assertEqual(common.vcard_of(facts), case['vcard'], name)
            self.assertEqual(common.order_problems(plan['phoneSectionOrder'], facts), case['order'], name)
            self.assertEqual(common.headline_problems(plan['phoneHeadline'], case['sources']), case['headline'], name)
            self.assertEqual(common.scorecard(facts, plan, case['skill']), case['scorecard'], name)

    def test_validator_agrees_with_the_server(self):
        for case in CASES['valid']:
            errors, _ = validate_mobile.check_plan(case['json'], case['facts'])
            self.assertEqual(errors, [])
        for case in CASES['invalid']:
            errors, _ = validate_mobile.check_plan(case['json'], case['facts'])
            self.assertTrue(errors, 'the server corrects %s, so the validator must reject it' % case['changes'])

    def test_rules_file(self):
        self.assertEqual(common.RULES['limits']['phoneHeadline'], 40)
        self.assertEqual([i['name'] for i in common.ICONS],
                         ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'favicon-32.png'])


class VCard(unittest.TestCase):
    def facts(self):
        return json.loads(json.dumps(CASES['facts'][0]['facts']))

    def test_card_from_the_facts(self):
        facts = self.facts()
        text = vcard.build_vcard(facts)
        props, problems = vcard.parse_vcard(text.encode('utf-8'))
        self.assertEqual(problems, [])
        self.assertEqual(vcard.card_fields(props), common.vcard_of(facts))
        self.assertEqual(vcard.extra_problems(props, facts), [])
        self.assertTrue(text.startswith('BEGIN:VCARD\r\nVERSION:3.0\r\n'))
        self.assertTrue(text.endswith('END:VCARD\r\n'))
        self.assertIn('TEL;TYPE=WORK,VOICE:+18135550142', text)
        self.assertIn('ADR;TYPE=WORK:;;1234 W Kennedy Blvd;Tampa;FL;33606;', text)
        self.assertIn('X-SOCIALPROFILE;TYPE=instagram:https://www.instagram.com/glossboss/', text)

    def test_street_with_the_city_is_not_repeated(self):
        facts = CASES['facts'][2]['facts']
        text = vcard.build_vcard(facts)
        self.assertIn('ADR;TYPE=WORK:;;88 Harbor Rd\\, Clearwater\\, FL 33755;;;;', text)
        props, problems = vcard.parse_vcard(text.encode('utf-8'))
        self.assertEqual(problems, [])
        self.assertEqual(vcard.card_fields(props)['adr'], facts['address']['line'])
        self.assertNotIn('TEL', [p['name'] for p in props])

    def test_folding_and_escaping(self):
        facts = self.facts()
        facts['business']['name'] = 'Caf\u00e9 \u00c9lite; Detailing, Tint & Wheels \\ Ceramic \u00dcbersch\u00e4l ' * 3
        facts['business']['name'] = facts['business']['name'].strip()
        text = vcard.build_vcard(facts, b'\x89PNG\r\n\x1a\n' + b'0' * 300)
        for line in text.split('\r\n'):
            self.assertLessEqual(len(line.encode('utf-8')), 75)
        props, problems = vcard.parse_vcard(text.encode('utf-8'))
        self.assertEqual(problems, [])
        self.assertEqual(vcard.card_fields(props)['fn'], facts['business']['name'])

    def test_problems(self):
        good = vcard.build_vcard(self.facts())
        _, problems = vcard.parse_vcard(good.replace('\r\n', '\n').encode('utf-8'))
        self.assertTrue(any('CRLF' in p for p in problems))
        tampered = good.replace('END:VCARD', 'NOTE:Voted best in Tampa\r\nTEL:+19995550100\r\nEND:VCARD')
        props, problems = vcard.parse_vcard(tampered.encode('utf-8'))
        self.assertEqual(problems, [])
        extra = vcard.extra_problems(props, self.facts())
        self.assertTrue(any('NOTE' in p for p in extra))
        self.assertTrue(any('2 TEL' in p for p in extra))
        social = good.replace('END:VCARD', 'X-SOCIALPROFILE;TYPE=x:https://evil.example\r\nEND:VCARD')
        props, _ = vcard.parse_vcard(social.encode('utf-8'))
        self.assertTrue(any('social profile' in p for p in vcard.extra_problems(props, self.facts())))
        _, problems = vcard.parse_vcard(b'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:x\r\nEND:VCARD\r\n')
        self.assertTrue(any('VERSION:3.0' in p for p in problems))
        self.assertTrue(any('N line' in p for p in problems))

        # Text hidden in a fixed value or a parameter is caught too.
        hidden = (good.replace('N:;;;;', 'N:Voted #1;;;;')
                  .replace('TEL;TYPE=WORK,VOICE:', 'TEL;TYPE=WORK,VOICE;X-NOTE=Best in Tampa:')
                  .replace('X-ABShowAs:COMPANY', 'X-ABShowAs:Top rated'))
        props, problems = vcard.parse_vcard(hidden.encode('utf-8'))
        self.assertEqual(problems, [])
        extra = '\n'.join(vcard.extra_problems(props, self.facts()))
        self.assertIn('N line must be ";;;;"', extra)
        self.assertIn('X-ABSHOWAS line must be "COMPANY"', extra)
        self.assertIn('TEL line has parameters build_plan.py does not write: TYPE=WORK,VOICE;X-NOTE=Best in Tampa', extra)
        # A site profile under another network's type is not the site's.
        swapped = good.replace('X-SOCIALPROFILE;TYPE=instagram:', 'X-SOCIALPROFILE;TYPE=facebook:')
        props, _ = vcard.parse_vcard(swapped.encode('utf-8'))
        self.assertTrue(any('social profile' in p for p in vcard.extra_problems(props, self.facts())))

    def test_only_a_number_that_dials(self):
        facts = self.facts()
        facts['phone'] = {'display': 'Call or text 813-555-0142 or 727-555-0199', 'dial': '', 'e164': ''}
        text = vcard.build_vcard(facts)
        props, problems = vcard.parse_vcard(text.encode('utf-8'))
        self.assertEqual(problems, [])
        self.assertNotIn('TEL', [p['name'] for p in props])
        self.assertEqual(vcard.card_fields(props), common.vcard_of(facts))
        self.assertEqual(common.vcard_of(facts)['tel'], '')
        local = CASES['facts'][1]['facts']
        self.assertEqual(common.vcard_of(local)['tel'], local['phone']['display'])


def antialiased(path, size, draw_fn, mode='RGBA', bg=(0, 0, 0, 0), scale=4, **save):
    big = Image.new(mode, (size[0] * scale, size[1] * scale), bg)
    draw_fn(ImageDraw.Draw(big), scale)
    big.resize(size, Image.LANCZOS).save(path, **save)


SHOP_CHOICES = {
    'phoneHeadline': 'Mobile detailing in your Tampa driveway',
    'shortName': 'Gloss Boss',
    'smsBody': "Hi Gloss Boss, I'd like a quote. Here's a photo of my vehicle:",
    'actions': ['call', 'text', 'book', 'directions', 'save'],
    'phoneSectionOrder': ['hero', 'services', 'featured', 'testimonials', 'gallery', 'about', 'brands', 'locations', 'cta'],
    'notes': ['Services moved up: phone visitors look for packages first.'],
}


@unittest.skipUnless(HAVE_LIBS, 'Pillow and numpy are needed')
class Scripts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix='mobile-skill-test-')
        t = cls.inputs = os.path.join(cls.tmp, 'inputs')
        os.makedirs(t)

        # A cut-out logo: a red emblem beside a wordmark (5 white blocks).
        def wide(d, s):
            d.ellipse([20 * s, 20 * s, 180 * s, 180 * s], fill=(200, 16, 46, 255))
            for i in range(5):
                d.rectangle([(210 + i * 70) * s, 70 * s, (260 + i * 70) * s, 130 * s], fill=(240, 240, 240, 255))
        antialiased(os.path.join(t, 'logo-1.png'), (600, 200), wide)

        # Dark ink on a white JPEG: invisible on the dark brand background.
        def navy(d, s):
            for i in range(4):
                d.rectangle([(60 + i * 90) * s, 80 * s, (130 + i * 90) * s, 160 * s], fill=(30, 58, 138))
            d.pieslice([40 * s, 20 * s, 460 * s, 260 * s], 200, 340, fill=(30, 30, 40))
        antialiased(os.path.join(t, 'logo-2.jpg'), (500, 250), navy, mode='RGB', bg=(255, 255, 255), quality=90)

        # Artwork that runs to its edges (a filled badge photo).
        def badge(d, s):
            for y in range(0, 300 * s, 6 * s):
                d.rectangle([0, y, 300 * s, y + 6 * s], fill=(min(255, 40 + y // (2 * s)), 90, 160))
            d.ellipse([60 * s, 60 * s, 240 * s, 240 * s], fill=(250, 250, 250))
        antialiased(os.path.join(t, 'logo-3.png'), (300, 300), badge, mode='RGB', bg=(0, 0, 0))

        cls.facts = json.loads(json.dumps(CASES['facts'][0]['facts']))
        cls.facts_path = os.path.join(t, 'mobile-inputs.json')
        with open(cls.facts_path, 'w', encoding='utf-8') as f:
            json.dump(cls.facts, f)
        cls.tint_path = os.path.join(t, 'tint-inputs.json')
        with open(cls.tint_path, 'w', encoding='utf-8') as f:
            json.dump(CASES['facts'][2]['facts'], f)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def out(self, name):
        d = os.path.join(self.tmp, name)
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d)
        return d

    def icons(self, out, *args, inputs=None):
        code, stdout, stderr = run('make_icons.py', '--inputs', inputs or self.facts_path, '--out-dir', out, *args)
        self.assertEqual(code, 0, stdout + stderr)
        with open(os.path.join(out, 'icons.json'), encoding='utf-8') as f:
            return json.load(f)

    def write_choices(self, out, choices):
        path = os.path.join(out, 'choices.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(choices, f)
        return path

    def build(self, out, choices, inputs=None):
        return run('build_plan.py', '--inputs', inputs or self.facts_path, '--choices', self.write_choices(out, choices),
                   '--icons', os.path.join(out, 'icons.json'), '--out-dir', out)

    def test_find_inputs(self):
        code, stdout, _ = run('find_inputs.py', '--root', self.inputs, '--names', 'mobile-inputs.json,logo-1.png')
        self.assertEqual(code, 0, stdout)
        found = json.loads(stdout)['files']
        self.assertEqual([f['name'] for f in found], ['mobile-inputs.json', 'logo-1.png'])
        self.assertEqual(found[1]['size'], [600, 200])
        self.assertTrue(found[1]['alpha'])
        code, stdout, _ = run('find_inputs.py', '--root', self.inputs, '--names', 'logo-9.png')
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(stdout)['missing'], ['logo-9.png'])

    def test_parts_of_a_wide_logo(self):
        code, stdout, _ = run('make_icons.py', '--logo', os.path.join(self.inputs, 'logo-1.png'), '--parts')
        self.assertEqual(code, 0)
        parts = json.loads(stdout)['parts']
        self.assertGreaterEqual(len(parts), 2)
        self.assertAlmostEqual(parts[0]['aspect'], 1.0, delta=0.15)  # the emblem first

    def test_icons_from_a_cut_out_logo(self):
        out = self.out('cutout')
        report = self.icons(out, '--logo', os.path.join(self.inputs, 'logo-1.png'))
        self.assertEqual(report['bg'], '#0a0909')
        self.assertEqual(report['logoBackground'], 'transparent')
        self.assertTrue(report['checks']['icons']['pass'])
        self.assertTrue(any('wider than tall' in w for w in report['warnings']))
        for spec in common.ICONS:
            path = os.path.join(out, spec['name'])
            self.assertEqual(image_info(path)[0], (spec['size'], spec['size']))
            problems, info = validate_mobile.measure_icon(path, spec['size'], spec['purpose'])
            self.assertEqual(problems, [], spec['name'])
        for name in ('icon-192.png', 'icon-512.png'):
            self.assertLessEqual(report['files'][name]['markRadius'], common.RULES['maskableSafeRadius'])
        self.assertEqual(image_info(os.path.join(out, 'apple-touch-icon.png'))[1], 'RGB')

        # The emblem alone fills the icons better and reads at 32 px.
        crop = json.loads(run('make_icons.py', '--logo', os.path.join(self.inputs, 'logo-1.png'), '--parts')[1])['parts'][0]['crop']
        report = self.icons(self.out('emblem'), '--logo', os.path.join(self.inputs, 'logo-1.png'), '--crop', crop)
        self.assertAlmostEqual(report['markAspect'], 1.0, delta=0.15)
        self.assertTrue(report['checks']['favicon']['pass'])
        self.assertGreaterEqual(min(report['faviconMarkPx']), 20)

    def test_icons_from_a_logo_on_white(self):
        out = self.out('onwhite')
        report = self.icons(out, '--logo', os.path.join(self.inputs, 'logo-2.jpg'))
        self.assertEqual(report['logoBackground'], 'solid')
        # Dark ink can't sit on the near-black brand background: its own white stays.
        self.assertEqual(report['bg'], '#ffffff')
        self.assertTrue(report['checks']['logo-contrast']['pass'])
        problems, info = validate_mobile.measure_icon(os.path.join(out, 'icon-512.png'), 512, 'maskable')
        self.assertEqual(problems, [])
        self.assertEqual(info['bg'], '#ffffff')

        # Forced onto the brand background, it says it doesn't stand out.
        report = self.icons(self.out('onwhite-forced'), '--logo', os.path.join(self.inputs, 'logo-2.jpg'), '--plate', 'none')
        self.assertEqual(report['bg'], '#0a0909')
        self.assertFalse(report['checks']['logo-contrast']['pass'])
        self.assertTrue(any('reads at' in w for w in report['warnings']))

    def test_icons_from_edge_to_edge_artwork(self):
        out = self.out('edge')
        report = self.icons(out, '--logo', os.path.join(self.inputs, 'logo-3.png'))
        self.assertEqual(report['logoBackground'], 'edge')
        problems, _ = validate_mobile.measure_icon(os.path.join(out, 'icon-192.png'), 192, 'maskable')
        self.assertEqual(problems, [])

    def test_monogram(self):
        out = self.out('mono')
        report = self.icons(out, '--monogram', 'GB')
        self.assertEqual(report['source'], 'monogram')
        self.assertEqual(report['ink'], '#ee3533')
        self.assertTrue(all(c['pass'] for c in report['checks'].values()))
        code, stdout, _ = run('make_icons.py', '--monogram', 'G B!', '--inputs', self.facts_path, '--out-dir', out)
        self.assertEqual(code, 2)
        code, stdout, _ = run('make_icons.py', '--monogram', 'GB', '--ink', 'red', '--inputs', self.facts_path, '--out-dir', out)
        self.assertEqual(code, 2)
        self.assertIn('--ink', stdout)

        # The letters are text: an --ink under 4.5:1 fails the contrast check
        # even though most of its pixels clear the logo's 2:1.
        report = self.icons(self.out('mono-dim'), '--monogram', 'GB', '--ink', '#6b6b6b')
        self.assertFalse(report['checks']['logo-contrast']['pass'])
        self.assertTrue(any('under 4.5:1' in w for w in report['warnings']))

        # A mid-tone background with no brand color that reads: black or
        # white, whichever reaches 4.5:1.
        mid = dict(self.facts, palette={'bg': '#777777', 'secondary': '#7a7a7a', 'text': '#808080', 'muted': '#787878', 'accent': '#7b7b7b'})
        mid_path = os.path.join(self.tmp, 'mid-inputs.json')
        with open(mid_path, 'w', encoding='utf-8') as f:
            json.dump(mid, f)
        report = self.icons(self.out('mono-mid'), '--monogram', 'GB', inputs=mid_path)
        self.assertGreaterEqual(common.contrast(report['ink'], report['bg']), 4.5)
        self.assertTrue(report['checks']['logo-contrast']['pass'])

    def test_end_to_end(self):
        out = self.out('e2e')
        self.icons(out, '--logo', os.path.join(self.inputs, 'logo-1.png'))
        code, stdout, stderr = self.build(out, SHOP_CHOICES)
        self.assertEqual(code, 0, stdout + stderr)
        code, stdout, stderr = run('validate_mobile.py', os.path.join(out, 'mobile.json'), '--inputs', self.facts_path)
        self.assertEqual(code, 0, stdout + stderr)
        with open(os.path.join(out, 'mobile.json'), encoding='utf-8') as f:
            plan = json.load(f)
        want = CASES['valid'][0]['json']
        for key in ('themeColor', 'shortName', 'phoneHeadline', 'phoneSectionOrder', 'actions', 'smsQuote', 'vcard'):
            self.assertEqual(plan[key], want[key], key)
        mine = {c['id']: c for c in plan['scorecard']}
        for c in want['scorecard']:
            if common.CHECK_FROM[c['id']] != 'skill':
                self.assertEqual(mine[c['id']], c, c['id'])
        self.assertEqual(plan['icons'], {'bg': '#0a0909', 'source': 'logo', 'logo': 'logo-1.png', 'monogram': ''})

        data = read_bytes(os.path.join(out, 'contact.vcf'))
        props, problems = vcard.parse_vcard(data)
        self.assertEqual(problems, [])
        photo = [p for p in props if p['name'] == 'PHOTO']
        self.assertEqual(len(photo), 1)
        self.assertEqual(image_info(base64.b64decode(photo[0]['raw']))[0], (180, 180))

        # Icons made again after build_plan.py: the card's picture is stale.
        crop = json.loads(run('make_icons.py', '--logo', os.path.join(self.inputs, 'logo-1.png'), '--parts')[1])['parts'][0]['crop']
        self.icons(out, '--logo', os.path.join(self.inputs, 'logo-1.png'), '--crop', crop)
        code, stdout, _ = run('validate_mobile.py', os.path.join(out, 'mobile.json'), '--inputs', self.facts_path)
        self.assertEqual(code, 1)
        self.assertIn('PHOTO is not apple-touch-icon.png', stdout)
        self.assertEqual(self.build(out, SHOP_CHOICES)[0], 0)
        data = read_bytes(os.path.join(out, 'contact.vcf'))

        # A hand-edited card fails the final check.
        bad = data.replace(b'END:VCARD', b'NOTE:Top rated\r\nEND:VCARD')
        with open(os.path.join(out, 'contact.vcf'), 'wb') as f:
            f.write(bad)
        code, stdout, _ = run('validate_mobile.py', os.path.join(out, 'mobile.json'), '--inputs', self.facts_path)
        self.assertEqual(code, 1)
        self.assertIn('NOTE', stdout)

    def test_choices_that_break_the_rules(self):
        out = self.out('bad')
        self.icons(out, '--logo', os.path.join(self.inputs, 'logo-1.png'))
        cases = [
            ({'phoneHeadline': 'The best mobile detailing in Tampa'}, '"best" is a claim'),
            ({'phoneHeadline': 'Spotless detailing in your Tampa home'}, '"spotless" is not in the site'),
            ({'phoneHeadline': 'Luxury detailing in your Tampa driveway'}, '"luxury" is a claim'),
            ({'labels': {'call': 'Call 24/7'}}, '"24" is a number the site does not state'),
            ({'smsBody': 'Hi, is the $99 deal still on?'}, '"99" is a number the site does not state'),
            ({'phoneHeadline': 'Mobile detailing in your Tampa driveway, every day'}, 'max 40'),
            ({'shortName': 'Shine Boss'}, 'not part of the business name'),
            ({'phoneSectionOrder': ['services', 'hero']}, 'phoneSectionOrder'),
            ({'smsBody': 'Hi! Want a FREE quote?'}, '"free" is a claim'),
            ({'labels': {'call': 'Call the experts'}}, '"experts" is a claim'),
            ({'themeColor': '#123456'}, 'not one of the brand colors'),
        ]
        for change, message in cases:
            choices = dict(SHOP_CHOICES, **change)
            code, stdout, _ = self.build(out, choices)
            self.assertEqual(code, 1, change)
            self.assertIn(message, stdout, change)

    def test_no_phone_number(self):
        out = self.out('nophone')
        self.icons(out, '--monogram', 'DT', inputs=self.tint_path)
        choices = {
            'phoneHeadline': 'Ceramic tint in Clearwater',
            'shortName': 'Darkline',
            'phoneSectionOrder': CASES['facts'][2]['visible'],
            'actions': ['call', 'text', 'directions', 'save'],
        }
        code, stdout, stderr = self.build(out, choices, inputs=self.tint_path)
        self.assertEqual(code, 0, stdout + stderr)
        self.assertIn('left out the "call" action', stdout)
        with open(os.path.join(out, 'mobile.json'), encoding='utf-8') as f:
            plan = json.load(f)
        self.assertIsNone(plan['smsQuote'])
        self.assertEqual([a['kind'] for a in plan['actions']], ['directions', 'save'])
        self.assertEqual(plan['icons']['source'], 'monogram')
        code, stdout, _ = run('validate_mobile.py', os.path.join(out, 'mobile.json'), '--inputs', self.tint_path)
        self.assertEqual(code, 0, stdout)

    def test_broken_icons_fail(self):
        out = self.out('broken')
        self.icons(out, '--logo', os.path.join(self.inputs, 'logo-1.png'))
        self.assertEqual(self.build(out, SHOP_CHOICES)[0], 0)
        # Transparent corners, and a mark that reaches the edge.
        Image.new('RGBA', (180, 180), (0, 0, 0, 0)).save(os.path.join(out, 'apple-touch-icon.png'))
        im = Image.new('RGB', (512, 512), (10, 9, 9))
        ImageDraw.Draw(im).rectangle([0, 200, 511, 300], fill=(238, 53, 51))
        im.save(os.path.join(out, 'icon-512.png'))
        Image.new('RGB', (100, 100), (10, 9, 9)).save(os.path.join(out, 'icon-192.png'))
        code, stdout, _ = run('validate_mobile.py', os.path.join(out, 'mobile.json'), '--inputs', self.facts_path)
        self.assertEqual(code, 1)
        self.assertIn('transparent', stdout)
        self.assertIn('outside the safe circle', stdout)
        self.assertIn('icon-192.png is 100x100', stdout)


if __name__ == '__main__':
    unittest.main(verbosity=2)
