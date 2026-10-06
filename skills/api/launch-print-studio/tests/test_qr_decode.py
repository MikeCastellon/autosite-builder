"""The QR decoder (scripts/qr_decode.py) against reportlab's encoder.

The decoder is written from the standard and shares no code with
reportlab's qrencoder, so these round trips check both: every payload a
print run could carry (links, tel:, vCards with CRLF, accented text) and
the numeric / alphanumeric segments reportlab picks on its own.

Needs reportlab (as in the code-execution container); skipped without it.
Run: python3 skills/api/launch-print-studio/tests/test_qr_decode.py
"""
import os
import random
import string
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts')))

try:
    from reportlab.graphics.barcode import qrencoder as E
    HAVE_LIBS = True
except ImportError:
    HAVE_LIBS = False

import qr_decode as D  # noqa: E402


def encode(text, level='M', mode='byte'):
    q = E.QRCode(None, getattr(E.QRErrorCorrectLevel, level))
    q.addData(E.QR8bitByte(text) if mode == 'byte' else text)
    q.make()
    return q


@unittest.skipUnless(HAVE_LIBS, 'reportlab is needed')
class Decoder(unittest.TestCase):
    def test_print_payloads(self):
        vcard = '\r\n'.join(['BEGIN:VCARD', 'VERSION:3.0', 'N:Café Shine\\, LLC;;;;', 'FN:Café Shine\\, LLC', 'ORG:Café Shine\\, LLC',
                             'TEL;TYPE=WORK,VOICE:+15550100199', 'EMAIL;TYPE=WORK:hello@shine.example', 'URL:https://shine.example/',
                             'X-ABShowAs:COMPANY', 'END:VCARD'])
        for text in ('https://search.google.com/local/writereview?placeid=ChIJ_test_place_01',
                     'https://shine.example/book#book', 'https://shine.example/', 'tel:+15550100199', vcard):
            q = encode(text)
            self.assertEqual(D.decode_matrix(q.modules), text)
            d = D.decode_details(q.modules)
            self.assertEqual((d['level'], d['version'], d['modules']), ('M', q.version, q.getModuleCount()))

    def test_random_round_trips(self):
        rnd = random.Random(7)
        count = 0
        for level in 'LMQ':
            for length in (1, 7, 25, 60, 120, 250, 420):
                for mode in ('byte', 'num', 'alnum', 'auto'):
                    if mode == 'num':
                        text = ''.join(rnd.choice(string.digits) for _ in range(length))
                    elif mode == 'alnum':
                        text = ''.join(rnd.choice(D.ALNUM) for _ in range(length))
                    else:
                        text = ''.join(rnd.choice(string.ascii_letters + string.digits + ' /:?#&=._-é\r\n') for _ in range(length))
                    q = encode(text, level, 'byte' if mode == 'byte' else 'auto')
                    self.assertEqual(D.decode_matrix(q.modules), text, (level, length, mode, q.version))
                    count += 1
        self.assertEqual(count, 84)

    def test_tables_match_reportlab_except_its_known_slip(self):
        slips = []
        for version in range(1, 41):
            self.assertEqual(list(E.QRUtil.PATTERN_POSITION_TABLE[version - 1]), D.alignment_positions(version))
            for level in 'LMQH':
                blocks = E.QRRSBlock.getRSBlocks(version, getattr(E.QRErrorCorrectLevel, level))
                ecc = {b.totalCount - b.dataCount for b in blocks}
                if len(blocks) != D.NUM_BLOCKS[level][version] or ecc != {D.ECC_PER_BLOCK[level][version]}:
                    slips.append((version, level))
        # reportlab's table lists version 15-H as 11 blocks of 36 (396
        # codewords for a 655-codeword symbol); the standard has 11 x 36 +
        # 7 x 37. Print runs use level M, so they never reach it.
        self.assertEqual(slips, [(15, 'H')])

    def test_rejects_what_is_not_a_code(self):
        with self.assertRaises(D.QrError):
            D.decode_matrix([[False] * 20 for _ in range(20)])
        with self.assertRaises(D.QrError):
            D.decode_matrix([[False] * 21 for _ in range(21)])


if __name__ == '__main__':
    unittest.main()
