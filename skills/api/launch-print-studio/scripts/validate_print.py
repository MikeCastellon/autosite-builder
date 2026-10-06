"""Checks print.json and the PDFs before delivery. Exit 1 lists every error.

  validate_print.py /tmp/print/print.json --inputs <dir>/print-inputs.json [--pdf-dir /tmp/print]

print.json: the exact shape the server stores (references/print-json.md),
every code's target exactly one of the request's links, review pieces only
with a review link (and listed in "omitted" without one), the pieces that
are always made present.

Each PDF: the page count, MediaBox / TrimBox / BleedBox (0.125 in bleed),
eight crop marks per page in the registration color, the die-line as its
own page in the DieCut spot color, every font embedded, and every QR code
read back from the PDF and decoded (scripts/qr_decode.py): it must hold
exactly what print.json says, print at least 0.75 in, sit inside the safe
area (and below the hang tag's hole), with modules of at least 0.25 mm.

Printed text: no claim the facts don't back, nothing against Google's review
policy (incentives, asking only happy customers).
"""
import argparse
import json
import math
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import printkit as K  # noqa: E402
import qr_decode  # noqa: E402

I = K.INCH
TOL = 0.05   # points
TOP_KEYS = ['version', 'pieces', 'omitted', 'fonts', 'colors', 'notes']
PIECE_KEYS = ['file', 'name', 'size', 'bleed', 'pages', 'qr', 'text', 'note']
QR_KEYS = ['label', 'kind', 'url', 'vcard', 'sizeIn']


def is_str(v, cap, empty=True):
    return isinstance(v, str) and len(v) <= cap and (empty or v.strip() != '')


