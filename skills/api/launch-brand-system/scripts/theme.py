"""Color math of the site's theme engine, ported from
src/components/preview/templates/kit/theme.js (deriveTheme + helpers).

A published site never shows the palette as given: deriveTheme() repairs
text, muted and accent-as-text to 4.5:1 and picks the label color on accent
buttons. A brand system must be judged on what the site will actually paint,
so this is a line-by-line port, JS quirks included (Math.round rounds halves
up, ensureContrast's 18-step search and its 0.01 nudge). tests/test_theme.py
checks it against tests/theme_fixtures.json, which
src/lib/brandTheme.fixtures.test.js computes from the JS module.

On top of the port: pair_ratios() (the 4 pairs a brand must pass),
repair_palette() (makes a palette pass and makes text/muted exactly what the
site renders), propose() / alternates() (mechanical starting points).

CLI (palette = JSON string or a path to a JSON file):
  theme.py check  PALETTE|brand.json   ratios of the 4 pairs, exit 1 on a fail
  theme.py repair PALETTE              passing palette + what changed
  theme.py derive PALETTE              every token deriveTheme returns
  theme.py propose '#cc0000' light|dark   full palette around one brand color
  theme.py alternates PALETTE          {"light": .., "dark": ..} for this palette
  theme.py ratio '#ffffff' '#cc0000'   contrast of two colors
"""
import json
import math
import os
import re
import sys
from decimal import Decimal, ROUND_HALF_UP

ROLES = ('bg', 'secondary', 'text', 'muted', 'accent')
MIN_RATIO = 4.5

# ─── JS semantics the port depends on ─────────────────────────────────

# JS \s and String.prototype.trim(): WhiteSpace + LineTerminator. Python's
# \s and str.strip() differ (\x1c-\x1f yes, ﻿ no), so spell it out.
_JS_WS_CHARS = (
    '\t\n\x0b\x0c\r   ' + ''.join(chr(c) for c in range(0x2000, 0x200b))
    + '    　﻿'
)
_JS_WS = re.escape(_JS_WS_CHARS)

# re.ASCII: JS \d and /i (without the u flag) never match non-ASCII.
HEX_RE = re.compile(r'^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\Z', re.I | re.A)
RGB_RE = re.compile(
    r'^rgba?\([{ws}]*([0-9.]+)[{ws}]*[, ][{ws}]*([0-9.]+)[{ws}]*[, ][{ws}]*([0-9.]+)'.format(ws=_JS_WS),
    re.I | re.A,
)


def _js_number(v):
    """Number(v) for the values this module sees (NaN as float('nan')).
    None is JS null (0): JSON fixtures carry null, and a JS `undefined`
    argument is a Python default argument instead."""
    if v is None:
        return 0.0
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip(_JS_WS_CHARS)
        if s == '':
            return 0.0
        try:
            # Only digits and dots reach here from RGB_RE; float() would also
            # take '1_0' or 'inf', which JS rejects.
            if not re.fullmatch(r'[0-9]*\.?[0-9]*', s, re.A) or s == '.':
                return float('nan')
            return float(s)
        except ValueError:
            return float('nan')
    return float('nan')


def _js_round(x):
    """Math.round: halves go up (toward +Infinity), unlike Python's round()."""
    if not math.isfinite(x):
        return x
    f = math.floor(x)
    return f + 1 if x - f >= 0.5 else f


def _clamp255(n):
    v = _js_number(n)
    if v != v or v == 0:  # `Number(n) || 0`
        v = 0.0
    return int(max(0, min(255, _js_round(v))))


def _js_num_str(x):
    """String(number) for the short decimals alpha() prints."""
    if math.isfinite(x) and x == int(x):
        return str(int(x))
    return repr(x)


# ─── Port of kit/theme.js ─────────────────────────────────────────────

def hex_to_rgb(value):
    """'#abc' | '#aabbcc' | '#aabbccdd' | 'rgb(1,2,3)' -> {'r','g','b'} or None."""
    if not isinstance(value, str):
        return None
    s = value.strip(_JS_WS_CHARS)
    rgb = RGB_RE.match(s)
    if rgb:
        return {'r': _clamp255(rgb.group(1)), 'g': _clamp255(rgb.group(2)), 'b': _clamp255(rgb.group(3))}
    m = HEX_RE.match(s)
    if not m:
        return None
    h = m.group(1)
    if len(h) <= 4:
        h = ''.join(ch + ch for ch in h)
    return {'r': int(h[0:2], 16), 'g': int(h[2:4], 16), 'b': int(h[4:6], 16)}


