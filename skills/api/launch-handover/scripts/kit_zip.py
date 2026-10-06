"""launch-kit.zip: every kit file the server sent, one folder per kit part
(data/contract.json zipParts), the handover PDF and a README.txt at the
top, plus plain-text files made from the inputs: the brand's colors and
fonts (brand-colors.txt), the words to paste (paste-ready.txt) and the
social captions (captions.txt).

The server takes the zip back only under its size cap, so the zip is kept
under `maxBytes` (handover-inputs.json zip.maxBytes): when it would be
bigger, the files data/kit_files.json ranks lowest ('keep') go first,
largest first, and each one is listed in `left` with the reason.

Text files use CRLF line endings, so they read right in Windows Notepad
as well as on a Mac or a phone.
"""
import os
import re
import zipfile

from common import GENERATED, PARTS, ROOT_FILES, is_zip_path, kit_file_info, one_line, valid_palette, zip_path

# Already compressed: deflating them again only costs time.
STORED_EXT = ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.zip')
CRLF = '\r\n'
RULE = '=' * 60
ROLE_LABELS = (('bg', 'Background'), ('secondary', 'Surface'), ('text', 'Text'), ('muted', 'Soft text'),
               ('accent', 'Accent (buttons and links)'))


def _lines(*parts):
    text = '\n'.join(parts).replace('\r\n', '\n').replace('\r', '\n')
    return text.replace('\n', CRLF) + CRLF


def _d(v):
    return v if isinstance(v, dict) else {}


def _l(v):
    return v if isinstance(v, list) else []


def _s(v):
    """A text from the inputs, or '' (the server sanitized it; this only
    keeps a wrong type from breaking the script)."""
    return v.strip() if isinstance(v, str) else ''


def _heading(title):
    return [RULE, title, RULE, '']


def brand_colors_text(look, brand, business):
    """The brand's colors and fonts as plain text: what a sign shop, wrap
    installer or printer asks for."""
    palette = look.get('palette')
    out = ['%s: brand colors and fonts' % business, '',
           'Give these to anyone who makes something for you (signs, shirts, a van wrap, print) so it matches your site.', '']
    out += _heading('COLORS ON YOUR SITE')
    for role, label in ROLE_LABELS:
        out.append('%-28s %s' % (label + ':', palette[role].upper()))
    out.append('')
    alts = _d(_d(brand).get('alternates'))
    for key, title in (('light', 'LIGHT VERSION (for light backgrounds)'), ('dark', 'DARK VERSION (for dark backgrounds)')):
        if valid_palette(alts.get(key)):
            out += _heading(title)
            for role, label in ROLE_LABELS:
                out.append('%-28s %s' % (label + ':', alts[key][role].upper()))
            out.append('')
    fonts = _d(look.get('fonts'))
    if _s(fonts.get('heading')) or _s(fonts.get('body')):
        out += _heading('FONTS (free from Google Fonts: fonts.google.com)')
        if _s(fonts.get('heading')):
            out.append('Headings:  %s' % _s(fonts['heading']))
        if _s(fonts.get('body')):
            out.append('Body text: %s' % _s(fonts['body']))
        out.append('')
    return _lines(*out)