def check_shape(data, errors):
    if not isinstance(data, dict):
        errors.append('print.json is not a JSON object')
        return False
    keys = list(data.keys())
    for k in keys:
        if k not in TOP_KEYS:
            errors.append('print.json: unknown key "%s"' % k)
    for k in TOP_KEYS:
        if k not in data:
            errors.append('print.json: "%s" is missing' % k)
    if data.get('version') != 1:
        errors.append('print.json: version must be 1')
    pieces = data.get('pieces')
    if not isinstance(pieces, list):
        errors.append('print.json: pieces must be a list')
        return False
    order = [p['file'] for p in K.PIECES]
    seen = []
    for i, p in enumerate(pieces):
        where = 'pieces[%d]' % i
        if not isinstance(p, dict):
            errors.append('%s is not an object' % where)
            continue
        for k in p:
            if k not in PIECE_KEYS:
                errors.append('%s: unknown key "%s"' % (where, k))
        for k in PIECE_KEYS:
            if k not in p:
                errors.append('%s: "%s" is missing' % (where, k))
        spec = K.PIECE_BY_FILE.get(p.get('file'))
        if not spec:
            errors.append('%s: file "%s" is not one of %s' % (where, p.get('file'), ', '.join(order)))
            continue
        where = p['file']
        if p['file'] in seen:
            errors.append('%s is listed twice' % where)
        seen.append(p['file'])
        if not is_str(p.get('name'), K.LIMITS['name'], False):
            errors.append('%s: name must be text up to %d characters' % (where, K.LIMITS['name']))
        if p.get('size') != spec['size']:
            errors.append('%s: size must be "%s"' % (where, spec['size']))
        if p.get('bleed') != '%.3fin' % K.BLEED:
            errors.append('%s: bleed must be "%.3fin"' % (where, K.BLEED))
        if p.get('pages') != spec['pages']:
            errors.append('%s: pages must be %s' % (where, json.dumps(spec['pages'])))
        qr = p.get('qr')
        if not isinstance(qr, list) or len(qr) > K.LIMITS['qr']:
            errors.append('%s: qr must be a list of at most %d codes' % (where, K.LIMITS['qr']))
            qr = []
        for j, q in enumerate(qr):
            w = '%s qr[%d]' % (where, j)
            if not isinstance(q, dict):
                errors.append('%s is not an object' % w)
                continue
            if sorted(q.keys()) != sorted(QR_KEYS):
                errors.append('%s: keys must be exactly %s' % (w, ', '.join(QR_KEYS)))
            if q.get('kind') not in K.QR_KINDS:
                errors.append('%s: kind must be one of %s' % (w, ', '.join(K.QR_KINDS)))
            if not is_str(q.get('label'), K.LIMITS['label'], False):
                errors.append('%s: label must be text up to %d characters' % (w, K.LIMITS['label']))
            if not is_str(q.get('url'), K.LIMITS['url']) or not is_str(q.get('vcard'), K.LIMITS['vcard']):
                errors.append('%s: url (up to %d) and vcard (up to %d) must be strings' % (w, K.LIMITS['url'], K.LIMITS['vcard']))
            size = q.get('sizeIn')
            if isinstance(size, bool) or not isinstance(size, (int, float)) or size < K.QR_MIN_IN or size > 4:
                errors.append('%s: sizeIn must be a number from %.2f to 4' % (w, K.QR_MIN_IN))
        text = p.get('text')
        if not isinstance(text, list) or len(text) > K.LIMITS['textLines'] or not all(is_str(t, K.LIMITS['text']) for t in text):
            errors.append('%s: text must be a list of at most %d lines of up to %d characters' % (where, K.LIMITS['textLines'], K.LIMITS['text']))
        if not is_str(p.get('note'), K.LIMITS['note']):
            errors.append('%s: note must be text up to %d characters' % (where, K.LIMITS['note']))
    if seen != [f for f in order if f in seen]:
        errors.append('print.json: pieces must be in this order: %s' % ', '.join(order))
    omitted = data.get('omitted')
    if not isinstance(omitted, list):
        errors.append('print.json: omitted must be a list')
    else:
        for o in omitted:
            if not isinstance(o, dict) or sorted(o.keys()) != ['file', 'reason'] or o.get('file') not in [p['file'] for p in K.PIECES if p['review']] \
                    or not is_str(o.get('reason'), K.LIMITS['reason'], False):
                errors.append('print.json: omitted entries are { file (a review piece), reason (up to %d characters) }' % K.LIMITS['reason'])
    fonts = data.get('fonts')
    if not isinstance(fonts, dict) or sorted(fonts.keys()) != ['body', 'fallback', 'heading'] \
            or not is_str(fonts.get('heading'), K.LIMITS['font']) or not is_str(fonts.get('body'), K.LIMITS['font']) or not isinstance(fonts.get('fallback'), bool):
        errors.append('print.json: fonts must be { heading, body, fallback (true/false) }')
    colors = data.get('colors')
    if not isinstance(colors, dict) or sorted(colors.keys()) != ['accent', 'cmykRisk', 'ink', 'panel']:
        errors.append('print.json: colors must be { panel, ink, accent, cmykRisk }')
    else:
        for k in ('panel', 'ink', 'accent'):
            if not K.HEX_RE.match(str(colors.get(k))):
                errors.append('print.json: colors.%s must be #rrggbb (lowercase)' % k)
        risk = colors.get('cmykRisk')
        if not isinstance(risk, list) or len(risk) > K.LIMITS['risk'] or not all(K.HEX_RE.match(str(h)) for h in risk):
            errors.append('print.json: colors.cmykRisk must be a list of at most %d #rrggbb colors' % K.LIMITS['risk'])
    notes = data.get('notes')
    if not isinstance(notes, list) or len(notes) > K.LIMITS['notes'] or not all(is_str(n, K.LIMITS['note']) for n in notes):
        errors.append('print.json: notes must be a list of at most %d lines of up to %d characters' % (K.LIMITS['notes'], K.LIMITS['note']))
    return True


def check_targets(data, inputs, errors):
    links = inputs.get('links') or {}
    review = bool(links.get('review'))
    made = {p.get('file'): p for p in data.get('pieces') or [] if isinstance(p, dict)}
    omitted = [o.get('file') for o in data.get('omitted') or [] if isinstance(o, dict)]
    for spec in K.PIECES:
        f = spec['file']
        if spec['review'] and not review:
            if f in made:
                errors.append('%s: there is no review link, so this piece must be left out' % f)
            if f not in omitted:
                errors.append('%s: list it in "omitted" with the reason (no Google profile is linked)' % f)
        elif f not in made:
            errors.append('%s is missing from pieces (it must be made)' % f)
    for f, p in made.items():
        codes = [q for q in p.get('qr') or [] if isinstance(q, dict)]
        kinds = [q.get('kind') for q in codes]
        spec = K.PIECE_BY_FILE.get(f)
        if spec and spec['review'] and 'review' not in kinds:
            errors.append('%s: a review piece needs its review code' % f)
        if f == 'glovebox-card.pdf' and (('contact' not in kinds) if links.get('vcard') else not codes):
            errors.append('%s: needs its save-contact code' % f)
        for q in codes:
            kind = q.get('kind')
            if kind not in K.QR_KINDS:
                continue
            want = K.link_for(kind, links)
            label = q.get('label') or kind
            if not want:
                errors.append('%s: the "%s" code is a %s code, and the request has no %s link' % (f, label, kind, kind))
            elif kind == 'contact':
                if q.get('vcard') != want or q.get('url'):
                    errors.append('%s: the contact code must hold exactly links.vcard (and url "")' % f)
            elif q.get('url') != want or q.get('vcard'):
                errors.append('%s: the "%s" code points to %r; it must be exactly links.%s = %r (and vcard "")' % (f, label, q.get('url'), kind, want))


