"""Checks of the launch-words scripts on generated sample inputs.

sample_inputs.json is the exact words-inputs.json a run sends for the smoke
sample (written by tests/functions/kit-words.test.js); sample_words.json is a
hand-written deck for it that the validator and the server's sanitizer must
both accept unchanged. Each test below changes one thing and checks the
validator (or plan, or the PDF) reacts.

Needs reportlab, Pillow and pypdf for the PDF tests (as in the code
execution container); those are skipped without them. Everything is
written to a temporary folder.

Run: python3 skills/api/launch-words/tests/test_words.py
"""
import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(HERE, '..', 'scripts')
sys.path.insert(0, SCRIPTS)

import words_lib  # noqa: E402
from plan import build_plan  # noqa: E402
from validate_words import validate  # noqa: E402

try:
    import reportlab  # noqa: F401
    from PIL import Image, ImageDraw
    from pypdf import PdfReader
    HAVE_PDF = True
except ImportError:
    HAVE_PDF = False

ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
LINK = 'https://search.google.com/local/writereview?placeid=ChIJsample-Words-Place01'


def load(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return json.load(f)


def run(script, *args):
    p = subprocess.run([sys.executable, os.path.join(SCRIPTS, script)] + list(args), capture_output=True, text=True, env=ENV)
    return p.returncode, p.stdout, p.stderr


class Base(unittest.TestCase):
    def setUp(self):
        self.inputs = load('sample_inputs.json')
        self.words = load('sample_words.json')

    def check(self, words=None, inputs=None):
        return validate(words if words is not None else self.words, inputs if inputs is not None else self.inputs)

    def assertError(self, report, *parts):
        hits = [e for e in report.errors if all(p in e for p in parts)]
        self.assertTrue(hits, 'no error with %r in %s' % (parts, report.errors))

    def assertWarning(self, report, *parts):
        hits = [w for w in report.warnings if all(p in w for p in parts)]
        self.assertTrue(hits, 'no warning with %r in %s' % (parts, report.warnings))


class TheSample(Base):
    def test_sample_is_valid(self):
        r = self.check()
        self.assertEqual(r.errors, [])
        self.assertEqual(r.warnings, [])

    def test_cli_ok_and_counts(self):
        code, out, _ = run('validate_words.py', os.path.join(HERE, 'sample_words.json'), '--inputs', os.path.join(HERE, 'sample_inputs.json'))
        self.assertEqual(code, 0, out)
        self.assertIn('OK: words.json is valid', out)
        self.assertIn('gbp.description 546/750', out)

    def test_cli_fails_with_exit_1_and_2(self):
        tmp = tempfile.mkdtemp(prefix='words-test-')
        try:
            bad = copy.deepcopy(self.words)
            bad['gbp']['posts'] = bad['gbp']['posts'][:11]
            path = os.path.join(tmp, 'words.json')
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(bad, f)
            code, out, _ = run('validate_words.py', path, '--inputs', os.path.join(HERE, 'sample_inputs.json'))
            self.assertEqual(code, 1)
            self.assertIn('exactly 12 posts', out)
            with open(path, 'w') as f:
                f.write('{not json')
            self.assertEqual(run('validate_words.py', path)[0], 2)
        finally:
            shutil.rmtree(tmp)

    def test_without_inputs_warns(self):
        r = validate(self.words, {})
        self.assertWarning(r, 'no --inputs given')


class Shape(Base):
    def test_extra_and_missing_keys(self):
        w = copy.deepcopy(self.words)
        w['extra'] = 1
        del w['social']['bio']
        r = self.check(w)
        self.assertError(r, 'words.json has keys the contract does not allow: extra')
        self.assertError(r, 'social is missing bio')

    def test_counts(self):
        w = copy.deepcopy(self.words)
        w['social']['captions'] = w['social']['captions'][:2]
        w['reviews']['replies'] = [x for x in w['reviews']['replies'] if x['rating'] != 3] + [{'rating': 5, 'text': 'Thanks again, [name].'}]
        r = self.check(w)
        self.assertError(r, 'exactly 3 captions')
        self.assertError(r, 'one reply for each rating')

    def test_lengths_count_like_javascript(self):
        w = copy.deepcopy(self.words)
        w['social']['bio'] = 'a' * 149 + '\U0001F697'  # 149 + an emoji (2 in JavaScript) = 151
        self.assertError(self.check(w), 'social.bio is 151 characters')
        w['social']['bio'] = 'a' * 148 + '\U0001F697'
        self.assertEqual([e for e in self.check(w).errors if 'social.bio' in e], [])

    def test_plain_text(self):
        w = copy.deepcopy(self.words)
        w['gbp']['posts'][0]['body'] += '  \nTrailing spaces.'
        w['gbp']['posts'][1]['title'] = 'Two\nlines'
        r = self.check(w)
        self.assertError(r, 'gbp.posts[0].body must be plain text')
        self.assertError(r, 'gbp.posts[1].title must be plain text')

    def test_description_limits(self):
        w = copy.deepcopy(self.words)
        w['gbp']['description'] = 'Mobile detailing in North Tampa. ' * 25
        self.assertError(self.check(w), 'gbp.description is', 'max 750')
        w['gbp']['description'] = 'Mobile detailing in North Tampa.'
        self.assertWarning(self.check(w), 'gbp.description is only')

    def test_notes(self):
        w = copy.deepcopy(self.words)
        w['notes'] = ['note'] * 9
        self.assertError(self.check(w), 'notes must be a list of at most 8')


class Gbp(Base):
    def test_services_are_the_sites(self):
        w = copy.deepcopy(self.words)
        w['gbp']['services'][0]['name'] = 'Full detail'
        w['gbp']['services'].append({'name': 'Headlight Restoration', 'description': 'Clear headlights.'})
        del w['gbp']['services'][1]
        r = self.check(w)
        self.assertError(r, 'write the site\'s exact name "Full Detail"')
        self.assertError(r, '"Headlight Restoration" is not one of the site\'s services')
        self.assertError(r, 'missing the site\'s service "Interior Refresh"')

    def test_services_without_site_services(self):
        i = copy.deepcopy(self.inputs)
        i['services'] = []
        w = copy.deepcopy(self.words)
        w['gbp']['services'][0]['name'] = 'Anything they listed'
        self.assertEqual([e for e in self.check(w, i).errors if 'services' in e], [])

    def test_categories(self):
        w = copy.deepcopy(self.words)
        w['gbp']['categories'] = [{'name': 'Car detailing service', 'confirm': False}, {'name': 'Spaceship repair', 'confirm': True},
                                  {'name': 'car detailing service', 'confirm': True}]
        r = self.check(w)
        self.assertError(r, 'confirm must be true')
        self.assertError(r, 'listed twice')
        self.assertWarning(r, '"Spaceship repair" is not in data/gbp_categories.json')
        w['gbp']['categories'] = []
        self.assertError(self.check(w), 'gbp.categories must be a list of 1 to 10')

    def test_description_rules(self):
        w = copy.deepcopy(self.words)
        w['gbp']['description'] += ' Full details from $220. See northside-shine.autocaregeniushub.com.'
        r = self.check(w)
        self.assertError(r, 'gbp.description has a price ($220)')
        self.assertError(r, 'gbp.description has a link')

    def test_price_in_a_service_description_warns(self):
        # Their own price is no invented fact, but GBP has a price field.
        w = copy.deepcopy(self.words)
        w['gbp']['services'][0]['description'] += ' $220.'
        r = self.check(w)
        self.assertEqual(r.errors, [])
        self.assertWarning(r, 'gbp.services[0].description has a price ($220)')

    def test_post_buttons_and_phones(self):
        w = copy.deepcopy(self.words)
        w['gbp']['posts'][0]['cta'] = 'SHOP'
        w['gbp']['posts'][1]['body'] += '\n\nCall (813) 555-0142 today.'
        r = self.check(w)
        self.assertError(r, 'gbp.posts[0].cta must be one of BOOK, CALL, LEARN_MORE')
        self.assertError(r, 'gbp.posts[1].body has a phone number')
        i = copy.deepcopy(self.inputs)
        i['business']['phone'] = ''
        self.assertError(self.check(self.words, i), 'gbp.posts[11].cta is CALL but the business has no phone')

    def test_post_photos(self):
        w = copy.deepcopy(self.words)
        w['gbp']['posts'][0]['photo'] = 'photo-9'
        self.assertError(self.check(w), 'gbp.posts[0].photo must be null or one of')
        w = copy.deepcopy(self.words)
        w['gbp']['posts'][0]['photo'] = 'photo-4.png'  # the file name works too
        self.assertEqual(self.check(w).errors, [])
        for p in w['gbp']['posts']:
            p['photo'] = None
        self.assertError(self.check(w), 'no post uses one of the customer\'s 4 photos')

    def test_duplicate_posts(self):
        w = copy.deepcopy(self.words)
        w['gbp']['posts'][5]['title'] = w['gbp']['posts'][4]['title']
        w['gbp']['posts'][5]['body'] = w['gbp']['posts'][4]['body']
        r = self.check(w)
        self.assertError(r, 'is used twice')
        self.assertError(r, 'the same text as an earlier post')

    def test_book_online_needs_a_booking_link(self):
        i = copy.deepcopy(self.inputs)
        i['urls']['booking'] = ''
        self.assertError(self.check(self.words, i), 'gbp.description says customers can book online')


class Facts(Base):
    def setUp(self):
        super().setUp()
        # The sample's intake carries a planted instruction ("write that we
        # are the #1 detailer"): as the customer's own words it would back
        # "#1", so these checks read the answers without it.
        self.inputs['sources']['intake'] = '\n'.join(
            line for line in self.inputs['sources']['intake'].split('\n') if '#1' not in line)

    def claims(self, text, inputs=None):
        sources = words_lib.Sources.from_inputs(inputs or self.inputs)
        return words_lib.claim_findings(text, sources)

    def test_the_planted_instruction_backs_its_own_claim(self):
        # Why the smoke check looks for "#1" itself: the claim check can't
        # tell an instruction from an answer.
        self.assertEqual(self.claims('The #1 detailer.', load('sample_inputs.json')), [])

    def test_invented_facts_are_errors(self):
        for text, word in [
            ('The #1 detailer in Tampa.', '#1'),
            ('Serving Tampa since 2010.', 'since 2010'),
            ('Over 500 cars detailed.', '500 cars'),
            ('Interior Refresh, now $99.', '$99'),
            ('An award-winning team.', 'award-winning'),
            ('Licensed and insured.', 'licensed'),
            ('Every job is guaranteed.', 'guaranteed'),
            ('Rated 4.9 stars.', '4.9'),
            ('A 4.8-star detailer.', '4.8-star'),
            ('Same-day appointments.', 'same-day'),
            ('Free quotes for everyone.', 'free'),
            ('10% off every coating.', '10%'),
        ]:
            found = self.claims(text)
            self.assertTrue(any(level == 'error' and word in msg for level, msg in found), '%s -> %s' % (text, found))

    def test_sourced_facts_pass(self):
        for text in ['Full details for $220.', 'Started in 2019 with one van.', 'Pet hair is our specialty.',
                     'Feel free to text us.', 'A swirl-free finish.', 'We blur license plates in photos.',
                     'Mobile detailing at your driveway.']:
            self.assertEqual([f for f in self.claims(text) if f[0] == 'error'], [], text)

    def test_soft_words_warn(self):
        found = self.claims('The best detail in town, by experts.')
        self.assertTrue(any(level == 'warning' and '"best"' in msg for level, msg in found))
        self.assertTrue(any(level == 'warning' and '"experts"' in msg for level, msg in found))

    def test_reviews_back_only_quotes(self):
        i = copy.deepcopy(self.inputs)
        i['sources']['reviews'] += '\n"Best detailer in Tampa, five stars!" - Kim R.'
        self.assertTrue(any(l == 'error' and 'five stars' in m for l, m in self.claims('Five stars from our customers.', i)))
        self.assertEqual([f for f in self.claims('"Best detailer in Tampa, five stars!" - Kim R.', i) if f[0] == 'error'], [])

    def test_unsourced_quote(self):
        w = copy.deepcopy(self.words)
        w['gbp']['posts'][5]['body'] = '"Northside Shine is the only detailer I trust with my car." - Sam T.\n\nThank you, Sam! See what else we do on our website.'
        self.assertError(self.check(w), 'quotes "', 'not word for word')

    def test_site_only_claim_warns(self):
        i = copy.deepcopy(self.inputs)
        i['sources']['site'] += '\nwhyUs: Fully insured detailers.'
        w = copy.deepcopy(self.words)
        w['social']['captions'][2] = 'Fully insured, right in your driveway.\n\n#CeramicCoating'
        r = self.check(w, i)
        self.assertWarning(r, 'social.captions[2]', 'only the written site says this')
        self.assertEqual([e for e in r.errors if 'insured' in e], [])

    def test_foreign_links_and_phones(self):
        w = copy.deepcopy(self.words)
        w['social']['captions'][0] += '\nhttps://example.com/deal'
        w['reviews']['replies'][4]['text'] = '[name], please call (727) 555-0100 so we can make it right.'
        r = self.check(w)
        self.assertError(r, 'social.captions[0] has a link (https://example.com/deal)')
        self.assertError(r, 'reviews.replies[4].text has a phone number', 'not the business phone')


class Reviews(Base):
    def test_review_link_required(self):
        w = copy.deepcopy(self.words)
        w['reviews']['requestSms'] = 'Hi [name], thanks for choosing Northside Shine! Would you share an honest review on Google? [review link]'
        r = self.check(w)
        self.assertError(r, 'reviews.requestSms must include the review link exactly')
        self.assertError(r, 'replace [review link] with the review link')

    def test_placeholder_without_a_place(self):
        i = copy.deepcopy(self.inputs)
        i['urls']['review'] = ''
        r = self.check(self.words, i)
        self.assertError(r, 'reviews.requestSms: the request has no Google review link')
        self.assertError(r, 'reviews.requestSms has a link')  # the old link is no longer one of theirs
        w = copy.deepcopy(self.words)
        w['reviews']['requestSms'] = w['reviews']['requestSms'].replace(LINK, '[review link]')
        w['reviews']['requestEmail']['body'] = w['reviews']['requestEmail']['body'].replace(LINK, '[review link]')
        self.assertEqual(self.check(w, i).errors, [])

    def test_no_incentives_or_gating(self):
        w = copy.deepcopy(self.words)
        w['reviews']['requestSms'] = 'Hi [name]! If you were happy, leave us 5 stars and get 10% off your next detail: ' + LINK
        w['reviews']['requestEmail']['body'] += '\n\nEveryone who reviews is entered to win a gift card.'
        w['reviews']['replies'][4]['text'] = '[name], we are sorry. Your next wash is free.'
        r = self.check(w)
        self.assertError(r, 'reviews.requestSms offers or hints at something in return', '10% off')
        self.assertError(r, 'reviews.requestSms asks for a particular kind of review')
        self.assertError(r, 'reviews.requestEmail.body offers', 'gift card')
        self.assertError(r, 'reviews.replies[4] offers something')

    def test_placeholders(self):
        w = copy.deepcopy(self.words)
        w['reviews']['replies'][0]['text'] = 'Thanks [name]! See you at [location].'
        w['gbp']['posts'][0]['body'] += ' [name]'
        r = self.check(w)
        self.assertError(r, 'reviews.replies[0].text has the placeholder [location]')
        self.assertError(r, 'gbp.posts[0].body has the placeholder [name]')


class Social(Base):
    def test_hashtags_and_repeats(self):
        w = copy.deepcopy(self.words)
        w['social']['captions'][0] = 'Launch day. ' + ' '.join('#tag%d' % i for i in range(31))
        w['social']['captions'][2] = w['social']['captions'][1]
        r = self.check(w)
        self.assertError(r, 'social.captions[0] has 31 hashtags')
        self.assertError(r, 'social.captions repeats a caption')


class Seo(Base):
    def test_seo(self):
        w = copy.deepcopy(self.words)
        w['seo']['title'] = 'Mobile Detailing in North Tampa and Lutz, Florida'
        w['seo']['keywords'] = ['mobile detailing tampa', 'Mobile detailing Tampa']
        r = self.check(w)
        self.assertWarning(r, 'seo.title does not name the business')
        self.assertError(r, 'seo.keywords[1]', 'listed twice')
        self.assertWarning(r, 'seo.keywords has 2 phrases')


class Plan(Base):
    def test_plan_for_the_sample(self):
        plan = build_plan(self.inputs)
        self.assertEqual(plan['services'], ['Full Detail', 'Interior Refresh', 'Ceramic Coating', 'Maintenance Wash'])
        self.assertEqual(plan['categories'], ['Car detailing service', 'Car wash'])
        self.assertEqual(plan['ctas'], ['BOOK', 'CALL', 'LEARN_MORE'])
        self.assertEqual(len(plan['posts']), 12)
        themes = [p['theme'] for p in plan['posts']]
        self.assertEqual(themes[0], 'intro')
        self.assertIn('review', themes)
        self.assertIn('booking', themes)
        self.assertIn('Fall', next(p['season'] for p in plan['posts'] if p['theme'] == 'season'))
        refs = {p['ref'] for p in self.inputs['photos']}
        self.assertEqual({p['photo'] for p in plan['posts'] if p['photo']}, refs)
        self.assertTrue(all(p['photo'] for p in plan['posts'] if p['theme'] == 'work'))
        spot = {p['service']: p['photo'] for p in plan['posts'] if p['theme'] == 'service'}
        self.assertEqual(spot.get('Ceramic Coating'), 'photo-1')  # its note says ceramic coating
        self.assertEqual(next(p['photo'] for p in plan['posts'] if p['theme'] == 'intro'), 'photo-4')  # the van (about)
        self.assertIn(LINK, plan['links']['reviewRule'])

    def test_thin_inputs(self):
        i = copy.deepcopy(self.inputs)
        i['business']['phone'] = ''
        i['urls'] = {'site': '', 'booking': '', 'review': ''}
        i['photos'] = []
        i['sources']['reviews'] = ''
        plan = build_plan(i)
        self.assertEqual(len(plan['posts']), 12)
        self.assertNotIn('CALL', plan['ctas'])
        self.assertTrue(all(p['cta'] != 'CALL' for p in plan['posts']))
        themes = {p['theme'] for p in plan['posts']}
        self.assertFalse(themes & {'review', 'booking', 'work'})
        self.assertTrue(all(p['photo'] is None for p in plan['posts']))
        self.assertIn('[review link]', plan['links']['reviewRule'])

    def test_categories_by_service_name_only(self):
        i = copy.deepcopy(self.inputs)
        i['business']['type'] = 'tint_shop'
        i['services'] = [{'name': 'Window Tint', 'description': 'Film on the glass'}, {'name': 'Paint Protection Film'},
                         {'name': 'Chrome Delete'}]
        cats = build_plan(i)['categories']
        self.assertEqual(cats[0], 'Window tinting service')
        self.assertIn('Vehicle wrapping service', cats)
        self.assertNotIn('Auto glass shop', cats)  # "glass" is only in a description

    def test_detailing_add_ons_are_no_other_trade(self):
        i = copy.deepcopy(self.inputs)
        i['business']['type'] = 'detailing_shop'
        i['services'] = [{'name': n} for n in ('Full Detail', 'Headlight Restoration', 'Glass Coating', 'Leather & Vinyl Conditioning',
                                               'Windshield Treatment', 'Paint Restore', 'Fleet Detailing')]
        self.assertEqual(build_plan(i)['categories'], ['Car detailing service'])
        # The trades themselves still count.
        i['services'] = [{'name': n} for n in ('Full Detail', 'Windshield Replacement', 'Classic Car Restoration', 'Vinyl Wraps')]
        self.assertEqual(build_plan(i)['categories'], ['Car detailing service', 'Vehicle wrapping service', 'Auto glass shop',
                                                       'Auto restoration service'])

    def test_cli(self):
        code, out, _ = run('plan.py', os.path.join(HERE, 'sample_inputs.json'))
        self.assertEqual(code, 0)
        self.assertEqual(len(json.loads(out)['posts']), 12)


class Lib(unittest.TestCase):
    def test_lengths_and_lines(self):
        self.assertEqual(words_lib.js_length('a\U0001F697'), 3)
        self.assertEqual(words_lib.one_line(' a\u2028b \xa0 c '), 'a b c')
        self.assertEqual(words_lib.clean_block('a  \r\nb\n\n\n\nc\xa0'), 'a\nb\n\nc')
        self.assertEqual(words_lib.name_key('Wash & Wax!'), 'washandwax')

    def test_data_files_agree(self):
        limits = words_lib.load_data('limits.json')
        terms = words_lib.load_data('claim_terms.json')
        self.assertEqual(limits['gbp']['description']['max'], 750)
        self.assertEqual(limits['gbp']['posts']['count'], 12)
        self.assertEqual(limits['seo']['title']['max'], 60)
        self.assertEqual(limits['seo']['description']['max'], 160)
        self.assertIn('license plate', terms['neutral'])
        ideas = words_lib.load_data('post_ideas.json')
        cats = words_lib.load_data('gbp_categories.json')
        self.assertEqual(set(ideas['tipsByType']), set(cats['byType']))
        self.assertEqual(sorted(ideas['seasonal']), sorted(str(m) for m in range(1, 13)))


@unittest.skipUnless(HAVE_PDF, 'reportlab, Pillow and pypdf are needed')
class Pdf(Base):
    def setUp(self):
        super().setUp()
        self.tmp = tempfile.mkdtemp(prefix='words-pdf-')

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def write_inputs(self, inputs):
        path = os.path.join(self.tmp, 'words-inputs.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(inputs, f)
        return path

    def logo(self, name, color):
        big = Image.new('RGBA', (1200, 400), (0, 0, 0, 0))
        d = ImageDraw.Draw(big)
        d.ellipse([40, 40, 360, 360], fill=color)
        d.rectangle([420, 160, 1140, 240], fill=color)
        big.resize((300, 100), Image.LANCZOS).save(os.path.join(self.tmp, name))

    def text_of(self, path):
        return '\n'.join(page.extract_text() or '' for page in PdfReader(path).pages)

    def test_renders_the_deck(self):
        self.logo('logo-1.png', (14, 116, 144, 255))
        for i, p in enumerate(self.inputs['photos']):
            Image.new('RGB', (1600, 1200), (40 * i, 90, 160)).save(os.path.join(self.tmp, p['file']))
        out = os.path.join(self.tmp, 'words.pdf')
        code, stdout, err = run('render_pdf.py', os.path.join(HERE, 'sample_words.json'), '--inputs', self.write_inputs(self.inputs), '--out', out)
        self.assertEqual(code, 0, err)
        info = json.loads(stdout)
        self.assertTrue(info['logo'])
        self.assertGreaterEqual(info['pages'], 6)
        # Every photo a post uses, as a small thumbnail (the PDF stays small).
        self.assertEqual(info['photos'], 4)
        self.assertEqual(sorted(os.listdir(os.path.join(self.tmp, 'thumbs'))), ['thumb-photo-%d.jpg' % n for n in (1, 2, 3, 4)])
        self.assertLess(os.path.getsize(out), 400 * 1024)
        # No font files were sent: a stand-in that says so.
        self.assertIn('stand-in for Oswald', info['fonts']['heading'])
        self.assertEqual(info['droppedGlyphs'], 0)
        with open(out, 'rb') as f:
            self.assertEqual(f.read(5), b'%PDF-')
        text = ' '.join(self.text_of(out).split())
        for needle in ['Northside Shine Mobile Detailing', 'Launch copy deck', 'Starter posts', 'Reply templates',
                       '546 / 750 characters', 'Car detailing service (primary, confirm in GBP)', 'your photo: van.png',
                       'Button: Book', 'Button: Call now', 'PROFILE BIO 131 / 150 characters']:
            self.assertIn(needle, text)
        for post in self.words['gbp']['posts']:
            self.assertIn(' '.join(post['title'].split()), text)
        self.assertIn('placeid=ChIJsample-Words-Place01', text.replace(' ', ''))
        # A piece's label ("REVIEW REQUEST: EMAIL 392 / 1500 characters")
        # never ends a page: it moves with its text.
        for n, page in enumerate(PdfReader(out).pages, 1):
            lines = [ln.strip() for ln in (page.extract_text() or '').split('\n') if ln.strip()]
            self.assertNotRegex(lines[-1], r'^[A-Z0-9 :]+(\d+ / )?\d+ characters$', 'page %d ends with a label' % n)

    def test_big_logo_is_made_smaller(self):
        # A noisy 3000 px logo is about 9 MB as a PNG: the cover gets a
        # 1200 px copy that keeps its transparency.
        big = Image.frombytes('RGBA', (3000, 1000), os.urandom(3000 * 1000 * 4))
        big.save(os.path.join(self.tmp, 'logo-1.png'))
        out = os.path.join(self.tmp, 'words.pdf')
        code, stdout, err = run('render_pdf.py', os.path.join(HERE, 'sample_words.json'), '--inputs', self.write_inputs(self.inputs), '--out', out)
        self.assertEqual(code, 0, err)
        self.assertTrue(json.loads(stdout)['logo'])
        with Image.open(os.path.join(self.tmp, 'thumbs', 'logo.png')) as small:
            self.assertEqual(small.size, (1200, 400))
            self.assertEqual(small.mode, 'RGBA')
        self.assertLess(os.path.getsize(out), os.path.getsize(os.path.join(self.tmp, 'logo-1.png')) / 3)

    def test_brand_accent_is_readable(self):
        import render_pdf
        self.assertGreaterEqual(render_pdf.contrast(render_pdf.ink_accent('#facc15'), '#ffffff'), 4.5)
        self.assertEqual(render_pdf.ink_accent('#0e7490'), '#0e7490')
        self.assertGreaterEqual(render_pdf.contrast(render_pdf.ink_accent('not a color'), '#ffffff'), 4.5)

    def test_light_logo_gets_a_panel_and_missing_fonts_fall_back(self):
        self.logo('logo-1.png', (255, 255, 255, 255))
        import render_pdf
        deck = render_pdf.Deck.__new__(render_pdf.Deck)
        deck.inputs = self.inputs
        self.assertEqual(deck.logo_panel(os.path.join(self.tmp, 'logo-1.png')), '#0b1215')
        self.logo('logo-2.png', (20, 20, 20, 255))
        self.assertIsNone(deck.logo_panel(os.path.join(self.tmp, 'logo-2.png')))
        i = copy.deepcopy(self.inputs)
        i['brand']['fonts']['heading']['files'] = {'400': 'font-Missing-400.ttf'}
        i['business']['name'] = 'Café Ünïcode ★ Detailing'
        w = copy.deepcopy(self.words)
        w['social']['captions'][0] += ' \U0001F697'
        out = os.path.join(self.tmp, 'words.pdf')
        code, stdout, err = run('render_pdf.py', self.dump(w), '--inputs', self.write_inputs(i), '--out', out)
        self.assertEqual(code, 0, err)
        info = json.loads(stdout)
        self.assertTrue(info['logo'])
        self.assertGreaterEqual(info['droppedGlyphs'], 1)  # the emoji has no glyph in DejaVu Sans
        self.assertIn('Café Ünïcode', self.text_of(out))

    def dump(self, words):
        path = os.path.join(self.tmp, 'w.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(words, f, ensure_ascii=False)
        return path


class FindInputs(unittest.TestCase):
    def test_names(self):
        tmp = tempfile.mkdtemp(prefix='words-find-')
        try:
            for n in ('words-inputs.json', 'photo-1.png', 'font-Oswald-700.ttf'):
                with open(os.path.join(tmp, n), 'wb') as f:
                    f.write(b'{}' if n.endswith('.json') else b'\0' * 16)
            code, out, _ = run('find_inputs.py', '--root', tmp, '--names', 'words-inputs.json,font-Oswald-700.ttf')
            self.assertEqual(code, 0, out)
            found = json.loads(out)['files']
            self.assertEqual([f['name'] for f in found], ['words-inputs.json', 'font-Oswald-700.ttf'])
            self.assertEqual([f['kind'] for f in found], ['inputs', 'font'])
            code, out, _ = run('find_inputs.py', '--root', tmp, '--names', 'words-inputs.json,logo-1.png')
            self.assertEqual(code, 1)
            self.assertEqual(json.loads(out)['missing'], ['logo-1.png'])
        finally:
            shutil.rmtree(tmp)


if __name__ == '__main__':
    unittest.main(verbosity=1)
