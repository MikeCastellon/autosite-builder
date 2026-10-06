"""Zoom views with a coordinate grid, for reading focal points and blur
boxes off a photo, and for checking the crops and boxes you wrote.

  inspect_photo.py photo-3.jpg [photo-7.jpg ...] --analysis /tmp/photos/analysis.json --out /tmp/photos/view.jpg
      One panel per photo (up to 6, two per row), the whole photo with grid
      lines every 0.1 labeled in fractions of the photo (x along the top, y
      down the left side): read a spot's coordinates straight off the grid.
  ... photo-3.jpg --region 0.6,0.5,0.3,0.2
      Only that part (x, y, w, h as fractions of the whole photo), larger,
      with a finer grid still labeled in whole-photo fractions, so the
      numbers you read are the ones photos.json takes. Use it for plates
      and faces: they are small in the full view.
  ... --draft /tmp/photos/draft.json   (or photos.json)
      Draws that file's focal point (white ring), desktop crop (yellow),
      phone crop (dashed blue) and blur boxes (red, labeled) on the panels.

Photos are named by their file name (as in the request) or by #n from
analyze.py. Open the output with the file viewer (text editor view).
"""
import argparse
import math
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import font, load_json, open_photo  # noqa: E402
from contact_sheet import dashed_rect  # noqa: E402

MAX_PANELS = 6


def resolve(ref, analysis):
    photos = analysis['photos']
    if ref.startswith('#') and ref[1:].isdigit():
        n = int(ref[1:])
        return next((p for p in photos if p.get('n') == n), None)
    return next((p for p in photos if p['name'] == ref), None)


def parse_region(text):
    vals = [float(v) for v in text.split(',')]
    if len(vals) != 4:
        raise ValueError('--region takes x,y,w,h')
    x, y, w, h = vals
    x, y = min(max(x, 0.0), 0.98), min(max(y, 0.0), 0.98)
    w, h = min(max(w, 0.02), 1 - x), min(max(h, 0.02), 1 - y)
    return x, y, w, h


def grid_step(span):
    for step in (0.1, 0.05, 0.02, 0.01, 0.005):
        if span / step >= 5:
            return step
    return 0.005


def draw_draft(d, pick, to_px, f, margin_top):
    """A draft's (or photos.json's) blur boxes, crops and focal point."""
    for b in pick.get('blur') or []:
        x0, y0 = to_px(b['x'], b['y'])
        x1, y1 = to_px(b['x'] + b['w'], b['y'] + b['h'])
        d.rectangle([x0, y0, x1, y1], outline=(255, 60, 60, 255), width=3)
        d.text((x0 + 3, max(margin_top, y0 - 16)), str(b.get('kind', '')), font=f, fill=(255, 90, 90, 255))
    crops = pick.get('crops') or {}
    if crops.get('desktop'):
        b = crops['desktop']
        d.rectangle([*to_px(b['x'], b['y']), *to_px(b['x'] + b['w'], b['y'] + b['h'])], outline=(255, 230, 90, 255), width=3)
    if crops.get('phone'):
        b = crops['phone']
        dashed_rect(d, (*to_px(b['x'], b['y']), *to_px(b['x'] + b['w'], b['y'] + b['h'])), (90, 220, 255, 255), width=3)
    fp = pick.get('focal')
    if fp:
        cx, cy = to_px(fp['x'], fp['y'])
        d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], outline=(0, 0, 0, 255), width=5)
        d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], outline=(255, 255, 255, 255), width=2)


