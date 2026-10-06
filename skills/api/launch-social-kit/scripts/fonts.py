"""Fonts for the images: the brand's own TTFs when the request sent them
(font-<Family>-<weight>.ttf, fetched by the server from Google Fonts), else
the DejaVu faces matplotlib ships, else Pillow's built-in face. Also text
measurement and wrapping (balanced lines, so a headline never ends on one
lonely word when it doesn't have to).

  fonts.py --brief /tmp/social/brief.json     # which faces the images will use
"""
import argparse
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common  # noqa: E402

try:
    from PIL import ImageFont
except ImportError:  # pragma: no cover
    ImageFont = None

# The weight each text role is drawn in, and from which brand font.
ROLE_FACE = {
    'eyebrow': ('body', 700),
    'headline': ('heading', 700),
    'sub': ('body', 400),
    'items': ('body', 700),
    'quote': ('heading', 400),
    'cite': ('body', 400),
    'cta': ('body', 700),
    'footer': ('body', 700),
}


def dejavu(bold):
    try:
        import matplotlib
        path = os.path.join(matplotlib.get_data_path(), 'fonts', 'ttf', 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')
        return path if os.path.isfile(path) else None
    except Exception:
        return None


class Faces(object):
    """Picks a font file per (slot, weight) and caches loaded sizes."""

    def __init__(self, brief):
        self.brief = brief
        self.cache = {}
        self.stand_in = set()
        self.families = {}
        fonts = brief.get('fonts') or {}
        self.files = {}
        for slot in ('heading', 'body'):
            f = fonts.get(slot) or {}
            self.families[slot] = f.get('family') or ''
            have = []
            for item in f.get('files') or []:
                path = (brief.get('paths') or {}).get(item.get('name'))
                if path and os.path.isfile(path) and self._loads(path):
                    have.append((int(item.get('weight') or 400), path))
            self.files[slot] = have
        # A single family for both slots: the heading face stands in for a
        # body file the server could not send, and the other way round.
        for a, b in (('heading', 'body'), ('body', 'heading')):
            if not self.files[a] and self.files[b] and (self.families[a] == self.families[b] or not self.families[a]):
                self.files[a] = list(self.files[b])
                self.families[a] = self.families[b]

    @staticmethod
    def _loads(path):
        try:
            ImageFont.truetype(path, 20)
            return True
        except Exception:
            return False

    def path_for(self, slot, weight):
        have = self.files.get(slot) or []
        if have:
            return sorted(have, key=lambda wp: (abs(wp[0] - weight), -wp[0]))[0][1], False
        return dejavu(weight >= 600), True

    def font(self, role, size):
        slot, weight = ROLE_FACE[role]
        path, stand_in = self.path_for(slot, weight)
        if stand_in:
            self.stand_in.add(slot)
        key = (path, int(size))
        if key not in self.cache:
            if path:
                self.cache[key] = ImageFont.truetype(path, int(size))
            else:  # Pillow >= 10.1 scales its own face
                self.cache[key] = ImageFont.load_default(int(size))
        return self.cache[key]

    def report(self):
        """{ heading, body, standIn } for social.json."""
        return {
            'heading': self.families.get('heading') or 'DejaVu Sans',
            'body': self.families.get('body') or 'DejaVu Sans',
            'standIn': bool(self.stand_in),
        }


def text_width(font, text, tracking=0.0):
    if not text:
        return 0.0
    w = font.getlength(text)
    if tracking:
        w += tracking * font.size * max(0, len(text) - 1)
    return w


def greedy(words, font, width, tracking=0.0):
    lines = []
    cur = ''
    for w in words:
        trial = (cur + ' ' + w) if cur else w
        if not cur or text_width(font, trial, tracking) <= width:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def wrap(text, font, width, max_lines, tracking=0.0, balance=True):
    """Lines of `text` within `width`, or None when it needs more than
    `max_lines` or one word alone is wider than `width`."""
    words = str(text).split()
    if not words:
        return []
    if any(text_width(font, w, tracking) > width for w in words):
        return None
    lines = greedy(words, font, width, tracking)
    if len(lines) > max_lines:
        return None
    if balance and len(lines) > 1:
        # The narrowest width that still gives this many lines.
        lo, hi = max(text_width(font, w, tracking) for w in words), width
        best = lines
        for _ in range(14):
            mid = (lo + hi) / 2.0
            trial = greedy(words, font, mid, tracking)
            if len(trial) <= len(lines):
                best, hi = trial, mid
            else:
                lo = mid
        lines = best
    return lines


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--brief', required=True)
    args = ap.parse_args(argv[1:])
    brief = common.load_brief(args.brief)
    faces = Faces(brief)
    for role in ROLE_FACE:
        faces.font(role, 40)
    for slot in ('heading', 'body'):
        have = faces.files.get(slot) or []
        print('%s: %s %s' % (slot, faces.families.get(slot) or '(none)',
                             ', '.join('%d %s' % (w, os.path.basename(p)) for w, p in sorted(have)) or '-> DejaVu Sans stand-in'))
    print('standIn: %s' % faces.report()['standIn'])
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
