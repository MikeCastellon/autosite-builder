"""The text gate: what may be written on an image, in a caption, in alt text.

Rules (data/text_rules.json; references/text-rules.md explains them):
- An image line is sourced: its words appear in that order, together, in
  one source text of the brief (the site's copy, the Words kit, the
  business facts, the owner's intake answers), or it is one of the
  allowed phrases ("Our new website is live", "Book online" only with a
  booking link, ...). Cutting a sentence down is fine; rewording is not.
- quote role: one or more whole sentences of one line of the pasted
  reviews, word for word (one review per line, as pasted: a quote never
  joins two reviews). cite role: words from the reviews (the reviewer's
  name); on the image of a quote, from the quote's own line or a name
  line right under it. A line found only in the reviews goes in the quote role,
  nowhere else, and "What our customers say" only goes on an image with a
  quote (image_problems).
- A claim (any number, or a claim phrase such as best, certified, years,
  free, guaranteed) must also appear in the business facts or the owner's
  intake answers. Copy we wrote (site, Words kit) backs no claim; reviews
  back a claim only inside a quote.
- Captions and alt text are free text with the same claim rule; whole
  review sentences inside quotation marks are allowed.

src/lib/kit/social.js holds the same rules (the server's second look);
tests/textrules_fixtures.json runs through both.

  textrules.py sources --brief /tmp/social/brief.json [--kind site]
  textrules.py check --brief /tmp/social/brief.json --role headline "Showroom shine"
  textrules.py caption --brief /tmp/social/brief.json --file /tmp/social/caption1.txt
"""
import argparse
import os
import re
import sys
import unicodedata

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common  # noqa: E402

TOKEN = re.compile(r'[a-z0-9]+')
COMBINING = re.compile('[\u0300-\u036f]')
SENTENCE_END = re.compile('([.!?]+["\'\u201d\u2019)\\]]*)\\s+')
QUOTED = re.compile('"([^"\\n]{2,})"|\u201c([^\u201d\\n]{2,})\u201d')
HASHTAG = re.compile(r'#[A-Za-z0-9_]+')
# A review line this short with one sentence is a name pasted under the
# review above it ("- Casey V.", "Casey V., Tampa FL").
NAME_LINE_TOKENS = 4
ROLES = ['eyebrow', 'headline', 'sub', 'items', 'quote', 'cite', 'cta', 'footer']


def ulen(text):
    """Length as JavaScript counts it (UTF-16 code units), so both sides cap alike."""
    return len(text.encode('utf-16-le')) // 2


def tokens(text):
    s = unicodedata.normalize('NFKD', str(text or ''))
    s = COMBINING.sub('', s).lower().replace('&', ' and ')
    return TOKEN.findall(s)


def contains(hay, needle):
    n = len(needle)
    if not n or n > len(hay):
        return False
    first = needle[0]
    for i in range(len(hay) - n + 1):
        if hay[i] == first and hay[i:i + n] == needle:
            return True
    return False


def review_lines(text):
    """The reviews as pasted, one per line: each non-empty line as a list
    of its sentences' tokens (a sentence ends at . ! or ?, with any closing
    quote, before whitespace)."""
    out = []
    for line in str(text or '').split('\n'):
        sents = [t for t in (tokens(part) for part in SENTENCE_END.sub(r'\1\n', line).split('\n')) if t]
        if sents:
            out.append(sents)
    return out


def sentences(text):
    return [s for line in review_lines(text) for s in line]


