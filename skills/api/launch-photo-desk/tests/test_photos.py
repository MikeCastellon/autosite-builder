"""Tests for the photo desk scripts, on sample photos drawn by samples.py
(no binaries in the repo). Needs Pillow and numpy (the container's Python
has them; locally use a scratch venv, never the repo):

  python3 skills/api/launch-photo-desk/tests/test_photos.py

The skill's whole workflow runs here end to end: find, analyze, review
sheets, zoom views, a draft built into photos.json, validation and the
final contact sheet. fixtures.json (tests/make_fixtures.py) holds the cases
the server's sanitizer runs too (src/lib/kit/photos.test.js).
"""
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.normpath(os.path.join(HERE, '..'))
SCRIPTS = os.path.join(SKILL, 'scripts')
sys.path.insert(0, SCRIPTS)
sys.path.insert(0, HERE)

import analyze  # noqa: E402
import build_photos  # noqa: E402
import common  # noqa: E402
import contact_sheet  # noqa: E402
import find_inputs  # noqa: E402
import inspect_photo  # noqa: E402
import make_fixtures  # noqa: E402
import samples  # noqa: E402
import validate_photos  # noqa: E402
from PIL import Image  # noqa: E402

ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')


def run(script, *args, cwd=None):
    """(exit code, stdout + stderr) of one script, run as the skill runs it."""
    p = subprocess.run([sys.executable, os.path.join(SCRIPTS, script)] + list(args), cwd=cwd, env=ENV,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
    return p.returncode, p.stdout


def overlap(a, b):
    """Intersection area of two (x, y, w, h) boxes, as a share of b."""
    ax0, ay0, ax1, ay1 = a[0], a[1], a[0] + a[2], a[1] + a[3]
    bx0, by0, bx1, by1 = b[0], b[1], b[0] + b[2], b[1] + b[3]
    w = max(0.0, min(ax1, bx1) - max(ax0, bx0))
    h = max(0.0, min(ay1, by1) - max(ay0, by0))
    return w * h / (b[2] * b[3])


def sample_draft(truth):
    """The draft a run would write for the sample set: blur boxes from the
    drawn plates (with a margin), as Claude reads them off the zoom views."""
    def plate(name):
        x, y, w, h = truth[name]['plate']
        return [{'x': x - w * 0.1, 'y': y - h * 0.1, 'w': w * 1.2, 'h': h * 1.2, 'kind': 'plate'}]
    return {
        'picks': [
            {'path': 'photo-1.jpg', 'role': 'hero', 'score': 9.1, 'reason': 'Sharp and wide, the whole car in even light',
             'alt': 'Red sedan parked on a driveway in front of a row of trees', 'blur': plate('photo-1.jpg')},
            {'path': 'photo-7.jpg', 'role': 'about', 'score': 7.4, 'reason': 'The owner, facing the camera',
             'alt': 'Person in a blue jacket standing in front of a white wall', 'focal': {'x': 0.5, 'y': 0.33}},
            {'path': 'photo-5.jpg', 'role': 'before', 'score': 7.0, 'reason': 'Same spot as photo-6, mud on the doors',
             'alt': 'White car in a shop with mud on the doors', 'blur': plate('photo-5.jpg')},
            {'path': 'photo-6.jpg', 'role': 'after', 'score': 8.0, 'reason': 'Clean, same framing as photo-5',
             'alt': 'The same white car in the shop, clean', 'blur': plate('photo-6.jpg'), 'zoom': {'phone': 0.9}},
        ],
        'skip': {
            'photo-2.jpg': 'Near-duplicate of photo-1',
            'photo-3.jpg': 'Out of focus: the whole car is soft',
            'photo-4.jpg': 'Too dark to show the car',
            'photo-8.png': 'Too small for the site',
            'photo-9.png': {'reason': 'A flyer, not a photo', 'score': 0},
        },
        'pairs': [{'before': 'photo-5.jpg', 'after': 'photo-6.jpg', 'note': 'Mud washed off the doors and wheels'}],
        'shotList': [
            'A finished car from the front corner, the whole car in frame, phone held sideways',
            'Before and after of the same car from the same spot',
            'You at work with your van behind you',
        ],
        'notes': [],
    }


class SampleSet(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix='photo-desk-test-')
        cls.inputs = os.path.join(cls.tmp, 'uploads')
        cls.truth = samples.make_set(cls.inputs)
        cls.work = os.path.join(cls.tmp, 'work')
        os.makedirs(cls.work)
        cls.analysis_path = os.path.join(cls.work, 'analysis.json')
        names = ','.join(sorted(cls.truth))
        code, out = run('analyze.py', '--names', names, '--root', cls.inputs, '--out', cls.analysis_path, cwd=cls.work)
        cls.analyze_out = out
        assert code == 0, out
        cls.analysis = common.load_json(cls.analysis_path)
        cls.by = {p['name']: p for p in cls.analysis['photos']}

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    # ── analyze.py ──

    def test_every_photo_measured_in_request_order(self):
        self.assertEqual([p['name'] for p in self.analysis['photos']], sorted(self.truth))
        self.assertEqual([p['n'] for p in self.analysis['photos']], list(range(1, 10)))
        self.assertIn('wrote', self.analyze_out)

    def test_displayed_size_follows_exif(self):
        p = self.by['photo-7.jpg']
        with Image.open(self.truth['photo-7.jpg']['path']) as im:
            self.assertEqual(im.size, (1400, 1000))  # stored sideways
        self.assertEqual((p['width'], p['height']), (1000, 1400))
        self.assertEqual(p['orientation'], 'portrait')

    def test_flags(self):
        flags = {n: set(p['flags']) for n, p in self.by.items()}
        self.assertEqual(flags['photo-1.jpg'], set())
        self.assertIn('blurry', flags['photo-3.jpg'])
        self.assertIn('dark', flags['photo-4.jpg'])
        self.assertIn('small', flags['photo-8.png'])
        self.assertIn('graphic', flags['photo-9.png'])
        for n in ('photo-1.jpg', 'photo-5.jpg', 'photo-6.jpg', 'photo-7.jpg'):
            self.assertFalse(flags[n] & {'blurry', 'dark', 'small', 'graphic'}, n)
        self.assertTrue(self.by['photo-1.jpg']['fits']['hero'])
        self.assertFalse(self.by['photo-3.jpg']['fits']['hero'])
        self.assertGreater(self.by['photo-1.jpg']['techScore'], self.by['photo-3.jpg']['techScore'] + 3)
        self.assertGreater(self.by['photo-1.jpg']['techScore'], self.by['photo-4.jpg']['techScore'])

    def test_near_duplicates_and_similar_pairs(self):
        groups = self.analysis['groups']
        self.assertEqual(len(groups), 1)
        self.assertEqual(sorted(groups[0]['members']), ['photo-1.jpg', 'photo-2.jpg'])
        dupes = [n for n in ('photo-1.jpg', 'photo-2.jpg') if self.by[n]['duplicateOf']]
        self.assertEqual(len(dupes), 1)
        self.assertIn('duplicate', self.by[dupes[0]]['flags'])
        # The before/after pair is similar, never a duplicate.
        pairs = {(s['a'], s['b']) for s in self.analysis['similar']}
        self.assertIn(('photo-5.jpg', 'photo-6.jpg'), pairs)
        self.assertIsNone(self.by['photo-5.jpg']['dupGroup'])

    def test_focal_point_lands_on_the_car(self):
        bx, by, bw, bh = samples.LAYOUTS['drive']
        f = self.by['photo-1.jpg']['focal']
        self.assertTrue(bx <= f['x'] <= bx + bw and by - 0.1 <= f['y'] <= by + bh, f)

    def test_missing_names_are_reported(self):
        out_path = os.path.join(self.work, 'a2.json')
        code, out = run('analyze.py', '--names', 'photo-1.jpg,nope.jpg', '--root', self.inputs, '--out', out_path, cwd=self.work)
        self.assertEqual(code, 0, out)
        self.assertIn('nope.jpg', out)
        self.assertEqual([p['name'] for p in common.load_json(out_path)['photos']], ['photo-1.jpg'])

    def test_unreadable_photo(self):
        bad = os.path.join(self.tmp, 'broken.jpg')
        with open(bad, 'wb') as f:
            f.write(b'\xff\xd8\xff\xe0not a jpeg at all')
        out_path = os.path.join(self.work, 'a3.json')
        code, out = run('analyze.py', bad, self.truth['photo-1.jpg']['path'], '--out', out_path)
        self.assertEqual(code, 0, out)
        a = common.load_json(out_path)
        self.assertIn('unreadable', a['photos'][0]['flags'])
        # Unreadable photos need no pick; picking one is an error.
        doc = {'version': 1, 'picks': [], 'pairs': [], 'shotList': ['a', 'b', 'c'], 'notes': []}
        draft = {'picks': [{'path': 'photo-1.jpg', 'role': 'hero', 'score': 8, 'reason': 'Wide', 'alt': 'Red car'}],
                 'skip': {'broken.jpg': 'Unreadable'}, 'pairs': [], 'shotList': ['a', 'b', 'c'], 'notes': ['broken.jpg could not be read']}
        with redirect_stdout(io.StringIO()):
            doc, problems = build_photos.build(draft, a)
        self.assertEqual(problems, [])
        self.assertEqual([p['path'] for p in doc['picks']], ['photo-1.jpg'])
        errors, _ = validate_photos.validate(doc, a)
        self.assertEqual(errors, [])
        doc['picks'].append(dict(doc['picks'][0], path='broken.jpg', role='skip'))
        errors, _ = validate_photos.validate(doc, a)
        self.assertTrue(any('could not be read' in e for e in errors), errors)

    # ── find_inputs.py ──

    def test_find_inputs(self):
        code, out = run('find_inputs.py', '--names', 'photo-7.jpg,photo-9.png', '--root', self.inputs)
        self.assertEqual(code, 0, out)
        files = json.loads(out)['files']
        self.assertEqual([f['name'] for f in files], ['photo-7.jpg', 'photo-9.png'])
        self.assertEqual(files[0]['displaySize'], [1000, 1400])
        code, out = run('find_inputs.py', '--names', 'missing.jpg', '--root', self.inputs)
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(out)['missing'], ['missing.jpg'])

    # ── contact_sheet.py review / inspect_photo.py ──

    def test_review_sheets(self):
        out_dir = os.path.join(self.work, 'sheets')
        code, out = run('contact_sheet.py', 'review', '--analysis', self.analysis_path, '--out-dir', out_dir, '--per-sheet', '4')
        self.assertEqual(code, 0, out)
        sheets = sorted(os.listdir(out_dir))
        self.assertEqual(sheets, ['sheet-1.jpg', 'sheet-2.jpg', 'sheet-3.jpg'])
        with Image.open(os.path.join(out_dir, 'sheet-1.jpg')) as im:
            self.assertEqual(im.width, 1568)
        self.assertIn('#9 photo-9.png', out)

    def test_zoom_views(self):
        out = os.path.join(self.work, 'view.jpg')
        code, text = run('inspect_photo.py', 'photo-1.jpg', '#7', '--analysis', self.analysis_path, '--out', out)
        self.assertEqual(code, 0, text)
        self.assertIn('photo-7.jpg', text)
        zoom = os.path.join(self.work, 'zoom.jpg')
        code, text = run('inspect_photo.py', 'photo-1.jpg', '--region', '0.6,0.55,0.25,0.2', '--analysis', self.analysis_path, '--out', zoom)
        self.assertEqual(code, 0, text)
        with Image.open(zoom) as im:
            self.assertGreater(im.width, 1000)  # a small region is enlarged
        code, text = run('inspect_photo.py', 'nope.jpg', '--analysis', self.analysis_path, '--out', zoom)
        self.assertEqual(code, 1)

    # ── build_photos.py → validate_photos.py → contact_sheet.py final ──

    def build_sample(self):
        draft_path = os.path.join(self.work, 'draft.json')
        common.write_json(draft_path, sample_draft(self.truth))
        out = os.path.join(self.work, 'photos.json')
        code, text = run('build_photos.py', draft_path, '--analysis', self.analysis_path, '--out', out)
        return code, text, out

    def test_build_validate_and_final_sheet(self):
        code, text, out = self.build_sample()
        self.assertEqual(code, 0, text)
        self.assertIn('OK wrote', text)
        doc = common.load_json(out)
        self.assertEqual(sorted(p['path'] for p in doc['picks']), sorted(self.truth))
        for p in doc['picks']:
            info = self.by[p['path']]
            self.assertEqual((p['width'], p['height']), (info['width'], info['height']))
            for key, aspect in common.ASPECTS.items():
                b = p['crops'][key]
                self.assertLessEqual(common.aspect_error(b, p['width'], p['height'], aspect), common.ASPECT_TOLERANCE)
                self.assertLessEqual(b['x'] + b['w'], 1 + 1e-9)
                self.assertLessEqual(b['y'] + b['h'], 1 + 1e-9)
                self.assertTrue(b['x'] <= p['focal']['x'] <= b['x'] + b['w'], (p['path'], key))
        by = {p['path']: p for p in doc['picks']}
        self.assertEqual(by['photo-7.jpg']['focal'], {'x': 0.5, 'y': 0.33})
        self.assertEqual(by['photo-1.jpg']['focal'], self.by['photo-1.jpg']['focal'])
        self.assertLess(by['photo-6.jpg']['crops']['phone']['h'], 1)  # zoom 0.9
        self.assertEqual(by['photo-3.jpg']['score'], 4.3 if self.by['photo-3.jpg']['techScore'] <= 4.3 else 5.0)
        self.assertEqual(by['photo-9.png']['score'], 0)
        self.assertEqual(by['photo-3.jpg']['alt'], '')
        # Blur boxes cover the drawn plates.
        for name in ('photo-1.jpg', 'photo-5.jpg', 'photo-6.jpg'):
            b = by[name]['blur'][0]
            self.assertGreater(overlap((b['x'], b['y'], b['w'], b['h']), self.truth[name]['plate']), 0.99)
        code, text = run('validate_photos.py', out, '--analysis', self.analysis_path)
        self.assertEqual(code, 0, text)
        sheet = os.path.join(self.work, 'contact_sheet.png')
        code, text = run('contact_sheet.py', 'final', out, '--analysis', self.analysis_path, '--out', sheet)
        self.assertEqual(code, 0, text)
        with Image.open(sheet) as im:
            self.assertEqual(im.format, 'PNG')
            self.assertEqual(im.width, 1600)
        self.assertLess(os.path.getsize(sheet), contact_sheet.MAX_FINAL_BYTES)
        check = os.path.join(self.work, 'check.jpg')
        code, text = run('inspect_photo.py', 'photo-1.jpg', '--analysis', self.analysis_path, '--draft', out, '--out', check)
        self.assertEqual(code, 0, text)

    def test_contact_sheet_order(self):
        _, _, out = self.build_sample()
        doc = common.load_json(out)
        order = [p['path'] for p in contact_sheet.ordered(doc['picks'], doc['pairs'])]
        self.assertEqual(order[:4], ['photo-1.jpg', 'photo-7.jpg', 'photo-5.jpg', 'photo-6.jpg'])
        self.assertEqual(len(order), 9)

    def test_build_reports_what_to_fix(self):
        draft = sample_draft(self.truth)
        draft['picks'][0]['alt'] = 'The best detail in town'
        del draft['skip']['photo-4.jpg']
        draft['picks'].append({'path': 'photo-99.jpg', 'role': 'gallery'})
        draft_path = os.path.join(self.work, 'draft-bad.json')
        common.write_json(draft_path, draft)
        out = os.path.join(self.work, 'photos-bad.json')
        code, text = run('build_photos.py', draft_path, '--analysis', self.analysis_path, '--out', out)
        self.assertEqual(code, 1, text)
        self.assertIn('claims "best"', text)
        self.assertIn('photo-4.jpg', text)
        self.assertIn('photo-99.jpg is not in analysis.json', text)
        self.assertTrue(os.path.isfile(out))

    def test_build_tidies_numbers_and_text(self):
        draft = sample_draft(self.truth)
        draft['picks'][0].update({'score': 9.149, 'reason': '  Sharp\nand wide  ', 'focal': {'x': 0.123456, 'y': 1.4},
                                  'blur': [{'x': -0.01, 'y': 0.66, 'w': 0.081234, 'h': 0.05, 'kind': 'plate'}]})
        with redirect_stdout(io.StringIO()):
            doc, problems = build_photos.build(draft, self.analysis)
        self.assertEqual(problems, [])
        p = doc['picks'][0]
        self.assertEqual(p['score'], 9.1)
        self.assertEqual(p['reason'], 'Sharp and wide')
        self.assertEqual(p['focal'], {'x': 0.1235, 'y': 1.0})
        self.assertEqual(p['blur'][0], {'x': 0.0, 'y': 0.66, 'w': 0.0712, 'h': 0.05, 'kind': 'plate'})
        errors, _ = validate_photos.validate(doc, self.analysis)
        self.assertEqual(errors, [])

    def test_explicit_crop_is_checked(self):
        draft = sample_draft(self.truth)
        draft['picks'][0]['crops'] = {'phone': {'x': 0.1, 'y': 0, 'w': 0.4, 'h': 1}}
        with redirect_stdout(io.StringIO()):
            doc, _ = build_photos.build(draft, self.analysis)
        errors, _ = validate_photos.validate(doc, self.analysis)
        self.assertTrue(any('is not 4:5' in e for e in errors), errors)
        draft['picks'][0]['crops'] = {'phone': {'x': 0.1, 'y': 0, 'w': 0.5333, 'h': 1}}
        with redirect_stdout(io.StringIO()):
            doc, _ = build_photos.build(draft, self.analysis)
        self.assertEqual(doc['picks'][0]['crops']['phone'], {'x': 0.1, 'y': 0.0, 'w': 0.5333, 'h': 1.0})
        errors, _ = validate_photos.validate(doc, self.analysis)
        self.assertEqual(errors, [])

    def test_validator_warnings(self):
        draft = sample_draft(self.truth)
        draft['picks'][0]['alt'] = 'Red sedan with plate 7ABC123 and a stunning finish'
        draft['skip'].pop('photo-2.jpg')
        draft['picks'].append({'path': 'photo-2.jpg', 'role': 'gallery', 'score': 8, 'reason': 'Another angle',
                               'alt': 'Red sedan on a driveway'})
        draft['skip'].pop('photo-3.jpg')
        draft['picks'].append({'path': 'photo-3.jpg', 'role': 'gallery', 'score': 4, 'reason': 'Blue car',
                               'alt': 'Blue car on a street'})
        with redirect_stdout(io.StringIO()):
            doc, _ = build_photos.build(draft, self.analysis)
        errors, warnings = validate_photos.validate(doc, self.analysis)
        self.assertEqual(errors, [])
        text = '\n'.join(warnings)
        self.assertIn('plate-like token "7ABC123"', text)
        self.assertIn('says "stunning"', text)
        self.assertIn('near-duplicates both in use', text)
        self.assertIn('flagged it blurry', text)

    def test_odd_shapes_are_reported_not_crashed_on(self):
        draft = sample_draft(self.truth)
        draft['shotList'] = 'Shoot the car'
        draft['pairs'] = {'before': 'photo-5.jpg'}
        with redirect_stdout(io.StringIO()):
            doc, problems = build_photos.build(draft, self.analysis)
        self.assertIn('"shotList" must be a list', problems)
        self.assertIn('"pairs" must be a list', problems)
        self.assertEqual(doc['shotList'], [])
        doc['shotList'] = [{'shot': 'x'}, 'A', 'A', 7]
        doc['picks'][0]['blur'] = [{'x': 'a'}, 'plate']
        errors, _ = validate_photos.validate(doc, self.analysis)
        text = '\n'.join(errors)
        self.assertIn('shotList[0] must be a string', text)
        self.assertIn('shotList repeats a line', text)
        self.assertIn('blur[1] must be an object', text)
        for bad in (None, [], 'x', {'version': 1}):
            errors, _ = validate_photos.validate(bad, self.analysis)
            self.assertTrue(errors)

    def test_no_usable_photo(self):
        draft = {'picks': [], 'skip': {n: 'Not usable' for n in self.truth}, 'pairs': [],
                 'shotList': ['One', 'Two', 'Three'], 'notes': ['None of the photos can be used.']}
        with redirect_stdout(io.StringIO()):
            doc, problems = build_photos.build(draft, self.analysis)
        self.assertEqual(problems, [])
        errors, _ = validate_photos.validate(doc, self.analysis)
        self.assertEqual(errors, [])


