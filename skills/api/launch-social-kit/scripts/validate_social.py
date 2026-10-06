"""Checks social.json, the PNGs next to it and what compose.py measured.

  validate_social.py /tmp/social/out/social.json --brief /tmp/social/brief.json --render /tmp/social/render.json

Errors (exit 1, fix and run again):
- social.json not exactly the schema (references/social-json.md);
- a PNG missing, not a PNG, not its exact size, too large, or an extra
  file in the folder (only the delivered files may be there);
- an image line that isn't sourced, a review outside the quote role, a
  quote that joins two reviews or a cite that isn't its reviewer, "What
  our customers say" without a quote, a claim the business facts or the
  owner's answers don't back, a caption or alt text with such a claim, a
  post without its caption;
- with --render: a text below 4.5:1 on the pixels behind it, text or logo
  outside the safe area or under a platform overlay, a profile logo that
  leaves the circle, or social.json's text not what was drawn.
Warnings (exit 0): a logo that reads poorly, an enlarged photo, a caption
that isn't the Words kit's.
"""
import argparse
import os
import struct
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common  # noqa: E402
import textrules as TR  # noqa: E402

MAX_PNG_BYTES = 11 * 1024 * 1024
WARN_PNG_BYTES = 5 * 1024 * 1024
MIN_TEXT = 4.5
MIN_LOGO = 0.7
NOTE_MAX = 300
NOTES_MAX = 8
TOL = 3


def png_info(path):
    """(width, height, color type) of a PNG file, or None."""
    try:
        with open(path, 'rb') as f:
            head = f.read(29)
    except OSError:
        return None
    if len(head) < 29 or head[:8] != b'\x89PNG\r\n\x1a\n' or head[12:16] != b'IHDR':
        return None
    w, h = struct.unpack('>II', head[16:24])
    return w, h, head[25]


def inside(b, box):
    return b[0] >= box[0] - TOL and b[1] >= box[1] - TOL and b[2] <= box[2] + TOL and b[3] <= box[3] + TOL