# ─── PDF ────────────────────────────────────────────────────────────────

def box(page, name):
    b = page.get(name)
    return [float(v) for v in b] if b is not None else None


def near(a, b):
    return a is not None and b is not None and len(a) == len(b) and all(abs(x - y) <= TOL for x, y in zip(a, b))


def page_strokes(page, reader):
    """[(x0, y0, x1, y1, stroke colorspace)] for every stroked straight segment."""
    from pypdf.generic import ContentStream
    contents = page.get_contents()
    if contents is None:
        return []
    ctm = [1, 0, 0, 1, 0, 0]
    stack = []
    cs = None
    path = []
    cur = start = None
    out = []
    for operands, op in ContentStream(contents, reader).operations:
        if op == b'q':
            stack.append((ctm, cs))
        elif op == b'Q':
            ctm, cs = stack.pop() if stack else ([1, 0, 0, 1, 0, 0], None)
        elif op == b'cm':
            ctm = qr_decode._mul([float(v) for v in operands], ctm)
        elif op == b'CS':
            cs = str(operands[0])
        elif op in (b'RG', b'K', b'G'):
            cs = 'Device'
        elif op == b'm':
            cur = start = qr_decode._apply(ctm, float(operands[0]), float(operands[1]))
        elif op == b'l' and cur is not None:
            nxt = qr_decode._apply(ctm, float(operands[0]), float(operands[1]))
            path.append((cur[0], cur[1], nxt[0], nxt[1]))
            cur = nxt
        elif op in (b'c', b'v', b'y') and len(operands) >= 4:
            # A curve: no straight segment, but the pen moves to its end.
            cur = qr_decode._apply(ctm, float(operands[-2]), float(operands[-1]))
        elif op == b'h' and cur is not None:
            cur = start
        elif op in (b'S', b's', b'B', b'b', b'B*', b'b*'):
            out.extend(seg + (cs,) for seg in path)
            path = []
        elif op in (b'n', b'f', b'F', b'f*', b'W', b'W*'):
            if op != b'W' and op != b'W*':
                path = []
    return out


def crop_mark_count(page, reader, trim, bleed):
    count = 0
    xs, ys = (trim[0], trim[2]), (trim[1], trim[3])
    for x0, y0, x1, y1, cs in page_strokes(page, reader):
        outside = all(x < bleed[0] - TOL or x > bleed[2] + TOL or y < bleed[1] - TOL or y > bleed[3] + TOL for x, y in ((x0, y0), (x1, y1)))
        on_line = (abs(x0 - x1) <= TOL and any(abs(x0 - x) <= TOL for x in xs)) or (abs(y0 - y1) <= TOL and any(abs(y0 - y) <= TOL for y in ys))
        if outside and on_line and cs == '/All':
            count += 1
    return count


def separations(page):
    out = set()
    res = page.get('/Resources') or {}
    spaces = res.get('/ColorSpace') or {}
    spaces = spaces.get_object() if hasattr(spaces, 'get_object') else spaces
    for v in spaces.values():
        arr = v.get_object()
        if isinstance(arr, list) and len(arr) > 1 and str(arr[0]) == '/Separation':
            out.add(str(arr[1]).lstrip('/'))
    return out


def unembedded_fonts(page):
    bad = []
    res = page.get('/Resources') or {}
    fonts = res.get('/Font') or {}
    fonts = fonts.get_object() if hasattr(fonts, 'get_object') else fonts
    for name, ref in fonts.items():
        f = ref.get_object()
        desc = f.get('/FontDescriptor')
        if f.get('/Subtype') == '/Type0':
            kids = f.get('/DescendantFonts') or []
            desc = kids[0].get_object().get('/FontDescriptor') if kids else None
        desc = desc.get_object() if desc is not None else None
        if not desc or not any(k in desc for k in ('/FontFile', '/FontFile2', '/FontFile3')):
            bad.append(str(f.get('/BaseFont') or name))
    return bad


