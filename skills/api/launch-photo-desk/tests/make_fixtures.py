"""Writes tests/fixtures.json: the cases the skill's validator and the
server's sanitizer (src/lib/kit/photos.js, photos.test.js) both run, so the
two can't drift apart.

  python3 tests/make_fixtures.py          # rewrite fixtures.json
  (test_photos.py fails when the file differs from what this builds)

- crops: crop_for() inputs and results; the JS cropFor() must match.
- valid: a photos.json the validator accepts, with the photos it covers
  (name, displayed and stored size): the sanitizer must store it unchanged.
- invalid: one broken copy of it per rule. Each names the validator error it
  must raise and whether the server reports a repair too ("server":
  "repair") or quietly stores its own version ("server": "keep": a rule
  only the validator holds). extraPhotos: photos the case adds.
"""
import copy
import json
import os
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'scripts'))
from common import ASPECTS, crop_for  # noqa: E402

OUT = os.path.join(HERE, 'fixtures.json')

CROP_CASES = [
    # width, height, focal, aspect key, zoom
    (1800, 1200, {'x': 0.54, 'y': 0.61}, 'desktop', 1),
    (1800, 1200, {'x': 0.54, 'y': 0.61}, 'phone', 1),
    (1000, 1400, {'x': 0.5, 'y': 0.35}, 'desktop', 1),
    (1000, 1400, {'x': 0.5, 'y': 0.35}, 'phone', 1),
    (4032, 3024, {'x': 0.98, 'y': 0.02}, 'desktop', 1),
    (4032, 3024, {'x': 0.02, 'y': 0.98}, 'phone', 0.6),
    (1920, 1080, {'x': 0.5, 'y': 0.5}, 'desktop', 1),
    (1920, 1080, {'x': 0.1, 'y': 0.5}, 'phone', 0.3),
    (3000, 4000, {'x': 0.7, 'y': 0.9}, 'desktop', 0.8),
    (640, 427, {'x': 0.3333, 'y': 0.6667}, 'phone', 1),
    (1080, 1080, {'x': 0.5, 'y': 0.5}, 'phone', 0.1),
    (2000, 500, {'x': 1.5, 'y': -1}, 'phone', 2),
]

# The photos the valid doc covers: displayed size, and the stored size the
# server reads from the bytes (photo-7 is a phone portrait stored sideways).
PHOTOS = [
    {'name': 'photo-1.jpg', 'width': 1800, 'height': 1200, 'storedWidth': 1800, 'storedHeight': 1200},
    {'name': 'photo-5.jpg', 'width': 1800, 'height': 1200, 'storedWidth': 1800, 'storedHeight': 1200},
    {'name': 'photo-6.jpg', 'width': 1800, 'height': 1200, 'storedWidth': 1800, 'storedHeight': 1200},
    {'name': 'photo-7.jpg', 'width': 1000, 'height': 1400, 'storedWidth': 1400, 'storedHeight': 1000},
    {'name': 'photo-9.png', 'width': 1080, 'height': 1080, 'storedWidth': 1080, 'storedHeight': 1080},
]


def pick(name, role, score, reason, alt, focal, blur=(), zoom=None, photos=PHOTOS):
    p = next(p for p in photos if p['name'] == name)
    zoom = zoom or {}
    return {
        'path': name, 'role': role, 'score': score, 'reason': reason, 'alt': alt, 'focal': focal,
        'crops': {k: crop_for(p['width'], p['height'], focal, a, zoom.get(k, 1)) for k, a in ASPECTS.items()},
        'blur': list(blur), 'width': p['width'], 'height': p['height'],
    }


def valid_doc():
    return {
        'version': 1,
        'picks': [
            pick('photo-1.jpg', 'hero', 9.1, 'Sharp and wide, the whole car in even light',
                 'Red sedan parked on a driveway in front of a row of trees', {'x': 0.54, 'y': 0.61},
                 [{'x': 0.698, 'y': 0.662, 'w': 0.081, 'h': 0.054, 'kind': 'plate'}]),
            pick('photo-7.jpg', 'about', 7.4, 'The owner facing the camera, the van behind',
                 'Person in a blue jacket standing in front of a white van', {'x': 0.5, 'y': 0.35}),
            pick('photo-5.jpg', 'before', 7, 'Same spot as photo-6, mud on the doors',
                 'White car in a shop with mud on the doors and wheels', {'x': 0.57, 'y': 0.64},
                 [{'x': 0.73, 'y': 0.655, 'w': 0.1, 'h': 0.075, 'kind': 'plate'}]),
            pick('photo-6.jpg', 'after', 8, 'Clean, same framing as photo-5', 'The same white car in the shop, clean',
                 {'x': 0.53, 'y': 0.62}, [{'x': 0.73, 'y': 0.655, 'w': 0.1, 'h': 0.075, 'kind': 'plate'}],
                 zoom={'phone': 0.9}),
            pick('photo-9.png', 'skip', 0, 'A flyer, not a photo', '', {'x': 0.47, 'y': 0.36}),
        ],
        'pairs': [{'before': 'photo-5.jpg', 'after': 'photo-6.jpg', 'note': 'Mud washed off the doors and wheels'}],
        'shotList': [
            'A finished car from the front corner, the whole car in frame, phone held sideways at headlight height',
            'Before and after of the same car from the same spot and angle',
            'You at work with your van behind you',
        ],
        'notes': ['photo-9.png is a flyer; it was left out of the site.'],
    }


