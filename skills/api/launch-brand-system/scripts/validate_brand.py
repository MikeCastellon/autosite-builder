"""Checks brand.json against the contract the site's runner reads
(references/brand-json.md). Exit 0 = valid (warnings may still print),
1 = errors to fix, 2 = unreadable file.

  validate_brand.py /tmp/brand/brand.json

Errors (all must be fixed):
  - shape: exactly the contract's keys, version 1, lowercase #rrggbb colors
  - every palette (palette, alternates.light, alternates.dark) passes
    text/bg, muted/bg, onAccent/accent and text/secondary at 4.5:1 on the
    tokens the site renders (scripts/theme.py = kit/theme.js deriveTheme),
    and text/muted are already what the site renders (no silent repair)
  - alternates.light is a light palette, alternates.dark a dark one, and
    the main palette is copied exactly into the alternate of its own mode
  - fonts are FONT_CATALOG families (data/fonts.json); body can carry text
  - reasons and notes are single plain lines (the server's oneLine() would
    otherwise rewrite them); logo is null when there is no logo
The limits match src/lib/brandSpec.js sanitizeBrand(), so a file that passes
here is stored exactly as written.
Warnings (judgement calls, say why in reasons/notes if you keep them):
  accent hard to see on bg, bg/secondary too alike, muted on cards,
  links repainted, two display faces, empty logo colors.
"""
import json
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from theme import _JS_WS_CHARS, ROLES, contrast_ratio, derive_theme, is_dark, palette_problems, repair_palette  # noqa: E402
from fonts import FAMILIES, catalog_family, is_body_family  # noqa: E402

HEX6 = re.compile(r'#[0-9a-f]{6}', re.A)
TOP_KEYS = ('version', 'palette', 'alternates', 'fonts', 'reasons', 'logo', 'notes')
REASON_KEYS = ('palette', 'accent', 'fonts')
LOGO_KEYS = ('dominant', 'background', 'hasText')
BACKGROUNDS = ('light', 'dark', 'transparent')
MAX_BYTES = 16 * 1024
# brandSpec.js: REASON_MAX, NOTE_MAX, BRAND_NOTES_MAX, LOGO_COLORS_MAX.
MAX_REASON = 600
MAX_NOTE = 300
MAX_NOTES = 8
MAX_DOMINANT = 8
_CONTROL = re.compile('[\x00-\x1f\x7f\u2028\u2029]+')
_SPACES = re.compile('[%s]+' % re.escape(_JS_WS_CHARS))


def one_line(v):
    """brandSpec.js oneLine() without the cap: control characters and
    whitespace runs become one space, ends trimmed."""
    return _SPACES.sub(' ', _CONTROL.sub(' ', v)).strip(_JS_WS_CHARS)


def _keys(obj, want, where, errors):
    if not isinstance(obj, dict):
        errors.append('%s must be an object' % where)
        return False
    missing = [k for k in want if k not in obj]
    extra = [k for k in obj if k not in want]
    if missing:
        errors.append('%s is missing %s' % (where, ', '.join(missing)))
    if extra:
        errors.append('%s has keys the contract does not allow: %s' % (where, ', '.join(map(str, extra))))
    return not missing


def js_length(v):
    """String.prototype.length: UTF-16 code units. oneLine()'s slice(0, max)
    counts these, so an emoji counts 2 and a line of them that fits by
    Python's len() would still be cut (mid-character) on the server."""
    return len(v.encode('utf-16-le')) // 2


def _text(v, where, max_len, errors):
    if not isinstance(v, str) or not v.strip():
        errors.append('%s must be a non-empty string' % where)
    elif js_length(v) > max_len:
        errors.append('%s is %d characters (emoji count 2), max %d' % (where, js_length(v), max_len))
    elif one_line(v) != v:
        errors.append('%s must be one plain line: no line breaks, tabs, doubled spaces or spaces at the ends' % where)


def check_palette(pal, where, errors, warnings):
    if not _keys(pal, ROLES, where, errors):
        return False
    shape_ok = True
    for role in ROLES:
        v = pal[role]
        if not isinstance(v, str) or not HEX6.fullmatch(v):
            errors.append('%s.%s must be a lowercase #rrggbb color (got %r)' % (where, role, v))
            shape_ok = False
    if not shape_ok:
        return False
    problems = palette_problems(pal)
    if problems:
        fixed, changes = repair_palette(pal)
        for p in problems:
            errors.append('%s: %s' % (where, p))
        errors.append('%s: theme.py repair suggests %s (%s)' % (where, json.dumps(fixed), '; '.join(changes) or 'no change'))
        return False

    t = derive_theme(pal)
    if contrast_ratio(pal['accent'], pal['bg']) < 3:
        warnings.append('%s: accent %s is %.2f:1 on bg (under 3:1, buttons and highlights will not stand out)'
                        % (where, pal['accent'], contrast_ratio(pal['accent'], pal['bg'])))
    if t['accentText'] != pal['accent']:
        warnings.append('%s: links and accent text will render as %s, not %s (accent is under 4.5:1 on bg or secondary)'
                        % (where, t['accentText'], pal['accent']))
    sec = contrast_ratio(pal['bg'], pal['secondary'])
    if sec < 1.04:
        warnings.append('%s: bg and secondary are %.2f:1 apart, cards and alternate sections will not read as a separate surface' % (where, sec))
    if contrast_ratio(pal['muted'], pal['secondary']) < 4.5:
        warnings.append('%s: muted is %.2f:1 on secondary (fine on bg, weak on cards)' % (where, contrast_ratio(pal['muted'], pal['secondary'])))
    if contrast_ratio(pal['muted'], pal['text']) < 1.25:
        warnings.append('%s: muted and text are nearly the same color' % where)
    return True