def check_pdf(p, spec, pdf_dir, errors, warnings, info):
    from pypdf import PdfReader
    f = p['file']
    path = os.path.join(pdf_dir, f)
    if not os.path.isfile(path):
        errors.append('%s: the PDF is missing in %s' % (f, pdf_dir))
        return
    with open(path, 'rb') as fh:
        if fh.read(5) != b'%PDF-':
            errors.append('%s: not a PDF' % f)
            return
    try:
        reader = PdfReader(path)
        pages = reader.pages
    except Exception as e:
        errors.append('%s: could not open it (%s)' % (f, e))
        return
    W, H = float(spec['w']), float(spec['h'])
    S, B = K.SLUG * I, K.BLEED * I
    trim = [S, S, S + W * I, S + H * I]
    bleed = [S - B, S - B, S + W * I + B, S + H * I + B]
    media = [0, 0, (W + 2 * K.SLUG) * I, (H + 2 * K.SLUG) * I]
    if len(pages) != len(spec['pages']):
        errors.append('%s: %d pages; it must have %d (%s)' % (f, len(pages), len(spec['pages']), ', '.join(spec['pages'])))
    for i, page in enumerate(pages):
        side = spec['pages'][i] if i < len(spec['pages']) else 'extra'
        where = '%s page %d (%s)' % (f, i + 1, side)
        if not near(box(page, '/MediaBox'), media):
            errors.append('%s: MediaBox %s, expected %s (trim + 0.5 in slug each side)' % (where, box(page, '/MediaBox'), media))
        if not near(box(page, '/TrimBox'), trim):
            errors.append('%s: TrimBox %s, expected %s (%s)' % (where, box(page, '/TrimBox'), trim, spec['size']))
        if not near(box(page, '/BleedBox'), bleed):
            errors.append('%s: BleedBox %s, expected %s (0.125 in bleed)' % (where, box(page, '/BleedBox'), bleed))
        marks = crop_mark_count(page, reader, trim, bleed)
        if marks < 8:
            errors.append('%s: %d crop marks in the registration color; expected 8' % (where, marks))
        bad = unembedded_fonts(page)
        if bad:
            errors.append('%s: fonts not embedded: %s' % (where, ', '.join(sorted(set(bad)))))
        seps = separations(page)
        if side == 'die-line':
            if 'DieCut' not in seps:
                errors.append('%s: the die-line must be drawn in the DieCut spot color' % where)
        elif 'DieCut' in seps:
            errors.append('%s: the DieCut spot color belongs on the die-line page only' % where)
    if 'die-line' in spec['pages'] and spec['pages'][-1] != 'die-line':
        errors.append('%s: the die-line must be the last page' % f)

    # The codes, read back from the PDF.
    try:
        found = qr_decode.pdf_codes(path)
    except Exception as e:
        errors.append('%s: could not read its codes (%s)' % (f, e))
        return
    hole = spec.get('hole')
    hole_bottom = (S + (H - hole['fromTop'] - hole['d'] / 2.0 - hole['clearIn'] + 0.05) * I) if hole else None
    for c in found:
        where = '%s page %d %s code' % (f, c['page'] + 1, c['kind'])
        if 'error' in c:
            errors.append('%s: unreadable (%s)' % (where, c['error']))
            continue
        size_in = c['size'] / I
        module_mm = size_in / c['modules'] * 25.4
        c['sizeIn'], c['moduleMm'] = round(size_in, 3), round(module_mm, 3)
        if size_in < K.QR_MIN_IN - 0.005:
            errors.append('%s: prints %.2f in; at least %.2f in' % (where, size_in, K.QR_MIN_IN))
        if module_mm < K.MODULE_MIN_MM:
            errors.append('%s: modules are %.2f mm; at least %.2f mm (make the code bigger or the content shorter)' % (where, module_mm, K.MODULE_MIN_MM))
        elif module_mm < K.MODULE_WARN_MM:
            warnings.append('%s: modules are %.2f mm; it scans best from %.1f mm' % (where, module_mm, K.MODULE_WARN_MM))
        quiet = K.QUIET * c['size'] / c['modules']
        safe = K.SAFE * I
        if c['x'] - quiet < trim[0] + safe / 2 - TOL or c['y'] - quiet < trim[1] + safe / 2 - TOL \
                or c['x'] + c['size'] + quiet > trim[2] - safe / 2 + TOL or c['y'] + c['size'] + quiet > trim[3] - safe / 2 + TOL:
            errors.append('%s: the code and its quiet zone must sit inside the trim, away from the cut' % where)
        if hole_bottom is not None and c['y'] + c['size'] + quiet > hole_bottom:
            errors.append('%s: the code reaches into the mirror hole area' % where)
    listed = sorted((q.get('kind'), q.get('vcard') if q.get('kind') == 'contact' else q.get('url')) for q in p.get('qr') or [] if isinstance(q, dict))
    printed = sorted((c['kind'], c.get('text')) for c in found)
    if listed != printed:
        errors.append('%s: the codes in the PDF %s are not the codes print.json lists %s' % (
            f, json.dumps([[k, (t or '')[:60]] for k, t in printed]), json.dumps([[k, (t or '')[:60]] for k, t in listed])))
    for q in p.get('qr') or []:
        if not isinstance(q, dict):
            continue
        target = q.get('vcard') if q.get('kind') == 'contact' else q.get('url')
        match = [c for c in found if c['kind'] == q.get('kind') and c.get('text') == target]
        if match and isinstance(q.get('sizeIn'), (int, float)) and abs(match[0]['size'] / I - q['sizeIn']) > 0.02:
            errors.append('%s: the %s code prints at %.2f in, print.json says %.2f in' % (f, q.get('kind'), match[0]['size'] / I, q['sizeIn']))
    info.append({'file': f, 'pages': len(pages), 'codes': [{'kind': c['kind'], 'page': c['page'] + 1, 'sizeIn': c.get('sizeIn'),
                                                             'moduleMm': c.get('moduleMm'), 'text': (c.get('text') or '')[:80]} for c in found]})

    # Every listed line should be in the PDF's text (wrapped lines join).
    try:
        pdf_text = K.norm_text(' '.join(pg.extract_text() or '' for pg in pages))
    except Exception:
        pdf_text = ''
    flat = pdf_text.replace(' ', '')
    for line in p.get('text') or []:
        # Spaces aside: a long email or address may break across lines.
        if isinstance(line, str) and pdf_text and K.norm_text(line).replace(' ', '') not in flat:
            warnings.append('%s: "%s" is listed in text but not found in the PDF text' % (f, line[:60]))


