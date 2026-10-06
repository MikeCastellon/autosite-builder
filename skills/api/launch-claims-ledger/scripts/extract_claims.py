"""The pre-pass: every sentence in the checked texts that looks like a
factual claim (numbers, years, ratings, awards, certifications, guarantees,
warranties, brands, service areas, prices, best/#1/only), with the source
pieces that share its numbers or words. You then check a list instead of
reading every text cold.

  extract_claims.py [--input claims-input.json] [--pdf kit-print-a.pdf ...] [--out-dir /tmp/claims]

Without --input it finds claims-input.json and the kit-print-*.pdf files
itself (where the request's uploads landed). Writes to --out-dir:
  candidates.json  sources, checked texts, candidates (validate_claims.py reads it)
  candidates.txt   the candidates, one block each (read in chunks: sed -n '1,200p')
  checked.txt      every checked text as "[where] path: text" (skim it for
                   claims the patterns missed)
  sources.txt      every source as "[field] label:" and its text
Prints a summary, and the candidate list when it is short.
Exit 1 when claims-input.json can't be found or read.
"""
import argparse
import json
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import claimlib  # noqa: E402

PRINT_LIMIT = 30000


def block(c, labels):
    head = '%s [%s] %s | %s' % (c['id'], c['where'], c['path'] or '-', ', '.join(c['kinds']))
    if c.get('review'):
        head += ' | word for word in the pasted reviews: %s' % ('yes' if c.get('verbatim') else 'NO')
    lines = [head, '  "%s"' % c['text'].replace('\n', ' ')]
    if c.get('matches'):
        lines.append('  matches: %s' % ' | '.join(c['matches']))
    for h in c.get('hints') or []:
        lines.append('  hint %s (%s): "%s"' % (h['field'], labels.get(h['field'], ''), h['quote'].replace('\n', ' ')))
    return '\n'.join(lines)


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--input', default='', help='path of claims-input.json (found automatically when left out)')
    ap.add_argument('--pdf', action='append', default=[], help='a print PDF (kit-print-*.pdf); found automatically')
    ap.add_argument('--out-dir', default='/tmp/claims')
    args = ap.parse_args(argv[1:])

    found = {} if args.input and args.pdf else claimlib.find_inputs()
    input_path = args.input or found.get(claimlib.INPUT_NAME)
    if not input_path or not os.path.isfile(input_path):
        print('claims-input.json not found%s. List the uploads with find_inputs.py and pass --input.'
              % (' at %s' % input_path if input_path else ''))
        return 1
    try:
        data = claimlib.load_input(input_path)
    except (OSError, ValueError) as e:
        print('claims-input.json could not be read: %s' % e)
        return 1
    pdfs = {name: path for name, path in found.items() if name.startswith(claimlib.PRINT_PREFIX)}
    for p in args.pdf:
        pdfs[os.path.basename(p)] = p

    sources = [s for s in data['sources'] if isinstance(s, dict) and s.get('field') and isinstance(s.get('text'), str)]
    units, problems = claimlib.checked_units(data, pdfs)
    every = claimlib.candidates(units, sources, limit=None)
    found_candidates = every[:claimlib.CANDIDATE_LIMIT]
    if len(every) > len(found_candidates):
        # Past the list: still claims to check, by reading (no ref).
        first = every[len(found_candidates)]
        problems.append('%d more sentences look like claims but are past the %d-candidate list, from [%s] %s on: '
                        'read them in checked.txt and add their claims without "ref"'
                        % (len(every) - len(found_candidates), claimlib.CANDIDATE_LIMIT, first['where'], first['path'] or '-'))
    labels = {s['field']: s.get('label') or '' for s in sources}

    os.makedirs(args.out_dir, exist_ok=True)
    out = {
        'input': os.path.abspath(input_path),
        'business': data.get('business') or {},
        'sources': sources,
        'units': units,
        'candidates': found_candidates,
        'problems': problems,
    }
    with open(os.path.join(args.out_dir, 'candidates.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    listing = '\n\n'.join(block(c, labels) for c in found_candidates)
    with open(os.path.join(args.out_dir, 'candidates.txt'), 'w', encoding='utf-8') as f:
        f.write(listing + '\n')
    with open(os.path.join(args.out_dir, 'checked.txt'), 'w', encoding='utf-8') as f:
        for u in units:
            f.write('[%s] %s: %s\n' % (u['where'], u['path'] or '-', u['text'].replace('\n', ' / ')))
    with open(os.path.join(args.out_dir, 'sources.txt'), 'w', encoding='utf-8') as f:
        for s in sources:
            f.write('[%s] %s:\n%s\n\n' % (s['field'], s.get('label') or '', s['text']))

    by_where = {}
    for u in units:
        by_where[u['where']] = by_where.get(u['where'], 0) + 1
    print('Input: %s' % input_path)
    print('Sources: %d (%s)' % (len(sources), ', '.join(s['field'] for s in sources) or 'none'))
    print('Checked texts: %d (%s)' % (len(units), ', '.join('%s %d' % (w, n) for w, n in sorted(by_where.items())) or 'none'))
    if pdfs:
        print('Print PDFs: %s' % ', '.join(sorted(pdfs)))
    for p in problems:
        print('Problem: %s' % p)
    reviews = [c for c in found_candidates if c.get('review')]
    print('Candidates: %d (%d reviews shown on the site, %d of them not word for word)'
          % (len(found_candidates), len(reviews), sum(1 for c in reviews if not c.get('verbatim'))))
    print('Files: %s' % ', '.join(os.path.join(args.out_dir, n) for n in ('candidates.json', 'candidates.txt', 'checked.txt', 'sources.txt')))
    if len(listing) <= PRINT_LIMIT:
        print('')
        print(listing)
    else:
        print('The list is long: read candidates.txt in chunks (sed -n \'1,250p\' ...).')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