def paste_ready_text(words, business):
    """The words run's copy as plain text, in the order it gets pasted."""
    out = ['%s: copy deck (plain text)' % business, '',
           'Paste each part where it goes. Nothing here has been posted for you.', '']
    gbp = _d(words.get('gbp'))
    services = [s for s in _l(gbp.get('services')) if isinstance(s, dict) and _s(s.get('name'))]
    posts = [p for p in _l(gbp.get('posts')) if isinstance(p, dict) and (_s(p.get('title')) or _s(p.get('body')))]
    cats = [_s(c.get('name') if isinstance(c, dict) else c) for c in _l(gbp.get('categories'))]
    cats = [c for c in cats if c]
    if _s(gbp.get('description')) or services or posts or cats:
        out += _heading('GOOGLE BUSINESS PROFILE')
        if _s(gbp.get('description')):
            out += ['Business description:', _s(gbp['description']), '']
        if cats:
            out += ['Categories to pick in your profile (the first one as your main category; check each name in the category box):']
            out += ['- %s' % c for c in cats] + ['']
        if services:
            out += ['Services:']
            for s in services:
                out += ['- %s' % _s(s['name'])] + (['  %s' % _s(s.get('description'))] if _s(s.get('description')) else [])
            out += ['']
        if posts:
            out += _heading('GOOGLE POSTS (one a week)')
            for i, p in enumerate(posts, 1):
                out += ['Post %d: %s' % (i, _s(p.get('title')))]
                if _s(p.get('body')):
                    out += [_s(p['body'])]
                cta = _s(p.get('cta'))
                if cta:
                    # The server set each button link from the site's own
                    # links; anything that isn't a web address is left out.
                    link = _s(p.get('link')) if re.match(r'https?://[^\s<>"]+$', _s(p.get('link'))) else ''
                    out += ['Button: %s%s' % (cta.replace('_', ' ').title(), ' (%s)' % link if link else '')]
                if _s(p.get('imageHint')):
                    out += ['Photo: %s' % _s(p['imageHint'])]
                out += ['']
    reviews = _d(words.get('reviews'))
    email = _d(reviews.get('requestEmail'))
    replies = [r for r in _l(reviews.get('replies')) if isinstance(r, dict) and _s(r.get('text'))]
    if _s(reviews.get('requestSms')) or _s(email.get('body')) or replies:
        out += _heading('ASKING FOR REVIEWS')
        out += ['Never offer anything in return for a review: Google does not allow it.']
        if '[review link]' in (_s(reviews.get('requestSms')) + _s(email.get('body'))):
            out += ['Replace [review link] with your Google review link before you send it.']
        out += ['']
        if _s(reviews.get('requestSms')):
            out += ['Text message:', _s(reviews['requestSms']), '']
        if _s(email.get('body')):
            out += ['Email subject: %s' % _s(email.get('subject')), _s(email['body']), '']
        for r in replies:
            rating = r.get('rating')
            label = '%d-star' % rating if isinstance(rating, int) and not isinstance(rating, bool) else 'a'
            out += ['Reply to a %s review:' % label, _s(r['text']), '']
    social = _d(words.get('social'))
    captions = [_s(c) for c in _l(social.get('captions')) if _s(c)]
    if _s(social.get('bio')) or captions:
        out += _heading('SOCIAL')
        if _s(social.get('bio')):
            out += ['Bio:', _s(social['bio']), '']
        for i, c in enumerate(captions, 1):
            out += ['Caption %d:' % i, c, '']
    seo = _d(words.get('seo'))
    if _s(seo.get('title')) or _s(seo.get('description')):
        out += _heading('SEARCH LISTING (your site already uses these; keep them for whoever edits it)')
        if _s(seo.get('title')):
            out += ['Page title: %s' % _s(seo['title'])]
        if _s(seo.get('description')):
            out += ['Description: %s' % _s(seo['description'])]
        out += ['']
    return _lines(*out)


def captions_text(social, business):
    out = ['%s: social captions' % business, '', 'Each caption goes with the image named above it.', '']
    for c in _l(social.get('captions')):
        if isinstance(c, dict) and _s(c.get('text')):
            out += [_s(c.get('file')) or 'Caption', _s(c['text']), '']
    return _lines(*out)


def _has_words_text(words):
    gbp = _d(words.get('gbp'))
    reviews = _d(words.get('reviews'))
    social = _d(words.get('social'))
    seo = _d(words.get('seo'))
    return bool(_s(gbp.get('description')) or _l(gbp.get('services')) or _l(gbp.get('posts'))
                or _s(reviews.get('requestSms')) or _l(reviews.get('replies')) or _s(social.get('bio'))
                or _l(social.get('captions')) or _s(seo.get('title')))


def generated_files(inputs):
    """{zip path: text} for the plain-text files made from the inputs."""
    parts = _d(inputs.get('parts'))
    business = one_line(_s(_d(inputs.get('business')).get('name')) or 'Your business')
    out = {}
    look = _d(inputs.get('look'))
    if valid_palette(look.get('palette')):
        out['%s/%s' % (_folder('brand'), GENERATED['brand'])] = brand_colors_text(look, inputs.get('brand'), business)
    words = parts.get('words')
    if isinstance(words, dict) and _has_words_text(words):
        out['%s/%s' % (_folder('words'), GENERATED['words'])] = paste_ready_text(words, business)
    social = parts.get('social')
    if isinstance(social, dict) and any(isinstance(c, dict) and _s(c.get('text')) for c in _l(social.get('captions'))):
        out['%s/%s' % (_folder('social'), GENERATED['social'])] = captions_text(social, business)
    return out


def _folder(key):
    return next(p['folder'] for p in PARTS if p['key'] == key)


def readme_text(inputs, entries):
    """README.txt: what each folder holds, for someone who unzipped it."""
    business = one_line(_s(_d(inputs.get('business')).get('name')) or 'Your business')
    out = ['%s: Launch Kit' % business, '',
           'Start with handover.pdf: what we built, your links, how to edit your site and what to do first.', '']
    by_folder = {}
    for e in entries:
        folder = e['zip'].split('/', 1)[0] if '/' in e['zip'] else ''
        by_folder.setdefault(folder, []).append(e)
    for part in PARTS:
        files = by_folder.get(part['folder'])
        if not files:
            continue
        out += ['%s (%s)' % (part['folder'], part['label'])]
        for e in files:
            info = kit_file_info(part['key'], e['zip'].split('/', 1)[1])
            out += ['  %s: %s' % (e['zip'].split('/', 1)[1], info['what'] or info['label'])]
            if info.get('use'):
                out += ['    %s' % info['use']]
        out += ['']
    return _lines(*out)


