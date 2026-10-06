"""Sample inputs for the tests: the files a brief names, drawn with Pillow.

tests/sample_input.json is the exact social-input.json the server sends
for its smoke sample (tests/functions/kit-social.test.js writes it). This
draws stand-ins for the files it names: photos (a car under a sky, a
bright one, a busy one, one with a plate box), the logo (an icon next to a
wordmark, on a transparent background) and the brand fonts (DejaVu Serif
copied under the brief's font file names, when matplotlib is there).

  python3 tests/make_sample.py OUT_DIR      # writes social-input.json and its files
"""
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLE = os.path.join(HERE, 'sample_input.json')

from PIL import Image, ImageDraw, ImageFilter  # noqa: E402


def load_sample():
    with open(SAMPLE, encoding='utf-8') as f:
        return json.load(f)


def car_photo(path, size, sky, ground, body, seed=0, busy=False):
    W, H = size
    s = 2
    im = Image.new('RGB', (W * s, H * s))
    d = ImageDraw.Draw(im)
    horizon = int(H * s * 0.58)
    for y in range(H * s):
        t = y / float(H * s)
        if y < horizon:
            c = tuple(int(sky[0][i] + (sky[1][i] - sky[0][i]) * (y / float(horizon))) for i in range(3))
        else:
            c = tuple(int(ground[i] * (0.85 + 0.15 * t)) for i in range(3))
        d.line([(0, y), (W * s, y)], fill=c)
    if busy:
        import random
        rnd = random.Random(seed)
        for _ in range(260):
            x, y = rnd.randrange(W * s), rnd.randrange(horizon)
            r = rnd.randrange(6, 40) * s
            d.ellipse([x - r, y - r, x + r, y + r], fill=(rnd.randrange(256), rnd.randrange(256), rnd.randrange(256)))
    cx, cy = int(W * s * 0.52), int(H * s * 0.62)
    w, h = int(W * s * 0.56), int(H * s * 0.2)
    d.rounded_rectangle([cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2], radius=h // 3, fill=body)
    d.rounded_rectangle([cx - w // 3, cy - h, cx + w // 4, cy - h // 2 + 6], radius=h // 3, fill=body)
    d.polygon([(cx - w // 3 + 20 * s, cy - h + 12 * s), (cx + w // 4 - 20 * s, cy - h + 12 * s),
               (cx + w // 4 - 8 * s, cy - h // 2), (cx - w // 3 + 8 * s, cy - h // 2)], fill=(30, 40, 52))
    for wx in (cx - w // 3, cx + w // 3):
        r = int(h * 0.42)
        d.ellipse([wx - r, cy + h // 2 - r, wx + r, cy + h // 2 + r], fill=(20, 20, 22))
        d.ellipse([wx - r // 2, cy + h // 2 - r // 2, wx + r // 2, cy + h // 2 + r // 2], fill=(150, 150, 160))
    # A plate: white box with dark marks, where the brief's blur box says.
    px0, py0 = cx - int(W * s * 0.05), cy + int(h * 0.05)
    d.rectangle([px0, py0, px0 + int(W * s * 0.1), py0 + int(H * s * 0.05)], fill=(245, 245, 240))
    for k in range(5):
        d.rectangle([px0 + 8 * s + k * int(W * s * 0.018), py0 + 6 * s, px0 + 14 * s + k * int(W * s * 0.018), py0 + int(H * s * 0.04)], fill=(10, 10, 10))
    im = im.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
    ext = os.path.splitext(path)[1].lower()
    if ext in ('.jpg', '.jpeg'):
        im.save(path, 'JPEG', quality=88)
    else:
        im.save(path)


def lockup_logo(path, accent=(238, 53, 51), ink=(245, 245, 245)):
    """A round icon left of a wordmark (bars), transparent background."""
    s = 4
    im = Image.new('RGBA', (900 * s, 260 * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([20 * s, 20 * s, 240 * s, 240 * s], fill=accent + (255,))
    d.polygon([(80 * s, 170 * s), (130 * s, 70 * s), (180 * s, 170 * s)], fill=ink + (255,))
    for i in range(6):
        d.rectangle([(320 + i * 92) * s, 80 * s, (390 + i * 92) * s, 180 * s], fill=ink + (255,))
    d.rectangle([320 * s, 200 * s, 850 * s, 214 * s], fill=accent + (255,))
    im.resize((900, 260), Image.LANCZOS).save(path)


def flat_logo(path):
    """A dark wordmark on a plain white JPEG background (keyed out)."""
    im = Image.new('RGB', (700, 240), (255, 255, 255))
    d = ImageDraw.Draw(im)
    for i in range(5):
        d.rectangle([60 + i * 120, 70, 140 + i * 120, 170], fill=(20, 30, 60))
    im.save(path, 'JPEG', quality=92)


def font_source(bold):
    try:
        import matplotlib
        p = os.path.join(matplotlib.get_data_path(), 'fonts', 'ttf', 'DejaVuSerif-Bold.ttf' if bold else 'DejaVuSerif.ttf')
        return p if os.path.isfile(p) else None
    except Exception:
        return None


PHOTO_LOOKS = [
    ((70, 110, 170), (160, 190, 230), (90, 95, 100), (200, 30, 40), False),
    ((235, 235, 240), (255, 255, 255), (220, 220, 215), (250, 250, 250), False),
    ((20, 20, 30), (60, 60, 90), (40, 40, 40), (30, 120, 200), True),
    ((120, 90, 60), (230, 180, 120), (60, 50, 45), (20, 20, 20), False),
]


def make_files(out_dir, brief):
    """Draws every file `brief` names into out_dir."""
    os.makedirs(out_dir, exist_ok=True)
    for i, p in enumerate(brief.get('photos') or []):
        look = PHOTO_LOOKS[i % len(PHOTO_LOOKS)]
        size = (int(p.get('width') or 1600), int(p.get('height') or 1067))
        car_photo(os.path.join(out_dir, p['file']), size, (look[0], look[1]), look[2], look[3], seed=i, busy=look[4])
    logo = brief.get('logo') or {}
    if logo.get('file'):
        if logo['file'].endswith('.jpg'):
            flat_logo(os.path.join(out_dir, logo['file']))
        else:
            lockup_logo(os.path.join(out_dir, logo['file']))
    for slot in ('heading', 'body'):
        for f in ((brief.get('fonts') or {}).get(slot) or {}).get('files') or []:
            src = font_source(int(f.get('weight') or 400) >= 600)
            if src:
                shutil.copyfile(src, os.path.join(out_dir, f['name']))
    with open(os.path.join(out_dir, 'social-input.json'), 'w', encoding='utf-8') as fh:
        json.dump(brief, fh, indent=1)
    return os.path.join(out_dir, 'social-input.json')


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/social-sample'
    print(make_files(out, load_sample()))
