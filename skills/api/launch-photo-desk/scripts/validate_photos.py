"""Checks photos.json against the contract the server stores
(references/photos-json.md; src/lib/kit/photos.js sanitizePhotos). Exit 0 =
valid (warnings may still print), 1 = errors to fix, 2 = unreadable file.

  validate_photos.py /tmp/photos/photos.json [--analysis /tmp/photos/analysis.json]

With --analysis (always pass it in a run) it also checks that every
analyzed photo has exactly one pick (one analyze.py could not read has
none), that width/height are the displayed size and that the crops have
the right shape in pixels.

Errors (the server would change or drop these):
  - shape: exactly the contract's keys, version 1, numbers with at most 4
    decimal places (score: 1), one-line texts within their caps
  - roles: at most 1 hero, 1 about, 12 gallery; exactly 1 hero when any
    photo is used; before/after photos each in exactly one pair
  - focal point, crops and blur boxes inside the photo; crops 16:9 (desktop)
    and 4:5 (phone) in pixels within 2%
  - alt text: required for every used photo (a skip's may be empty), no
    claims (data/claim_words.json "errors"), not "image of ..."; pair notes:
    no claims
  - shotList: 3 to 10 lines; notes: at most 8
Warnings (judgement calls: fix them or say why in notes):
  softer words in alt text, a plate-like token in alt text, long alt text,
  a portrait or small hero, flagged photos in use, two used photos from one
  duplicate group, a focal point outside a crop, a very large blur box.
"""
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (  # noqa: E402
    ASPECT_TOLERANCE, ASPECTS, BLUR_KINDS, IMAGE_OF, LIMITS, MIN_BLUR_SIDE, MIN_CROP_SIDE, PLATE_LIKE, ROLES, VERSION,
    aspect_error, claim_in, js_length, js_round, load_json, one_line, soft_claim_in,
)

TOP_KEYS = ('version', 'picks', 'pairs', 'shotList', 'notes')
PICK_KEYS = ('path', 'role', 'score', 'reason', 'alt', 'focal', 'crops', 'blur', 'width', 'height')
BOX_KEYS = ('x', 'y', 'w', 'h')
PAIR_KEYS = ('before', 'after', 'note')
PLAIN_NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._()+-]{0,150}$')
MAX_BYTES = 512 * 1024
EPS = 1e-9


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


def _number(v, where, errors, lo=0.0, hi=1.0, places=4):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        errors.append('%s must be a number' % where)
        return False
    if v < lo - EPS or v > hi + EPS:
        errors.append('%s is %s, outside %s..%s' % (where, v, lo, hi))
        return False
    if js_round(float(v), places) != v:
        errors.append('%s has more than %d decimal places (%s)' % (where, places, v))
        return False
    return True


def _line(v, where, max_len, errors, required=True):
    if not isinstance(v, str):
        errors.append('%s must be a string' % where)
        return False
    if required and not v.strip():
        errors.append('%s must not be empty' % where)
        return False
    if js_length(v) > max_len:
        errors.append('%s is %d characters, max %d' % (where, js_length(v), max_len))
        return False
    if one_line(v) != v:
        errors.append('%s must be one plain line (no line breaks, tabs or double spaces, no spaces at the ends)' % where)
        return False
    return True


def _box(b, where, errors, min_side):
    if not _keys(b, BOX_KEYS, where, errors):
        return False
    ok = all(_number(b[k], '%s.%s' % (where, k), errors) for k in BOX_KEYS)
    if not ok:
        return False
    if b['w'] < min_side or b['h'] < min_side:
        errors.append('%s is too small (w and h at least %s)' % (where, min_side))
        return False
    if b['x'] + b['w'] > 1 + 1e-6 or b['y'] + b['h'] > 1 + 1e-6:
        errors.append('%s reaches past the photo (x + w and y + h must be at most 1)' % where)
        return False
    return True


