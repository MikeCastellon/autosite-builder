"""Finds the request's files and writes the working brief.

The server sends social-input.json (the brief: business, colors, fonts,
logo, photos with the photo desk's picks, links, the Words kit's captions
and every text the images may quote) plus the files it names (logo-1.png,
photo-1.jpg, font-Oswald-700.ttf, ...). This finds them wherever the
container put them, writes /tmp/social/brief.json with their paths, and
prints what you have to work with.

  find_inputs.py [--brief PATH] [--out /tmp/social/brief.json]

Exit 1 when the brief or a logo/photo it names is missing (a missing font
only means the stand-in face is used).
"""
import argparse
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common  # noqa: E402


def image_size(path):
    try:
        from PIL import Image, ImageOps
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im)
            return list(im.size), im.mode
    except Exception as e:  # pragma: no cover - reported, not fatal here
        return None, 'unreadable: %s' % str(e)[:80]


def summary(brief):
    lines = []
    b = brief.get('business') or {}
    lines.append('Business: %s%s' % (b.get('name') or '(no name)', ' (%s)' % b['type'] if b.get('type') else ''))
    pal = common.palette_of(brief)
    lines.append('Colors (%s): %s' % (brief.get('paletteSource') or 'unknown', ', '.join('%s %s' % (k, v) for k, v in pal.items())))
    for slot in ('heading', 'body'):
        f = (brief.get('fonts') or {}).get(slot) or {}
        files = [x['name'] for x in f.get('files') or [] if x.get('name') in brief['paths']]
        lines.append('Font %s: %s (%s)' % (slot, f.get('family') or 'none', ', '.join(files) if files else 'no file: DejaVu stand-in'))
    logo = brief.get('logo') or {}
    if logo.get('file'):
        size, mode = image_size(brief['paths'][logo['file']]) if logo['file'] in brief['paths'] else (None, 'missing')
        lines.append('Logo: %s %s %s' % (logo['file'], 'x'.join(map(str, size)) if size else '', mode))
    else:
        lines.append('Logo: none (leave profile-800.png out and say so in notes)')
    photos = brief.get('photos') or []
    lines.append('Photos: %d' % len(photos))
    for p in photos:
        size, _ = image_size(brief['paths'][p['file']]) if p['file'] in brief['paths'] else (None, 'missing')
        bits = [p['file'], 'x'.join(map(str, size)) if size else 'MISSING']
        if p.get('role'):
            bits.append('photo desk: %s %s' % (p['role'], p.get('score', '')))
        if p.get('focal'):
            bits.append('focal %.2f,%.2f' % (p['focal']['x'], p['focal']['y']))
        if p.get('blur'):
            bits.append('%d area(s) to blur' % len(p['blur']))
        if p.get('alt'):
            bits.append('"%s"' % p['alt'][:70])
        lines.append('  - ' + ' | '.join(str(x) for x in bits))
    links = brief.get('links') or {}
    lines.append('Links: site %s, booking %s, phone %s' % (links.get('host') or 'none', 'yes' if links.get('booking') else 'no', 'yes' if links.get('phone') else 'no'))
    words = brief.get('words') or {}
    lines.append('Words kit captions: %s' % (len(words.get('captions') or []) if words.get('ready') else 'not ready (write captions yourself)'))
    kinds = {}
    for s in brief.get('sources') or []:
        kinds[s.get('kind')] = kinds.get(s.get('kind'), 0) + 1
    lines.append('Text sources: %s (list them: textrules.py sources)' % ', '.join('%s %d' % kv for kv in sorted(kinds.items())))
    return '\n'.join(lines)


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--brief', default='', help='path of social-input.json when you already know it')
    ap.add_argument('--out', default=os.path.join(common.WORK, 'brief.json'))
    args = ap.parse_args(argv[1:])

    path = args.brief
    if not path:
        path = common.find_files([common.BRIEF_NAME]).get(common.BRIEF_NAME, '')
    if not path or not os.path.isfile(path):
        print('social-input.json not found: the request lists the files; look for them with find / -name social-input.json')
        return 1
    brief = common.load_brief(path)
    names = common.brief_files(brief)
    missing = [n for n in names if n not in brief['paths']]
    common.write_json(args.out, brief)
    print('Brief: %s -> %s' % (path, args.out))
    print(summary(brief))
    fatal = [n for n in missing if not n.startswith('font-')]
    if missing:
        print('Missing: %s' % ', '.join(missing))
    return 1 if fatal else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
