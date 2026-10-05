"""End-to-end checks of the skill's scripts on generated sample logos.

Needs Pillow and numpy (as in the code-execution container); skipped
without them. Everything is written to a temporary folder.

Run: python3 skills/api/launch-brand-system/tests/test_scripts.py
"""
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

try:
    from PIL import Image, ImageDraw
    import numpy  # noqa: F401
    HAVE_LIBS = True
except ImportError:
    HAVE_LIBS = False

ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')


def run(script, *args, env=None):
    p = subprocess.run([sys.executable, os.path.join(SCRIPTS, script)] + list(args),
                       capture_output=True, text=True, env=env or ENV)
    return p.returncode, p.stdout, p.stderr


def antialiased(path, size, draw_fn, mode='RGBA', bg=(0, 0, 0, 0), scale=4, **save):
    big = Image.new(mode, (size[0] * scale, size[1] * scale), bg)
    draw_fn(ImageDraw.Draw(big), scale)
    big.resize(size, Image.LANCZOS).save(path, **save)


def good_brand():
    import theme
    alts = theme.alternates({'bg': '#0e0e10', 'secondary': '#1a1a1d', 'text': '#f5f5f5', 'muted': '#a1a1aa', 'accent': '#c8102e'})
    return {
        'version': 1,
        'palette': dict(alts['dark']),
        'alternates': alts,
        'fonts': {'heading': 'Bebas Neue', 'body': 'Barlow'},
        'reasons': {'palette': 'Dark page like the logo badge.', 'accent': 'The logo red.', 'fonts': 'Street pairing.'},
        'logo': {'dominant': ['#c8102e', '#111111'], 'background': 'transparent', 'hasText': True},
        'notes': [],
    }


