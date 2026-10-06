"""Checks ledger.json against the contract (references/ledger-json.md) and
against this run's inputs. Exit 0 = valid (warnings may still print),
1 = errors to fix, 2 = unreadable file.

  validate_claims.py /tmp/claims/ledger.json [--candidates /tmp/claims/candidates.json]

Errors (all must be fixed):
  - shape: the contract's keys only, version 1, enums, single-line strings
    within the caps; counts equal to the statuses
  - every claim's text is copied from a checked text of its `where`
  - a source quote is word for word in the source field it names (field
    names exactly as in the sources: "about", "testimonials",
    "businessInfo.yearsInBusiness")
  - sourced: has a source; every number in the claim is in the quote; a
    review is backed by the pasted reviews (the claim and every review on
    the site that holds it, word for word) and the pasted reviews back
    nothing but reviews; no suggestion
  - unsourced: no source; a suggestion. needs-rewrite: a suggestion
  - a suggestion adds no number the sources don't state
  - every candidate of the pre-pass is a claim's `ref` or `dismissed`
    with a reason; no claim twice (same place, path and text)
The rules match src/lib/kit/claims.js sanitizeLedger(), so a file that
passes here is stored as written (the server would otherwise downgrade a
claim and say why).
Warnings (judgement calls): needs-rewrite without a source, a suggestion
with words that read like a new claim (best, guaranteed, certified, ...).
"""
import argparse
import json
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import claimlib as cl  # noqa: E402

TOP_KEYS = ('version', 'claims', 'counts', 'dismissed', 'notes')
TOP_REQUIRED = ('version', 'claims', 'counts')
CLAIM_KEYS = ('ref', 'text', 'where', 'kind', 'path', 'source', 'status', 'suggestion')
CLAIM_REQUIRED = ('text', 'where', 'kind', 'source', 'status', 'suggestion')
COUNT_KEYS = ('sourced', 'unsourced', 'needsRewrite')
MAX_BYTES = 900 * 1024
MAX_NOTES = 8
MAX_NOTE = 300
MAX_REASON = 200
CLAIMY = re.compile(r'\b(?:best|#\s?1|number one|top[- ]rated|leading|premier|only|first|guarantee[ds]?|certified|'
                    r'award|lifetime|warranty|\d+\+)\b', re.I)


def text_field(v, name, limit, errors, required=True):
    """A single-line string within the cap; returns it (or '')."""
    if not isinstance(v, str):
        errors.append('%s must be a string' % name)
        return ''
    if v != cl.one_line(v):
        errors.append('%s must be one plain line (no line breaks, tabs or extra spaces)' % name)
    if required and not v.strip():
        errors.append('%s is empty' % name)
    if len(v) > limit:
        errors.append('%s is %d characters; the limit is %d' % (name, len(v), limit))
    return v


