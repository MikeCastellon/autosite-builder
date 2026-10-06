"""Turns your decisions (draft.json) into photos.json: the sizes, crops and
rounding done by the same math the server checks with, then the full
validation. You decide; this does the arithmetic.

  build_photos.py /tmp/photos/draft.json --analysis /tmp/photos/analysis.json --out /tmp/photos/photos.json

draft.json (references/photos-json.md has the full contract):
  {
    "picks": [
      {"path": "photo-1.jpg", "role": "hero", "score": 9.1,
       "reason": "Sharp, wide, the whole car in open shade",
       "alt": "Red sedan parked on a driveway, front three-quarter view",
       "focal": {"x": 0.55, "y": 0.6},           optional: analyze.py's focal point
       "zoom": {"desktop": 1, "phone": 0.8},      optional, 0.3-1: tighter crops
       "crops": {"phone": {"x": ..., "y": ..., "w": ..., "h": ...}},
                                                  optional: your own crop (checked)
       "blur": [{"x": 0.70, "y": 0.66, "w": 0.08, "h": 0.05, "kind": "plate"}]},
      ...
    ],
    "skip": {"photo-3.jpg": "Out of focus: the car is soft all over",
             "photo-9.png": {"reason": "A flyer, not a photo", "score": 0}},
    "pairs": [{"before": "photo-5.jpg", "after": "photo-6.jpg", "note": "..."}],
    "shotList": ["...", "...", "..."],
    "notes": []
  }

"skip" is shorthand for photos you don't use: a reason (and optionally a
score; default the tech score, at most 5) is enough. Every analyzed photo
needs a pick or a skip entry; one analyze.py could not read stays out of
photos.json (mention it in notes).

Filled in: version, width and height (as displayed, from analysis.json),
focal points (analyze.py's when you give none), both crops (the largest
16:9 and 4:5 boxes around the focal point, times zoom, unless you gave
one), numbers rounded to the contract's places, blur boxes kept inside the
photo, texts on one line. Nothing is invented and nothing is shortened:
texts that are too long or make claims fail the validation, for you to
fix in draft.json.

Exit 0 when photos.json is valid, 1 when the validation found errors (the
file is still written, so inspect_photo.py --draft can show it), 2 when
draft.json or analysis.json can't be read or a pick can't be built.
"""
import argparse
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ASPECTS, VERSION, crop_for, floor4, js_round, load_json, one_line, write_json  # noqa: E402
from validate_photos import validate  # noqa: E402

PICK_FIELDS = ('path', 'role', 'score', 'reason', 'alt', 'focal', 'crops', 'blur', 'width', 'height')
SKIP_SCORE_MAX = 5.0


def _num(v):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _clamp01(v):
    return min(1.0, max(0.0, v))


def _text(v):
    return one_line(v) if isinstance(v, str) else ''


def _round_box(b, problems, where):
    """A box rounded to 4 places and kept inside the photo, or None."""
    if not isinstance(b, dict):
        problems.append('%s must be an object with x, y, w, h' % where)
        return None
    vals = [_num(b.get(k)) for k in ('x', 'y', 'w', 'h')]
    if any(v is None for v in vals):
        problems.append('%s needs numbers x, y, w and h (fractions of the photo)' % where)
        return None
    x, y, w, h = vals
    x0, y0 = _clamp01(x), _clamp01(y)
    w = min(w - (x0 - x), 1 - x0)
    h = min(h - (y0 - y), 1 - y0)
    out = {'x': js_round(x0, 4), 'y': js_round(y0, 4), 'w': max(0.0, floor4(w)), 'h': max(0.0, floor4(h))}
    # Rounding x up must not push the box past the edge.
    out['w'] = min(out['w'], floor4(1 - out['x']))
    out['h'] = min(out['h'], floor4(1 - out['y']))
    return out


def build_pick(d, info, problems):
    where = 'pick %s' % d.get('path')
    W, H = info['width'], info['height']
    focal = d.get('focal')
    if isinstance(focal, dict) and _num(focal.get('x')) is not None and _num(focal.get('y')) is not None:
        f = {'x': js_round(_clamp01(_num(focal['x'])), 4), 'y': js_round(_clamp01(_num(focal['y'])), 4)}
    else:
        if focal is not None:
            problems.append('%s: focal needs numbers x and y; using analyze.py\'s focal point' % where)
        af = info.get('focal') or {'x': 0.5, 'y': 0.5}
        f = {'x': js_round(af['x'], 4), 'y': js_round(af['y'], 4)}
    zoom = d.get('zoom') if isinstance(d.get('zoom'), dict) else {}
    given = d.get('crops') if isinstance(d.get('crops'), dict) else {}
    crops = {}
    for key, aspect in ASPECTS.items():
        if given.get(key) is not None:
            box = _round_box(given[key], problems, '%s.crops.%s' % (where, key))
            if box:
                crops[key] = box
                continue
        z = _num(zoom.get(key))
        crops[key] = crop_for(W, H, f, aspect, z if z is not None else 1.0)
    blur = []
    raw_blur = d.get('blur') if d.get('blur') is not None else []
    if not isinstance(raw_blur, list):
        problems.append('%s.blur must be a list' % where)
        raw_blur = []
    for j, b in enumerate(raw_blur):
        box = _round_box(b, problems, '%s.blur[%d]' % (where, j))
        if box:
            box['kind'] = b.get('kind')
            blur.append(box)
    score = _num(d.get('score'))
    pick = {
        'path': d.get('path'),
        'role': d.get('role'),
        'score': js_round(min(10.0, max(0.0, score)), 1) if score is not None else d.get('score'),
        'reason': _text(d.get('reason')),
        'alt': _text(d.get('alt')),
        'focal': f,
        'crops': crops,
        'blur': blur,
        'width': W,
        'height': H,
    }
    return {k: pick[k] for k in PICK_FIELDS}