def zip_entries(inputs, plan):
    """Everything the zip should hold besides the PDF and README, before
    the size cap: [{zip, source (path) | text (bytes), key, keep, bytes}]."""
    entries = []
    for f in plan.get('zipFiles') or []:
        if f.get('path') and os.path.isfile(f['path']) and is_zip_path(f['zip']):
            entries.append({'zip': f['zip'], 'source': f['path'], 'key': f['key'], 'keep': f.get('keep', 9),
                            'bytes': os.path.getsize(f['path'])})
    for path, text in generated_files(inputs).items():
        data = text.encode('utf-8')
        key = next(p['key'] for p in PARTS if path.startswith(p['folder'] + '/'))
        entries.append({'zip': path, 'text': data, 'key': key, 'keep': 1, 'bytes': len(data)})
    order = {p['key']: i for i, p in enumerate(PARTS)}
    entries.sort(key=lambda e: (order.get(e['key'], 99), e['zip']))
    return entries


# The zip's own headers, the README and some slack.
ZIP_OVERHEAD = 64 * 1024


# Per entry: its local header, its central directory record and the name
# twice, rounded up.
ENTRY_OVERHEAD = 200


def fit_entries(entries, budget):
    """(kept, dropped): drops the lowest-ranked ('keep'), largest files
    until the sum fits `budget` bytes, then puts back what still fits, best
    ranked and smallest first (dropping a big post can leave room for the
    small contact sheet that went before it). Keeps the entries' order."""
    cost = lambda e: e['bytes'] + ENTRY_OVERHEAD  # noqa: E731
    kept = list(entries)
    dropped = []
    total = sum(cost(e) for e in kept)
    while total > budget and kept:
        drop = max(kept, key=lambda e: (e['keep'], e['bytes']))
        kept.remove(drop)
        total -= cost(drop)
        dropped.append(drop)
    for e in sorted(dropped, key=lambda e: (e['keep'], e['bytes'])):
        if total + cost(e) <= budget:
            dropped.remove(e)
            total += cost(e)
            kept.append(e)
    position = {id(e): i for i, e in enumerate(entries)}
    kept.sort(key=lambda e: position[id(e)])
    dropped.sort(key=lambda e: position[id(e)])
    return kept, dropped


def budget_for(max_bytes, pdf_bytes):
    return max_bytes - pdf_bytes - ZIP_OVERHEAD


TOO_LARGE = 'Too large to fit in the zip; ask us and we will send it separately.'
NOT_ADDED = 'Could not be added this time; ask us and we will send it separately.'


def left_entries(dropped, plan, inputs):
    """What was meant for the zip but isn't in it: dropped for size, or
    sent by the server and not found in the container, or not sent."""
    left = [{'file': e['zip'], 'reason': TOO_LARGE} for e in dropped]
    for f in plan.get('zipFiles') or []:
        if not f.get('path') and is_zip_path(f.get('zip')):
            left.append({'file': f['zip'], 'reason': NOT_ADDED})
    for s in inputs.get('kitSkipped') or []:
        z = zip_path(s.get('key'), s.get('name')) if isinstance(s, dict) else ''
        if is_zip_path(z) and all(l['file'] != z for l in left):
            left.append({'file': z, 'reason': TOO_LARGE if 'large' in (s.get('reason') or '').lower() or 'size' in (s.get('reason') or '').lower() else NOT_ADDED})
    return left


def write_zip(out_path, inputs, kept, pdf_path, date_time=(2026, 1, 1, 0, 0, 0)):
    """Writes launch-kit.zip: handover.pdf and README.txt first, then the
    kept entries. Returns the zip paths in order."""
    readme = readme_text(inputs, kept).encode('utf-8')

    def add(zf, name, data=None, source=None):
        info = zipfile.ZipInfo(name, date_time=date_time)
        info.external_attr = 0o644 << 16
        info.compress_type = zipfile.ZIP_STORED if name.lower().endswith(STORED_EXT) else zipfile.ZIP_DEFLATED
        if source is not None:
            with open(source, 'rb') as f:
                data = f.read()
        zf.writestr(info, data)

    files = []
    with zipfile.ZipFile(out_path, 'w') as zf:
        add(zf, ROOT_FILES[0], source=pdf_path)
        add(zf, ROOT_FILES[1], data=readme)
        files += ROOT_FILES[:2]
        for e in kept:
            add(zf, e['zip'], data=e.get('text'), source=e.get('source'))
            files.append(e['zip'])
    return files