def validate(doc, analysis=None):
    """(errors, warnings) for a parsed photos.json."""
    errors, warnings = [], []
    if not _keys(doc, TOP_KEYS, 'photos.json', errors):
        return errors, warnings
    if doc['version'] != VERSION:
        errors.append('version must be %d' % VERSION)
    analyzed = (analysis or {}).get('photos', [])
    known = {p['name']: p for p in analyzed if 'unreadable' not in p}
    unreadable = {p['name'] for p in analyzed if 'unreadable' in p}
    picks = doc['picks']
    if not isinstance(picks, list) or not picks:
        errors.append('picks must be a non-empty list')
        picks = []
    if len(picks) > LIMITS['picks']:
        errors.append('picks has %d entries, max %d' % (len(picks), LIMITS['picks']))
    seen = {}
    roles = {r: [] for r in ROLES}
    for i, p in enumerate(picks):
        where = 'picks[%d]' % i
        if not _keys(p, PICK_KEYS, where, errors):
            continue
        path = p['path']
        if not isinstance(path, str) or not PLAIN_NAME.match(path):
            errors.append('%s.path must be the container file name from the request (e.g. "photo-3.jpg")' % where)
            continue
        where = '%s (%s)' % (where, path)
        if path in seen:
            errors.append('%s is listed twice (each photo exactly once)' % where)
        seen[path] = p
        info = known.get(path)
        if path in unreadable:
            errors.append('%s could not be read by analyze.py: leave it out and say so in notes' % where)
        elif analysis is not None and not info:
            errors.append('%s is not one of the analyzed photos' % where)
        if p['role'] not in ROLES:
            errors.append('%s.role must be one of %s' % (where, ', '.join(ROLES)))
        else:
            roles[p['role']].append(path)
        _number(p['score'], '%s.score' % where, errors, 0, 10, places=1)
        _line(p['reason'], '%s.reason' % where, LIMITS['reason'], errors)
        used = p['role'] != 'skip'
        # A skip's alt text may be empty; when it is written, it follows the
        # same rules (an admin may still use the photo).
        if _line(p['alt'], '%s.alt' % where, LIMITS['alt'], errors, required=used) and p['alt']:
            claim = claim_in(p['alt'])
            if claim:
                errors.append('%s.alt claims "%s": describe only what is visible' % (where, claim))
            if IMAGE_OF.search(p['alt']):
                errors.append('%s.alt starts with "image of": screen readers already say it is an image' % where)
        if used and isinstance(p['alt'], str) and p['alt']:
            soft = soft_claim_in(p['alt'])
            if soft:
                warnings.append('%s.alt says "%s": keep it only if the customer said so (their note) or it is plainly visible' % (where, soft))
            if PLATE_LIKE.search(p['alt']):
                warnings.append('%s.alt has a plate-like token "%s": never write plate numbers' % (where, PLATE_LIKE.search(p['alt']).group(0)))
            if js_length(p['alt']) > 125:
                warnings.append('%s.alt is %d characters; 125 or fewer reads better' % (where, js_length(p['alt'])))
        for k in ('width', 'height'):
            if isinstance(p[k], bool) or not isinstance(p[k], int) or p[k] < 1:
                errors.append('%s.%s must be a positive whole number of pixels' % (where, k))
        size_ok = isinstance(p['width'], int) and isinstance(p['height'], int) and p['width'] > 0 and p['height'] > 0
        if info and size_ok and (p['width'], p['height']) != (info.get('width'), info.get('height')):
            errors.append('%s is %dx%d in analysis.json, not %dx%d' % (where, info.get('width'), info.get('height'), p['width'], p['height']))
        focal_ok = _keys(p['focal'], ('x', 'y'), '%s.focal' % where, errors) and all(
            _number(p['focal'][k], '%s.focal.%s' % (where, k), errors) for k in ('x', 'y'))
        if _keys(p['crops'], tuple(ASPECTS), '%s.crops' % where, errors):
            for key, aspect in ASPECTS.items():
                b = p['crops'][key]
                if not _box(b, '%s.crops.%s' % (where, key), errors, MIN_CROP_SIDE) or not size_ok:
                    continue
                err = aspect_error(b, p['width'], p['height'], aspect)
                if err is not None and err > ASPECT_TOLERANCE:
                    errors.append('%s.crops.%s is not %d:%d in pixels (off by %.1f%%): use build_photos.py or common.crop_for' % (
                        where, key, aspect[0], aspect[1], err * 100))
                elif focal_ok and not (b['x'] - EPS <= p['focal']['x'] <= b['x'] + b['w'] + EPS and b['y'] - EPS <= p['focal']['y'] <= b['y'] + b['h'] + EPS):
                    warnings.append('%s: the focal point is outside the %s crop' % (where, key))
        blur = p['blur']
        if not isinstance(blur, list):
            errors.append('%s.blur must be a list (empty when nothing needs blurring)' % where)
        else:
            if len(blur) > LIMITS['blur']:
                errors.append('%s.blur has %d boxes, max %d' % (where, len(blur), LIMITS['blur']))
            for j, b in enumerate(blur):
                bw = '%s.blur[%d]' % (where, j)
                if not isinstance(b, dict):
                    errors.append('%s must be an object' % bw)
                    continue
                if b.get('kind') not in BLUR_KINDS:
                    errors.append('%s.kind must be "plate" or "face"' % bw)
                box_only = {k: v for k, v in b.items() if k != 'kind'}
                if _box(box_only, bw, errors, MIN_BLUR_SIDE) and b['w'] * b['h'] > 0.25:
                    warnings.append('%s covers a quarter of the photo or more: a plate or face box should be tight' % bw)
        if info and used:
            bad = [f for f in info.get('flags', []) if f in ('blurry', 'dark', 'small', 'graphic', 'unreadable')]
            if bad:
                warnings.append('%s is used as %s but analyze.py flagged it %s' % (where, p['role'], ', '.join(bad)))
    if analysis is not None:
        missing = [n for n in known if n not in seen]
        if missing:
            errors.append('these photos have no pick (give each one, role "skip" with a reason when unused): %s' % ', '.join(missing))

    for role, cap in (('hero', LIMITS['hero']), ('about', LIMITS['about']), ('gallery', LIMITS['gallery'])):
        if len(roles[role]) > cap:
            errors.append('%d %s photos, max %d' % (len(roles[role]), role, cap))
    used_any = any(roles[r] for r in ROLES if r != 'skip')
    if used_any and not roles['hero']:
        errors.append('no hero: pick the strongest wide photo as the hero')

    pairs = doc['pairs']
    paired = {}
    if not isinstance(pairs, list):
        errors.append('pairs must be a list (empty without before/after photos)')
        pairs = []
    if len(pairs) > LIMITS['pairs']:
        errors.append('pairs has %d entries, max %d' % (len(pairs), LIMITS['pairs']))
    for i, pr in enumerate(pairs):
        where = 'pairs[%d]' % i
        if not _keys(pr, PAIR_KEYS, where, errors):
            continue
        for side in ('before', 'after'):
            ref = pr[side]
            pick = seen.get(ref) if isinstance(ref, str) else None
            if not pick:
                errors.append('%s.%s must name a pick' % (where, side))
            elif pick.get('role') != side:
                errors.append('%s.%s (%s) must have role "%s"' % (where, side, ref, side))
            elif ref in paired:
                errors.append('%s.%s (%s) is already in %s' % (where, side, ref, paired[ref]))
            else:
                paired[ref] = where
        if pr['before'] == pr['after']:
            errors.append('%s: before and after are the same photo' % where)
        if _line(pr['note'], '%s.note' % where, LIMITS['pairNote'], errors, required=False) and claim_in(pr['note']):
            errors.append('%s.note claims "%s": say what changed, plainly' % (where, claim_in(pr['note'])))
    for role in ('before', 'after'):
        for path in roles[role]:
            if path not in paired:
                errors.append('%s has role "%s" but is in no pair: pair it or give it another role' % (path, role))

    shots = doc['shotList']
    if not isinstance(shots, list) or not 3 <= len(shots) <= LIMITS['shotList']:
        errors.append('shotList must have 3 to %d lines' % LIMITS['shotList'])
    else:
        for i, s in enumerate(shots):
            _line(s, 'shotList[%d]' % i, LIMITS['shot'], errors)
        texts = [s for s in shots if isinstance(s, str)]
        if len(set(texts)) != len(texts):
            errors.append('shotList repeats a line')
    notes = doc['notes']
    if not isinstance(notes, list) or len(notes) > LIMITS['notes']:
        errors.append('notes must be a list of at most %d lines' % LIMITS['notes'])
    else:
        for i, n in enumerate(notes):
            _line(n, 'notes[%d]' % i, LIMITS['note'], errors)

    # Judgement calls.
    if roles['hero'] and known:
        h = known.get(roles['hero'][0])
        if h and h.get('orientation') == 'portrait':
            warnings.append('the hero (%s) is a portrait photo: the 16:9 desktop crop keeps only a band of it' % roles['hero'][0])
        if h and max(h.get('width', 0), h.get('height', 0)) < 1600:
            warnings.append('the hero (%s) is under 1600 px wide: it may look soft on large screens' % roles['hero'][0])
    if known:
        groups = {}
        for path, p in seen.items():
            g = known.get(path, {}).get('dupGroup')
            if g and p.get('role') not in ('skip', 'before', 'after'):
                groups.setdefault(g, []).append(path)
        for g, members in groups.items():
            if len(members) > 1:
                warnings.append('near-duplicates both in use: %s (keep the best one unless they really differ)' % ', '.join(members))
    return errors, warnings


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    path = argv[1]
    analysis = None
    if '--analysis' in argv:
        analysis = load_json(argv[argv.index('--analysis') + 1])
    try:
        if os.path.getsize(path) > MAX_BYTES:
            print('ERROR photos.json is over %d KB' % (MAX_BYTES // 1024))
            return 1
        doc = load_json(path)
    except (OSError, ValueError) as e:
        print('ERROR cannot read %s: %s' % (path, e))
        return 2
    errors, warnings = validate(doc, analysis)
    for w in warnings:
        print('WARNING %s' % w)
    for e in errors:
        print('ERROR %s' % e)
    if errors:
        print('%d error(s): fix them and run this again' % len(errors))
        return 1
    print('OK %d picks, %d pairs, %d shots%s' % (len(doc['picks']), len(doc['pairs']), len(doc['shotList']),
                                                  '' if analysis else ' (run with --analysis for the full check)'))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
