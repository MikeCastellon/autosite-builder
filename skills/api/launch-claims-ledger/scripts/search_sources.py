"""Searches the sources (intake answers, confirmed business info, pasted
reviews) for a claim's words or numbers and prints the pieces that could
back it, each a word-for-word quote you can copy into the ledger.

  search_sources.py "IDA" "certified"          pieces with every term
  search_sources.py --any "warranty" "lifetime" pieces with any term
  search_sources.py --field about "years"      only that source field
  [--candidates /tmp/claims/candidates.json]   (default; extract_claims.py writes it)

Terms are compared without case or extra spaces; a number matches as a
number ("10" finds "10+", "ten" finds "10"). Nothing found means the
sources don't say it: the claim is unsourced.
"""
import argparse
import json
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import claimlib  # noqa: E402


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('terms', nargs='+')
    ap.add_argument('--any', action='store_true', help='pieces with any of the terms (default: all of them)')
    ap.add_argument('--field', default='', help='only this source field')
    ap.add_argument('--candidates', default='/tmp/claims/candidates.json')
    args = ap.parse_args(argv[1:])
    try:
        with open(args.candidates, encoding='utf-8') as f:
            sources = json.load(f).get('sources') or []
    except (OSError, ValueError) as e:
        print('%s could not be read (%s): run extract_claims.py first.' % (args.candidates, e))
        return 2
    if args.field:
        sources = [s for s in sources if s.get('field') == args.field]
    hits = claimlib.SourceIndex(sources).search(args.terms, any_term=args.any)
    if not hits:
        print('Nothing in the sources says %s.' % ' / '.join('"%s"' % t for t in args.terms))
        return 1
    for h in hits[:40]:
        print('%s: "%s"' % (h['field'], h['quote'].replace('\n', ' ')))
    if len(hits) > 40:
        print('... %d more: narrow the terms' % (len(hits) - 40))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
