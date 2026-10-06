"""vCard 3.0 (RFC 2426) for the business's contact card: built only from
mobile-inputs.json (the confirmed facts), and read back by the validator.

  vcard.py check contact.vcf        prints the card's properties as JSON; exit 1 on a format problem

Format: CRLF line endings, lines folded at 75 octets (a continuation starts
with one space), commas, semicolons, backslashes and line breaks escaped in
text values. iPhone and Android both import this form; X-ABShowAs:COMPANY
makes iOS file it as a business, and PHOTO (optional) is the 180 px icon so
the contact shows the logo.
"""
import base64
import json
import re
import sys

PRODID = '-//Genius Websites//Launch Kit//EN'
MAX_OCTETS = 75


def escape(v):
    return (v.replace('\\', '\\\\').replace('\r\n', '\n').replace('\r', '\n')
            .replace('\n', '\\n').replace(',', '\\,').replace(';', '\\;'))


def unescape(v):
    out = []
    i = 0
    while i < len(v):
        c = v[i]
        if c == '\\' and i + 1 < len(v):
            n = v[i + 1]
            out.append('\n' if n in 'nN' else n)
            i += 2
            continue
        out.append(c)
        i += 1
    return ''.join(out)


def uri(v):
    """A link as a vCard value: commas and semicolons would read as separators."""
    return v.replace(',', '%2C').replace(';', '%3B')


def fold(line):
    """One logical line as physical lines of at most 75 octets, never
    splitting a UTF-8 character (continuations start with one space)."""
    if len(line.encode('utf-8')) <= MAX_OCTETS:
        return [line]
    out, cur, size = [], '', 0
    for ch in line:
        n = len(ch.encode('utf-8'))
        if size + n > MAX_OCTETS:
            out.append(cur)
            cur, size = ' ', 1
        cur += ch
        size += n
    out.append(cur)
    return out


def address_parts(addr):
    """The card's street, city, region and postal parts: mobile-inputs.json's
    address.adr (a street that already names the city is the whole address
    there, so the card doesn't repeat it), else the separate fields."""
    adr = addr.get('adr')
    if isinstance(adr, list) and len(adr) == 4 and all(isinstance(p, str) for p in adr):
        return list(adr)
    return [addr.get('street') or '', addr.get('city') or '', addr.get('state') or '', addr.get('zip') or '']


def build_vcard(facts, photo_png=None):
    """The card's text (CRLF, ending in CRLF) from the facts. Fields the facts
    don't have are left out; nothing is guessed."""
    biz = facts.get('business') or {}
    phone = facts.get('phone') or {}
    addr = facts.get('address') or {}
    name = biz.get('name') or ''
    if not name:
        raise ValueError('the inputs have no business name')
    lines = ['BEGIN:VCARD', 'VERSION:3.0', 'PRODID:' + PRODID, 'N:;;;;', 'FN:' + escape(name), 'ORG:' + escape(name)]
    # Only a number that dials (common.vcard_of): never text such as
    # "call or text 555-0100 or 555-0199".
    dial = phone.get('dial') or ''
    tel = (phone.get('e164') or phone.get('display') or dial) if dial else ''
    if tel:
        lines.append('TEL;TYPE=WORK,VOICE:' + escape(tel))
    if facts.get('email'):
        lines.append('EMAIL;TYPE=INTERNET,WORK:' + escape(facts['email']))
    if facts.get('website'):
        lines.append('URL:' + uri(facts['website']))
    parts = address_parts(addr)
    if any(parts):
        lines.append('ADR;TYPE=WORK:;;' + ';'.join(escape(p) for p in parts) + ';')
    for s in facts.get('social') or []:
        if isinstance(s, dict) and s.get('url') and re.fullmatch(r'[a-z]{2,20}', s.get('type') or ''):
            lines.append('X-SOCIALPROFILE;TYPE=%s:%s' % (s['type'], uri(s['url'])))
    lines.append('X-ABShowAs:COMPANY')
    if photo_png:
        lines.append('PHOTO;ENCODING=b;TYPE=PNG:' + base64.b64encode(photo_png).decode('ascii'))
    lines.append('END:VCARD')
    physical = []
    for line in lines:
        physical += fold(line)
    return '\r\n'.join(physical) + '\r\n'


def _split_prop(line):
    """(NAME, {PARAM: value}, raw value) of one unfolded line, or None."""
    in_quotes = False
    for i, c in enumerate(line):
        if c == '"':
            in_quotes = not in_quotes
        elif c == ':' and not in_quotes:
            head, value = line[:i], line[i + 1:]
            bits = head.split(';')
            name = bits[0].upper()
            params = {}
            for b in bits[1:]:
                k, _, v = b.partition('=')
                params[k.upper()] = v
            return name, params, value
    return None


