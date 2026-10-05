"""Parity: scripts/theme.py and scripts/fonts.py against the JS they port.

The fixtures are computed from the JS modules by
src/lib/brandTheme.fixtures.test.js (UPDATE_SKILL_FIXTURES=1 rewrites them).
Hex outputs must match exactly; luminance and contrast ratios to 1e-12
(JS and Python may call different pow() implementations, a last-ulp
difference at most).

Run: python3 skills/api/launch-brand-system/tests/test_theme.py
"""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'scripts'))
sys.dont_write_bytecode = True

import theme  # noqa: E402
import fonts  # noqa: E402


def load(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return json.load(f)


FIX = load('theme_fixtures.json')
RANK = load('fonts_fixtures.json')


class ThemeParity(unittest.TestCase):
    def assertClose(self, a, b, msg=None):
        self.assertTrue(abs(a - b) <= 1e-12 * max(1.0, abs(b)), '%r != %r %s' % (a, b, msg or ''))

    def test_hex_to_rgb(self):
        for value, want in FIX['hexToRgb']:
            self.assertEqual(theme.hex_to_rgb(value), want, repr(value))

    def test_rgb_to_hex(self):
        for (r, g, b), want_args, want_obj in FIX['rgbToHex']:
            self.assertEqual(theme.rgb_to_hex(r, g, b), want_args, (r, g, b))
            self.assertEqual(theme.rgb_to_hex({'r': r, 'g': g, 'b': b}), want_obj, (r, g, b))

    def test_mix(self):
        for a, b, t, want in FIX['mix']:
            self.assertEqual(theme.mix(a, b, t), want, (a, b, t))

    def test_alpha(self):
        for color, a, want in FIX['alpha']:
            self.assertEqual(theme.alpha(color, a), want, (color, a))

    def test_luminance_is_dark_readable_on(self):
        for color, lum, dark, readable in FIX['luminance']:
            self.assertClose(theme.luminance(color), lum, color)
            self.assertEqual(theme.is_dark(color), dark, color)
            self.assertEqual(theme.readable_on(color), readable, color)

    def test_contrast_ratio(self):
        for a, b, want in FIX['contrastRatio']:
            self.assertClose(theme.contrast_ratio(a, b), want, (a, b))

    def test_ensure_contrast(self):
        for fg, bg, min_ratio, want in FIX['ensureContrast']:
            self.assertEqual(theme.ensure_contrast(fg, bg, min_ratio), want, (fg, bg, min_ratio))

    def test_derive_theme(self):
        for palette, want, pairs in FIX['deriveTheme']:
            got = theme.derive_theme(palette)
            self.assertEqual(got, want, palette)
            if isinstance(palette, dict) or palette is None:
                ratios = theme.pair_ratios(palette)
                for key, value in pairs.items():
                    self.assertClose(ratios[key], value, (palette, key))


class RepairPalette(unittest.TestCase):
    def test_every_fixture_palette_repairs_to_a_passing_fixed_point(self):
        for palette, _, _ in FIX['deriveTheme']:
            if not isinstance(palette, dict) or any(theme.normalize(palette.get(r)) is None for r in theme.ROLES):
                continue
            fixed, _ = theme.repair_palette(palette)
            self.assertEqual(theme.palette_problems(fixed), [], (palette, fixed))
            self.assertEqual(fixed['bg'], theme.normalize(palette['bg']))

    def test_a_passing_palette_is_left_alone(self):
        p = {'bg': '#0b0b0d', 'secondary': '#17171a', 'text': '#f5f5f5', 'muted': '#a8a8ad', 'accent': '#e11d48'}
        self.assertEqual(theme.palette_problems(p), [])
        self.assertEqual(theme.repair_palette(p), (p, []))

    def test_propose_and_alternates_pass(self):
        for accent in ('#cc0000', '#f59e0b', '#2563eb', '#16a34a', '#808080', '#ffffff', '#000000', '#7c3aed'):
            for mode in ('light', 'dark'):
                p = theme.propose(accent, mode)
                self.assertEqual(theme.palette_problems(p), [], (accent, mode, p))
                self.assertEqual(theme.is_dark(p['bg']), mode == 'dark', (accent, mode))
            alts = theme.alternates(theme.propose(accent, 'dark'))
            self.assertFalse(theme.is_dark(alts['light']['bg']))
            self.assertTrue(theme.is_dark(alts['dark']['bg']))


class FontsParity(unittest.TestCase):
    def test_rank_pairings(self):
        for args, want in RANK['rankPairings']:
            got = fonts.rank(args['styles'], args['businessType'], args['mood'])
            self.assertEqual([[p['id'], p['fits'], p['score'], p['reasons']] for p in got], want, args)

    def test_pairings_use_catalog_families(self):
        for p in fonts.PAIRINGS:
            self.assertEqual(fonts.pair_problems(p['heading'], p['body']), [], p['id'])

    def test_match(self):
        got = fonts.match('Gotham, montserrat bold; Comic Sans and Barlow Condensed')
        self.assertEqual([m['asked'] for m in got], ['Gotham', 'montserrat', 'Comic Sans', 'Barlow Condensed'])
        self.assertEqual(got[0]['lookalikes'][0], 'Montserrat')
        self.assertEqual(got[1]['family'], 'Montserrat')
        self.assertEqual(got[2], {'asked': 'Comic Sans', 'family': None, 'lookalikes': []})
        self.assertEqual(got[3]['family'], 'Barlow Condensed')
        self.assertEqual(fonts.match('We use "Gotham" for everything')[0]['asked'], 'Gotham')
        self.assertEqual(fonts.match(''), [])


if __name__ == '__main__':
    unittest.main(verbosity=1)