def panel(p, region, max_side, draft_pick):
    """The rendered panel (RGB) for one photo."""
    from PIL import Image, ImageChops, ImageDraw
    rx, ry, rw, rh = region
    # Decode at the size the region needs (a small region of a big photo
    # keeps its detail).
    need = int(max_side / max(rw, rh) * 1.1)
    im, (W, H) = open_photo(p['path'], max_side=min(max(p['width'], p['height']), max(need, max_side)))
    sx, sy = im.width / W, im.height / H
    crop = im.crop((int(rx * W * sx), int(ry * H * sy), int((rx + rw) * W * sx), int((ry + rh) * H * sy)))
    # Fit max_side: a small region is enlarged (up to 4x) so a plate or a
    # face is big enough to read its edges off the grid.
    scale = min(4.0, max_side / float(max(crop.size)))
    if abs(scale - 1) > 0.01:
        crop = crop.resize((max(1, int(crop.width * scale)), max(1, int(crop.height * scale))), Image.LANCZOS)
    margin_top, margin_left = 26, 44
    title = '#%s %s  %dx%d' % (p.get('n', '?'), p['name'], W, H)
    if region != (0.0, 0.0, 1.0, 1.0):
        title += '  region %.3f,%.3f,%.3f,%.3f' % region
    title_font = font(14, True)
    width = max(crop.width + margin_left + 8, int(ImageDraw.Draw(Image.new('RGB', (1, 1))).textlength(title, font=title_font)) + margin_left + 12)
    canvas = Image.new('RGB', (width, crop.height + margin_top + 30), (24, 24, 26))
    canvas.paste(crop, (margin_left, margin_top))
    cw, ch = crop.size
    to_px = lambda fx, fy: (margin_left + (fx - rx) / rw * cw, margin_top + (fy - ry) / rh * ch)  # noqa: E731
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = font(13, True)
    step = grid_step(min(rw, rh))
    places = 1 if step >= 0.1 else 2 if step >= 0.01 else 3
    v = math.ceil(rx / step) * step
    while v < rx + rw - 1e-9:
        x, _ = to_px(v, ry)
        d.line([(x, margin_top), (x, margin_top + ch)], fill=(255, 255, 255, 110), width=1)
        d.text((x - 12, 6), ('%.*f' % (places, v)), font=f, fill=(255, 255, 255, 255))
        v += step
    v = math.ceil(ry / step) * step
    while v < ry + rh - 1e-9:
        _, y = to_px(rx, v)
        d.line([(margin_left, y), (margin_left + cw, y)], fill=(255, 255, 255, 110), width=1)
        d.text((4, y - 8), ('%.*f' % (places, v)), font=f, fill=(255, 255, 255, 255))
        v += step
    ov = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    if draft_pick:
        try:
            draw_draft(ImageDraw.Draw(ov), draft_pick, to_px, f, margin_top)
        except (KeyError, TypeError, ValueError) as e:
            print('the draft entry for %s could not be drawn: %s' % (p['name'], e), file=sys.stderr)
        # Overlays stop at the photo's edge (a crop reaching past a zoomed
        # region would otherwise run over the grid labels).
        mask = Image.new('L', canvas.size, 0)
        ImageDraw.Draw(mask).rectangle([margin_left, margin_top, margin_left + cw - 1, margin_top + ch - 1], fill=255)
        ov.putalpha(ImageChops.multiply(ov.getchannel('A'), mask))
    layer = Image.alpha_composite(layer, ov)
    out = Image.alpha_composite(canvas.convert('RGBA'), layer).convert('RGB')
    d2 = ImageDraw.Draw(out)
    d2.text((margin_left, margin_top + ch + 7), title, font=title_font, fill=(255, 255, 255))
    return out


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('photos', nargs='+')
    ap.add_argument('--analysis', default='/tmp/photos/analysis.json')
    ap.add_argument('--out', default='/tmp/photos/view.jpg')
    ap.add_argument('--region', default='')
    ap.add_argument('--draft', default='')
    args = ap.parse_args(argv[1:])
    from PIL import Image
    analysis = load_json(args.analysis)
    picked = []
    for ref in args.photos[:MAX_PANELS]:
        p = resolve(ref, analysis)
        if not p or 'unreadable' in p:
            print('not found or unreadable: %s' % ref, file=sys.stderr)
            return 1
        picked.append(p)
    region = parse_region(args.region) if args.region else (0.0, 0.0, 1.0, 1.0)
    draft = {}
    if args.draft:
        for dp in load_json(args.draft).get('picks') or []:
            draft[dp.get('path')] = dp
    single = len(picked) == 1
    max_side = 1400 if single else 740
    panels = [panel(p, region, max_side, draft.get(p['name'])) for p in picked]
    cols = 1 if single else 2
    rows = math.ceil(len(panels) / cols)
    cell_w = max(pp.width for pp in panels)
    cell_h = max(pp.height for pp in panels)
    sheet = Image.new('RGB', (cell_w * cols, cell_h * rows), (24, 24, 26))
    for k, pp in enumerate(panels):
        sheet.paste(pp, ((k % cols) * cell_w, (k // cols) * cell_h))
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    sheet.save(args.out, 'JPEG', quality=90)
    print('wrote %s (%dx%d): %s' % (args.out, sheet.width, sheet.height, ', '.join(p['name'] for p in picked)))
    if len(args.photos) > MAX_PANELS:
        print('only the first %d photos fit one view' % MAX_PANELS)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