def broken(name, error, server, change):
    doc = valid_doc()
    extra = change(doc) or []
    case = {'name': name, 'error': error, 'server': server, 'doc': doc}
    if extra:
        case['extraPhotos'] = extra
    return case


def _set(path, value):
    def change(doc):
        target = doc
        for key in path[:-1]:
            target = target[key]
        target[path[-1]] = value
    return change


def invalid_cases():
    def second_hero(doc):
        doc['picks'][2]['role'] = 'hero'
        doc['pairs'] = []
        doc['picks'][3]['role'] = 'gallery'

    def unpaired(doc):
        doc['pairs'] = []

    def unknown_photo(doc):
        doc['picks'][4]['path'] = 'photo-99.jpg'

    def twice(doc):
        doc['picks'][4] = copy.deepcopy(doc['picks'][0])
        doc['picks'][4]['role'] = 'skip'

    def wrong_crop(doc):
        doc['picks'][0]['crops']['phone'] = {'x': 0, 'y': 0, 'w': 1, 'h': 1}

    def missing_crop(doc):
        del doc['picks'][0]['crops']['desktop']

    def bad_blur(doc):
        doc['picks'][0]['blur'][0]['kind'] = 'logo'

    def outside_blur(doc):
        doc['picks'][0]['blur'][0]['x'] = 0.95

    def pair_claim(doc):
        doc['pairs'][0]['note'] = 'Looks perfect again'

    def gallery_13(doc):
        extra = [{'name': 'photo-%d.jpg' % (20 + i), 'width': 1600, 'height': 1200, 'storedWidth': 1600, 'storedHeight': 1200}
                 for i in range(13)]
        for p in extra:
            doc['picks'].append(pick(p['name'], 'gallery', 6, 'Filler', 'Blue car parked on a street',
                                     {'x': 0.5, 'y': 0.5}, photos=extra))
        return extra

    return [
        broken('claim in alt text', 'claims "best"', 'repair', _set(['picks', 0, 'alt'], 'The best detail in town on a red sedan')),
        broken('image of in alt text', 'starts with "image of"', 'repair', _set(['picks', 1, 'alt'], 'Image of the owner in front of a van')),
        broken('claim in a skip alt text', 'claims "award', 'repair', _set(['picks', 4, 'alt'], 'An award-winning flyer')),
        broken('two heroes', '2 hero photos', 'repair', second_hero),
        broken('unpaired before and after', 'is in no pair', 'repair', unpaired),
        broken('unknown photo', 'not one of the analyzed photos', 'repair', unknown_photo),
        broken('a photo picked twice', 'listed twice', 'repair', twice),
        broken('phone crop not 4:5', 'is not 4:5', 'repair', wrong_crop),
        broken('desktop crop missing', 'crops is missing desktop', 'repair', missing_crop),
        broken('blur kind', 'kind must be "plate" or "face"', 'repair', bad_blur),
        broken('blur box past the edge', 'reaches past the photo', 'repair', outside_blur),
        broken('claim in a pair note', 'claims "perfect"', 'repair', pair_claim),
        broken('unknown role', 'role must be one of', 'repair', _set(['picks', 1, 'role'], 'banner')),
        broken('gallery over 12', '13 gallery photos', 'repair', gallery_13),
        broken('focal outside the photo', 'outside 0.0..1.0', 'repair', _set(['picks', 0, 'focal', 'x'], 1.2)),
        broken('score with two decimals', 'more than 1 decimal places', 'repair', _set(['picks', 0, 'score'], 9.15)),
        broken('text over two lines', 'must be one plain line', 'repair', _set(['picks', 0, 'reason'], 'Sharp and wide\nwhole car')),
        broken('shot list too short', 'shotList must have 3 to 10 lines', 'keep', _set(['shotList'], ['One shot'])),
        broken('empty reason', 'reason must not be empty', 'keep', _set(['picks', 0, 'reason'], '')),
        broken('extra key', 'keys the contract does not allow', 'keep', _set(['picks', 0, 'caption'], 'Hello')),
        broken('alt text missing on a used photo', 'alt must not be empty', 'keep', _set(['picks', 2, 'alt'], '')),
        broken('version', 'version must be 1', 'keep', _set(['version'], 2)),
    ]


def build():
    invalid = invalid_cases()
    return {
        'about': 'Written by tests/make_fixtures.py; read by tests/test_photos.py and src/lib/kit/photos.test.js.',
        'crops': [{'width': w, 'height': h, 'focal': f, 'aspect': a, 'zoom': z, 'box': crop_for(w, h, f, ASPECTS[a], z)}
                  for (w, h, f, a, z) in CROP_CASES],
        'photos': copy.deepcopy(PHOTOS),
        'valid': valid_doc(),
        'invalid': invalid,
    }


def render():
    return json.dumps(build(), indent=1, ensure_ascii=False) + '\n'


if __name__ == '__main__':
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(render())
    print('wrote %s' % OUT)