def check_text(data, inputs, errors):
    facts = K.facts_text(inputs)
    own = K.own_names(inputs)
    for p in data.get('pieces') or []:
        if not isinstance(p, dict) or p.get('file') not in K.PIECE_BY_FILE:
            continue
        lines = [t for t in p.get('text') or [] if isinstance(t, str)]
        for line, phrase in K.claim_flags(lines, facts):
            errors.append('%s: "%s" claims "%s", which the facts in print-inputs.json don\'t say' % (p['file'], line, phrase))
        for line, phrase in K.review_flags(lines, K.PIECE_BY_FILE[p['file']]['review'], own):
            errors.append('%s: "%s" goes against Google\'s review policy ("%s": no incentives, no asking only happy customers)' % (p['file'], line, phrase))


def validate(print_json, inputs_path, pdf_dir=None):
    errors, warnings, info = [], [], []
    inputs, in_errors = K.load_inputs(inputs_path)
    if in_errors:
        return ['print-inputs.json: ' + e for e in in_errors], warnings, info
    try:
        with open(print_json, encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        return ['%s: not valid JSON (%s)' % (print_json, e)], warnings, info
    if not check_shape(data, errors):
        return errors, warnings, info
    check_targets(data, inputs, errors)
    check_text(data, inputs, errors)
    pdf_dir = pdf_dir or os.path.dirname(os.path.abspath(print_json))
    for p in data.get('pieces') or []:
        spec = K.PIECE_BY_FILE.get(p.get('file')) if isinstance(p, dict) else None
        if spec:
            check_pdf(p, spec, pdf_dir, errors, warnings, info)
    # Delivery copies every PDF in the folder: a piece PDF print.json doesn't
    # list (an earlier build's, or one made by hand) would reach the server
    # unchecked.
    listed = {p.get('file') for p in data.get('pieces') or [] if isinstance(p, dict)}
    for spec in K.PIECES:
        if spec['file'] not in listed and os.path.isfile(os.path.join(pdf_dir, spec['file'])):
            errors.append('%s is in %s but not in print.json: build again (it clears it) or delete it' % (spec['file'], pdf_dir))
    return errors, warnings, info


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('print_json')
    ap.add_argument('--inputs', required=True)
    ap.add_argument('--pdf-dir', default='')
    args = ap.parse_args(argv[1:])
    errors, warnings, info = validate(args.print_json, args.inputs, args.pdf_dir or None)
    for i in info:
        print('%s: %d page(s); codes: %s' % (i['file'], i['pages'], '; '.join(
            'p%d %s %.2f in (%.2f mm modules) -> %s' % (c['page'], c['kind'], c['sizeIn'] or 0, c['moduleMm'] or 0, c['text'].replace('\r\n', ' | ')) for c in i['codes']) or 'none'))
    for w in warnings:
        print('warning: ' + w)
    if errors:
        print('\n%d error(s):' % len(errors))
        for e in errors:
            print('- ' + e)
        return 1
    print('OK')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