class Index(object):
    """The brief's sources, prepared for the checks."""

    def __init__(self, sources, links=None, rules=None):
        self.rules = rules or common.rules()
        kinds = set(self.rules['sourceKinds'])
        self.claim_kinds = set(self.rules['claimSources'])
        self.quote_kinds = set(self.rules['quoteSources'])
        self.sources = []
        # The pasted reviews line by line: {source, sentences, tokens}.
        self.review_lines = []
        for s in sources or []:
            if not isinstance(s, dict) or s.get('kind') not in kinds or not isinstance(s.get('text'), str):
                continue
            toks = tokens(s['text'])
            if not toks:
                continue
            self.sources.append({'id': s.get('id') or '', 'kind': s['kind'], 'tokens': toks})
            if s['kind'] in self.quote_kinds:
                for line in review_lines(s['text']):
                    self.review_lines.append({'source': len(self.sources) - 1, 'sentences': line,
                                              'tokens': [t for sent in line for t in sent]})
        links = links or {}
        self.links = {'booking': bool(links.get('booking')), 'phone': bool(links.get('phone'))}
        self.phrases = [(tokens(p['text']), p.get('needs')) for p in self.rules['phrases']]
        self.claim_phrases = [(p, tokens(p)) for p in self.rules['claimPhrases']]
        self.neutral = [tokens(p) for p in self.rules['neutralPhrases']]
        self.limits = self.rules['limits']
        # What a claim may rest on, neutral phrases blanked: "feel free"
        # in the owner's answers backs no "free".
        for src in self.sources:
            src['claim_tokens'] = self.blank_neutral(src['tokens'])

    def blank_neutral(self, toks):
        t = list(toks)
        for ph in self.neutral:
            n = len(ph)
            i = 0
            while n and i <= len(t) - n:
                if t[i:i + n] == ph:
                    for k in range(i, i + n):
                        t[k] = ''
                    i += n
                else:
                    i += 1
        return t

    def matches(self, toks):
        return [s for s in self.sources if contains(s['tokens'], toks)]

    def quote_lines(self, toks):
        """The review lines in which `toks` are one or more whole
        consecutive sentences (indexes into review_lines)."""
        out = []
        for li, line in enumerate(self.review_lines):
            rs = line['sentences']
            hit = False
            for i in range(len(rs)):
                joined = []
                for j in range(i, len(rs)):
                    joined = joined + rs[j]
                    if len(joined) > len(toks):
                        break
                    if joined == toks:
                        hit = True
                        break
                if hit:
                    break
            if hit:
                out.append(li)
        return out

    def review_run(self, toks):
        """Are `toks` one or more whole consecutive sentences of one review line?"""
        return bool(self.quote_lines(toks))

    def cite_fits(self, quote_toks, cite_toks):
        """Is the cite in the quoted review's own line, or in the line after
        it when that line is only a name ("- Casey V.": one sentence of at
        most NAME_LINE_TOKENS words, so never the next review)?"""
        rl = self.review_lines
        for li in self.quote_lines(quote_toks):
            if contains(rl[li]['tokens'], cite_toks):
                return True
            k = li + 1
            if (k < len(rl) and rl[k]['source'] == rl[li]['source'] and len(rl[k]['sentences']) == 1
                    and len(rl[k]['tokens']) <= NAME_LINE_TOKENS and contains(rl[k]['tokens'], cite_toks)):
                return True
        return False

    def in_reviews(self, toks):
        return any(s['kind'] in self.quote_kinds and contains(s['tokens'], toks) for s in self.sources)

    def claims(self, toks):
        """Claim terms in `toks`: numbers first (in order), then claim
        phrases (in rule order), each once; neutral phrases don't count."""
        t = self.blank_neutral(toks)
        found = []
        for tok in t:
            if tok and any(ch.isdigit() for ch in tok) and tok not in found:
                found.append(tok)
        for text, ph in self.claim_phrases:
            if ph and contains(t, ph) and text not in found:
                found.append(text)
        return found

    def backed(self, term):
        toks = tokens(term)
        return any(s['kind'] in self.claim_kinds and contains(s['claim_tokens'], toks) for s in self.sources)

    def unbacked(self, toks):
        return [c for c in self.claims(toks) if not self.backed(c)]


def index_of(brief):
    return Index(brief.get('sources') or [], brief.get('links') or {})


def line_problems(role, text, index):
    """Why an image line can't be used ([] when it can)."""
    if role not in ROLES:
        return ['unknown text role "%s"' % role]
    if not isinstance(text, str) or not text.strip():
        return ['%s is empty' % role]
    out = []
    if ulen(text) > index.limits['line']:
        out.append('%s is longer than %d characters' % (role, index.limits['line']))
    toks = tokens(text)
    if not toks:
        return out + ['%s has no words' % role]
    if role == 'quote':
        if not index.review_run(toks):
            out.append('quote "%s" is not one or more whole sentences of one pasted review, word for word' % text)
        return out
    if role == 'cite':
        if not index.in_reviews(toks):
            out.append('cite "%s" is not in the pasted reviews (use the reviewer\'s name as they wrote it)' % text)
        return out
    for ph, needs in index.phrases:
        if ph == toks:
            # 'quote' is an image's matter (image_problems), not a link.
            if needs and needs != 'quote' and not index.links.get(needs):
                out.append('"%s" needs a %s link, and this site has none' % (text, needs))
            return out
    found = index.matches(toks)
    if not found:
        out.append('%s "%s" is not in the site\'s copy, the Words kit or the business facts (copy a run of words exactly, or use an allowed phrase)' % (role, text))
        return out
    if all(s['kind'] in index.quote_kinds for s in found):
        out.append('%s "%s" comes from the pasted reviews: reviews go only in the quote role' % (role, text))
        return out
    for c in index.unbacked(toks):
        out.append('%s "%s": the claim "%s" is not in the business facts or the owner\'s answers' % (role, text, c))
    return out