def rgb_to_hex(r, g=None, b=None):
    """rgb_to_hex({'r','g','b'}) or rgb_to_hex(r, g, b) -> '#rrggbb' (lowercase)."""
    if isinstance(r, dict):
        r, g, b = r.get('r'), r.get('g'), r.get('b')
    elif isinstance(r, (list, tuple)):
        r, g, b = None, None, None  # JS destructures r/g/b off an array: undefined
    return '#' + ''.join('%02x' % _clamp255(n) for n in (r, g, b))


def normalize(color):
    rgb = hex_to_rgb(color)
    return rgb_to_hex(rgb) if rgb else None


def mix(a, b, t=0.5):
    """Linear blend in sRGB: t=0 -> a, t=1 -> b."""
    ca = hex_to_rgb(a)
    cb = hex_to_rgb(b)
    if not ca or not cb:
        return normalize(a) or normalize(b) or '#000000'
    k = _js_number(t)
    if k != k or k == 0:
        k = 0.0
    k = max(0.0, min(1.0, k))
    return rgb_to_hex(
        ca['r'] + (cb['r'] - ca['r']) * k,
        ca['g'] + (cb['g'] - ca['g']) * k,
        ca['b'] + (cb['b'] - ca['b']) * k,
    )


def alpha(color, a=1):
    """alpha('#ff0000', 0.2) -> 'rgba(255, 0, 0, 0.2)'"""
    c = hex_to_rgb(color) or {'r': 0, 'g': 0, 'b': 0}
    n = _js_number(a)
    k = max(0.0, min(1.0, n if math.isfinite(n) else 1.0))
    # `+k.toFixed(3)`: toFixed rounds the exact binary value, halves up.
    k3 = float(Decimal(k).quantize(Decimal('0.001'), rounding=ROUND_HALF_UP))
    return 'rgba(%d, %d, %d, %s)' % (c['r'], c['g'], c['b'], _js_num_str(k3))


def luminance(color):
    """WCAG 2.x relative luminance, 0 (black) .. 1 (white). Invalid -> 0."""
    c = hex_to_rgb(color)
    if not c:
        return 0

    def lin(v):
        s = v / 255
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4

    return 0.2126 * lin(c['r']) + 0.7152 * lin(c['g']) + 0.0722 * lin(c['b'])


def contrast_ratio(a, b):
    la = luminance(a)
    lb = luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def is_dark(color):
    """True when white text reads better than black text on this color."""
    return contrast_ratio(color, '#ffffff') > contrast_ratio(color, '#000000')


def readable_on(bg, light='#ffffff', dark='#111111'):
    return light if contrast_ratio(light, bg) >= contrast_ratio(dark, bg) else dark


def ensure_contrast(fg, bg, min_ratio=4.5):
    """fg unchanged when it reaches min_ratio on bg; else the smallest blend
    toward white or black that does; else the better extreme."""
    if not hex_to_rgb(bg):
        return normalize(fg) or fg
    if not hex_to_rgb(fg):
        return readable_on(bg)
    if contrast_ratio(fg, bg) >= min_ratio:
        return fg

    def solve(target):
        if contrast_ratio(target, bg) < min_ratio:
            return None
        lo = 0.0
        hi = 1.0
        for _ in range(18):
            mid_t = (lo + hi) / 2
            if contrast_ratio(mix(fg, target, mid_t), bg) >= min_ratio:
                hi = mid_t
            else:
                lo = mid_t
        # Rounding to 8-bit channels can land a hair under the target; step on.
        t = hi
        out = mix(fg, target, t)
        while contrast_ratio(out, bg) < min_ratio and t < 1:
            t = min(1, t + 0.01)
            out = mix(fg, target, t)
        return t, out

    up = solve('#ffffff')
    down = solve('#000000')
    if up and down:
        return up[1] if up[0] <= down[0] else down[1]
    if up:
        return up[1]
    if down:
        return down[1]
    return '#ffffff' if contrast_ratio('#ffffff', bg) >= contrast_ratio('#000000', bg) else '#000000'


DEFAULTS = {'bg': '#ffffff', 'accent': '#2563eb'}


def _readable_on_both(fg, bg, surface):
    on_bg = ensure_contrast(fg, bg, 4.5)
    if contrast_ratio(on_bg, surface) >= 4.5:
        return on_bg
    both = ensure_contrast(on_bg, surface, 4.5)
    return both if contrast_ratio(both, bg) >= 4.5 else on_bg