def overlaps(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def is_str(v, empty=False):
    return isinstance(v, str) and (empty or bool(v.strip()))


def validate(social, brief, images_dir, render=None):
    errors, warnings = [], []
    fm = common.formats()
    index = TR.index_of(brief)
    if not isinstance(social, dict):
        return ['social.json must be an object'], warnings
    extra = set(social) - {'version', 'images', 'captions', 'fonts', 'notes'}
    if extra:
        errors.append('unknown top-level keys: %s' % ', '.join(sorted(extra)))
    if social.get('version') != 1:
        errors.append('version must be 1')
    images = social.get('images')
    if not isinstance(images, list) or not images:
        errors.append('images must be a non-empty list')
        images = []
    photos = set(p.get('file') for p in brief.get('photos') or [])
    seen = []
    for i, im in enumerate(images):
        if not isinstance(im, dict):
            errors.append('images[%d] is not an object' % i)
            continue
        name = im.get('file')
        fmt = fm['formats'].get(name)
        if not fmt:
            errors.append('images[%d]: unknown file "%s"' % (i, name))
            continue
        if name in seen:
            errors.append('%s is listed twice' % name)
            continue
        seen.append(name)
        keys = set(im) - {'file', 'size', 'purpose', 'alt', 'layout', 'photo', 'text'}
        if keys:
            errors.append('%s: unknown keys %s' % (name, ', '.join(sorted(keys))))
        if im.get('size') != '%dx%d' % tuple(fmt['size']):
            errors.append('%s: size must be "%dx%d"' % (name, fmt['size'][0], fmt['size'][1]))
        if im.get('purpose') != fmt['purpose']:
            errors.append('%s: purpose must be "%s" (from data/formats.json)' % (name, fmt['purpose']))
        errors.extend(TR.alt_problems(im.get('alt'), index, '%s alt' % name))
        if im.get('layout') not in fmt['layouts']:
            errors.append('%s: layout must be one of %s' % (name, ', '.join(fmt['layouts'])))
        photo = im.get('photo')
        if photo is not None and photo not in photos:
            errors.append('%s: photo "%s" is not one of the customer\'s photos in the brief' % (name, photo))
        if str(im.get('layout') or '').startswith('photo-') and not photo:
            errors.append('%s: a %s layout names its photo' % (name, im.get('layout')))
        text = im.get('text')
        if not isinstance(text, list):
            errors.append('%s: text must be a list of {role, text}' % name)
            continue
        counts = {}
        for j, t in enumerate(text):
            if not isinstance(t, dict) or set(t) != {'role', 'text'} or not is_str(t.get('text')):
                errors.append('%s: text[%d] must be {"role", "text"} with text' % (name, j))
                continue
            role = t['role']
            if role not in fmt['text']:
                errors.append('%s: no %s text on this image' % (name, role))
                continue
            counts[role] = counts.get(role, 0) + 1
            for p in TR.line_problems(role, t['text'], index):
                errors.append('%s: %s' % (name, p))
        for role, n in counts.items():
            most = fmt['text'][role][2] if role == 'items' else 1
            if n > most:
                errors.append('%s: %d %s entries (at most %d)' % (name, n, role, most))
        lines = [(t['role'], t['text']) for t in text if isinstance(t, dict) and is_str(t.get('text'))]
        for p in TR.image_problems(lines, index):
            errors.append('%s: %s' % (name, p))

        path = os.path.join(images_dir, name)
        info = png_info(path)
        if not info:
            errors.append('%s: missing or not a PNG in %s' % (name, images_dir))
        else:
            if (info[0], info[1]) != tuple(fmt['size']):
                errors.append('%s is %dx%d, not %dx%d' % (name, info[0], info[1], fmt['size'][0], fmt['size'][1]))
            if info[2] not in (2,):
                warnings.append('%s is not plain RGB (color type %d): platforms flatten transparency unpredictably' % (name, info[2]))
            size = os.path.getsize(path)
            if size > MAX_PNG_BYTES:
                errors.append('%s is %.1f MB (at most %.0f MB)' % (name, size / 1048576.0, MAX_PNG_BYTES / 1048576.0))
            elif size > WARN_PNG_BYTES:
                warnings.append('%s is %.1f MB: some platforms recompress large uploads' % (name, size / 1048576.0))
    for req in [n for n in fm['order'] if fm['formats'][n]['required']]:
        if req not in seen:
            errors.append('%s is required' % req)
    if images_dir and os.path.isdir(images_dir):
        allowed = set(seen) | {'social.json'}
        stray = sorted(n for n in os.listdir(images_dir) if n not in allowed)
        if stray:
            errors.append('only the delivered files may be in %s; remove: %s' % (images_dir, ', '.join(stray)))

    posts = [n for n in seen if fm['formats'][n]['kind'] == 'post']
    captions = social.get('captions')
    if not isinstance(captions, list):
        errors.append('captions must be a list')
        captions = []
    words = brief.get('words') or {}
    word_caps = [TR.tokens(c) for c in words.get('captions') or [] if isinstance(c, str)] if words.get('ready') else []
    got = []
    for i, c in enumerate(captions):
        if not isinstance(c, dict) or set(c) != {'file', 'text'}:
            errors.append('captions[%d] must be {"file", "text"}' % i)
            continue
        if c['file'] not in posts:
            errors.append('captions[%d]: file must be one of the posts (%s)' % (i, ', '.join(posts) or 'none'))
            continue
        if c['file'] in got:
            errors.append('%s has two captions' % c['file'])
            continue
        got.append(c['file'])
        errors.extend(TR.caption_problems(c.get('text'), index, '%s caption' % c['file']))
        if word_caps and is_str(c.get('text')) and TR.tokens(c['text']) not in word_caps:
            warnings.append('%s caption is not one of the Words kit\'s captions: fine when you removed a claim, say so in notes' % c['file'])
    for p in posts:
        if p not in got:
            errors.append('%s has no caption' % p)

    fonts = social.get('fonts')
    if not (isinstance(fonts, dict) and is_str(fonts.get('heading')) and is_str(fonts.get('body')) and isinstance(fonts.get('standIn'), bool)
            and set(fonts) == {'heading', 'body', 'standIn'}):
        errors.append('fonts must be {"heading", "body", "standIn"} (compose.py writes it)')
    notes = social.get('notes')
    if not isinstance(notes, list) or not all(is_str(n) for n in notes):
        errors.append('notes must be a list of strings')
    else:
        if len(notes) > NOTES_MAX:
            errors.append('at most %d notes' % NOTES_MAX)
        for n in notes:
            if len(n) > NOTE_MAX:
                errors.append('a note is longer than %d characters' % NOTE_MAX)

    if render is None:
        warnings.append('no --render report: contrast and safe areas were not checked')
        return errors, warnings
    reports = {r.get('file'): r for r in render.get('images') or [] if isinstance(r, dict)}
    for im in images:
        if not isinstance(im, dict) or im.get('file') not in fm['formats']:
            continue
        name = im['file']
        fmt = fm['formats'][name]
        r = reports.get(name)
        if not r:
            errors.append('%s: not in the render report (run compose.py again)' % name)
            continue
        drawn = [(e['role'], e['text']) for e in r.get('elements') or [] if e.get('type') == 'text']
        listed = [(t.get('role'), t.get('text')) for t in im.get('text') or [] if isinstance(t, dict)]
        if sorted(drawn) != sorted(listed):
            errors.append('%s: social.json\'s text is not what compose.py drew (run compose.py again; never edit its output)' % name)
        for e in r.get('elements') or []:
            what = e.get('role') or e.get('type') or 'logo'
            box = e.get('box') or e.get('bbox')
            if not box or not inside(box, fmt['safe']):
                errors.append('%s: the %s is outside the safe area' % (name, what))
            for a in fmt.get('avoid') or []:
                if box and overlaps(box, a):
                    errors.append('%s: the %s is under an area the platform covers' % (name, what))
            if e.get('type') == 'text' and not (isinstance(e.get('contrast'), (int, float)) and e['contrast'] >= MIN_TEXT):
                errors.append('%s: the %s reaches %s:1 against what is behind it (at least %.1f)' % (name, what, e.get('contrast'), MIN_TEXT))
            if e.get('type') == 'logo':
                if (e.get('legibility') or 0) < MIN_LOGO:
                    warnings.append('%s: only %d%% of the logo reaches 3:1 on its background' % (name, int(round((e.get('legibility') or 0) * 100))))
                if fmt.get('circle') and (e.get('reach') or 0) > fmt['circle'][2]:
                    errors.append('%s: the logo reaches past the circle the platforms show' % name)
        for w in r.get('warnings') or []:
            warnings.append(w)
    return errors, warnings


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('social')
    ap.add_argument('--brief', required=True)
    ap.add_argument('--render', default='')
    ap.add_argument('--images', default='', help='folder with the PNGs (default: next to social.json)')
    args = ap.parse_args(argv[1:])
    try:
        social = common.read_json(args.social)
    except Exception as e:
        print('ERROR social.json is not readable JSON: %s' % e)
        return 1
    brief = common.load_brief(args.brief)
    render = common.read_json(args.render) if args.render else None
    images_dir = args.images or os.path.dirname(os.path.abspath(args.social))
    errors, warnings = validate(social, brief, images_dir, render)
    for e in errors:
        print('ERROR ' + e)
    for w in warnings:
        print('WARNING ' + w)
    if errors:
        print('%d error(s)' % len(errors))
        return 1
    print('OK (%d image%s, %d caption%s)' % (
        len(social['images']), '' if len(social['images']) == 1 else 's',
        len(social['captions']), '' if len(social['captions']) == 1 else 's'))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
