"""Reads the QR codes back out of a print PDF and decodes them.

build_print.py draws every code as its own PDF form (XObject) named
FormXob.QR_<kind>_<n>, with one 1x1 rectangle per dark module in module
units. This module finds those forms on each page, rebuilds the module
matrix from the rectangles, works out where and how big the form is printed
(the page's transformation matrix at its Do operator), and decodes the
matrix with a QR decoder written from the ISO 18004 layout (format bits,
function patterns, zigzag data order, block interleaving, numeric /
alphanumeric / byte segments). The decoder shares no code with the encoder
(reportlab's qrencoder), so a passing check means the printed code really
opens what print.json says.

The matrix is read as drawn (no camera, no damage), so the decoder needs no
Reed-Solomon correction; a matrix it can't read is an error.

  python3 qr_decode.py <file.pdf>      prints every code found, as JSON
"""
import json
import sys

sys.dont_write_bytecode = True

# ─── Tables (ISO 18004 table 9) ─────────────────────────────────────────
# Index 0 is padding; one row per error-correction level.
ECC_PER_BLOCK = {
    'L': (-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30),
    'M': (-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28),
    'Q': (-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30),
    'H': (-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30),
}
NUM_BLOCKS = {
    'L': (-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25),
    'M': (-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49),
    'Q': (-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68),
    'H': (-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81),
}
# The two format bits of each level, as the format information stores them.
LEVEL_BITS = {1: 'L', 0: 'M', 3: 'Q', 2: 'H'}
ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'


class QrError(ValueError):
    pass


def _format_words():
    """{15-bit masked format word: (level, mask)} for all 32 combinations."""
    out = {}
    for level_bits, level in LEVEL_BITS.items():
        for mask in range(8):
            data = (level_bits << 3) | mask
            rem = data
            for _ in range(10):
                rem = (rem << 1) ^ ((rem >> 9) * 0x537)
            out[((data << 10) | (rem & 0x3FF)) ^ 0x5412] = (level, mask)
    return out


FORMAT_WORDS = _format_words()


