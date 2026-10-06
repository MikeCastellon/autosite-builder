"""End-to-end checks of the skill's scripts on generated sample inputs.

The brief is tests/sample_input.json, the exact social-input.json the
server sends for its smoke sample (tests/functions/kit-social.test.js
keeps it current); tests/make_sample.py draws the photos and the logo it
names. Needs Pillow and numpy (as in the code-execution container);
skipped without them. Everything is written to a temporary folder.

Run: python3 skills/api/launch-social-kit/tests/test_social.py
"""
import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(HERE, '..', 'scripts')
sys.dont_write_bytecode = True
sys.path.insert(0, SCRIPTS)
sys.path.insert(0, HERE)

try:
    from PIL import Image
    import numpy as np
    HAVE_LIBS = True
except ImportError:
    HAVE_LIBS = False

ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
SIZES = {
    'share-1200x630.png': (1200, 630), 'facebook-cover.png': (1640, 624), 'profile-800.png': (800, 800),
    'post-1.png': (1080, 1080), 'post-2.png': (1080, 1080), 'post-3.png': (1080, 1080), 'story-1080x1920.png': (1080, 1920),
}
QUOTE = 'Sam made my truck look brand new. Showed up right on time!'


def run(script, *args):
    p = subprocess.run([sys.executable, os.path.join(SCRIPTS, script)] + list(args), capture_output=True, text=True, env=ENV)
    return p.returncode, p.stdout + p.stderr


