"""The text gate on the shared fixtures (src/lib/kit/social.test.js runs the
same file through the server's copy of the rules).

Run: python3 skills/api/launch-social-kit/tests/test_textrules.py
"""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'scripts'))
sys.dont_write_bytecode = True

import textrules as TR  # noqa: E402

with open(os.path.join(HERE, 'textrules_fixtures.json'), encoding='utf-8') as f:
    FIX = json.load(f)


class Fixtures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = TR.Index(FIX['sources'], FIX['links'])

    def test_tokens(self):
        for case in FIX['tokens']:
            self.assertEqual(TR.tokens(case['text']), case['tokens'], case['text'])

    def test_sentences(self):
        for case in FIX['sentences']:
            self.assertEqual(TR.sentences(case['text']), case['sentences'], case['text'])

    def test_lines(self):
        for case in FIX['lines']:
            problems = TR.line_problems(case['role'], case['text'], self.index)
            self.assertEqual(not problems, case['ok'], '%s %r: %s' % (case['role'], case['text'], problems))
            if 'unbacked' in case:
                self.assertEqual(self.index.unbacked(TR.tokens(case['text'])), case['unbacked'], case['text'])

    def test_captions(self):
        for case in FIX['captions']:
            problems = TR.caption_problems(case['text'], self.index)
            self.assertEqual(not problems, case['ok'], '%r: %s' % (case['text'], problems))
            if 'unbacked' in case:
                self.assertEqual(TR.free_unbacked(case['text'], self.index), case['unbacked'], case['text'])

    def test_alts(self):
        for case in FIX['alts']:
            problems = TR.alt_problems(case['text'], self.index)
            self.assertEqual(not problems, case['ok'], '%r: %s' % (case['text'], problems))
            if 'unbacked' in case:
                self.assertEqual(TR.free_unbacked(case['text'], self.index), case['unbacked'], case['text'])

    def test_images(self):
        for case in FIX['images']:
            items = [(t['role'], t['text']) for t in case['text']]
            problems = TR.image_problems(items, self.index)
            self.assertEqual(not problems, case['ok'], '%r: %s' % (items, problems))

    def test_quotes_stay_inside_one_review(self):
        # The pasted reviews are one per line: a quote never joins two of them.
        self.assertEqual(len(self.index.review_lines), 4)
        self.assertTrue(TR.line_problems('quote', 'Jordan P. Five stars.', self.index))

    def test_other_kinds_are_ignored(self):
        self.assertEqual([s['id'] for s in self.index.sources if s['id'] == 'junk'], [])

    def test_lengths_count_like_javascript(self):
        self.assertEqual(TR.ulen('ab'), 2)
        self.assertEqual(TR.ulen('\U0001F697'), 2)  # an emoji is two UTF-16 units

    def test_phrases_need_their_link(self):
        no_links = TR.Index(FIX['sources'], {})
        self.assertTrue(TR.line_problems('cta', 'Book online', no_links))
        self.assertFalse(TR.line_problems('cta', 'Book online', self.index))


if __name__ == '__main__':
    unittest.main()
