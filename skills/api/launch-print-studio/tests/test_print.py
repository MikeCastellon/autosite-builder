"""End-to-end checks of the print scripts on the smoke sample's inputs.

tests/sample_inputs.json is the exact print-inputs.json a run sends for the
smoke sample (tests/functions/kit-print.test.js writes and checks it), with
tests/sample_logo.png as its logo; the brand font files are stood in by
DejaVu copies under the names the inputs list. Every printed code is read
back out of the PDFs and decoded (scripts/qr_decode.py) and compared with
the links byte for byte.

Needs reportlab, pypdf, Pillow and numpy (as in the code-execution
container); skipped without them. Everything is written to a temporary
folder. UPDATE_SKILL_FIXTURES=1 also writes tests/sample_print.json (the
sample's print.json, which the server's sanitizer must store unchanged).

Run: python3 skills/api/launch-print-studio/tests/test_print.py
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
SCRIPTS = os.path.normpath(os.path.join(HERE, '..', 'scripts'))
sys.path.insert(0, SCRIPTS)

try:
    import numpy  # noqa: F401
    import pypdf  # noqa: F401
    import reportlab  # noqa: F401
    from PIL import Image, ImageDraw
    HAVE_LIBS = True
except ImportError:
    HAVE_LIBS = False

ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
I = 72.0


def run(script, *args):
    p = subprocess.run([sys.executable, os.path.join(SCRIPTS, script)] + [str(a) for a in args], capture_output=True, text=True, env=ENV)
    return p.returncode, p.stdout, p.stderr


def sample_inputs():
    with open(os.path.join(HERE, 'sample_inputs.json'), encoding='utf-8') as f:
        return json.load(f)


@unittest.skipUnless(HAVE_LIBS, 'reportlab, pypdf, Pillow and numpy are needed')
class PrintStudio(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import printkit as K
        cls.K = K
        cls.tmp = tempfile.mkdtemp(prefix='print-skill-test-')
        cls.dejavu = K.dejavu_paths()
        serif = os.path.join(os.path.dirname(cls.dejavu['regular']), 'DejaVuSerif-Bold.ttf')
        cls.stand_in = {('Oswald', 700): serif if os.path.isfile(serif) else cls.dejavu['bold'],
                        ('Oswald', 400): serif if os.path.isfile(serif) else cls.dejavu['regular'],
                        ('Inter', 400): cls.dejavu['regular'], ('Inter', 700): cls.dejavu['bold']}
        cls.full = cls.build('full', sample_inputs())
        if os.environ.get('UPDATE_SKILL_FIXTURES') == '1':
            shutil.copy(os.path.join(cls.full['out'], 'print.json'), os.path.join(HERE, 'sample_print.json'))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    @classmethod
    def build(cls, name, inputs, copy_json=None, logo=True):
        """Writes the inputs (and the files they name) to their own folder
        and runs build_print.py: { code, stdout, out, inputs, data }."""
        d = os.path.join(cls.tmp, name)
        src = os.path.join(d, 'in')
        out = os.path.join(d, 'out')
        os.makedirs(src)
        for f in inputs.get('fontFiles') or []:
            shutil.copy(cls.stand_in.get((f['family'], f['weight']), cls.dejavu['regular']), os.path.join(src, f['file']))
        if logo and inputs.get('logo'):
            shutil.copy(os.path.join(HERE, 'sample_logo.png'), os.path.join(src, inputs['logo']['file']))
        path = os.path.join(src, 'print-inputs.json')
        with open(path, 'w', encoding='utf-8') as fh:
            json.dump(inputs, fh)
        args = ['--inputs', path, '--out', out]
        if copy_json is not None:
            cp = os.path.join(d, 'copy.json')
            with open(cp, 'w', encoding='utf-8') as fh:
                json.dump(copy_json, fh)
            args += ['--copy', cp]
        code, stdout, stderr = run('build_print.py', *args)
        data = None
        if os.path.isfile(os.path.join(out, 'print.json')):
            with open(os.path.join(out, 'print.json'), encoding='utf-8') as fh:
                data = json.load(fh)
        return {'code': code, 'stdout': stdout + stderr, 'out': out, 'inputs': path, 'data': data}

    def validate(self, b, print_json=None):
        return run('validate_print.py', print_json or os.path.join(b['out'], 'print.json'), '--inputs', b['inputs'], '--pdf-dir', b['out'])

    def codes(self, b, file):
        import qr_decode
        return qr_decode.pdf_codes(os.path.join(b['out'], file))

    # ─── The full sample ──────────────────────────────────────────────

    def test_full_sample_builds_and_validates(self):
        self.assertEqual(self.full['code'], 0, self.full['stdout'])
        code, out, err = self.validate(self.full)
        self.assertEqual(code, 0, out + err)
        self.assertIn('OK', out)
        data = self.full['data']
        self.assertEqual([p['file'] for p in data['pieces']], ['review-hang-tag.pdf', 'counter-card.pdf', 'glovebox-card.pdf', 'business-cards.pdf'])
        self.assertEqual(data['omitted'], [])
        self.assertEqual(sorted(os.listdir(self.full['out'])), ['business-cards.pdf', 'counter-card.pdf', 'glovebox-card.pdf', 'print.json', 'review-hang-tag.pdf'])
        for p in data['pieces']:
            self.assertEqual(p['bleed'], '0.125in')
        self.assertEqual(data['fonts'], {'heading': 'Oswald', 'body': 'Inter', 'fallback': False})
        self.assertEqual(data['colors']['panel'], '#0a0909')

    def test_every_code_decodes_to_exactly_its_link(self):
        links = sample_inputs()['links']
        want = {
            'review-hang-tag.pdf': [(0, 'review', links['review']), (1, 'booking', links['booking'])],
            'counter-card.pdf': [(0, 'review', links['review'])],
            'glovebox-card.pdf': [(0, 'contact', links['vcard']), (1, 'booking', links['booking'])],
            'business-cards.pdf': [(1, 'site', links['site'])],
        }
        listed = {p['file']: p['qr'] for p in self.full['data']['pieces']}
        for file, expected in want.items():
            found = self.codes(self.full, file)
            self.assertEqual([(c['page'], c['kind'], c['text']) for c in found], expected, file)
            for c, q in zip(found, listed[file]):
                size_in = c['size'] / I
                self.assertGreaterEqual(size_in, 0.75, file)
                self.assertAlmostEqual(size_in, q['sizeIn'], places=2)
                self.assertGreaterEqual(size_in / c['modules'] * 25.4, 0.25, '%s modules too small' % file)
                self.assertEqual(c['level'], 'M')
                self.assertEqual(q['url'] if q['kind'] != 'contact' else q['vcard'], c['text'])
        # The contact code is a real vCard with CRLF lines.
        vcard = self.codes(self.full, 'glovebox-card.pdf')[0]['text']
        self.assertTrue(vcard.startswith('BEGIN:VCARD\r\nVERSION:3.0\r\n'))
        self.assertIn('TEL;TYPE=WORK,VOICE:+15550100199', vcard)

    def test_page_boxes_bleed_and_crop_marks(self):
        from pypdf import PdfReader
        import validate_print as V
        for p in self.K.PIECES:
            reader = PdfReader(os.path.join(self.full['out'], p['file']))
            self.assertEqual(len(reader.pages), len(p['pages']))
            w, h = p['w'] * I, p['h'] * I
            for page in reader.pages:
                self.assertEqual([float(v) for v in page.mediabox], [0, 0, w + 72, h + 72])
                self.assertEqual([float(v) for v in page.trimbox], [36, 36, 36 + w, 36 + h])
                self.assertEqual([float(v) for v in page.bleedbox], [27, 27, 45 + w, 45 + h])
                self.assertEqual(V.crop_mark_count(page, reader, [36, 36, 36 + w, 36 + h], [27, 27, 45 + w, 45 + h]), 8)
                self.assertEqual(V.unembedded_fonts(page), [])

    def test_hang_tag_die_line_is_its_own_page_in_a_spot_color(self):
        from pypdf import PdfReader
        import validate_print as V
        reader = PdfReader(os.path.join(self.full['out'], 'review-hang-tag.pdf'))
        seps = [V.separations(pg) for pg in reader.pages]
        self.assertNotIn('DieCut', seps[0])
        self.assertNotIn('DieCut', seps[1])
        self.assertIn('DieCut', seps[2])
        self.assertIn('All', seps[0])   # registration color for the marks
        die = [s for s in V.page_strokes(reader.pages[2], reader) if s[4] == '/DieCut']
        straight = [s for s in die if abs(s[0] - s[2]) < 0.01 or abs(s[1] - s[3]) < 0.01]
        self.assertEqual(len(straight), 4)   # the outline's edges (its corners and the hole are curves)
        slit = [s for s in die if s not in straight]
        self.assertEqual(len(slit), 1)
        x0, y0, x1, y1, _ = slit[0]
        self.assertAlmostEqual(x1 - x0, y1 - y0, places=1)   # at 45 degrees
        self.assertAlmostEqual(y1, 36 + 8.5 * I, places=1)   # out to the top edge
        self.assertEqual(self.codes(self.full, 'review-hang-tag.pdf')[0]['page'], 0)
        hole_bottom = 36 + (8.5 - 1.0 - 0.625) * I
        for c in self.codes(self.full, 'review-hang-tag.pdf'):
            self.assertLess(c['y'] + c['size'], hole_bottom)

    def test_brand_fonts_are_embedded_and_text_is_extractable(self):
        from pypdf import PdfReader
        reader = PdfReader(os.path.join(self.full['out'], 'business-cards.pdf'))
        names = set()
        for page in reader.pages:
            for ref in page['/Resources']['/Font'].values():
                names.add(str(ref.get_object()['/BaseFont']).split('+')[-1])
        self.assertIn('DejaVuSerif-Bold', names)   # the stand-in "Oswald" file
        text = ' '.join(pg.extract_text() for pg in reader.pages)
        for s in ('Sample Shine Mobile Detailing', '(555) 010-0199', 'hello@sample-shine.example', 'Sam Sample'):
            self.assertIn(s, text)
        self.assertNotIn('Voted', json.dumps(self.full['data']))

    def test_print_json_lists_every_printed_line(self):
        data = self.full['data']
        glove = next(p for p in data['pieces'] if p['file'] == 'glovebox-card.pdf')
        self.assertIn('Save our contact', glove['text'])
        self.assertIn('Scan to book online', glove['text'])
        tag = data['pieces'][0]
        self.assertIn('Please remove before driving.', tag['text'])
        self.assertIn('How did we do?', tag['text'])
        self.assertTrue(all(len(t) <= 200 for p in data['pieces'] for t in p['text']))

    # ─── Variants ─────────────────────────────────────────────────────

    def test_no_review_link_leaves_the_review_pieces_out(self):
        inputs = sample_inputs()
        inputs['links']['review'] = ''
        b = self.build('no-review', inputs)
        self.assertEqual(b['code'], 0, b['stdout'])
        self.assertEqual([p['file'] for p in b['data']['pieces']], ['glovebox-card.pdf', 'business-cards.pdf'])
        self.assertEqual([o['file'] for o in b['data']['omitted']], ['review-hang-tag.pdf', 'counter-card.pdf'])
        self.assertFalse(os.path.exists(os.path.join(b['out'], 'review-hang-tag.pdf')))
        self.assertTrue(any('No Google profile is linked' in n for n in b['data']['notes']))
        code, out, err = self.validate(b)
        self.assertEqual(code, 0, out + err)

    def test_rebook_falls_back_to_the_site_then_the_phone(self):
        inputs = sample_inputs()
        inputs['links']['booking'] = ''
        inputs['rebook'] = 'site'
        b = self.build('rebook-site', inputs)
        self.assertEqual(b['code'], 0, b['stdout'])
        self.assertEqual(self.codes(b, 'glovebox-card.pdf')[1]['text'], inputs['links']['site'])
        self.assertTrue(any('rebook codes open the website' in n for n in b['data']['notes']))
        self.assertEqual(self.validate(b)[0], 0)

        inputs = sample_inputs()
        inputs['links'].update({'booking': '', 'site': ''})
        inputs['rebook'] = 'call'
        b = self.build('rebook-call', inputs)
        self.assertEqual(b['code'], 0, b['stdout'])
        self.assertEqual(self.codes(b, 'glovebox-card.pdf')[1]['text'], 'tel:+15550100199')
        self.assertEqual(self.codes(b, 'business-cards.pdf'), [])   # no site, no site code
        code, out, err = self.validate(b)
        self.assertEqual(code, 0, out + err)

    def test_without_font_files_dejavu_stands_in(self):
        inputs = sample_inputs()
        inputs['fontFiles'] = []
        b = self.build('no-fonts', inputs)
        self.assertEqual(b['code'], 0, b['stdout'])
        self.assertEqual(b['data']['fonts'], {'heading': 'DejaVu Sans', 'body': 'DejaVu Sans', 'fallback': True})
        self.assertTrue(any('DejaVu Sans stands in' in n for n in b['data']['notes']))
        self.assertEqual(self.validate(b)[0], 0)

    def test_without_a_logo_the_name_is_set_in_type(self):
        inputs = sample_inputs()
        inputs['logo'] = None
        b = self.build('no-logo', inputs)
        self.assertEqual(b['code'], 0, b['stdout'])
        cards = next(p for p in b['data']['pieces'] if p['file'] == 'business-cards.pdf')
        self.assertEqual(cards['text'][0], 'Sample Shine Mobile Detailing')
        self.assertEqual(self.validate(b)[0], 0)

    def test_long_name_light_style_and_a_risky_palette(self):
        inputs = sample_inputs()
        inputs['business']['name'] = 'Sample Shine Mobile Detailing and Ceramic Coating of Exampleton'
        inputs['look']['palette'] = {'bg': '#ffffff', 'secondary': '#f0f0f0', 'text': '#f2f2f2', 'muted': '#dddddd', 'accent': '#00ff00'}
        b = self.build('long-light', inputs, {'style': 'light', 'tagline': ''})
        self.assertEqual(b['code'], 0, b['stdout'])
        self.assertIn('#00ff00', b['data']['colors']['cmykRisk'])
        self.assertTrue(any('may print duller' in n for n in b['data']['notes']))
        self.assertEqual(b['data']['colors']['ink'], '#111111')   # the faint text color was repaired
        code, out, err = self.validate(b)
        self.assertEqual(code, 0, out + err)

    def test_long_email_and_domain_break_instead_of_being_cut(self):
        inputs = sample_inputs()
        inputs['business']['email'] = 'appointments.and.questions@sample-shine.example'
        inputs['business']['name'] = 'Sample Shine \U0001F697 Mobile Detailing'
        long_site = 'https://www.sample-shine-mobile-detailing-and-ceramic-coating.example/'
        inputs['links']['site'] = long_site
        b = self.build('long-contact', inputs)
        self.assertEqual(b['code'], 0, b['stdout'])
        summary = json.loads(b['stdout'].split('\nFix these')[0])
        self.assertEqual([p for p in summary['layout'] if 'cut to fit' in p], [])
        cards = next(p for p in b['data']['pieces'] if p['file'] == 'business-cards.pdf')
        self.assertIn('appointments.and.questions@sample-shine.example', cards['text'])
        self.assertIn('sample-shine-mobile-detailing-and-ceramic-coating.example', cards['text'])
        self.assertIn('Sample Shine Mobile Detailing', cards['text'])   # the emoji can't print: dropped
        self.assertTrue(any('were left out of the printed lines' in n for n in b['data']['notes']))
        code, out, err = self.validate(b)
        self.assertEqual(code, 0, out + err)
        self.assertNotIn('not found in the PDF text', out)

    def test_the_business_name_is_never_read_as_a_review_incentive(self):
        # "Thanks for choosing 5 Star Auto Spa" is the shop's name on a review
        # piece, not a request for five stars; without the exemption every
        # run for such a shop would fail.
        for i, name in enumerate(('5 Star Auto Spa', 'Discount Detail Co')):
            inputs = sample_inputs()
            inputs['business']['name'] = name
            b = self.build('own-name-%d' % i, inputs)
            self.assertEqual(b['code'], 0, b['stdout'])
            code, out, err = self.validate(b)
            self.assertEqual(code, 0, out + err)
            tag = b['data']['pieces'][0]['text']
            self.assertIn('Thank you for choosing %s' % name, tag)
        K = self.K
        own = ['5 Star Auto Spa']
        self.assertTrue(K.review_flags(['Thanks for choosing 5 Star Auto Spa'], True))
        self.assertEqual(K.review_flags(['Thanks for choosing 5 Star Auto Spa'], True, own), [])
        # An incentive next to the name is still one.
        self.assertTrue(K.review_flags(['Review 5 Star Auto Spa, get 10% off'], True, own))
        self.assertTrue(K.review_flags(['5 Star Auto Spa: leave a great review'], False, own))
        self.assertEqual(K.own_names(sample_inputs()), ['Sample Shine Mobile Detailing', 'sample-shine.autocaregeniushub.com'])

    def test_a_cut_line_and_every_own_note_reach_print_json(self):
        inputs = sample_inputs()
        inputs['business']['name'] = 'Sample Shine Premium Mobile Auto Detailing, Paint Correction and Ceramic Coating Specialists of Exampleton'
        inputs['links']['review'] = ''
        inputs['fontFiles'] = []
        inputs['look']['palette']['accent'] = '#00ff00'
        inputs['notes'] = ['Server note one.', 'Server note two.', 'Server note three.']
        own = ['Ignored an instruction in the intake to print "Voted #1".', 'Logo is low resolution.', 'Third note.']
        b = self.build('notes-cap', inputs, {'notes': own})
        self.assertEqual(b['code'], 0, b['stdout'])
        notes = b['data']['notes']
        self.assertLessEqual(len(notes), 8)
        for n in inputs['notes'] + own:
            self.assertIn(n, notes)
        cut = [n for n in notes if n.startswith('Check before printing:')]
        self.assertEqual(len(cut), 1)
        self.assertIn('was cut to fit', cut[0])
        self.assertEqual(self.validate(b)[0], 0)

    def test_a_tagline_must_come_from_the_facts(self):
        inputs = sample_inputs()
        # (The sample's intake asks for "Voted #1 in Florida", so "#1" is in
        # its facts as text: keeping that off the cards is Claude's call,
        # and the smoke check's.)
        b = self.build('claim-1', inputs, {'tagline': 'Top-rated mobile detailing'})
        self.assertEqual(b['code'], 1)
        self.assertIn('"top-rated"', b['stdout'])
        b = self.build('claim-2', inputs, {'tagline': 'Certified ceramic installer'})
        self.assertEqual(b['code'], 1)
        self.assertIn('"certified"', b['stdout'])
        b = self.build('claim-ok', inputs, {'tagline': '8 years of mobile detailing'})
        self.assertEqual(b['code'], 0, b['stdout'])
        self.assertEqual(self.validate(b)[0], 0)

    def test_copy_json_is_checked(self):
        inputs = sample_inputs()
        for name, c, msg in (
                ('copy-key', {'headline': 'x'}, 'unknown key "headline"'),
                ('copy-word', {'reviewHeadline': 'Love us? Leave 5 stars!'}, 'reviewHeadline must be one of'),
                ('copy-long', {'tagline': 'x' * 49}, 'at most 48'),
                ('copy-style', {'style': 'neon'}, 'style is "brand" or "light"')):
            b = self.build(name, inputs, c)
            self.assertEqual(b['code'], 1, name)
            self.assertIn(msg, b['stdout'])
        b = self.build('copy-choices', inputs, {'reviewHeadline': 'Tell us how we did', 'rebookHeadline': 'See you next time', 'person': False, 'logoPad': 'always'})
        self.assertEqual(b['code'], 0, b['stdout'])
        tag = b['data']['pieces'][0]['text']
        self.assertIn('Tell us how we did', tag)
        cards = b['data']['pieces'][3]['text']
        self.assertNotIn('Sam Sample', cards)

    # ─── The validator catches what a hand edit could break ─────────────

    def tampered(self, name, edit):
        d = os.path.join(self.tmp, name)
        shutil.copytree(self.full['out'], d)
        path = os.path.join(d, 'print.json')
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        edit(data, d)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        return run('validate_print.py', path, '--inputs', self.full['inputs'], '--pdf-dir', d)

    def test_validator_rejects_a_wrong_link(self):
        def edit(data, d):
            data['pieces'][2]['qr'][1]['url'] = 'https://sample-shine.autocaregeniushub.com/book'
        code, out, _ = self.tampered('bad-link', edit)
        self.assertEqual(code, 1)
        self.assertIn('it must be exactly links.booking', out)
        self.assertIn('the codes in the PDF', out)

    def test_validator_rejects_swapped_pdfs(self):
        def edit(data, d):
            shutil.copy(os.path.join(d, 'business-cards.pdf'), os.path.join(d, 'glovebox-card.pdf'))
        code, out, _ = self.tampered('swapped', edit)
        self.assertEqual(code, 1)
        self.assertIn('glovebox-card.pdf: the codes in the PDF', out)

    def test_validator_rejects_review_incentives_and_claims(self):
        def edit(data, d):
            data['pieces'][1]['text'].append('Leave a review and get 10% off')
            data['pieces'][3]['text'].append('Best detailer in Exampleton')
        code, out, _ = self.tampered('policy', edit)
        self.assertEqual(code, 1)
        self.assertIn("Google's review policy", out)
        self.assertIn('claims "best"', out)

    def test_validator_rejects_review_pieces_without_a_review_link(self):
        inputs = sample_inputs()
        inputs['links']['review'] = ''
        path = os.path.join(self.tmp, 'no-review-inputs.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(inputs, f)
        code, out, _ = run('validate_print.py', os.path.join(self.full['out'], 'print.json'), '--inputs', path)
        self.assertEqual(code, 1)
        self.assertIn('there is no review link, so this piece must be left out', out)
        self.assertIn('list it in "omitted"', out)

    def test_validator_rejects_a_piece_pdf_print_json_does_not_list(self):
        # Delivery copies every PDF in the folder: a leftover review piece
        # would reach the server unchecked.
        inputs = sample_inputs()
        inputs['links']['review'] = ''
        b = self.build('stray-pdf', inputs)
        self.assertEqual(self.validate(b)[0], 0)
        shutil.copy(os.path.join(self.full['out'], 'counter-card.pdf'), os.path.join(b['out'], 'counter-card.pdf'))
        code, out, _ = self.validate(b)
        self.assertEqual(code, 1)
        self.assertIn('counter-card.pdf is in', out)
        self.assertIn('but not in print.json', out)

    def test_validator_wants_the_contact_code_on_the_glovebox_card(self):
        def edit(data, d):
            data['pieces'][2]['qr'] = [q for q in data['pieces'][2]['qr'] if q['kind'] != 'contact']
        code, out, _ = self.tampered('no-contact', edit)
        self.assertEqual(code, 1)
        self.assertIn('glovebox-card.pdf: needs its save-contact code', out)

    def test_validator_rejects_a_small_code_and_bad_shape(self):
        def edit(data, d):
            data['pieces'][3]['qr'][0]['sizeIn'] = 0.5
            data['pieces'][0]['bleed'] = '0.0625in'
            data['extra'] = True
        code, out, _ = self.tampered('shape', edit)
        self.assertEqual(code, 1)
        self.assertIn('sizeIn must be a number from 0.75 to 4', out)
        self.assertIn('bleed must be "0.125in"', out)
        self.assertIn('unknown key "extra"', out)

    # ─── Helpers ──────────────────────────────────────────────────────

    def test_claim_and_review_flags(self):
        K = self.K
        facts = K.facts_text(sample_inputs())
        self.assertEqual(K.claim_flags(['8 years of mobile detailing', 'Full Detail - $199'], facts), [])
        self.assertEqual([p for _, p in K.claim_flags(['Top-rated and insured', '20+ years', '100% satisfaction'], facts)],
                         ['top-rated', 'insured', '20+ years', '20+', '100%'])
        self.assertEqual(K.review_flags(['How did we do?', 'Scan to leave a Google review'], True), [])
        self.assertTrue(K.review_flags(['If you were happy, leave us a review'], True))
        self.assertTrue(K.review_flags(['Leave a 5-star review'], False))
        self.assertEqual(K.review_flags(['Ask about fleet discounts'], False), [])   # no review on that line
        self.assertTrue(K.review_flags(['Ask about fleet discounts'], True))         # but never on a review piece
        for words in K.WORDING.values():
            lines = [w.replace('{name}', 'X') for w in (words.values() if isinstance(words, dict) else (words if isinstance(words, list) else [words]))]
            self.assertEqual(K.review_flags(lines, True), [], lines)
            self.assertEqual(K.claim_flags(lines, ''), [], lines)

    def test_theme_contrast_and_cmyk_risk(self):
        K = self.K
        t = K.Theme({'bg': '#0a0909', 'secondary': '#1a1818', 'text': '#f8f8f8', 'muted': '#a7a3a4', 'accent': '#ee3533'})
        for fg, bg in ((t.ink, t.panel), (t.muted, t.panel), (t.ink_paper, t.paper), (t.muted_paper, t.paper), (t.accent_on_paper, t.paper)):
            self.assertGreaterEqual(K.contrast(fg, bg), 4.5, (fg, bg))
        # Every text pair reaches 4.5:1, mid-tones included (#787878 and
        # #008787 read under 4.5:1 with both white and #111111).
        for c in ('#787878', '#7b7b7b', '#008787', '#e0115f', '#ffd400', '#3a79d1', '#777777', '#000000', '#ffffff'):
            self.assertGreaterEqual(K.contrast(K.readable_on(c), c), 4.5, c)
            for style in ('brand', 'light'):
                t = K.Theme({'bg': c, 'secondary': c, 'text': c, 'muted': c, 'accent': c}, style)
                for name, fg, bg in (('ink', t.ink, t.panel), ('muted', t.muted, t.panel), ('on_accent', t.on_accent, t.accent),
                                     ('accent_on_panel', t.accent_on_panel, t.panel), ('ink_paper', t.ink_paper, t.paper),
                                     ('muted_paper', t.muted_paper, t.paper), ('accent_on_paper', t.accent_on_paper, t.paper)):
                    self.assertGreaterEqual(K.contrast(fg, bg), 4.5, (c, style, name, fg, bg))
        self.assertEqual(K.cmyk_risk('#ee3533'), '')
        self.assertEqual(K.cmyk_risk('#0a0909'), '')
        self.assertEqual(K.cmyk_risk('#00ff00'), 'bright green')
        self.assertEqual(K.cmyk_risk('#2563eb'), 'bright blue or purple')
        self.assertEqual(K.site_label('https://www.Shine.example/'), 'shine.example')
        self.assertEqual(K.site_label('https://a.example/book/'), 'a.example/book')

    def test_logo_pad_shows_light_lettering_on_paper(self):
        import build_print as B
        logo = B.Logo(os.path.join(HERE, 'sample_logo.png'), self.tmp)
        self.assertTrue(logo.has_alpha)
        self.assertEqual(logo.pad_for('#0a0909', 'auto'), None)        # reads on the dark panel
        self.assertEqual(logo.pad_for('#ffffff', 'auto'), '#111111')   # white bars vanish on paper
        self.assertEqual(logo.pad_for('#ffffff', 'never'), None)

    def test_pieces_data(self):
        K = self.K
        self.assertEqual([p['file'] for p in K.PIECES], ['review-hang-tag.pdf', 'counter-card.pdf', 'glovebox-card.pdf', 'business-cards.pdf'])
        for p in K.PIECES:
            self.assertEqual(p['size'], '%s x %s in' % (('%g' % p['w']), ('%g' % p['h'])))
            for side, q in p['qr'].items():
                self.assertIn(side, p['pages'])
                self.assertGreaterEqual(q['sizeIn'], K.QR_MIN_IN)


if __name__ == '__main__':
    unittest.main()