def read(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def write(path, value):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(value, f, indent=1)
    return path


def good_plan(brief, mark=None):
    host = brief['links']['host']
    caps = brief['words']['captions']
    return {
        'images': [
            {'file': 'share-1200x630.png', 'layout': 'photo-left', 'photo': 'photo-1.png',
             'text': {'eyebrow': 'Exampleton, FL', 'headline': 'Showroom shine, wherever you park',
                      'sub': 'We bring the water and the power.', 'footer': host},
             'alt': 'Sample Shine Mobile Detailing: Showroom shine, wherever you park.'},
            {'file': 'facebook-cover.png', 'layout': 'photo-right', 'photo': 'photo-3.png',
             'text': {'eyebrow': 'Exampleton and Sampleville', 'headline': 'Showroom shine, wherever you park'},
             'alt': 'A car at night next to the words: Showroom shine, wherever you park.'},
            dict({'file': 'profile-800.png', 'layout': 'logo', 'alt': 'Sample Shine Mobile Detailing logo'}, **({'logoCrop': mark} if mark else {})),
            {'file': 'post-1.png', 'layout': 'photo-overlay', 'photo': 'photo-1.png',
             'text': {'eyebrow': 'New website', 'headline': 'Our new website is live', 'cta': 'Book online', 'footer': host},
             'alt': 'A red car with the words: Our new website is live. Book online.'},
            {'file': 'post-2.png', 'layout': 'services', 'photo': 'photo-2.png',
             'text': {'eyebrow': 'Our services', 'items': ['Full Detail $199', 'Ceramic Coating $899', 'Interior Refresh $119']},
             'alt': 'Our services: Full Detail $199, Ceramic Coating $899, Interior Refresh $119.'},
            {'file': 'post-3.png', 'layout': 'quote',
             'text': {'eyebrow': 'What our customers say', 'quote': QUOTE, 'cite': 'Riley Q.'},
             'alt': 'A review: "%s" Riley Q.' % QUOTE},
            {'file': 'story-1080x1920.png', 'layout': 'photo-full', 'photo': 'photo-3.png',
             'text': {'eyebrow': 'Exampleton and Sampleville', 'headline': 'Showroom shine, wherever you park',
                      'cta': 'Book online', 'footer': host},
             'alt': 'A car at night with the words: Showroom shine, wherever you park. Book online.'},
        ],
        'captions': [
            {'file': 'post-1.png', 'text': caps[0]},
            {'file': 'post-2.png', 'text': caps[1]},
            {'file': 'post-3.png', 'text': '"Sam made my truck look brand new." Thank you, Riley!'},
        ],
        'notes': ['The Words kit\'s third caption claimed "500+ happy customers", which nothing backs: post-3 quotes a review instead.'],
    }


@unittest.skipUnless(HAVE_LIBS, 'Pillow and numpy are needed')
class Social(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import make_sample
        cls.make_sample = make_sample
        cls.tmp = tempfile.mkdtemp(prefix='social-skill-test-')
        cls.sample = make_sample.load_sample()
        cls.inputs = os.path.join(cls.tmp, 'in')
        make_sample.make_files(cls.inputs, cls.sample)
        cls.brief = os.path.join(cls.tmp, 'brief.json')
        cls.find_code, cls.find_out = run('find_inputs.py', '--brief', os.path.join(cls.inputs, 'social-input.json'), '--out', cls.brief)
        import logo as L
        parts = L.inspect(os.path.join(cls.inputs, 'logo-1.png'))['parts']
        cls.mark = min(parts, key=lambda p: abs(p['aspect'] - 1))['box']
        cls.plan = good_plan(cls.sample, cls.mark)
        cls.out, cls.report = os.path.join(cls.tmp, 'out'), os.path.join(cls.tmp, 'render.json')
        cls.code, cls.log = cls.compose(cls.plan, cls.out, cls.report)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    @classmethod
    def compose(cls, plan, out, report, brief=None, *extra):
        plan_path = write(os.path.join(cls.tmp, 'plan-%d.json' % abs(hash(out))), plan)
        return run('compose.py', '--brief', brief or cls.brief, '--plan', plan_path, '--out', out, '--report', report, *extra)

    def variant(self, name, plan=None, brief=None):
        out, report = os.path.join(self.tmp, name), os.path.join(self.tmp, name + '.json')
        code, log = self.compose(plan or self.plan, out, report, brief)
        return code, log, out, report

    def brief_variant(self, name, change):
        b = copy.deepcopy(read(self.brief))
        change(b)
        return write(os.path.join(self.tmp, name + '-brief.json'), b)

    # ── the happy path ──────────────────────────────────────────────

    def test_find_inputs_resolves_every_file(self):
        self.assertEqual(self.find_code, 0, self.find_out)
        brief = read(self.brief)
        for name in ['logo-1.png', 'photo-1.png', 'photo-2.png', 'photo-3.png']:
            self.assertTrue(os.path.isfile(brief['paths'][name]), name)
        self.assertIn('Words kit captions: 3', self.find_out)
        self.assertIn('stand-in', self.find_out)

    def test_full_set_renders_and_validates(self):
        self.assertEqual(self.code, 0, self.log)
        self.assertEqual(sorted(os.listdir(self.out)), sorted(list(SIZES) + ['social.json']))
        for name, size in SIZES.items():
            with Image.open(os.path.join(self.out, name)) as im:
                self.assertEqual(im.size, size, name)
                self.assertEqual(im.mode, 'RGB', name)
        code, log = run('validate_social.py', os.path.join(self.out, 'social.json'), '--brief', self.brief, '--render', self.report)
        self.assertEqual(code, 0, log)
        self.assertIn('OK (7 images, 3 captions)', log)

    def test_social_json_is_the_contract(self):
        import common
        social = read(os.path.join(self.out, 'social.json'))
        self.assertEqual(set(social), {'version', 'images', 'captions', 'fonts', 'notes'})
        self.assertEqual([im['file'] for im in social['images']], common.formats()['order'])
        for im in social['images']:
            fmt = common.format_of(im['file'])
            self.assertEqual(im['size'], '%dx%d' % tuple(fmt['size']))
            self.assertEqual(im['purpose'], fmt['purpose'])
            self.assertTrue(im['alt'])
        share = social['images'][0]
        self.assertEqual(share['photo'], 'photo-1.png')
        self.assertEqual([t['role'] for t in share['text']], ['eyebrow', 'headline', 'sub', 'footer'])
        services = [im for im in social['images'] if im['file'] == 'post-2.png'][0]
        self.assertEqual([t['text'] for t in services['text'] if t['role'] == 'items'], ['Full Detail $199', 'Ceramic Coating $899', 'Interior Refresh $119'])
        self.assertEqual([c['file'] for c in social['captions']], ['post-1.png', 'post-2.png', 'post-3.png'])
        self.assertEqual(social['fonts'], {'heading': 'Oswald', 'body': 'Inter', 'standIn': True})
        self.assertTrue(any('DejaVu' in n for n in social['notes']))
        self.assertTrue(any('Blurred' in n for n in social['notes']))

    def test_social_json_matches_the_shared_fixture(self):
        # tests/sample_social.json is what this plan makes; the server's
        # sanitizer must store it unflagged (src/lib/kit/social.test.js).
        # After an intended change: UPDATE_SKILL_FIXTURES=1 python3 tests/test_social.py
        social = read(os.path.join(self.out, 'social.json'))
        fixture = os.path.join(HERE, 'sample_social.json')
        if os.environ.get('UPDATE_SKILL_FIXTURES') == '1':
            write(fixture, social)
        self.assertEqual(social, read(fixture))

    def test_every_text_reads_and_stays_in_its_safe_area(self):
        import common
        report = read(self.report)
        self.assertEqual(len(report['images']), 7)
        for r in report['images']:
            fmt = common.format_of(r['file'])
            safe = fmt['safe']
            for e in r['elements']:
                box = e.get('box') or e['bbox']
                self.assertTrue(box[0] >= safe[0] - 3 and box[1] >= safe[1] - 3 and box[2] <= safe[2] + 3 and box[3] <= safe[3] + 3,
                                '%s %s %s outside %s' % (r['file'], e.get('role') or e['type'], box, safe))
                for a in fmt['avoid']:
                    self.assertFalse(box[0] < a[2] and a[0] < box[2] and box[1] < a[3] and a[1] < box[3], r['file'])
                if e['type'] == 'text':
                    self.assertGreaterEqual(e['contrast'], 4.5, '%s %s' % (r['file'], e['role']))
                if e['type'] == 'logo':
                    self.assertGreaterEqual(e['legibility'], 0.7, r['file'])

    def test_profile_uses_the_mark_inside_the_circle(self):
        report = read(self.report)
        prof = [r for r in report['images'] if r['file'] == 'profile-800.png'][0]
        logo = prof['elements'][0]
        self.assertLessEqual(logo['reach'], 360)
        self.assertGreater(logo['reach'], 250, 'the mark should fill most of the circle')
        self.assertGreaterEqual(logo['legibility'], 0.85)
        with Image.open(os.path.join(self.out, 'profile-800.png')) as im:
            corner = im.getpixel((5, 5))
        self.assertEqual('#%02x%02x%02x' % corner, logo['background'])

    def test_plate_areas_are_blurred(self):
        import compose
        p = read(self.brief)['photos'][0]
        self.assertTrue(p['blur'])
        b = p['blur'][0]
        raw = Image.open(read(self.brief)['paths']['photo-1.png']).convert('L')
        done, _, n = compose.load_photo(read(self.brief)['paths']['photo-1.png'], p['blur'])
        self.assertEqual(n, 1)
        W, H = raw.size
        box = (int(b['x'] * W), int(b['y'] * H), int((b['x'] + b['w']) * W), int((b['y'] + b['h']) * H))
        before = np.asarray(raw.crop(box), dtype='float64').std()
        after = np.asarray(done.convert('L').crop(box), dtype='float64').std()
        self.assertLess(after, before * 0.6)

    def test_check_mode_draws_nothing(self):
        out = os.path.join(self.tmp, 'check-only')
        code, log = self.compose(self.plan, out, os.path.join(self.tmp, 'check.json'), None, '--check')
        self.assertEqual(code, 0, log)
        self.assertIn('Plan OK', log)
        self.assertFalse(os.path.exists(out))

    # ── the gate ────────────────────────────────────────────────────

    def broken(self, name, edit):
        plan = copy.deepcopy(self.plan)
        edit(plan)
        code, log, out, _ = self.variant(name, plan)
        self.assertEqual(code, 1, log)
        self.assertFalse(os.path.exists(os.path.join(out, 'social.json')), 'nothing is written when the plan breaks a rule')
        return log

    def test_unsourced_line_is_refused(self):
        log = self.broken('unsourced', lambda p: p['images'][0]['text'].update(headline='The best detailer in Florida'))
        self.assertIn('is not in the site\'s copy', log)

    def test_planted_caption_is_refused(self):
        log = self.broken('planted', lambda p: p['captions'][2].update(text=self.sample['words']['captions'][2]))
        self.assertIn('"500"', log)
        self.assertIn('"trusted"', log)

    def test_review_outside_the_quote_role_is_refused(self):
        log = self.broken('review-headline', lambda p: p['images'][3]['text'].update(headline='Sam made my truck look brand new'))
        self.assertIn('reviews go only in the quote role', log)

    def test_partial_quote_is_refused(self):
        log = self.broken('partial-quote', lambda p: p['images'][5]['text'].update(quote='made my truck look brand new'))
        self.assertIn('whole sentences', log)

    def test_a_quote_belongs_to_its_own_reviewer(self):
        # Riley wrote the quote; Casey's name is on the next review.
        log = self.broken('other-reviewer', lambda p: p['images'][5]['text'].update(cite='Casey V.'))
        self.assertIn('is not the name pasted with the quoted review', log)
        # Two reviews joined into one quote.
        log = self.broken('joined-reviews', lambda p: p['images'][5]['text'].update(
            quote='Showed up right on time! Friendly, careful and the car looks great.'))
        self.assertIn('whole sentences of one pasted review', log)

    def test_customers_phrase_needs_a_quote(self):
        log = self.broken('customers-no-quote', lambda p: p['images'][4]['text'].update(eyebrow='What our customers say'))
        self.assertIn('"What our customers say" goes only on an image with a quote', log)

    def test_validator_catches_a_misattributed_quote(self):
        log = self.tampered('t-cite', edit_social=lambda s: [t.update(text='Casey V.') for t in s['images'][5]['text'] if t['role'] == 'cite'])
        self.assertIn('is not the name pasted with the quoted review', log)

    def test_unknown_photo_and_missing_caption_are_refused(self):
        def edit(p):
            p['images'][0]['photo'] = 'stock-car.jpg'
            p['captions'].pop()
        log = self.broken('photo-caption', edit)
        self.assertIn('must be one of the brief\'s photos', log)
        self.assertIn('post-3.png has no caption', log)

    def test_emoji_on_an_image_is_refused(self):
        log = self.broken('emoji', lambda p: p['images'][3]['text'].update(headline='Our new website is live \U0001F389'))
        self.assertIn('characters the fonts can\'t draw', log)

    def test_a_caption_that_is_not_text_is_refused(self):
        log = self.broken('caption-type', lambda p: p['captions'][0].update(text=['not', 'text']))
        self.assertIn('post-1.png caption is empty', log)

    def test_share_image_is_required(self):
        log = self.broken('no-share', lambda p: p['images'].pop(0))
        self.assertIn('share-1200x630.png is required', log)

    def test_too_long_text_says_how_much_fits(self):
        log = self.broken('too-long', lambda p: p['images'][1]['text'].update(
            headline='Mobile detailing in Exampleton and Sampleville. We bring the water and the power.'))
        self.assertIn('too long', log)
        self.assertIn('characters fit', log)

    # ── harder inputs ───────────────────────────────────────────────

    def test_bright_photo_gets_a_stronger_scrim(self):
        plan = copy.deepcopy(self.plan)
        plan['images'][3]['photo'] = 'photo-2.png'  # the white car on a white background
        code, log, out, report = self.variant('bright', plan)
        self.assertEqual(code, 0, log)
        post = [r for r in read(report)['images'] if r['file'] == 'post-1.png'][0]
        for e in post['elements']:
            if e['type'] == 'text':
                self.assertGreaterEqual(e['contrast'], 4.5, e['role'])
        # Starting from a weak scrim, the retries strengthen it until
        # every text reads.
        import common
        import compose
        import fonts as F
        start = compose.SCRIM_START
        compose.SCRIM_START = 0.15
        try:
            b = common.load_brief(self.brief)
            ctx = compose.Context(b, F.Faces(b))
            img, rep, problem = compose.render(plan['images'][3], common.format_of('post-1.png'), ctx)
        finally:
            compose.SCRIM_START = start
        self.assertIsNone(problem)
        self.assertGreater(rep['attempts'], 1)
        self.assertGreater(rep['scrim']['alpha'], 0.15)
        self.assertTrue(all(e['contrast'] >= 4.5 for e in rep['elements'] if e['type'] == 'text'))

    def test_light_palette_and_a_light_logo(self):
        def light(b):
            b['palette'] = {'bg': '#ffffff', 'secondary': '#f1f5f9', 'text': '#0f172a', 'muted': '#64748b', 'accent': '#2563eb'}
        brief = self.brief_variant('light', light)
        plan = copy.deepcopy(self.plan)
        plan['images'][0]['layout'] = 'brand'
        plan['images'][0].pop('photo')
        plan['images'][6]['layout'] = 'photo-top'
        code, log, out, report = self.variant('light', plan, brief)
        self.assertEqual(code, 0, log)
        rep = read(report)
        for r in rep['images']:
            for e in r['elements']:
                if e['type'] == 'text':
                    self.assertGreaterEqual(e['contrast'], 4.5, '%s %s' % (r['file'], e['role']))
                if e['type'] == 'logo':
                    self.assertGreaterEqual(e['legibility'], 0.7, r['file'])
        share = [r for r in rep['images'] if r['file'] == 'share-1200x630.png'][0]
        logo = [e for e in share['elements'] if e['type'] == 'logo'][0]
        self.assertTrue(logo['chip'], 'the light wordmark needs a plate on a white page')
        code, log = run('validate_social.py', os.path.join(out, 'social.json'), '--brief', brief, '--render', report)
        self.assertEqual(code, 0, log)

    def test_no_logo_and_no_photos(self):
        def bare(b):
            b['logo'] = None
            b['photos'] = []
        brief = self.brief_variant('bare', bare)
        code, log, _, _ = self.variant('bare-profile', None, brief)
        self.assertEqual(code, 1)
        self.assertIn('profile-800.png needs the logo', log)
        plan = copy.deepcopy(self.plan)
        plan['images'] = [im for im in plan['images'] if im['file'] != 'profile-800.png']
        for im in plan['images']:
            im.pop('photo', None)
            im['layout'] = {'share-1200x630.png': 'brand', 'facebook-cover.png': 'brand', 'post-1.png': 'brand',
                            'post-2.png': 'services', 'post-3.png': 'quote', 'story-1080x1920.png': 'brand'}[im['file']]
        code, log, out, report = self.variant('bare', plan, brief)
        self.assertEqual(code, 0, log)
        code, log = run('validate_social.py', os.path.join(out, 'social.json'), '--brief', brief, '--render', report)
        self.assertEqual(code, 0, log)
        self.assertNotIn('profile-800.png', os.listdir(out))

    def test_brand_fonts_are_used_when_sent(self):
        if not self.make_sample.font_source(True):
            self.skipTest('matplotlib fonts are needed to stand in for the brand TTFs')
        d = os.path.join(self.tmp, 'fonts')
        os.makedirs(d, exist_ok=True)
        for name, bold in (('font-Oswald-700.ttf', True), ('font-Inter-400.ttf', False), ('font-Inter-700.ttf', True)):
            shutil.copyfile(self.make_sample.font_source(bold), os.path.join(d, name))

        def fonts(b):
            b['fonts'] = {'heading': {'family': 'Oswald', 'files': [{'name': 'font-Oswald-700.ttf', 'weight': 700}]},
                          'body': {'family': 'Inter', 'files': [{'name': 'font-Inter-400.ttf', 'weight': 400}, {'name': 'font-Inter-700.ttf', 'weight': 700}]}}
            for n in ('font-Oswald-700.ttf', 'font-Inter-400.ttf', 'font-Inter-700.ttf'):
                b['paths'][n] = os.path.join(d, n)
        brief = self.brief_variant('fonts', fonts)
        code, log, out, _ = self.variant('fonts', None, brief)
        self.assertEqual(code, 0, log)
        social = read(os.path.join(out, 'social.json'))
        self.assertEqual(social['fonts'], {'heading': 'Oswald', 'body': 'Inter', 'standIn': False})
        self.assertFalse(any('DejaVu' in n for n in social['notes']))

    def test_flat_jpeg_logo_is_keyed_out(self):
        import logo as L
        path = os.path.join(self.tmp, 'flat-logo.jpg')
        self.make_sample.flat_logo(path)
        rgba, info = L.load(path)
        self.assertTrue(info['keyed'])
        self.assertEqual(info['background'], '#ffffff')
        alpha = np.asarray(rgba)[..., 3]
        self.assertEqual(int(alpha[2, 2]), 0)
        self.assertEqual(int(alpha[120, 100]), 255)
        dark = np.zeros((rgba.size[1], rgba.size[0], 3), dtype='uint8') + 10
        self.assertLess(L.legibility(rgba, dark), 0.7, 'a navy wordmark does not read on near-black')

    def test_logo_inspect_finds_the_mark(self):
        code, log = run('logo.py', 'inspect', os.path.join(self.inputs, 'logo-1.png'))
        self.assertEqual(code, 0, log)
        info = json.loads(log)
        self.assertTrue(info['transparent'])
        self.assertEqual(len(info['parts']), 2)
        self.assertAlmostEqual(min(p['aspect'] for p in info['parts']), 1.0, delta=0.15)

    # ── the validator ───────────────────────────────────────────────

    def tampered(self, name, edit_social=None, edit_render=None, edit_dir=None):
        d = os.path.join(self.tmp, name)
        shutil.copytree(self.out, d)
        social = read(os.path.join(d, 'social.json'))
        render = read(self.report)
        if edit_social:
            edit_social(social)
        if edit_render:
            edit_render(render)
        if edit_dir:
            edit_dir(d)
        write(os.path.join(d, 'social.json'), social)
        rpath = write(os.path.join(self.tmp, name + '-render.json'), render)
        code, log = run('validate_social.py', os.path.join(d, 'social.json'), '--brief', self.brief, '--render', rpath)
        self.assertEqual(code, 1, log)
        return log

    def test_validator_catches_edited_text(self):
        log = self.tampered('t-text', edit_social=lambda s: s['images'][0]['text'][1].update(text='Showroom shine'))
        self.assertIn('not what compose.py drew', log)

    def test_validator_catches_a_wrong_size_and_a_stray_file(self):
        def edit(d):
            Image.open(os.path.join(d, 'post-1.png')).resize((1000, 1000)).save(os.path.join(d, 'post-1.png'))
            with open(os.path.join(d, 'notes.txt'), 'w') as f:
                f.write('x')
        log = self.tampered('t-files', edit_dir=edit)
        self.assertIn('post-1.png is 1000x1000', log)
        self.assertIn('remove: notes.txt', log)

    def test_validator_catches_low_contrast_and_unsafe_boxes(self):
        def edit(r):
            share = [x for x in r['images'] if x['file'] == 'share-1200x630.png'][0]
            share['elements'][-1]['contrast'] = 3.1
            cover = [x for x in r['images'] if x['file'] == 'facebook-cover.png'][0]
            text = [e for e in cover['elements'] if e['type'] == 'text'][0]
            text['box'] = [320, 400, 500, 450]
        log = self.tampered('t-render', edit_render=edit)
        self.assertIn('reaches 3.1:1', log)
        self.assertIn('under an area the platform covers', log)

    def test_validator_catches_contract_breaks(self):
        def edit(s):
            s['images'][1]['layout'] = None
            s['images'][0]['size'] = '1200x628'
            s['images'][0]['purpose'] = 'Anything'
            s['captions'][0]['text'] = 'Rated five stars by 500 drivers.'
            s['extra'] = True
        log = self.tampered('t-contract', edit_social=edit)
        self.assertIn('size must be "1200x630"', log)
        self.assertIn('purpose must be', log)
        self.assertIn('"500"', log)
        self.assertIn('unknown top-level keys: extra', log)
        self.assertIn('facebook-cover.png: layout must be one of', log)

    # ── helpers ─────────────────────────────────────────────────────

    def test_textrules_cli(self):
        code, log = run('textrules.py', 'sources', '--brief', self.brief, '--kind', 'facts')
        self.assertEqual(code, 0, log)
        self.assertIn('[facts.businessName] (facts) Sample Shine Mobile Detailing', log)
        self.assertIn('Book online (needs booking)', log)
        line = os.path.join(self.tmp, 'line.txt')
        with open(line, 'w') as f:
            f.write('Showroom shine')
        self.assertEqual(run('textrules.py', 'check', '--brief', self.brief, '--role', 'headline', '--file', line)[0], 0)
        with open(line, 'w') as f:
            f.write('The best shine')
        code, log = run('textrules.py', 'check', '--brief', self.brief, '--role', 'headline', '--file', line)
        self.assertEqual(code, 1, log)

    def test_fonts_cli(self):
        code, log = run('fonts.py', '--brief', self.brief)
        self.assertEqual(code, 0, log)
        self.assertIn('standIn: True', log)


if __name__ == '__main__':
    unittest.main()