def _mask_bit(mask, row, col):
    if mask == 0:
        return (row + col) % 2 == 0
    if mask == 1:
        return row % 2 == 0
    if mask == 2:
        return col % 3 == 0
    if mask == 3:
        return (row + col) % 3 == 0
    if mask == 4:
        return (row // 2 + col // 3) % 2 == 0
    if mask == 5:
        return (row * col) % 2 + (row * col) % 3 == 0
    if mask == 6:
        return ((row * col) % 2 + (row * col) % 3) % 2 == 0
    return ((row + col) % 2 + (row * col) % 3) % 2 == 0


def alignment_positions(version):
    if version == 1:
        return []
    count = version // 7 + 2
    step = (version * 8 + count * 3 + 5) // (count * 4 - 4) * 2
    size = version * 4 + 17
    return sorted([6] + [size - 7 - i * step for i in range(count - 1)])


def _function_map(version):
    size = version * 4 + 17
    fn = [[False] * size for _ in range(size)]

    def block(r0, c0, h, w):
        for r in range(max(0, r0), min(size, r0 + h)):
            for c in range(max(0, c0), min(size, c0 + w)):
                fn[r][c] = True

    block(0, 0, 9, 9)                 # top-left finder, separator, format bits
    block(0, size - 8, 9, 8)          # top-right finder + format bits
    block(size - 8, 0, 8, 9)          # bottom-left finder + format bits + dark module
    block(6, 0, 1, size)              # timing patterns
    block(0, 6, size, 1)
    pos = alignment_positions(version)
    last = len(pos) - 1
    for i, r in enumerate(pos):
        for j, c in enumerate(pos):
            if (i == 0 and j == 0) or (i == 0 and j == last) or (i == last and j == 0):
                continue                # overlaps a finder
            block(r - 2, c - 2, 5, 5)
    if version >= 7:
        block(0, size - 11, 6, 3)       # version information
        block(size - 11, 0, 3, 6)
    return fn


def _read_format(m):
    size = len(m)
    first = 0
    for i in range(6):
        first |= m[i][8] << i
    first |= m[7][8] << 6
    first |= m[8][8] << 7
    first |= m[8][7] << 8
    for i in range(9, 15):
        first |= m[8][14 - i] << i
    second = 0
    for i in range(8):
        second |= m[8][size - 1 - i] << i
    for i in range(8, 15):
        second |= m[size - 15 + i][8] << i
    for word in (first, second):
        if word in FORMAT_WORDS:
            return FORMAT_WORDS[word]
    # A clean print has an exact copy; allow a few flipped bits like a scanner.
    best = min(FORMAT_WORDS, key=lambda w: min(bin(w ^ first).count('1'), bin(w ^ second).count('1')))
    if min(bin(best ^ first).count('1'), bin(best ^ second).count('1')) > 3:
        raise QrError('unreadable format information')
    return FORMAT_WORDS[best]


def _codewords(m, version, mask):
    size = len(m)
    fn = _function_map(version)
    bits = []
    right = size - 1
    while right >= 1:
        if right == 6:
            right = 5
        for vert in range(size):
            for j in range(2):
                col = right - j
                upward = ((right + 1) & 2) == 0
                row = size - 1 - vert if upward else vert
                if not fn[row][col]:
                    bits.append(int(m[row][col]) ^ int(_mask_bit(mask, row, col)))
        right -= 2
    words = []
    for i in range(0, len(bits) - 7, 8):
        v = 0
        for b in bits[i:i + 8]:
            v = (v << 1) | b
        words.append(v)
    return words


def _data_codewords(words, version, level):
    blocks = NUM_BLOCKS[level][version]
    ecc = ECC_PER_BLOCK[level][version]
    total = len(words)
    short_len = total // blocks
    short_blocks = blocks - total % blocks
    data_lens = [short_len - ecc + (0 if i < short_blocks else 1) for i in range(blocks)]
    if min(data_lens) <= 0:
        raise QrError('the block layout does not fit this version')
    out = [[] for _ in range(blocks)]
    k = 0
    for i in range(max(data_lens)):
        for b in range(blocks):
            if i < data_lens[b]:
                out[b].append(words[k])
                k += 1
    return [w for blk in out for w in blk]


class _Bits:
    def __init__(self, data):
        self.data = data
        self.pos = 0

    def left(self):
        return len(self.data) * 8 - self.pos

    def read(self, n):
        if n > self.left():
            raise QrError('the data ends in the middle of a segment')
        v = 0
        for _ in range(n):
            byte = self.data[self.pos // 8]
            v = (v << 1) | ((byte >> (7 - self.pos % 8)) & 1)
            self.pos += 1
        return v


def _count_bits(mode, version):
    i = 0 if version <= 9 else (1 if version <= 26 else 2)
    return {1: (10, 12, 14), 2: (9, 11, 13), 4: (8, 16, 16), 8: (8, 10, 12)}[mode][i]


def _parse(data, version):
    bits = _Bits(data)
    out = bytearray()
    while bits.left() >= 4:
        mode = bits.read(4)
        if mode == 0:
            break
        if mode == 7:                   # ECI: the designator only, the bytes stay UTF-8
            first = bits.read(8)
            if first & 0x80:
                bits.read(8 if (first & 0xC0) == 0x80 else 16)
            continue
        if mode not in (1, 2, 4):
            raise QrError('unsupported QR segment mode %d' % mode)
        count = bits.read(_count_bits(mode, version))
        if mode == 1:
            while count >= 3:
                out += ('%03d' % bits.read(10)).encode()
                count -= 3
            if count == 2:
                out += ('%02d' % bits.read(7)).encode()
            elif count == 1:
                out += str(bits.read(4)).encode()
        elif mode == 2:
            while count >= 2:
                v = bits.read(11)
                out += (ALNUM[v // 45] + ALNUM[v % 45]).encode()
                count -= 2
            if count:
                out += ALNUM[bits.read(6)].encode()
        else:
            for _ in range(count):
                out.append(bits.read(8))
    try:
        return out.decode('utf-8')
    except UnicodeDecodeError:
        return out.decode('latin-1')


def decode_matrix(m):
    """The text a module matrix holds (rows top to bottom, True = dark)."""
    size = len(m)
    if size < 21 or (size - 17) % 4 or any(len(r) != size for r in m):
        raise QrError('a QR matrix is square, 21 to 177 modules (got %d)' % size)
    version = (size - 17) // 4
    m = [[bool(v) for v in row] for row in m]
    for r0, c0 in ((0, 0), (0, size - 7), (size - 7, 0)):
        if not (m[r0][c0] and m[r0 + 3][c0 + 3] and m[r0 + 6][c0 + 6] and not m[r0 + 1][c0 + 1]):
            raise QrError('no finder pattern at row %d, column %d' % (r0, c0))
    level, mask = _read_format(m)
    words = _codewords(m, version, mask)
    return _parse(_data_codewords(words, version, level), version)


def decode_details(m):
    """{ text, version, level, mask, modules } for a module matrix."""
    size = len(m)
    level, mask = _read_format([[bool(v) for v in row] for row in m])
    return {'text': decode_matrix(m), 'version': (size - 17) // 4, 'level': level, 'mask': mask, 'modules': size}


# ─── PDF ────────────────────────────────────────────────────────────────

def _mul(a, b):
    """PDF matrices [a b c d e f]: a then b."""
    return [
        a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
    ]


def _apply(mx, x, y):
    return (mx[0] * x + mx[2] * y + mx[4], mx[1] * x + mx[3] * y + mx[5])


def _form_matrix(xobj, reader):
    from pypdf.generic import ContentStream
    bbox = [float(v) for v in xobj['/BBox']]
    n = int(round(bbox[2] - bbox[0]))
    if n <= 0 or abs((bbox[3] - bbox[1]) - n) > 0.01:
        raise QrError('the code form is not square')
    m = [[False] * n for _ in range(n)]
    ops = ContentStream(xobj, reader).operations
    for operands, op in ops:
        if op == b're':
            x, y, w, h = (float(v) for v in operands)
            if w < 0:
                x, w = x + w, -w
            if h < 0:
                y, h = y + h, -h
            for row in range(int(round(y)), int(round(y + h))):
                for col in range(int(round(x)), int(round(x + w))):
                    if 0 <= row < n and 0 <= col < n:
                        m[n - 1 - row][col] = True
    return m


def page_codes(page, reader, page_index=0):
    """Every QR form drawn on one page: [{ name, kind, text, version, level,
    modules, x, y, size (points, page space), page }]."""
    from pypdf.generic import ContentStream
    res = page.get('/Resources') or {}
    xobjects = res.get('/XObject') or {}
    xobjects = xobjects.get_object() if hasattr(xobjects, 'get_object') else xobjects
    found = []
    contents = page.get_contents()
    if contents is None:
        return found
    ctm = [1, 0, 0, 1, 0, 0]
    stack = []
    for operands, op in ContentStream(contents, reader).operations:
        if op == b'q':
            stack.append(ctm)
        elif op == b'Q':
            ctm = stack.pop() if stack else [1, 0, 0, 1, 0, 0]
        elif op == b'cm':
            ctm = _mul([float(v) for v in operands], ctm)
        elif op == b'Do':
            name = str(operands[0])
            if not name.startswith('/FormXob.QR_') or name not in xobjects:
                continue
            xobj = xobjects[name].get_object()
            mx = _mul([float(v) for v in xobj.get('/Matrix', [1, 0, 0, 1, 0, 0])], ctm)
            matrix = _form_matrix(xobj, reader)
            n = len(matrix)
            x0, y0 = _apply(mx, 0, 0)
            x1, y1 = _apply(mx, n, n)
            entry = {'name': name[len('/FormXob.'):], 'kind': name[len('/FormXob.QR_'):].rsplit('_', 1)[0],
                     'page': page_index, 'x': min(x0, x1), 'y': min(y0, y1),
                     'size': abs(x1 - x0), 'height': abs(y1 - y0)}
            try:
                entry.update(decode_details(matrix))
            except QrError as e:
                entry.update({'error': str(e), 'modules': n})
            found.append(entry)
    return found


def pdf_codes(path):
    """Every QR code in a PDF, page by page (see page_codes)."""
    from pypdf import PdfReader
    reader = PdfReader(path)
    out = []
    for i, page in enumerate(reader.pages):
        out.extend(page_codes(page, reader, i))
    return out


def main(argv):
    if len(argv) != 2:
        print(__doc__)
        return 2
    codes = pdf_codes(argv[1])
    for c in codes:
        c['sizeIn'] = round(c['size'] / 72.0, 3)
    print(json.dumps(codes, indent=2))
    return 0 if all('error' not in c for c in codes) else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