def validate(ledger, cand):
    errors, warnings = [], []
    if not isinstance(ledger, dict):
        return ['ledger.json must be a JSON object'], warnings
    for k in TOP_REQUIRED:
        if k not in ledger:
            errors.append('missing key "%s"' % k)
    for k in ledger:
        if k not in TOP_KEYS:
            errors.append('unknown key "%s" (allowed: %s)' % (k, ', '.join(TOP_KEYS)))
    if ledger.get('version') != cl.LEDGER_VERSION:
        errors.append('version must be %d' % cl.LEDGER_VERSION)
    claims = ledger.get('claims')
    if not isinstance(claims, list):
        errors.append('claims must be a list')
        claims = []
    if len(claims) > cl.LIMITS['claims']:
        errors.append('%d claims; the limit is %d: keep every unsourced and needs-rewrite claim and dismiss sourced '
                      'repeats of a claim already in the ledger ("sourced, same as cN"), then say so in notes'
                      % (len(claims), cl.LIMITS['claims']))

    sources = {s['field']: s['text'] for s in cand.get('sources') or [] if s.get('field') and isinstance(s.get('text'), str)}
    source_numbers = set()
    for t in sources.values():
        source_numbers.update(cl.numbers(t))
    units = cand.get('units') or []
    unit_text = {}
    for u in units:
        unit_text.setdefault(u['where'], []).append(cl.normalize(u['text']))
    candidates = {c['id']: c for c in cand.get('candidates') or []}
    reviews = ' \n'.join(t for f, t in sources.items() if f == cl.REVIEW_FIELD)
    review_units = [u for u in units if u['where'] == 'site' and cl.REVIEW_PATH.search(u.get('path') or '')]

    seen, refs = {}, {}
    counts = {'sourced': 0, 'unsourced': 0, 'needs-rewrite': 0}
    for i, c in enumerate(claims):
        name = 'claims[%d]' % i
        if not isinstance(c, dict):
            errors.append('%s must be an object' % name)
            continue
        for k in CLAIM_REQUIRED:
            if k not in c:
                errors.append('%s: missing "%s"' % (name, k))
        for k in c:
            if k not in CLAIM_KEYS:
                errors.append('%s: unknown key "%s"' % (name, k))
        text = text_field(c.get('text'), '%s.text' % name, cl.LIMITS['text'], errors)
        where, kind, status = c.get('where'), c.get('kind'), c.get('status')
        if where not in cl.WHERE:
            errors.append('%s.where must be one of %s' % (name, ', '.join(cl.WHERE)))
        if kind not in cl.KINDS:
            errors.append('%s.kind must be one of %s' % (name, ', '.join(cl.KINDS)))
        if status not in cl.STATUSES:
            errors.append('%s.status must be one of %s' % (name, ', '.join(cl.STATUSES)))
        else:
            counts[status] += 1
        if 'path' in c:
            text_field(c['path'], '%s.path' % name, cl.LIMITS['path'], errors, required=False)
        label = '%s ("%s")' % (name, text[:60])

        ref = c.get('ref')
        if ref is not None:
            if ref not in candidates:
                errors.append('%s: ref "%s" is not a candidate id' % (label, ref))
            else:
                refs.setdefault(ref, []).append(i)
                if candidates[ref]['where'] != where:
                    errors.append('%s: candidate %s is in "%s", not "%s"' % (label, ref, candidates[ref]['where'], where))

        if text and where in cl.WHERE and not any(cl.normalize(text) in t for t in unit_text.get(where, [])):
            errors.append('%s: the text is not in any checked "%s" text; copy it word for word (checked.txt)' % (label, where))
        if text and where in cl.WHERE:
            # The same claim in another text (two posts) is its own entry:
            # the admin fixes each place. Twice in one text is one.
            path = c.get('path') if isinstance(c.get('path'), str) else ''
            key = (where, cl.normalize(path), cl.normalize(text))
            if key in seen:
                errors.append('%s repeats claims[%d] (same place, path and text): keep one, and dismiss the other '
                              'candidate as a repeat' % (label, seen[key]))
            seen.setdefault(key, i)

        source = c.get('source')
        if source is not None:
            if not isinstance(source, dict) or set(source) != {'field', 'quote'}:
                errors.append('%s.source must be null or {"field", "quote"}' % name)
                source = None
            else:
                field = source.get('field')
                quote = text_field(source.get('quote'), '%s.source.quote' % name, cl.LIMITS['quote'], errors)
                if field not in sources:
                    errors.append('%s: source field "%s" is not a source of this run (one of: %s)' % (label, field, ', '.join(sources) or 'none'))
                elif quote and not cl.quote_in(quote, sources[field]):
                    errors.append('%s: the quote is not word for word in "%s" (at least 4 characters; search_sources.py finds them)' % (label, field))

        suggestion = text_field(c.get('suggestion'), '%s.suggestion' % name, cl.LIMITS['suggestion'], errors, required=False)
        if status == 'sourced':
            if not source:
                errors.append('%s: sourced needs a source' % label)
            else:
                field, quote = source.get('field'), source.get('quote') or ''
                if kind == 'review' and field != cl.REVIEW_FIELD:
                    errors.append('%s: a review is sourced only by the pasted reviews ("%s")' % (label, cl.REVIEW_FIELD))
                if kind != 'review' and field == cl.REVIEW_FIELD:
                    errors.append('%s: the pasted reviews back only a review shown as a review: kind "review", or needs-rewrite' % label)
                missing = [n for n in cl.numbers(text) if n not in set(cl.numbers(quote))]
                if missing:
                    errors.append('%s: the quote does not say %s: needs-rewrite, or quote the piece that does' % (label, ', '.join(missing)))
            if kind == 'review' and text:
                # The review itself, and every review on the site that holds
                # it, word for word in the pasted reviews (an excerpt of a
                # reworded review isn't the customer's words).
                whole = [u for u in review_units if cl.normalize(text) in cl.normalize(u['text'])]
                cands = [candidates[ref]] if ref in candidates else []
                if (not cl.quote_in(text, reviews) or any(not cl.quote_in(u['text'], reviews) for u in whole)
                        or any(x.get('review') and not x.get('verbatim') for x in cands)):
                    errors.append('%s: this review on the site is not word for word in the pasted reviews: needs-rewrite, with the exact wording as the suggestion' % label)
            if suggestion:
                errors.append('%s: a sourced claim has no suggestion ("")' % label)
        elif status == 'unsourced':
            if source is not None:
                errors.append('%s: unsourced means source null (a source that says less is needs-rewrite)' % label)
            if not suggestion.strip():
                errors.append('%s: unsourced needs a suggestion (the rewrite, or "Remove ...")' % label)
        elif status == 'needs-rewrite':
            if not suggestion.strip():
                errors.append('%s: needs-rewrite needs a suggestion (the replacement text)' % label)
            if source is None:
                warnings.append('%s: needs-rewrite without a source; if nothing backs any of it, it is unsourced' % label)
        if suggestion:
            added = [n for n in cl.numbers(suggestion) if n not in source_numbers and n not in set(cl.numbers(text))]
            if added:
                errors.append('%s: the suggestion adds %s, which no source states' % (label, ', '.join(added)))
            elif CLAIMY.search(suggestion) and not CLAIMY.search(text):
                warnings.append('%s: the suggestion says "%s": make sure it adds no new claim' % (label, CLAIMY.search(suggestion).group(0)))

    dismissed = ledger.get('dismissed', [])
    if not isinstance(dismissed, list):
        errors.append('dismissed must be a list')
        dismissed = []
    gone = set()
    for i, d in enumerate(dismissed):
        if not isinstance(d, dict) or set(d) != {'ref', 'reason'}:
            errors.append('dismissed[%d] must be {"ref", "reason"}' % i)
            continue
        if d['ref'] not in candidates:
            errors.append('dismissed[%d]: "%s" is not a candidate id' % (i, d['ref']))
        elif d['ref'] in refs:
            errors.append('dismissed[%d]: %s is also a claim\'s ref' % (i, d['ref']))
        text_field(d['reason'], 'dismissed[%d].reason' % i, MAX_REASON, errors)
        gone.add(d['ref'])
    unchecked = [cid for cid in candidates if cid not in refs and cid not in gone]
    if unchecked:
        more = ' and %d more' % (len(unchecked) - 15) if len(unchecked) > 15 else ''
        errors.append('candidates not handled (make each a claim with "ref", or dismiss it with a reason): %s%s'
                      % (', '.join(unchecked[:15]), more))

    want = {'sourced': counts['sourced'], 'unsourced': counts['unsourced'], 'needsRewrite': counts['needs-rewrite']}
    got = ledger.get('counts')
    if not isinstance(got, dict) or {k: got.get(k) for k in COUNT_KEYS} != want or any(k not in COUNT_KEYS + ('total',) for k in got):
        errors.append('counts must be %s' % json.dumps(want))
    elif 'total' in got and got['total'] != len(claims):
        errors.append('counts.total must be %d (or leave it out)' % len(claims))

    notes = ledger.get('notes', [])
    if not isinstance(notes, list) or len(notes) > MAX_NOTES:
        errors.append('notes must be a list of at most %d lines' % MAX_NOTES)
    else:
        for i, n in enumerate(notes):
            text_field(n, 'notes[%d]' % i, MAX_NOTE, errors)
    if not claims and candidates:
        warnings.append('no claims although the pre-pass found %d candidates: dismissing all of them is rare' % len(candidates))
    return errors, warnings


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('ledger')
    ap.add_argument('--candidates', default='/tmp/claims/candidates.json', help='what extract_claims.py wrote')
    args = ap.parse_args(argv[1:])
    try:
        if os.path.getsize(args.ledger) > MAX_BYTES:
            print('ERROR %s is larger than %d KB' % (args.ledger, MAX_BYTES // 1024))
            return 1
        with open(args.ledger, encoding='utf-8') as f:
            ledger = json.load(f)
    except (OSError, ValueError) as e:
        print('ERROR %s could not be read: %s' % (args.ledger, e))
        return 2
    try:
        with open(args.candidates, encoding='utf-8') as f:
            cand = json.load(f)
    except (OSError, ValueError) as e:
        print('ERROR %s could not be read (%s): run extract_claims.py first' % (args.candidates, e))
        return 2
    errors, warnings = validate(ledger, cand)
    for w in warnings:
        print('WARNING %s' % w)
    for e in errors:
        print('ERROR %s' % e)
    if errors:
        print('%d error(s): fix ledger.json and run this again.' % len(errors))
        return 1
    claims = ledger.get('claims') or []
    dismissed = len(ledger.get('dismissed') or [])
    print('OK %d claim%s (%s), %d candidate%s dismissed' % (
        len(claims), '' if len(claims) == 1 else 's', ', '.join('%s %d' % (k, v) for k, v in ledger['counts'].items()),
        dismissed, '' if dismissed == 1 else 's'))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
