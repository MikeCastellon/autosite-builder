"""Sample photos for the tests, drawn with Pillow + numpy (no binaries in
the repo): a car in a scene with sensor-like noise, so the measurements
behave as they do on phone photos. Each scene knows where its license plate
is, for the blur checks.

  make_set(folder) -> {name: {'path', 'plate': (x, y, w, h) fractions or None, ...}}
"""
import os

from PIL import Image, ImageDraw, ImageFilter


def _noise(im, amount, seed):
    import numpy as np
    rng = np.random.default_rng(seed)
    a = np.asarray(im, dtype=np.int16)
    a = a + rng.normal(0, amount, a.shape).astype(np.int16)
    return Image.fromarray(a.clip(0, 255).astype('uint8'))


LAYOUTS = {
    # car box (x, y, w, h) as fractions of the frame
    'drive': (0.18, 0.48, 0.62, 0.30),
    'shop': (0.06, 0.40, 0.80, 0.42),
    'street': (0.40, 0.55, 0.50, 0.24),
}


def _background(d, W, H, layout, shift, s):
    if layout == 'shop':
        d.rectangle([0, 0, W, int(H * 0.62)], fill=(196, 188, 170))
        for y in range(int(H * 0.08), int(H * 0.55), int(26 * s) or 1):
            d.line([(int(W * 0.55), y), (int(W * 0.95), y)], fill=(150, 146, 136), width=max(1, int(4 * s)))
        d.rectangle([0, int(H * 0.62), W, H], fill=(128, 132, 140))
        for x in range(0, W, int(90 * s) or 1):
            d.line([(x + shift, int(H * 0.62)), (x + shift - int(200 * s), H)], fill=(110, 114, 122), width=max(1, int(2 * s)))
        return
    for y in range(H):
        t = y / H
        if layout == 'street':
            c = (int(230 - 60 * t), int(200 - 40 * t), int(150 - 30 * t)) if t < 0.5 else (int(84 + 20 * t), int(80 + 20 * t), int(78 + 20 * t))
        elif t < 0.45:
            c = (int(120 + 90 * t), int(170 + 60 * t), 235)
        else:
            c = (int(70 + 30 * t), int(70 + 30 * t), int(75 + 30 * t))
        d.line([(0, y), (W, y)], fill=c)
    if layout == 'street':
        for i in range(0, W, int(160 * s) or 1):
            d.rectangle([i + shift, int(H * (0.15 + (i * 31 % 7) / 40)), i + shift + int(120 * s), int(H * 0.5)], fill=(90 + i % 60, 70, 60))
        return
    # Trees along the horizon (texture for the sharpness measure).
    for i in range(0, W, int(38 * s) or 1):
        r = int((30 + (i * 7919 % 23)) * s)
        cx, cy = i + shift, int(H * 0.42)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(34, 90 + i % 40, 40))
    # Asphalt seams.
    for x in range(-W, W * 2, int(140 * s) or 1):
        d.line([(x + shift, H), (x + int(400 * s) + shift, int(H * 0.55))], fill=(60, 60, 64), width=max(1, int(3 * s)))