def image_problems(items, index):
    """What one image's lines break together ([] when nothing): a cite
    without a quote, a cite that isn't the quoted reviewer, and a phrase
    that needs a quote ("What our customers say") on an image without one.
    `items` is [(role, text)]."""
    out = []
    quotes = [t for r, t in items if r == 'quote' and isinstance(t, str)]
    cites = [t for r, t in items if r == 'cite' and isinstance(t, str)]
    if cites and not quotes:
        out.append('a cite goes with a quote')
    elif cites:
        q = tokens(quotes[0])
        if index.quote_lines(q):
            for c in cites:
                ct = tokens(c)
                if ct and not index.cite_fits(q, ct):
                    out.append('cite "%s" is not the name pasted with the quoted review (quote and name must be one review)' % c)
    if not quotes:
        for r, t in items:
            toks = tokens(t) if isinstance(t, str) else []
            if any(needs == 'quote' and ph == toks for ph, needs in index.phrases):
                out.append('"%s" goes only on an image with a quote from the pasted reviews' % t)
    return out


def free_unbacked(text, index):
    """The claims in free text nothing backs; whole review sentences in
    quotation marks are the reviewer's words and don't count."""
    rest = text
    for m in QUOTED.finditer(text):
        inner = m.group(1) if m.group(1) is not None else m.group(2)
        if index.review_run(tokens(inner)):
            rest = rest.replace(m.group(0), ' ')
    return index.unbacked(tokens(rest))


def free_text_problems(text, index, what, limit):
    if not isinstance(text, str) or not text.strip():
        return ['%s is empty' % what]
    out = []
    if ulen(text) > limit:
        out.append('%s is longer than %d characters' % (what, limit))
    for c in free_unbacked(text, index):
        out.append('%s: the claim "%s" is not in the business facts or the owner\'s answers' % (what, c))
    return out


def caption_problems(text, index, what='caption'):
    out = free_text_problems(text, index, what, index.limits['caption'])
    if isinstance(text, str) and len(HASHTAG.findall(text)) > index.limits['hashtags']:
        out.append('%s has more than %d hashtags' % (what, index.limits['hashtags']))
    return out


def alt_problems(text, index, what='alt'):
    return free_text_problems(text, index, what, index.limits['alt'])


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd')
    s = sub.add_parser('sources')
    s.add_argument('--brief', required=True)
    s.add_argument('--kind', default='')
    c = sub.add_parser('check')
    c.add_argument('--brief', required=True)
    c.add_argument('--role', required=True, choices=ROLES)
    c.add_argument('text', nargs='?', default=None)
    c.add_argument('--file', default='')
    k = sub.add_parser('caption')
    k.add_argument('--brief', required=True)
    k.add_argument('--file', required=True)
    args = ap.parse_args(argv[1:])
    if not args.cmd:
        ap.print_help()
        return 2
    brief = common.read_json(args.brief)
    index = index_of(brief)
    if args.cmd == 'sources':
        for src in brief.get('sources') or []:
            if args.kind and src.get('kind') != args.kind:
                continue
            print('[%s] (%s) %s' % (src.get('id'), src.get('kind'), src.get('text')))
        usable = lambda p: not p.get('needs') or index.links.get(p['needs']) or (p['needs'] == 'quote' and index.review_lines)
        print('\nAllowed phrases: %s' % '; '.join(
            p['text'] + (' (only with a quote on the image)' if p.get('needs') == 'quote' else ' (needs %s)' % p['needs'] if p.get('needs') else '')
            for p in index.rules['phrases'] if usable(p)))
        return 0
    if args.cmd == 'check':
        text = args.text
        if args.file:
            with open(args.file, encoding='utf-8') as f:
                text = f.read().strip()
        problems = line_problems(args.role, text or '', index)
    else:
        with open(args.file, encoding='utf-8') as f:
            problems = caption_problems(f.read().strip(), index)
    for p in problems:
        print('ERROR ' + p)
    if not problems:
        print('OK')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