def validate(data):
    errors, warnings = [], []
    if not _keys(data, TOP_KEYS, 'brand.json', errors) and not isinstance(data, dict):
        return errors, warnings

    if 'version' in data and (data['version'] != 1 or isinstance(data['version'], bool)):
        errors.append('version must be 1')

    main_ok = check_palette(data.get('palette'), 'palette', errors, warnings) if 'palette' in data else False

    alts = data.get('alternates')
    if 'alternates' in data and _keys(alts, ('light', 'dark'), 'alternates', errors):
        for mode in ('light', 'dark'):
            ok = check_palette(alts[mode], 'alternates.' + mode, errors, warnings)
            if ok and is_dark(alts[mode]['bg']) != (mode == 'dark'):
                errors.append('alternates.%s has a %s background (%s)' % (mode, 'dark' if mode == 'light' else 'light', alts[mode]['bg']))
        if main_ok and isinstance(alts.get('light'), dict) and isinstance(alts.get('dark'), dict):
            mode = 'dark' if is_dark(data['palette']['bg']) else 'light'
            if alts[mode] != data['palette']:
                errors.append('palette is a %s palette, so alternates.%s must be an exact copy of it' % (mode, mode))

    fonts = data.get('fonts')
    if 'fonts' in data and _keys(fonts, ('heading', 'body'), 'fonts', errors):
        for slot in ('heading', 'body'):
            v = fonts[slot]
            if not isinstance(v, str) or v not in FAMILIES:
                canon = catalog_family(v) if isinstance(v, str) else None
                errors.append('fonts.%s %r is not a FONT_CATALOG family%s' % (slot, v, ' (write %r)' % canon if canon else ' (see fonts.py list)'))
        if isinstance(fonts['body'], str) and fonts['body'] in FAMILIES and not is_body_family(fonts['body']):
            errors.append("fonts.body %r can't carry paragraphs (needs a sans/serif face with 400 and 700; see fonts.py list --role body)" % fonts['body'])
        if all(isinstance(fonts[s], str) and fonts[s] in FAMILIES for s in ('heading', 'body')):
            if fonts['heading'] == fonts['body']:
                warnings.append('fonts: heading and body are the same family (fine for a minimal look; say so in reasons.fonts)')
            if FAMILIES[fonts['heading']]['category'] == 'display' and FAMILIES[fonts['body']]['category'] == 'display':
                warnings.append('fonts: two display faces together')

    reasons = data.get('reasons')
    if 'reasons' in data and _keys(reasons, REASON_KEYS, 'reasons', errors):
        for k in REASON_KEYS:
            _text(reasons[k], 'reasons.' + k, MAX_REASON, errors)

    logo = data.get('logo')
    if 'logo' in data and logo is not None and not isinstance(logo, dict):
        errors.append('logo must be an object, or null when there is no logo')
    elif 'logo' in data and logo is not None and _keys(logo, LOGO_KEYS, 'logo', errors):
        dom = logo['dominant']
        if not isinstance(dom, list) or len(dom) > MAX_DOMINANT:
            errors.append('logo.dominant must be a list of at most %d colors' % MAX_DOMINANT)
        else:
            for i, v in enumerate(dom):
                if not isinstance(v, str) or not HEX6.fullmatch(v):
                    errors.append('logo.dominant[%d] must be a lowercase #rrggbb color (got %r)' % (i, v))
            if len(set(dom)) != len(dom):
                errors.append('logo.dominant has duplicates')
            if not dom:
                errors.append('logo.dominant is empty: list the logo\'s colors, or set logo to null when there is no logo')
        if logo['background'] not in BACKGROUNDS:
            errors.append('logo.background must be one of %s' % ', '.join(BACKGROUNDS))
        if not isinstance(logo['hasText'], bool):
            errors.append('logo.hasText must be true or false')

    notes = data.get('notes')
    if 'notes' in data:
        if not isinstance(notes, list) or len(notes) > MAX_NOTES:
            errors.append('notes must be a list of at most %d strings' % MAX_NOTES)
        else:
            for i, n in enumerate(notes):
                _text(n, 'notes[%d]' % i, MAX_NOTE, errors)
    return errors, warnings


def main(argv):
    if len(argv) != 2 or argv[1] in ('-h', '--help'):
        print(__doc__)
        return 2
    path = argv[1]
    try:
        raw = open(path, 'rb').read()
        data = json.loads(raw.decode('utf-8'))
    except (OSError, ValueError) as e:
        print('FAIL: cannot read %s as UTF-8 JSON: %s' % (path, e))
        return 2
    errors, warnings = validate(data)
    if len(raw) > MAX_BYTES:
        errors.append('brand.json is %d bytes, max %d' % (len(raw), MAX_BYTES))
    for w in warnings:
        print('WARN  ' + w)
    for e in errors:
        print('ERROR ' + e)
    if errors:
        print('FAIL: %d error(s). Fix brand.json and run this again.' % len(errors))
        return 1
    print('OK: brand.json is valid%s.' % (' (%d warning(s))' % len(warnings) if warnings else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
