"""Tests of the launch-claims-ledger scripts: the text rules against the
server's (parity.json, written by src/lib/kit/claims.test.js), the regex
pre-pass, and the scripts end to end on the exact input a smoke run sends
(sample_input.json and sample_print.json, written by
tests/functions/kit-claims.test.js) and on generated inputs.

Standard library only, except reading the print PDF (pypdf, as in the
code-execution container): those checks are skipped without it. Everything
is written to a temporary folder.

Run: python3 skills/api/launch-claims-ledger/tests/test_claims.py
"""
import copy
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(HERE, '..', 'scripts')
sys.path.insert(0, SCRIPTS)
sys.dont_write_bytecode = True

import claimlib as cl  # noqa: E402
import validate_claims as vc  # noqa: E402

try:
    import pypdf  # noqa: F401
    HAVE_PYPDF = True
except ImportError:
    HAVE_PYPDF = False

ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')


def load(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return json.load(f)


def run(script, *args, env=None, cwd=None):
    p = subprocess.run([sys.executable, os.path.join(SCRIPTS, script)] + list(args),
                       capture_output=True, text=True, env=env or ENV, cwd=cwd, timeout=120)
    return p.returncode, p.stdout, p.stderr


def sample_pdf(lines):
    """netlify/functions/_lib/kit/claims.js samplePdf(): the same bytes."""
    def esc(s):
        s = ''.join('\\' + c if c in '\\()' else c for c in str(s))
        return ''.join(c if 0x20 <= ord(c) <= 0x7e else '?' for c in s)
    stream = 'BT /F1 11 Tf 18 120 Td 14 TL %s ET' % ' '.join('(%s) Tj T*' % esc(line) for line in lines)
    objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 252 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        '<< /Length %d >>\nstream\n%s\nendstream' % (len(stream.encode('latin-1')), stream),
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    pdf = '%PDF-1.4\n'
    offsets = []
    for i, body in enumerate(objects):
        offsets.append(len(pdf.encode('latin-1')))
        pdf += '%d 0 obj\n%s\nendobj\n' % (i + 1, body)
    xref = len(pdf.encode('latin-1'))
    pdf += 'xref\n0 %d\n0000000000 65535 f \n%s' % (len(objects) + 1, ''.join('%010d 00000 n \n' % o for o in offsets))
    pdf += 'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objects) + 1, xref)
    return pdf.encode('latin-1')


def counts_of(claims):
    n = lambda s: sum(1 for c in claims if c.get('status') == s)  # noqa: E731
    return {'sourced': n('sourced'), 'unsourced': n('unsourced'), 'needsRewrite': n('needs-rewrite')}


# ─── The server's rules (parity.json) ────────────────────────────────

class Parity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p = load('parity.json')

    def test_constants(self):
        c = self.p['constants']
        self.assertEqual(c['version'], cl.LEDGER_VERSION)
        self.assertEqual(c['statuses'], list(cl.STATUSES))
        self.assertEqual(c['where'], list(cl.WHERE))
        self.assertEqual(c['kinds'], list(cl.KINDS))
        self.assertEqual(c['limits'], cl.LIMITS)
        self.assertEqual(c['reviewField'], cl.REVIEW_FIELD)
        self.assertEqual(c['businessInfoPrefix'], cl.BUSINESS_INFO_PREFIX)

    def test_normalize(self):
        for text, want in self.p['normalize']:
            self.assertEqual(cl.normalize(text), want, text)

    def test_numbers(self):
        for text, want in self.p['numbers']:
            self.assertEqual(cl.numbers(text), want, text)

    def test_quotes(self):
        for quote, text, want in self.p['quotes']:
            self.assertEqual(cl.quote_in(quote, text), want, quote)

    def test_review_paths(self):
        for path, want in self.p['reviewPaths']:
            self.assertEqual(bool(cl.REVIEW_PATH.search(path)), want, path)

    def test_validator_passes_what_the_server_stores_as_written(self):
        # Each claim alone: the server keeps it unchanged exactly when the
        # validator finds nothing wrong with it.
        cand = {'sources': self.p['ledgerSources'], 'units': self.p['ledgerChecked'], 'candidates': []}
        for case in self.p['ledgerClaims']:
            claim = case['claim']
            ledger = {'version': 1, 'claims': [claim], 'counts': counts_of([claim])}
            errors, _ = vc.validate(ledger, cand)
            self.assertEqual(not errors, case['kept'], '%s: %s' % (case['name'], errors))


# ─── Text helpers ────────────────────────────────────────────────────

class Text(unittest.TestCase):
    def test_sentences_are_verbatim_spans(self):
        text = 'Serving St. Pete and Tampa. Full detail $4.99 off! No. 1 in town?\nCall Mr. Sam today. Est. 2015 crew. ok then'
        got = [text[a:b] for a, b in cl.sentences(text)]
        self.assertEqual(got, ['Serving St. Pete and Tampa.', 'Full detail $4.99 off!', 'No. 1 in town?',
                               'Call Mr. Sam today.', 'Est. 2015 crew. ok then'])

    def test_sentences_skip_blank_lines(self):
        self.assertEqual(cl.sentences('  \n\nHi there.  \n'), [(4, 13)])
        self.assertEqual(cl.sentences(''), [])

    def test_window_stays_verbatim_and_short(self):
        text = 'word ' * 100
        w = cl.window(text, 0, len(text), 50)
        self.assertLessEqual(len(w), 50)
        self.assertTrue(text.startswith(w))
        self.assertEqual(cl.window('short text', 0, 10, 50), 'short text')

    def test_one_line(self):
        self.assertEqual(cl.one_line(' a\n b\t c '), 'a b c')
        self.assertEqual(cl.one_line(None), '')


# ─── The pre-pass ────────────────────────────────────────────────────

SOURCES = [
    {'field': 'serviceArea', 'text': 'Tampa, St. Pete and Clearwater'},
    {'field': 'address', 'text': '12 Main St, Brandon, FL 33511'},
    {'field': 'businessInfo.city', 'text': 'city: Lutz'},
    {'field': 'about', 'text': 'Family-owned since 2015.'},
]


class Prepass(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = cl.Matcher(SOURCES)

    def kinds(self, sentence):
        return set(k for k, _ in self.m.matches(sentence))

    def test_each_kind(self):
        cases = {
            'price': ['Full detail $199', 'Free estimates on every job', '15% off your first visit', 'Financing available'],
            'rating': ['Rated 4.9/5 on Google', '200+ five-star reviews', 'Top-rated in the bay', '5-star service'],
            'years': ['Since 2015', '12 years of experience', 'Over a decade of work', 'Twenty-five years strong'],
            'number': ['500+ cars detailed', 'More than 1,000 coatings', '98% of customers come back',
                       'Done in 2 hours'],
            'award': ['Award-winning detail shop', 'Voted best of Tampa 2023', 'As seen on TV'],
            'certification': ['Licensed and insured', 'IDA certified', 'ASE technicians', 'Authorized installer'],
            'guarantee': ['Satisfaction guaranteed', 'Money-back promise', '100% happy or we redo it'],
            'warranty': ['Lifetime warranty', 'Backed by the maker'],
            'brand': ['We install XPEL film', 'Ceramic Pro coatings', 'NAPA parts only', 'Flex polishers'],
            'area': ['Serving Tampa, Brandon and Riverview', 'Within 30 miles', 'We come to you',
                     'Mobile detailing in Clearwater'],
            'superlative': ["Tampa's #1 detailer", 'The best in town', 'The only shop that does it',
                            'Most trusted in the county'],
            'availability': ['Open 24/7', 'Same-day service', 'Walk-ins welcome'],
            'other': ['Eco-friendly products', 'Veteran-owned and operated', 'Scratch-free wash'],
        }
        for kind, sentences in cases.items():
            for s in sentences:
                self.assertIn(kind, self.kinds(s), s)

    def test_taste_and_calls_to_action_are_not_claims(self):
        for s in ['Showroom shine, wherever you park.', 'Book now', 'We treat every car like our own.',
                  'Get a quote', 'Napa Valley road trip ready', 'A flex schedule that suits you']:
            self.assertEqual(self.kinds(s), set(), s)

    def test_body_names_count_as_certifications(self):
        self.assertIn('certification', self.kinds('Member of the Better Business Bureau'))

    def test_place_terms_come_from_the_sources_that_name_places(self):
        terms = cl.place_terms(SOURCES, cl.load_lexicon())
        for t in ['Tampa', 'St. Pete', 'Clearwater', 'Brandon', 'FL', 'Lutz']:
            self.assertIn(t, terms)
        self.assertNotIn('Main St', terms)
        self.assertNotIn('Family', terms)

    def test_business_facts_are_claims_whatever_their_wording(self):
        self.assertEqual(cl.info_kind('businessInfo.yearsInBusiness'), 'years')
        self.assertEqual(cl.info_kind('businessInfo.services[0]'), 'price')
        self.assertEqual(cl.info_kind('businessInfo.googlePlace.rating'), 'rating')
        self.assertEqual(cl.info_kind('businessInfo.priceRange'), 'price')
        self.assertIsNone(cl.info_kind('businessInfo.googlePlace.placeName'))
        self.assertIsNone(cl.info_kind('headline'))
        units = [{'where': 'site', 'path': 'businessInfo.yearsInBusiness', 'text': 'yearsInBusiness: 8'}]
        [c] = cl.candidates(units, SOURCES)
        self.assertEqual(c['kinds'], ['years'])
        self.assertIn('8', c['matches'])

    def test_a_review_on_the_site_is_one_candidate_with_its_wording_checked(self):
        sources = SOURCES + [{'field': 'testimonials', 'text': '"Great job, best in town!" - Al'}]
        units = [
            {'where': 'site', 'path': 'testimonialPlaceholders[0].text', 'text': 'Great job, best in town!'},
            {'where': 'site', 'path': 'testimonialPlaceholders[1].text', 'text': 'Great work. Best in town, 10/10.'},
            {'where': 'site', 'path': 'testimonialPlaceholders[1].name', 'text': 'Best Buy'},
        ]
        c = cl.candidates(units, sources)
        self.assertEqual([x['path'] for x in c], ['testimonialPlaceholders[0].text', 'testimonialPlaceholders[1].text',
                                                  'testimonialPlaceholders[1].name'])
        self.assertEqual([x.get('verbatim') for x in c[:2]], [True, False])
        self.assertTrue(all(x.get('review') for x in c[:2]))
        self.assertNotIn('review', c[2])

    def test_hints_lead_to_the_sources_that_share_numbers_or_words(self):
        index = cl.SourceIndex(SOURCES)
        hints = index.hints('Family owned since 2015', ['since 2015'])
        self.assertEqual(hints[0], {'field': 'about', 'quote': 'Family-owned since 2015.'})
        self.assertEqual(index.search(['2015']), [{'field': 'about', 'quote': 'Family-owned since 2015.'}])
        self.assertEqual(index.search(['nothing like this']), [])

    def test_the_candidate_list_is_capped(self):
        units = [{'where': 'site', 'path': 'p%d' % i, 'text': 'Best wash number %d.' % i} for i in range(30)]
        got = cl.candidates(units, [], limit=10)
        self.assertEqual([c['id'] for c in got], ['c%d' % i for i in range(1, 11)])


# ─── The scripts on the smoke run's exact input ─────────────────────

class SampleRun(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix='claims-test-')
        cls.out = os.path.join(cls.tmp, 'out')
        meta = load('sample_print.json')
        cls.pdf = os.path.join(cls.tmp, meta['name'])
        data = sample_pdf(meta['lines'])
        with open(cls.pdf, 'wb') as f:
            f.write(data)
        cls.pdf_meta, cls.pdf_bytes = meta, data
        cls.code, cls.stdout, cls.stderr = run('extract_claims.py', '--input', os.path.join(HERE, 'sample_input.json'),
                                               '--pdf', cls.pdf, '--out-dir', cls.out)
        with open(os.path.join(cls.out, 'candidates.json'), encoding='utf-8') as f:
            cls.cand = json.load(f)
        cls.by_text = {c['text']: c for c in cls.cand['candidates']}

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_the_print_pdf_is_the_smoke_runs_own(self):
        self.assertEqual(len(self.pdf_bytes), self.pdf_meta['size'])
        self.assertEqual(hashlib.sha256(self.pdf_bytes).hexdigest(), self.pdf_meta['sha256'])

    def test_prepass_writes_its_files_and_lists_the_candidates(self):
        self.assertEqual(self.code, 0, self.stdout + self.stderr)
        for name in ('candidates.json', 'candidates.txt', 'checked.txt', 'sources.txt'):
            self.assertTrue(os.path.getsize(os.path.join(self.out, name)) > 0, name)
        self.assertIn('Sources: 14', self.stdout)
        self.assertIn('c1 [site] headline | area, superlative', self.stdout)
        with open(os.path.join(self.out, 'sources.txt'), encoding='utf-8') as f:
            self.assertIn('[about] Intake: Your story:\nI\'ve been detailing cars for 8 years.', f.read())

    def test_the_planted_claims_are_candidates(self):
        for text, kind in [("Exampleton's #1 Mobile Detailer", 'superlative'), ('Over 10 years of experience.', 'years'),
                           ('Serving Exampleton, Sampleville and Demo Beach.', 'area'),
                           ('Our best-selling package, from $149.', 'price'),
                           ('5-star service, satisfaction guaranteed.', 'guarantee'), ('500+ happy customers.', 'number'),
                           ('Protect your paint with a Gtechniq coating and a lifetime warranty.', 'warranty'),
                           ('yearsInBusiness: 8', 'years')]:
            self.assertIn(text, self.by_text)
            self.assertIn(kind, self.by_text[text]['kinds'], text)

    def test_the_reworded_review_is_marked(self):
        ok = self.by_text['Sam made my truck look brand new. Best detailer in Exampleton!']
        reworded = self.by_text['On time, friendly and the car looks amazing. Highly recommend!']
        self.assertEqual((ok['review'], ok['verbatim']), (True, True))
        self.assertEqual((reworded['review'], reworded['verbatim']), (True, False))
        self.assertIn('word for word in the pasted reviews: NO', self.stdout)

    def test_every_candidate_is_a_verbatim_piece_of_a_checked_text(self):
        units = {}
        for u in self.cand['units']:
            units.setdefault((u['where'], u['path']), []).append(u['text'])
        for c in self.cand['candidates']:
            self.assertTrue(any(c['text'] in t for t in units[(c['where'], c['path'])]), c['id'])
            self.assertEqual(c['id'], 'c%d' % (self.cand['candidates'].index(c) + 1))

    def test_contact_details_and_settings_are_not_checked(self):
        paths = [u['path'] for u in self.cand['units']]
        for p in ('ctaPrimary', 'footerTagline', 'businessInfo.yearsInBusiness'):
            self.assertIn(p, paths)
        for p in ('businessInfo.city', 'businessInfo.businessName', 'businessInfo.googlePlace.placeName', 'keywords'):
            self.assertNotIn(p, paths)
        blob = json.dumps(self.cand)
        for secret in ('sam@example.test', '(555) 010-0199', 'ChIJ_sample_place_0001'):
            self.assertNotIn(secret, blob)

    @unittest.skipUnless(HAVE_PYPDF, 'pypdf is needed to read the print PDF')
    def test_the_print_pdf_is_read_as_print(self):
        self.assertEqual(self.cand['problems'], [])
        printed = [c for c in self.cand['candidates'] if c['where'] == 'print']
        self.assertEqual([c['text'] for c in printed], ['Lifetime warranty on every coating', 'IDA certified - we come to you'])
        self.assertEqual({c['path'] for c in printed}, {'print:glovebox-card.pdf p1'})

    @unittest.skipUnless(HAVE_PYPDF, 'the sample ledger has print claims')
    def test_the_sample_ledger_validates(self):
        code, out, err = run('validate_claims.py', os.path.join(HERE, 'sample_ledger.json'),
                             '--candidates', os.path.join(self.out, 'candidates.json'))
        self.assertEqual(code, 0, out + err)
        self.assertIn('OK 38 claims (sourced 26, unsourced 5, needsRewrite 7), 1 candidate dismissed', out)
        self.assertNotIn('WARNING', out)

    @unittest.skipUnless(HAVE_PYPDF, 'the sample ledger has print claims')
    def test_the_validator_catches_each_mistake(self):
        good = load('sample_ledger.json')

        def errors_after(change):
            ledger = copy.deepcopy(good)
            change(ledger)
            errs, _ = vc.validate(ledger, self.cand)
            return ' | '.join(errs)

        def claim(ledger, text):
            return next(c for c in ledger['claims'] if c['text'] == text)

        def set_(which, **kw):
            return lambda led: claim(led, which).update(kw)

        def recount(change):
            def go(led):
                change(led)
                led['counts'] = counts_of(led['claims'])
            return go

        cases = [
            (set_('Over 10 years of experience', status='sourced', suggestion=''), 'the quote does not say 10'),
            (recount(set_('Over 10 years of experience', status='sourced', suggestion='')), 'the quote does not say 10'),
            (set_('detailing cars for 8 years', source={'field': 'about', 'quote': 'detailing cars for 9 years'}),
             'the quote is not word for word in "about"'),
            (set_('detailing cars for 8 years', source={'field': 'whyNot', 'quote': 'detailing cars for 8 years'}),
             'source field "whyNot" is not a source of this run'),
            (recount(set_('On time, friendly and the car looks amazing. Highly recommend!', status='sourced', suggestion='')),
             'not word for word in the pasted reviews'),
            (recount(set_("Exampleton's most trusted mobile detailer", status='sourced', suggestion='',
                          source={'field': 'testimonials', 'quote': 'Best detailer in Exampleton!'})),
             'the pasted reviews back only a review'),
            (set_('5-star service', source={'field': 'services', 'quote': 'Full Detail - $199'}), 'unsourced means source null'),
            (set_('5-star service', suggestion=''), 'unsourced needs a suggestion'),
            (set_('a lifetime warranty', suggestion=''), 'needs-rewrite needs a suggestion'),
            (set_('500+ happy customers', suggestion='Over 300 happy customers'), 'the suggestion adds 300'),
            (set_('IDA certified', suggestion='keep'), 'a sourced claim has no suggestion'),
            (set_('Over 10 years of experience', text='Over 11 years of experience'), 'the text is not in any checked "site" text'),
            (set_('Over 10 years of experience', text='Over 10 years\nof experience'), 'must be one plain line'),
            (set_('Over 10 years of experience', where='billboard'), 'where must be one of'),
            (set_('Over 10 years of experience', kind='gossip'), 'kind must be one of'),
            (set_('Over 10 years of experience', ref='c99'), 'ref "c99" is not a candidate id'),
            (set_('Over 10 years of experience', ref='c21'), 'candidate c21 is in "gbp", not "site"'),
            (set_('Over 10 years of experience', extra=1), 'unknown key "extra"'),
            (lambda led: led['claims'].append(dict(led['claims'][0])), 'repeats claims[0]'),
            (lambda led: led.update(dismissed=[]), 'candidates not handled'),
            (lambda led: led['claims'].pop(0), 'candidates not handled (make each a claim with "ref", or dismiss it with a reason): c1'),
            (lambda led: led['dismissed'].append({'ref': 'c1', 'reason': 'no'}), "c1 is also a claim's ref"),
            (lambda led: led['counts'].update(sourced=1), 'counts must be'),
            (lambda led: led['counts'].update(total=1), 'counts.total must be 38'),
            (lambda led: led.update(version=2), 'version must be 1'),
            (lambda led: led.update(extra=True), 'unknown key "extra"'),
            (lambda led: led.update(notes=['x'] * 9), 'notes must be a list of at most 8'),
        ]
        for change, want in cases:
            self.assertIn(want, errors_after(change), want)
        self.assertEqual(errors_after(lambda led: None), '')
        # The same claim in another text is its own entry (the admin fixes
        # each place); src/lib/kit/claims.js keeps both too.
        self.assertEqual(errors_after(recount(lambda led: led['claims'].append(dict(led['claims'][0], path='subheadline')))), '')

    def test_search_sources(self):
        cand = os.path.join(self.out, 'candidates.json')
        code, out, _ = run('search_sources.py', 'IDA', 'certified', '--candidates', cand)
        self.assertEqual(code, 0)
        self.assertIn('businessInfo.certifications: "certifications: IDA Certified Detailer"', out)
        code, out, _ = run('search_sources.py', '--any', 'lifetime', 'warranty', '--candidates', cand)
        self.assertEqual((code, out.strip()), (0, 'services: "Ceramic Coating - $899 (5 year warranty)"'))
        code, out, _ = run('search_sources.py', 'eight', '--field', 'about', '--candidates', cand)
        self.assertEqual((code, out.strip()), (0, 'about: "I\'ve been detailing cars for 8 years."'))
        code, out, _ = run('search_sources.py', 'lifetime', '--candidates', cand)
        self.assertEqual((code, out.strip()), (1, 'Nothing in the sources says "lifetime".'))
        code, out, _ = run('search_sources.py', 'x', '--candidates', os.path.join(self.tmp, 'missing.json'))
        self.assertEqual(code, 2)


# ─── Finding the inputs, broken inputs ───────────────────────────────

class Inputs(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='claims-inputs-')
        self.env = dict(ENV, HOME=self.tmp, INPUT_DIR=os.path.join(self.tmp, 'uploads'))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def write_input(self, folder, print_files=()):
        os.makedirs(folder, exist_ok=True)
        data = load('sample_input.json')
        data['printFiles'] = list(print_files)
        path = os.path.join(folder, 'claims-input.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        return path

    def test_find_inputs_lists_the_uploads_and_what_is_missing(self):
        folder = os.path.join(self.tmp, 'uploads', 'deep')
        self.write_input(folder, ['kit-print-glovebox-card.pdf', 'kit-print-counter-card.pdf'])
        with open(os.path.join(folder, 'kit-print-glovebox-card.pdf'), 'wb') as f:
            f.write(sample_pdf(['x']))
        code, out, _ = run('find_inputs.py', '--root', self.tmp, env=self.env, cwd=self.tmp)
        got = json.loads(out)
        self.assertEqual(code, 0)
        self.assertEqual(sorted(got['files']), ['claims-input.json', 'kit-print-glovebox-card.pdf'])
        self.assertEqual(got['missing'], ['kit-print-counter-card.pdf'])

    def test_extract_finds_the_input_itself_and_reports_what_it_cannot_read(self):
        folder = os.path.join(self.tmp, 'uploads')
        self.write_input(folder, ['kit-print-glovebox-card.pdf', 'kit-print-counter-card.pdf'])
        with open(os.path.join(folder, 'kit-print-glovebox-card.pdf'), 'wb') as f:
            f.write(b'not a pdf at all')
        started = time.time()
        code, out, err = run('extract_claims.py', '--out-dir', os.path.join(self.tmp, 'out'), env=self.env, cwd=self.tmp)
        self.assertLess(time.time() - started, 60)
        self.assertEqual(code, 0, out + err)
        self.assertIn('Input: %s' % os.path.join(folder, 'claims-input.json'), out)
        self.assertIn('Problem: kit-print-counter-card.pdf was sent but is not in the container', out)
        # Garbage named like a print PDF: reported, the rest still checked.
        self.assertRegex(out, r'Problem: (could not read kit-print-glovebox-card\.pdf|kit-print-glovebox-card\.pdf has no text)')
        self.assertRegex(out, r'Candidates: [1-9]')

    def test_extract_without_an_input_says_how_to_find_it(self):
        code, out, _ = run('extract_claims.py', '--input', os.path.join(self.tmp, 'nope.json'), '--pdf', 'x.pdf',
                           '--out-dir', os.path.join(self.tmp, 'out'), env=self.env, cwd=self.tmp)
        self.assertEqual(code, 1)
        self.assertIn('claims-input.json not found', out)
        bad = os.path.join(self.tmp, 'claims-input.json')
        with open(bad, 'w') as f:
            f.write('[1, 2]')
        code, out, _ = run('extract_claims.py', '--input', bad, '--pdf', 'x.pdf', '--out-dir', os.path.join(self.tmp, 'out'),
                           env=self.env, cwd=self.tmp)
        self.assertEqual(code, 1)
        self.assertIn('could not be read', out)

    def test_validator_exit_codes(self):
        cand = os.path.join(self.tmp, 'candidates.json')
        with open(cand, 'w') as f:
            json.dump({'sources': [], 'units': [], 'candidates': []}, f)
        ledger = os.path.join(self.tmp, 'ledger.json')
        with open(ledger, 'w') as f:
            f.write('{not json')
        self.assertEqual(run('validate_claims.py', ledger, '--candidates', cand)[0], 2)
        with open(ledger, 'w') as f:
            json.dump({'version': 1, 'claims': [], 'counts': {'sourced': 0, 'unsourced': 0, 'needsRewrite': 0}}, f)
        code, out, _ = run('validate_claims.py', ledger, '--candidates', cand)
        self.assertEqual((code, out.strip()), (0, 'OK 0 claims (sourced 0, unsourced 0, needsRewrite 0), 0 candidates dismissed'))
        self.assertEqual(run('validate_claims.py', ledger, '--candidates', os.path.join(self.tmp, 'none.json'))[0], 2)


# ─── Generated inputs ────────────────────────────────────────────────

PHRASES = [
    ('site', 'headline', "{city}'s #1 {trade}"),
    ('site', 'subheadline', 'Over {years} years of experience. Licensed and insured.'),
    ('site', 'aboutText', 'We have detailed {cars}+ cars since {since}. Every coating has a lifetime warranty.'),
    ('site', 'trustBar[0]', 'Satisfaction guaranteed'),
    ('site', 'trustBar[1]', 'Open 24/7'),
    ('site', 'servicesSection.intro', 'Serving {city}, {town} and {other}.'),
    ('site', 'servicesSection.items[0].description', 'Our full detail from ${price}, with {brand} products.'),
    ('site', 'testimonialPlaceholders[0].text', 'Best {trade} around, {rating} stars from me!'),
    ('site', 'footerTagline', 'Showroom shine, wherever you park.'),
    ('seo', 'metaDescription', 'Top-rated {trade} in {city}. Award-winning, eco-friendly and family-owned.'),
    ('gbp', 'words.gbp.description', 'The most trusted {trade} in {city}, rated {rating} by {reviews}+ customers.'),
    ('gbp', 'words.gbp.posts[0].body', 'Same-day service and free estimates. {pct}% off this month.'),
    ('social', 'words.social.bio', 'Voted best of {city} {since}. IDA certified.'),
    ('social', 'words.social.captions[0]', 'Another happy customer.'),
]


def generated_input(seed):
    """A claims-input.json for a made-up business, every claim kind in it,
    with values that vary by seed."""
    v = {
        'city': ['Exampleton', 'Sampleville', 'Demo Beach'][seed % 3], 'town': 'Testburg', 'other': 'Mockford',
        'trade': ['detailer', 'tint shop', 'wheel shop'][seed % 3], 'years': 5 + seed, 'cars': 100 * (seed + 1),
        'since': 2010 + seed, 'price': 99 + 10 * seed, 'brand': ['XPEL', 'Gtechniq', 'Ceramic Pro'][seed % 3],
        'rating': '4.%d' % (seed % 10), 'reviews': 20 + seed, 'pct': 5 + seed,
    }
    checked = [{'where': w, 'path': p, 'text': t.format(**v)} for w, p, t in PHRASES]
    sources = [
        {'field': 'serviceArea', 'label': 'Intake: City or area you serve', 'kind': 'intake',
         'text': '%s and %s' % (v['city'], v['town'])},
        {'field': 'about', 'label': 'Intake: Your story', 'kind': 'intake',
         'text': 'I started in %d and have done about %d cars. I use %s.' % (v['since'], v['cars'], v['brand'])},
        {'field': 'services', 'label': 'Intake: Services and prices', 'kind': 'intake', 'text': 'Full detail - $%d' % v['price']},
        {'field': 'testimonials', 'label': 'Pasted reviews', 'kind': 'reviews', 'text': '"Great work!" - Pat'},
        {'field': 'businessInfo.googlePlace', 'label': 'Business info: Google profile', 'kind': 'businessInfo',
         'text': 'googlePlace.rating: %s\ngooglePlace.reviewCount: %d' % (v['rating'], v['reviews'])},
    ]
    return {'version': 1, 'business': {'name': 'Generated %d' % seed, 'type': 'Detailing'}, 'sources': sources,
            'checked': checked, 'printFiles': []}


def mechanical_ledger(cand):
    """A ledger that marks every candidate unsourced (a valid, if lazy,
    ledger): what the validator must accept, whatever the input."""
    claims, dismissed, seen = [], [], set()
    for c in cand['candidates']:
        text = cl.window(c['text'], 0, len(c['text']), 250)
        key = (c['where'], cl.normalize(text))
        if key in seen:
            dismissed.append({'ref': c['id'], 'reason': 'The same text in the same place: one claim.'})
            continue
        seen.add(key)
        kind = 'review' if c.get('review') else c['kinds'][0]
        claims.append({'ref': c['id'], 'text': text, 'where': c['where'], 'kind': kind, 'path': c['path'][:120],
                       'source': None, 'status': 'unsourced', 'suggestion': 'Remove "%s"' % text})
    return {'version': 1, 'claims': claims, 'dismissed': dismissed, 'counts': counts_of(claims), 'notes': []}


class Generated(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='claims-gen-')

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def extract(self, data, name):
        path = os.path.join(self.tmp, '%s.json' % name)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        out = os.path.join(self.tmp, name)
        code, stdout, err = run('extract_claims.py', '--input', path, '--pdf', os.path.join(self.tmp, 'none.pdf'),
                                '--out-dir', out)
        self.assertEqual(code, 0, stdout + err)
        with open(os.path.join(out, 'candidates.json'), encoding='utf-8') as f:
            return json.load(f), os.path.join(out, 'candidates.json')

    def test_every_kind_is_found_and_a_mechanical_ledger_validates(self):
        for seed in range(4):
            cand, cand_path = self.extract(generated_input(seed), 'gen%d' % seed)
            kinds = set(k for c in cand['candidates'] for k in c['kinds'])
            self.assertEqual(kinds, set(cl.KINDS), seed)
            paths = [c['path'] for c in cand['candidates']]
            self.assertNotIn('footerTagline', paths)
            self.assertNotIn('words.social.captions[0]', paths)
            ledger = mechanical_ledger(cand)
            path = os.path.join(self.tmp, 'ledger%d.json' % seed)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(ledger, f)
            code, out, err = run('validate_claims.py', path, '--candidates', cand_path)
            self.assertEqual(code, 0, out + err)

    def test_a_tracing_ledger_on_generated_input(self):
        # The sourced/needs-rewrite rules on generated values: the price and
        # area match the sources, the years don't.
        cand, _ = self.extract(generated_input(2), 'trace')
        ledger = mechanical_ledger(cand)
        by_text = {c['text']: c for c in ledger['claims']}
        price = by_text['Our full detail from $119, with Ceramic Pro products.']
        price.update(text='full detail from $119', kind='price', status='sourced', suggestion='',
                     source={'field': 'services', 'quote': 'Full detail - $119'})
        years = by_text['Over 7 years of experience.']
        years.update(text='Over 7 years of experience', kind='years', status='needs-rewrite',
                     source={'field': 'about', 'quote': 'I started in 2012'}, suggestion='Detailing since 2012')
        ledger['counts'] = counts_of(ledger['claims'])
        errors, _ = vc.validate(ledger, cand)
        self.assertEqual(errors, [])
        years.update(status='sourced', suggestion='')
        ledger['counts'] = counts_of(ledger['claims'])
        errors, _ = vc.validate(ledger, cand)
        self.assertEqual(len(errors), 1)
        self.assertIn('the quote does not say 7', errors[0])

    def test_a_long_input_stays_within_the_limits(self):
        data = generated_input(0)
        data['checked'] = [{'where': 'site', 'path': 'aboutText[%d]' % i, 'text': 'Best detail number %d in town.' % i}
                           for i in range(450)]
        cand, cand_path = self.extract(data, 'long')
        self.assertEqual(len(cand['candidates']), 400)
        self.assertEqual(cand['candidates'][-1]['id'], 'c400')
        # What didn't fit is said, with where to start reading.
        self.assertIn('50 more sentences look like claims but are past the 400-candidate list, from [site] aboutText[400] on',
                      ' '.join(cand['problems']))
        ledger = mechanical_ledger(cand)
        errors, _ = vc.validate(ledger, cand)
        self.assertTrue(any('400 claims; the limit is 200' in e for e in errors), errors[:3])


if __name__ == '__main__':
    unittest.main(verbosity=2)