def parse_vcard(data):
    """(props, problems) for a .vcf's bytes: props is a list of
    {name, params, value (unescaped), raw}. Problems are format errors a
    phone might refuse or misread."""
    problems = []
    try:
        text = data.decode('utf-8') if isinstance(data, bytes) else data
    except UnicodeDecodeError:
        return [], ['the card is not UTF-8']
    if text.startswith('\ufeff'):
        problems.append('the card starts with a byte-order mark')
        text = text[1:]
    if re.search(r'(?<!\r)\n', text) or re.search(r'\r(?!\n)', text):
        problems.append('the card must use CRLF line endings only')
    if not text.endswith('\r\n'):
        problems.append('the card must end with a line break')
    physical = text.replace('\r\n', '\n').split('\n')
    if physical and physical[-1] == '':
        physical.pop()
    for i, line in enumerate(physical):
        if len(line.encode('utf-8')) > MAX_OCTETS:
            problems.append('line %d is %d octets (fold at %d)' % (i + 1, len(line.encode('utf-8')), MAX_OCTETS))
    logical = []
    for line in physical:
        if line[:1] in (' ', '\t') and logical:
            logical[-1] += line[1:]
        else:
            logical.append(line)
    props = []
    for line in logical:
        p = _split_prop(line)
        if not p:
            problems.append('a line has no "name:value" form: %r' % line[:40])
            continue
        name, params, raw = p
        props.append({'name': name, 'params': params, 'value': unescape(raw), 'raw': raw})
    names = [p['name'] for p in props]
    if not props or props[0]['name'] != 'BEGIN' or props[0]['raw'].upper() != 'VCARD':
        problems.append('the card must start with BEGIN:VCARD')
    if not props or props[-1]['name'] != 'END' or props[-1]['raw'].upper() != 'VCARD':
        problems.append('the card must end with END:VCARD')
    if names.count('BEGIN') != 1 or names.count('END') != 1:
        problems.append('the file must hold exactly one card')
    if len(props) < 2 or props[1]['name'] != 'VERSION' or props[1]['raw'] != '3.0':
        problems.append('VERSION:3.0 must follow BEGIN:VCARD')
    for need in ('N', 'FN'):
        if names.count(need) != 1:
            problems.append('the card must have exactly one %s line (vCard 3.0 requires it)' % need)
    for p in props:
        if p['name'] == 'PHOTO':
            try:
                png = base64.b64decode(p['raw'], validate=True)
            except Exception:
                problems.append('PHOTO is not valid base64')
                continue
            if not png.startswith(b'\x89PNG\r\n\x1a\n'):
                problems.append('PHOTO is not a PNG')
    return props, problems


# The only properties the card may hold: everything in it comes from the
# facts, so anything else (a NOTE, a second TEL, a TITLE) was added by hand.
ALLOWED = ('BEGIN', 'VERSION', 'PRODID', 'N', 'FN', 'ORG', 'TEL', 'EMAIL', 'URL', 'ADR', 'X-SOCIALPROFILE',
           'X-ABSHOWAS', 'PHOTO', 'END')
ONCE = ('FN', 'ORG', 'TEL', 'EMAIL', 'URL', 'ADR', 'X-ABSHOWAS', 'PHOTO')
# Lines whose value is fixed, and the parameters build_vcard writes on each
# line (a parameter can carry text too: "TEL;X-NOTE=Voted #1:...").
FIXED = {'PRODID': PRODID, 'N': ';;;;', 'X-ABSHOWAS': 'COMPANY'}
PARAMS = {'TEL': {'TYPE': 'WORK,VOICE'}, 'EMAIL': {'TYPE': 'INTERNET,WORK'}, 'ADR': {'TYPE': 'WORK'},
          'PHOTO': {'ENCODING': 'b', 'TYPE': 'PNG'}}


def extra_problems(props, facts):
    """Properties the facts don't give: unknown names, repeats, changed
    fixed values or parameters, social profiles that aren't the site's."""
    out = []
    names = [p['name'] for p in props]
    for n in sorted(set(names) - set(ALLOWED)):
        out.append('the card has a %s line; only the facts go on it (build_plan.py writes it, never edit it)' % n)
    for n in ONCE:
        if names.count(n) > 1:
            out.append('the card has %d %s lines; one at most' % (names.count(n), n))
    social = {(s.get('type'), uri(s.get('url', ''))) for s in facts.get('social') or [] if isinstance(s, dict)}
    for p in props:
        name = p['name']
        if name in FIXED and p['raw'] != FIXED[name]:
            out.append('the card\'s %s line must be "%s" (build_plan.py writes it, never edit it)' % (name, FIXED[name]))
        if name == 'X-SOCIALPROFILE':
            if (p['params'].get('TYPE'), p['raw']) not in social or set(p['params']) != {'TYPE'}:
                out.append('the card links a social profile the site does not: %s' % p['raw'][:80])
        elif name in ALLOWED and p['params'] != PARAMS.get(name, {}):
            out.append('the card\'s %s line has parameters build_plan.py does not write: %s' % (
                name, ';'.join('%s=%s' % kv for kv in sorted(p['params'].items()))[:80] or '(none)'))
    return out


def card_fields(props):
    """The fields mobile.json's vcard object describes, read from a parsed card."""
    first = {}
    for p in props:
        first.setdefault(p['name'], p)
    adr = first.get('ADR')
    adr_line = ''
    if adr:
        parts = [unescape(x) for x in re.split(r'(?<!\\);', adr['raw'])]
        parts += [''] * (7 - len(parts))
        street, city, region, postal = parts[2], parts[3], parts[4], parts[5]
        adr_line = ', '.join(x for x in (street, city, ' '.join(y for y in (region, postal) if y)) if x)
    return {
        'fn': first['FN']['value'] if 'FN' in first else '',
        'org': first['ORG']['value'] if 'ORG' in first else '',
        'tel': first['TEL']['value'] if 'TEL' in first else '',
        'email': first['EMAIL']['value'] if 'EMAIL' in first else '',
        'url': first['URL']['raw'] if 'URL' in first else '',
        'adr': adr_line,
    }


def main(argv):
    if len(argv) != 3 or argv[1] != 'check':
        print(__doc__)
        return 2
    try:
        data = open(argv[2], 'rb').read()
    except OSError as e:
        print('FAIL: cannot read %s: %s' % (argv[2], e))
        return 2
    props, problems = parse_vcard(data)
    print(json.dumps({'fields': card_fields(props), 'properties': [p['name'] for p in props], 'problems': problems}, indent=2))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.dont_write_bytecode = True
    sys.exit(main(sys.argv))