@unittest.skipUnless(HAVE_LIBS, 'Pillow and numpy are needed')
class Scripts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix='brand-skill-test-')
        t = cls.tmp

        def red_logo(d, s):
            d.ellipse([20 * s, 20 * s, 180 * s, 180 * s], fill=(200, 16, 46, 255))
            for i in range(5):
                d.rectangle([(210 + i * 70) * s, 70 * s, (260 + i * 70) * s, 130 * s], fill=(17, 17, 17, 255))
            d.rectangle([210 * s, 150 * s, 560 * s, 158 * s], fill=(250, 204, 21, 255))
        antialiased(os.path.join(t, 'logo-1.png'), (600, 200), red_logo)

        def navy_orange(d, s):
            for i in range(4):
                d.rectangle([(60 + i * 90) * s, 80 * s, (130 + i * 90) * s, 160 * s], fill=(30, 58, 138))
            d.pieslice([40 * s, 20 * s, 460 * s, 260 * s], 200, 340, fill=(249, 115, 22))
        antialiased(os.path.join(t, 'logo-2.jpg'), (500, 250), navy_orange, mode='RGB', bg=(255, 255, 255), quality=90)

        def mono(d, s):
            for i in range(6):
                d.rectangle([(30 + i * 60) * s, 40 * s, (70 + i * 60) * s, 110 * s], fill=(240, 240, 240))
        antialiased(os.path.join(t, 'logo-3.png'), (420, 150), mono, mode='RGB', bg=(0, 0, 0))

        with open(os.path.join(t, 'logo-4.svg'), 'w') as f:
            f.write('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#0F766E" width="9" height="9"/>'
                    '<path style="fill:#fbbf24" d="M0 0h1"/><text font-family="Montserrat">A</text></svg>')

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def path(self, name):
        return os.path.join(self.tmp, name)

    # extract_palette.py

    def test_transparent_logo(self):
        code, out, err = run('extract_palette.py', self.path('logo-1.png'), '--raster-dir', self.path('raster'))
        self.assertEqual(code, 0, err)
        r = json.loads(out)
        self.assertEqual(r['background'], 'transparent')
        self.assertFalse(r['monochrome'])
        hexes = [c['hex'] for c in r['dominant']]
        self.assertEqual(hexes[:2], ['#c8102e', '#111111'])
        self.assertEqual(r['accentCandidates'][0]['hex'], '#c8102e')
        self.assertIn('#fbcc15', [c['hex'] for c in r['accentCandidates']])
        self.assertTrue(os.path.isfile(r['raster']))
        self.assertEqual(r['logoField']['background'], 'transparent')

    def test_logo_on_white_has_no_antialias_colors(self):
        code, out, err = run('extract_palette.py', self.path('logo-2.jpg'))
        self.assertEqual(code, 0, err)
        r = json.loads(out)
        self.assertEqual((r['background'], r['backgroundColor']), ('light', '#ffffff'))
        self.assertEqual(len(r['dominant']), 2, r['dominant'])
        import theme
        for c, want in zip(r['dominant'], ('#f97316', '#1e3a8a')):
            self.assertLess(theme.contrast_ratio(c['hex'], want), 1.05, (c, want))  # JPEG noise only

    def test_monochrome_logo(self):
        r = json.loads(run('extract_palette.py', self.path('logo-3.png'))[1])
        self.assertEqual(r['background'], 'dark')
        self.assertTrue(r['monochrome'])
        self.assertEqual(len(r['dominant']), 1)
        self.assertEqual(r['accentCandidates'], [])

    def test_vector_svg_reads_source_colors(self):
        code, out, _ = run('extract_palette.py', self.path('logo-4.svg'))
        r = json.loads(out)
        self.assertEqual(code, 0)
        self.assertIsNone(r['decoded'])
        self.assertEqual([c['hex'] for c in r['svgColors']], ['#0f766e', '#fbbf24'])
        self.assertEqual(r['fontNames'], ['Montserrat'])

    def test_extract_is_deterministic(self):
        a = run('extract_palette.py', self.path('logo-2.jpg'))[1]
        b = run('extract_palette.py', self.path('logo-2.jpg'))[1]
        self.assertEqual(a, b)

    # validate_brand.py

    def write(self, name, data):
        with open(self.path(name), 'w') as f:
            json.dump(data, f)
        return self.path(name)

    def test_valid_brand_passes(self):
        code, out, _ = run('validate_brand.py', self.write('ok.json', good_brand()))
        self.assertEqual(code, 0, out)
        self.assertIn('OK', out)

    def test_invalid_brand_lists_every_error(self):
        b = good_brand()
        b['palette']['accent'] = '#C8102E'
        b['alternates']['light']['muted'] = '#cccccc'
        b['fonts'] = {'heading': 'Gotham', 'body': 'Bebas Neue'}
        b['logo']['background'] = 'white'
        b['extra'] = 1
        del b['notes']
        code, out, _ = run('validate_brand.py', self.write('bad.json', b))
        self.assertEqual(code, 1, out)
        for needle in ('palette.accent must be a lowercase', 'alternates.light: muted #cccccc renders as #6b6b6b',
                       'theme.py repair suggests', "fonts.heading 'Gotham'", "fonts.body 'Bebas Neue' can't carry",
                       'logo.background', 'extra', 'missing notes'):
            self.assertIn(needle, out)

    def test_main_palette_must_match_its_alternate(self):
        b = good_brand()
        b['alternates']['dark'] = dict(b['palette'], secondary='#202024')
        code, out, _ = run('validate_brand.py', self.write('mismatch.json', b))
        self.assertEqual(code, 1)
        self.assertIn('alternates.dark must be an exact copy', out)

    def test_limits_match_the_server(self):
        # src/lib/brandSpec.js: logo may be null, at most 8 notes, one-line text.
        b = good_brand()
        b['logo'] = None
        self.assertEqual(run('validate_brand.py', self.write('nologo.json', b))[0], 0)
        b['notes'] = ['n%d' % i for i in range(9)]
        b['reasons']['fonts'] = 'Street pairing.\nSecond line.'
        b['logo'] = {'dominant': [], 'background': 'light', 'hasText': False}
        code, out, _ = run('validate_brand.py', self.write('limits.json', b))
        self.assertEqual(code, 1)
        for needle in ('notes must be a list of at most 8', 'reasons.fonts must be one plain line', 'logo.dominant is empty'):
            self.assertIn(needle, out)
        # The server's caps count UTF-16 units (JS .length): 200 emoji are 400.
        b = good_brand()
        b['notes'] = ['\U0001F697' * 200]
        code, out, _ = run('validate_brand.py', self.write('emoji.json', b))
        self.assertEqual(code, 1, out)
        self.assertIn('notes[0] is 400 characters', out)
        b['notes'] = ['\U0001F697' * 150]
        self.assertEqual(run('validate_brand.py', self.write('emoji-ok.json', b))[0], 0)

    def test_unreadable_brand_json(self):
        with open(self.path('broken.json'), 'w') as f:
            f.write('{"version": 1,')
        self.assertEqual(run('validate_brand.py', self.path('broken.json'))[0], 2)

    # brand_board.py

    def test_board_renders_at_contract_size(self):
        brand = self.write('board-brand.json', good_brand())
        meta = self.write('meta.json', {'name': 'Joe\'s "Fast" $(Detail)', 'headline': 'Clean cars, clear prices'})
        for logo, state in ((self.path('logo-1.png'), 'drawn'), (None, 'none'), (self.path('logo-4.svg'), 'unreadable')):
            out = self.path('board-%s.png' % state)
            args = [brand, '--out', out, '--meta', meta] + (['--logo', logo] if logo else [])
            code, stdout, err = run('brand_board.py', *args)
            self.assertEqual(code, 0, err)
            info = json.loads(stdout)
            self.assertEqual(info['logo'], state)
            with Image.open(out) as im:
                self.assertEqual(im.size, (1600, 1000))
            self.assertLess(os.path.getsize(out), 2 * 1024 * 1024)

    def test_board_refuses_a_brand_without_palette(self):
        code, _, err = run('brand_board.py', self.write('empty.json', {}), '--out', self.path('x.png'))
        self.assertEqual(code, 1)
        self.assertIn('validate_brand.py', err)

    # find_inputs.py, fonts.py, theme.py CLIs

    def test_find_inputs(self):
        env = dict(ENV, INPUT_DIR=self.tmp)
        code, out, _ = run('find_inputs.py', '--names', 'logo-1.png,logo-2.jpg', env=env)
        self.assertEqual(code, 0)
        files = json.loads(out)['files']
        self.assertEqual([f['name'] for f in files], ['logo-1.png', 'logo-2.jpg'])
        self.assertEqual(files[0]['kind'], 'logo')
        self.assertEqual(files[0]['size'], [600, 200])
        code, out, _ = run('find_inputs.py', '--names', 'logo-1.png,missing.png', env=env)
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(out)['missing'], ['missing.png'])

    def test_cli_exit_codes(self):
        self.assertEqual(run('fonts.py', 'check', 'Bebas Neue', 'Barlow')[0], 0)
        self.assertEqual(run('fonts.py', 'check', 'Barlow', 'Bebas Neue')[0], 1)
        code, out, _ = run('fonts.py', 'rank', '--styles', '["Rugged & industrial"]', '--type', 'mechanic_shop', '--top', '1')
        self.assertEqual(code, 0)
        self.assertTrue(out.startswith('workshop') or out.startswith('heavy_duty'), out)
        by_label = run('fonts.py', 'rank', '--styles', 'Rugged & industrial', '--type', 'Mechanic / repair', '--top', '1')[1]
        self.assertEqual(by_label, out)
        with open(self.path('fonts.txt'), 'w') as f:
            f.write('We use "Gotham" and $(Open Sans)')
        found = json.loads(run('fonts.py', 'match', '--file', self.path('fonts.txt'))[1])
        self.assertEqual(found[0]['lookalikes'][0], 'Montserrat')
        self.assertEqual(run('theme.py', 'check', json.dumps(good_brand()['palette']))[0], 0)
        bad = {'bg': '#ffffff', 'secondary': '#333333', 'text': '#999999', 'muted': '#cccccc', 'accent': '#808080'}
        self.assertEqual(run('theme.py', 'check', json.dumps(bad))[0], 1)
        fixed = json.loads(run('theme.py', 'repair', json.dumps(bad))[1])['palette']
        self.assertEqual(run('theme.py', 'check', json.dumps(fixed))[0], 0)


if __name__ == '__main__':
    unittest.main(verbosity=1)