def derive_theme(colors):
    """templateMeta.colors -> the token set templates paint with (same keys as JS)."""
    src = colors if isinstance(colors, dict) else {}

    raw_text = normalize(src.get('text'))
    bg = normalize(src.get('bg')) or (readable_on(raw_text, '#ffffff', '#111111') if raw_text else DEFAULTS['bg'])
    dark = is_dark(bg)

    base_text = ensure_contrast(raw_text or ('#ffffff' if dark else '#111111'), bg, 4.5)
    surface = normalize(src.get('secondary')) or mix(bg, base_text, 0.06 if dark else 0.04)
    surface_alt = mix(surface, base_text, 0.07 if dark else 0.05)
    text = _readable_on_both(base_text, bg, surface)
    text_muted = _readable_on_both(normalize(src.get('muted')) or mix(text, bg, 0.38), bg, surface)
    accent = normalize(src.get('accent')) or DEFAULTS['accent']
    accent_text = _readable_on_both(accent, bg, surface)

    scrim_base = mix(bg, '#000000', 0.35) if dark else '#0b0c10'

    return {
        'bg': bg,
        'surface': surface,
        'surfaceAlt': surface_alt,
        'text': text,
        'textMuted': text_muted,
        'accent': accent,
        'onAccent': readable_on(accent),
        'accentText': accent_text,
        'accentSoft': alpha(accent, 0.16 if dark else 0.1),
        'border': alpha(text, 0.16 if dark else 0.12),
        'borderStrong': alpha(text, 0.32 if dark else 0.26),
        'focus': accent_text,
        'heroScrim': 'linear-gradient(180deg, %s 0%%, %s 50%%, %s 100%%)' % (
            alpha(scrim_base, 0.5), alpha(scrim_base, 0.62), alpha(scrim_base, 0.85)),
        'heroScrimLeft': 'linear-gradient(90deg, %s 0%%, %s 50%%, %s 100%%)' % (
            alpha(scrim_base, 0.88), alpha(scrim_base, 0.66), alpha(scrim_base, 0.3)),
        'onHero': '#ffffff',
        'isDark': dark,
    }


# ─── Brand checks on top of the port ──────────────────────────────────

PAIR_KEYS = ('text/bg', 'muted/bg', 'onAccent/accent', 'text/secondary')


def pair_ratios(palette):
    """The 4 pairs every brand palette must pass, measured on the tokens the
    site paints (after deriveTheme's repair)."""
    t = derive_theme(palette)
    return {
        'text/bg': contrast_ratio(t['text'], t['bg']),
        'muted/bg': contrast_ratio(t['textMuted'], t['bg']),
        'onAccent/accent': contrast_ratio(t['onAccent'], t['accent']),
        'text/secondary': contrast_ratio(t['text'], t['surface']),
    }


def palette_problems(palette):
    """[] when the palette is valid as given; else one line per problem."""
    out = []
    if not isinstance(palette, dict):
        return ['palette is not an object']
    for role in ROLES:
        v = palette.get(role)
        if not isinstance(v, str) or not re.fullmatch(r'#[0-9a-f]{6}', v, re.A):
            out.append('%s must be a lowercase #rrggbb color (got %r)' % (role, v))
    if out:
        return out
    ratios = pair_ratios(palette)
    for key in PAIR_KEYS:
        if ratios[key] < MIN_RATIO:
            out.append('%s is %.2f:1, needs %.1f:1' % (key, ratios[key], MIN_RATIO))
    t = derive_theme(palette)
    if t['text'] != palette['text']:
        out.append('text %s renders as %s on the site (contrast repair): use %s' % (palette['text'], t['text'], t['text']))
    if t['textMuted'] != palette['muted']:
        out.append('muted %s renders as %s on the site (contrast repair): use %s' % (palette['muted'], t['textMuted'], t['textMuted']))
    return out


def _rgb_distance(a, b):
    ca, cb = hex_to_rgb(a), hex_to_rgb(b)
    return math.sqrt(sum((ca[k] - cb[k]) ** 2 for k in 'rgb'))