class Fixtures(unittest.TestCase):
    """The cases src/lib/kit/photos.test.js runs against the sanitizer."""

    @classmethod
    def setUpClass(cls):
        with open(make_fixtures.OUT, encoding='utf-8') as f:
            cls.raw = f.read()
        cls.fx = json.loads(cls.raw)

    def analysis(self, extra=()):
        return {'photos': [{'name': p['name'], 'width': p['width'], 'height': p['height']}
                           for p in self.fx['photos'] + list(extra)]}

    def test_fixtures_are_current(self):
        self.assertEqual(self.raw, make_fixtures.render(), 'run python3 tests/make_fixtures.py')

    def test_crops(self):
        for c in self.fx['crops']:
            box = common.crop_for(c['width'], c['height'], c['focal'], common.ASPECTS[c['aspect']], c['zoom'])
            self.assertEqual(box, c['box'])
            err = common.aspect_error(box, c['width'], c['height'], common.ASPECTS[c['aspect']])
            self.assertLessEqual(err, common.ASPECT_TOLERANCE, c)

    def test_valid_passes(self):
        errors, warnings = validate_photos.validate(self.fx['valid'], self.analysis())
        self.assertEqual(errors, [])
        errors, _ = validate_photos.validate(self.fx['valid'])
        self.assertEqual(errors, [])

    def test_each_invalid_case_fails_for_its_reason(self):
        for case in self.fx['invalid']:
            errors, _ = validate_photos.validate(case['doc'], self.analysis(case.get('extraPhotos', [])))
            self.assertTrue(any(case['error'] in e for e in errors), '%s: %s' % (case['name'], errors))