def build(draft, analysis):
    """(photos.json dict, problems) from a draft and analysis.json."""
    problems = []
    known = {p['name']: p for p in analysis.get('photos', []) if 'unreadable' not in p}
    unreadable = {p['name'] for p in analysis.get('photos', []) if 'unreadable' in p}
    picks, seen = [], set()
    raw_picks = draft.get('picks') if isinstance(draft.get('picks'), list) else []
    if not isinstance(draft.get('picks'), list):
        problems.append('draft.json needs a "picks" list')
    for d in raw_picks:
        if not isinstance(d, dict) or not isinstance(d.get('path'), str):
            problems.append('every pick needs a "path" (the file name, e.g. "photo-3.jpg")')
            continue
        name = d['path']
        if name in seen:
            problems.append('%s is picked twice' % name)
            continue
        info = known.get(name)
        if not info:
            problems.append('%s is %s' % (name, 'unreadable: give it a skip entry instead' if name in unreadable else 'not in analysis.json'))
            continue
        seen.add(name)
        picks.append(build_pick(d, info, problems))
    skip = draft.get('skip') if isinstance(draft.get('skip'), dict) else {}
    for name, entry in skip.items():
        if name in seen:
            problems.append('%s is both picked and skipped' % name)
            continue
        reason = entry.get('reason') if isinstance(entry, dict) else entry
        score = _num(entry.get('score')) if isinstance(entry, dict) else None
        info = known.get(name)
        if name in unreadable:
            # No size, no crops: it stays out of photos.json (say so in notes).
            print('NOTE %s could not be read, so it is left out of photos.json' % name)
            continue
        if not info:
            problems.append('skip %s is not in analysis.json' % name)
            continue
        if score is None:
            score = min(SKIP_SCORE_MAX, float(info.get('techScore') or 0))
        seen.add(name)
        picks.append(build_pick({'path': name, 'role': 'skip', 'score': score, 'reason': reason, 'alt': '',
                                 'blur': []}, info, problems))
    for key in ('pairs', 'shotList', 'notes'):
        if draft.get(key) is not None and not isinstance(draft.get(key), list):
            problems.append('"%s" must be a list' % key)
    pairs = []
    for pr in (draft.get('pairs') if isinstance(draft.get('pairs'), list) else []):
        if isinstance(pr, dict):
            pairs.append({'before': pr.get('before'), 'after': pr.get('after'), 'note': _text(pr.get('note'))})
        else:
            problems.append('every pair must be an object with before, after and note')
    shots = [_text(s) for s in (draft.get('shotList') if isinstance(draft.get('shotList'), list) else []) if isinstance(s, str)]
    notes = [_text(n) for n in (draft.get('notes') if isinstance(draft.get('notes'), list) else []) if isinstance(n, str) and _text(n)]
    doc = {'version': VERSION, 'picks': picks, 'pairs': pairs, 'shotList': [s for s in shots if s], 'notes': notes}
    return doc, problems


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('draft')
    ap.add_argument('--analysis', required=True)
    ap.add_argument('--out', default='/tmp/photos/photos.json')
    args = ap.parse_args(argv[1:])
    try:
        draft = load_json(args.draft)
        analysis = load_json(args.analysis)
    except (OSError, ValueError) as e:
        print('ERROR cannot read input: %s' % e)
        return 2
    if not isinstance(draft, dict):
        print('ERROR draft.json must be an object')
        return 2
    doc, problems = build(draft, analysis)
    for p in problems:
        print('PROBLEM %s' % p)
    write_json(args.out, doc)
    errors, warnings = validate(doc, analysis)
    for w in warnings:
        print('WARNING %s' % w)
    for e in errors:
        print('ERROR %s' % e)
    if problems and not errors:
        print('wrote %s, but fix the problems above in draft.json' % args.out)
        return 2
    if errors:
        print('wrote %s with %d error(s): fix draft.json and build again' % (args.out, len(errors)))
        return 1
    print('OK wrote %s: %d picks, %d pairs, %d shots' % (args.out, len(doc['picks']), len(doc['pairs']), len(doc['shotList'])))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