def repair_palette(palette, max_rounds=8):
    """A passing palette as close to `palette` as the rules allow, plus a list
    of what changed. bg is never touched. Order: accent (its button label),
    secondary (pulled toward bg until text reads on it), then text/muted set
    to exactly what deriveTheme renders."""
    p = {}
    for role in ROLES:
        v = normalize(palette.get(role)) if isinstance(palette, dict) else None
        if not v:
            raise ValueError('palette.%s is missing or not a color' % role)
        p[role] = v
    original = dict(p)

    for _ in range(max_rounds):
        before = dict(p)

        # Accent buttons carry white or #111111 labels (readableOn); a mid-tone
        # accent fits neither, so darken it (white label) or lighten it (dark
        # label), whichever moves it less.
        if contrast_ratio(readable_on(p['accent']), p['accent']) < MIN_RATIO:
            darker = ensure_contrast(p['accent'], '#ffffff', MIN_RATIO)
            lighter = ensure_contrast(p['accent'], '#111111', MIN_RATIO)
            options = [c for c in (darker, lighter) if contrast_ratio(readable_on(c), c) >= MIN_RATIO]
            if options:
                p['accent'] = min(options, key=lambda c: _rgb_distance(c, p['accent']))

        # Text must read on the card surface too: blend secondary toward bg
        # in small steps until it does (at 100% it is bg, which passes).
        t = derive_theme(p)
        if contrast_ratio(t['text'], t['surface']) < MIN_RATIO:
            for i in range(1, 51):
                cand = mix(p['secondary'], p['bg'], i / 50)
                td = derive_theme(dict(p, secondary=cand))
                if contrast_ratio(td['text'], cand) >= MIN_RATIO:
                    p['secondary'] = cand
                    break

        t = derive_theme(p)
        p['text'] = t['text']
        p['muted'] = t['textMuted']
        if p == before:
            break

    changes = ['%s %s -> %s' % (role, original[role], p[role]) for role in ROLES if original[role] != p[role]]
    return p, changes


def propose(accent, mode='light', tint=0.04):
    """A complete passing palette around one brand color: neutral page and
    card colors with a faint tint of the accent's hue, near-black or
    near-white text. A starting point to adjust, not a final answer."""
    a = normalize(accent)
    if not a:
        raise ValueError('accent is not a color: %r' % (accent,))
    if mode == 'dark':
        bg = mix('#0b0b0d', a, tint)
        p = {
            'bg': bg,
            'secondary': mix(bg, '#ffffff', 0.07),
            'text': mix('#f5f5f5', a, tint / 2),
            'muted': mix('#a8a8ad', a, tint),
            'accent': a,
        }
    else:
        bg = '#ffffff'
        p = {
            'bg': bg,
            'secondary': mix('#f4f4f5', a, tint),
            'text': mix('#111114', a, tint * 2),
            'muted': mix('#5c5c66', a, tint * 2),
            'accent': a,
        }
    return repair_palette(p)[0]


def alternates(palette):
    """{'light', 'dark'}: the palette itself for its own mode, a proposal
    around its accent for the other one."""
    p = repair_palette(palette)[0]
    if is_dark(p['bg']):
        return {'light': propose(p['accent'], 'light'), 'dark': p}
    return {'light': p, 'dark': propose(p['accent'], 'dark')}


# ─── CLI ──────────────────────────────────────────────────────────────

def _load(arg):
    if os.path.isfile(arg):
        with open(arg, encoding='utf-8') as f:
            return json.load(f)
    return json.loads(arg)


def _ratios_line(palette):
    r = pair_ratios(palette)
    return '  '.join('%s %.2f%s' % (k, r[k], '' if r[k] >= MIN_RATIO else ' FAIL') for k in PAIR_KEYS)


def main(argv):
    if len(argv) < 2 or argv[1] in ('-h', '--help'):
        print(__doc__)
        return 0
    cmd, args = argv[1], argv[2:]
    if cmd == 'ratio' and len(args) == 2:
        print('%.2f' % contrast_ratio(args[0], args[1]))
        return 0
    if cmd == 'propose' and args:
        print(json.dumps(propose(args[0], args[1] if len(args) > 1 else 'light'), indent=2))
        return 0
    if not args:
        print('missing palette argument', file=sys.stderr)
        return 2
    data = _load(args[0])
    if cmd == 'derive':
        print(json.dumps(derive_theme(data), indent=2))
        return 0
    if cmd == 'repair':
        fixed, changes = repair_palette(data)
        print(json.dumps({'palette': fixed, 'changes': changes, 'ratios': {k: round(v, 2) for k, v in pair_ratios(fixed).items()}}, indent=2))
        return 0
    if cmd == 'alternates':
        print(json.dumps(alternates(data), indent=2))
        return 0
    if cmd == 'check':
        sets = [('palette', data)]
        if isinstance(data, dict) and isinstance(data.get('palette'), dict):
            sets = [('palette', data['palette'])]
            for mode in ('light', 'dark'):
                alt = (data.get('alternates') or {}).get(mode)
                if isinstance(alt, dict):
                    sets.append(('alternates.' + mode, alt))
        bad = False
        for name, pal in sets:
            problems = palette_problems(pal)
            bad = bad or bool(problems)
            print('%s: %s' % (name, 'OK' if not problems else 'FAIL'))
            if not any('must be a lowercase' in x for x in problems):
                print('  ' + _ratios_line(pal))
            for x in problems:
                print('  - ' + x)
        return 1 if bad else 0
    print('unknown command: %s' % cmd, file=sys.stderr)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv))