class Contract(unittest.TestCase):
    def test_skill_md_frontmatter(self):
        with open(os.path.join(SKILL, 'SKILL.md'), encoding='utf-8') as f:
            text = f.read()
        m = re.match(r'^---\nname: (.+)\ndescription: (.+)\n---\n', text)
        self.assertTrue(m, 'frontmatter')
        self.assertEqual(m.group(1), 'launch-photo-desk')
        self.assertLessEqual(len(m.group(2)), 1024)
        self.assertNotRegex(m.group(2), r'<[a-z]')
        self.assertLess(text.count('\n'), 200)
        for ref in re.findall(r'\]\(((?:references|data)/[^)#]+)', text):
            self.assertTrue(os.path.isfile(os.path.join(SKILL, ref)), ref)
        for script in set(re.findall(r'scripts/([a-z_]+\.py)', text)):
            self.assertTrue(os.path.isfile(os.path.join(SCRIPTS, script)), script)

    def test_line_endings_and_no_shebangs(self):
        for root, _, files in os.walk(SKILL):
            for name in files:
                if name.endswith(('.py', '.md', '.json')):
                    with open(os.path.join(root, name), 'rb') as f:
                        data = f.read()
                    self.assertNotIn(b'\r\n', data, name)
                    self.assertFalse(data.startswith(b'#!'), name)

    def test_shot_list_data(self):
        data = common.load_json(os.path.join(common.DATA, 'shot_list.json'))
        types = {'any', 'detailing_shop', 'mobile_detailing', 'tint_shop', 'wheel_shop', 'mechanic_shop', 'car_wash', 'other'}
        self.assertEqual(set(data['shots']), types)
        for shots in data['shots'].values():
            for s in shots:
                self.assertLessEqual(len(s['shot']), common.LIMITS['shot'])
                self.assertEqual(common.claim_in(s['shot']), '', s['shot'])

    def test_claim_words(self):
        self.assertEqual(common.claim_in('The BEST shine'), 'BEST')
        self.assertEqual(common.claim_in('Bestow'), '')
        self.assertEqual(common.claim_in('Rated #1 in town'), '#1')
        self.assertEqual(common.soft_claim_in('A stunning red car'), 'stunning')
        self.assertTrue(common.IMAGE_OF.search('Photo of a red car'))
        self.assertFalse(common.IMAGE_OF.search('Photographer at work'))
        # The server's JavaScript regexes fold and break words in ASCII only:
        # the same texts count here (src/lib/kit/photos.test.js checks these too).
        self.assertEqual(common.claim_in('be\u017ft'), '')
        self.assertTrue(common.IMAGE_OF.search('Photo of\u00e9t\u00e9'))
        self.assertTrue(common.PLATE_LIKE.search('plate 7ABC123'))
        self.assertFalse(common.PLATE_LIKE.search('A 2024 BMW X5 in the shop'))

    def test_one_line_matches_js(self):
        self.assertEqual(common.one_line('  a\xa0 b\n\tc\u2028d\ufeff '), 'a b c d')
        self.assertEqual(common.js_length('\U0001F697car'), 5)
        self.assertEqual(common.js_round(0.12345, 4), 0.1235)


if __name__ == '__main__':
    unittest.main(verbosity=1)