def car_scene(size=(1800, 1200), body=(178, 24, 32), dirty=False, light=1.0, shift=0, seed=1, plate=True, layout='drive'):
    """A car in a scene (driveway, shop or street): background, body,
    windows, wheels and a plate. Returns (image, plate box as fractions or
    None)."""
    W, H = size
    s = W / 1800.0
    im = Image.new('RGB', size)
    d = ImageDraw.Draw(im)
    _background(d, W, H, layout, shift, s)
    bx, by, bw, bh = LAYOUTS[layout]
    ox = int(W * bx) + shift
    oy = int(H * by)
    cw, ch = int(W * bw), int(H * bh)
    d.rounded_rectangle([ox, oy + ch // 3, ox + cw, oy + ch], radius=int(40 * s), fill=body)
    d.polygon([(ox + cw * 0.22, oy + ch // 3), (ox + cw * 0.35, oy), (ox + cw * 0.70, oy), (ox + cw * 0.82, oy + ch // 3)], fill=body)
    d.polygon([(ox + cw * 0.27, oy + ch // 3 - 4), (ox + cw * 0.37, oy + 10 * s), (ox + cw * 0.51, oy + 10 * s), (ox + cw * 0.51, oy + ch // 3 - 4)], fill=(40, 55, 70))
    d.polygon([(ox + cw * 0.53, oy + ch // 3 - 4), (ox + cw * 0.53, oy + 10 * s), (ox + cw * 0.68, oy + 10 * s), (ox + cw * 0.77, oy + ch // 3 - 4)], fill=(40, 55, 70))
    if not dirty:
        d.line([(ox + cw * 0.05, oy + ch * 0.45), (ox + cw * 0.95, oy + ch * 0.45)], fill=(255, 235, 235), width=max(2, int(6 * s)))
    for wx in (0.2, 0.8):
        cx, cy, r = ox + cw * wx, oy + ch, int(ch * 0.32)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(20, 20, 22))
        d.ellipse([cx - r * 0.55, cy - r * 0.55, cx + r * 0.55, cy + r * 0.55], fill=(170, 170, 178))
    box = None
    if plate:
        pw, ph = int(cw * 0.12), int(ch * 0.16)
        px, py = ox + cw - pw - int(cw * 0.04), oy + int(ch * 0.62)
        d.rectangle([px, py, px + pw, py + ph], fill=(240, 240, 235), outline=(30, 30, 30), width=max(1, int(2 * s)))
        for k in range(6):
            gx = px + pw * (0.1 + k * 0.14)
            d.rectangle([gx, py + ph * 0.25, gx + pw * 0.09, py + ph * 0.75], fill=(20, 30, 90))
        box = (px / W, py / H, pw / W, ph / H)
    if dirty:
        for k in range(160):
            x = ox + (k * 7919 % cw)
            y = oy + ch // 3 + (k * 104729 % (ch * 2 // 3))
            r = int((6 + k % 14) * s)
            d.ellipse([x - r, y - r, x + r, y + r], fill=(112, 88, 60))
    im = _noise(im, 6, seed)
    if light != 1.0:
        im = im.point(lambda v: max(0, min(255, int(v * light))))
    return im, box


def owner_portrait(size=(1000, 1400), seed=4):
    """A person in front of a van: an "about" candidate with a face."""
    W, H = size
    im = Image.new('RGB', size, (200, 205, 210))
    d = ImageDraw.Draw(im)
    d.rectangle([0, int(H * 0.30), W, int(H * 0.85)], fill=(235, 235, 240))
    d.rectangle([0, int(H * 0.85), W, H], fill=(90, 90, 95))
    cx = W // 2
    d.ellipse([cx - 120, int(H * 0.22), cx + 120, int(H * 0.22) + 260], fill=(214, 170, 140))
    d.ellipse([cx - 60, int(H * 0.22) + 90, cx - 30, int(H * 0.22) + 115], fill=(40, 30, 30))
    d.ellipse([cx + 30, int(H * 0.22) + 90, cx + 60, int(H * 0.22) + 115], fill=(40, 30, 30))
    d.arc([cx - 50, int(H * 0.22) + 140, cx + 50, int(H * 0.22) + 200], 20, 160, fill=(120, 40, 40), width=6)
    d.rounded_rectangle([cx - 230, int(H * 0.40), cx + 230, H], radius=60, fill=(20, 60, 140))
    face = ((cx - 120) / W, (H * 0.22) / H, 240 / W, 260 / H)
    return _noise(im, 5, seed), face


def flyer(size=(1080, 1080)):
    """A flat graphic (the kind of upload that isn't a photo)."""
    im = Image.new('RGB', size, (250, 200, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([60, 60, size[0] - 60, 300], fill=(20, 20, 20))
    d.rectangle([60, 400, size[0] - 60, 460], fill=(200, 0, 0))
    d.rectangle([60, 520, size[0] - 300, 560], fill=(20, 20, 20))
    return im, None


def save_jpeg_rotated(im, path, orientation=6):
    """Saves `im` (as it should be displayed) the way a phone does: pixels
    stored turned, with the EXIF orientation that turns them back."""
    turn = {6: Image.ROTATE_90, 8: Image.ROTATE_270, 3: Image.ROTATE_180}[orientation]
    stored = im.transpose(turn)
    exif = Image.Exif()
    exif[0x0112] = orientation
    stored.save(path, 'JPEG', quality=90, exif=exif.tobytes())


def make_set(folder):
    """The test set: hero candidate, its near-duplicate, a blurry and a dark
    shot, a before/after pair, an owner portrait stored rotated (EXIF 6), a
    small photo and a flyer."""
    os.makedirs(folder, exist_ok=True)
    out = {}

    def put(name, im, plate=None, **extra):
        path = os.path.join(folder, name)
        if name.endswith('.png'):
            im.save(path)
        else:
            im.save(path, 'JPEG', quality=90)
        out[name] = dict(path=path, plate=plate, size=im.size, **extra)

    im, plate = car_scene(seed=1)
    put('photo-1.jpg', im, plate, kind='hero')
    im2, plate2 = car_scene(seed=2, shift=12, light=1.04)
    put('photo-2.jpg', im2, plate2, kind='duplicate')
    im3, plate3 = car_scene(seed=3, body=(20, 60, 160), layout='street')
    put('photo-3.jpg', im3.filter(ImageFilter.GaussianBlur(9)), plate3, kind='blurry')
    im4, plate4 = car_scene(seed=4, body=(30, 120, 60), light=0.22, layout='street')
    put('photo-4.jpg', im4, plate4, kind='dark')
    before, pb = car_scene(seed=5, body=(240, 240, 240), dirty=True, layout='shop')
    put('photo-5.jpg', before, pb, kind='before')
    after, pa = car_scene(seed=6, body=(250, 250, 250), layout='shop')
    put('photo-6.jpg', after, pa, kind='after')
    portrait, face = owner_portrait()
    path = os.path.join(folder, 'photo-7.jpg')
    save_jpeg_rotated(portrait, path)
    out['photo-7.jpg'] = dict(path=path, plate=None, face=face, size=portrait.size, kind='about')
    small, ps = car_scene(size=(640, 427), seed=8, body=(90, 90, 90), layout='street')
    put('photo-8.png', small, ps, kind='small')
    fl, _ = flyer()
    put('photo-9.png', fl, None, kind='graphic')
    return out
