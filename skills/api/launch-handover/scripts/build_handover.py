"""Step 3: builds handover.pdf, launch-kit.zip and handover.json from the
plan (plan.py), the inputs and your content.json.

  build_handover.py [--plan /tmp/handover/plan.json] [--content /tmp/handover/content.json]
                    [--out-dir /tmp/handover/out]

Refuses (exit 1) while content.json has errors (validate_handover.py
content). The zip lists every kit file the server sent, one folder per kit
part, under the size the server takes back (handover-inputs.json
zip.maxBytes): when it can't fit, the files data/kit_files.json ranks lowest
are left out, and the PDF and handover.json say which. The PDF's kit pages
list exactly what the zip holds, so the PDF is built again if leaving files
out changes that.
"""
import argparse
import datetime
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CONTRACT, FILES, LIMITS, LINK_KEYS, PLAN_PATH, ROOT_FILES, WORK_DIR, clip, read_json, write_json  # noqa: E402
from handover_pdf import LISTED_MAX, build_pdf  # noqa: E402
from kit_zip import budget_for, fit_entries, left_entries, write_zip, zip_entries  # noqa: E402
from validate_handover import validate_content  # noqa: E402

DEFAULT_ZIP_MAX = 48 * 1024 * 1024
# A first guess at the PDF's size, before it exists.
PDF_RESERVE = 6 * 1024 * 1024
KIT_LABELS = {p['key']: p['label'] for p in CONTRACT['zipParts']}


def zip_date(inputs):
    try:
        d = datetime.datetime.strptime((inputs.get('generatedAt') or '')[:19], '%Y-%m-%dT%H:%M:%S')
        return (max(d.year, 1980), d.month, d.day, d.hour, d.minute, d.second)
    except ValueError:
        return (2026, 1, 1, 0, 0, 0)


def claims_summary(inputs):
    claims = (inputs.get('parts') or {}).get('claims')
    if not isinstance(claims, dict):
        return None
    counts = claims.get('counts') or {}
    items = [c for c in claims.get('toConfirm') or [] if isinstance(c, dict) and c.get('text')]
    to_confirm = max(int(counts.get('toConfirm') or 0), len(items))
    sourced = int(counts.get('sourced') or 0)
    total = max(int(counts.get('total') or 0), sourced + to_confirm)
    return {'checked': total, 'sourced': sourced, 'toConfirm': to_confirm, 'listed': min(len(items), LISTED_MAX)}


def auto_notes(inputs, plan, ctx, left):
    notes = []
    look_fonts = (inputs.get('look') or {}).get('fonts') or {}
    stand_in = [look_fonts.get(r) for r, real in (('heading', ctx.fonts.real['heading']), ('body', ctx.fonts.real['body']))
                if not real and look_fonts.get(r)]
    if stand_in:
        notes.append('The PDF shows %s in Helvetica: the font files did not come with the request.' % ' and '.join(sorted(set(stand_in))))
    if plan.get('missing'):
        notes.append('Not found in the container: %s.' % ', '.join(plan['missing'][:6]))
    for n in inputs.get('notReady') or []:
        notes.append('%s was not ready, so the handover leaves it out.' % (n.get('label') or n.get('key')))
    if left:
        notes.append('%d kit file%s left out of the zip (listed in the PDF).' % (len(left), '' if len(left) == 1 else 's'))
    return notes


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--plan', default=PLAN_PATH)
    ap.add_argument('--content', default=os.path.join(WORK_DIR, 'content.json'))
    ap.add_argument('--out-dir', default=os.path.join(WORK_DIR, 'out'))
    args = ap.parse_args(argv[1:])
    try:
        plan = read_json(args.plan)
        inputs = read_json(plan['inputs'])
        content = read_json(args.content)
    except (OSError, ValueError, KeyError) as e:
        print('FAIL: %s. Run plan.py first.' % e)
        return 2
    errors, _ = validate_content(content, inputs, plan)
    if errors:
        for e in errors:
            print('ERROR ' + e)
        print('FAIL: fix content.json first (validate_handover.py content).')
        return 1

    os.makedirs(args.out_dir, exist_ok=True)
    work = os.path.dirname(os.path.abspath(args.plan))
    pdf_path = os.path.join(args.out_dir, FILES['pdf'])
    zip_path = os.path.join(args.out_dir, FILES['zip'])
    max_bytes = int((inputs.get('zip') or {}).get('maxBytes') or DEFAULT_ZIP_MAX)
    entries = zip_entries(inputs, plan)
    kept, dropped = fit_entries(entries, budget_for(max_bytes, PDF_RESERVE))
    for _ in range(3):
        left = left_entries(dropped, plan, inputs)
        listed = list(ROOT_FILES) + [e['zip'] for e in kept]
        titles, pages, ctx = build_pdf(pdf_path, inputs, plan, content, listed, left, work)
        again, again_dropped = fit_entries(entries, budget_for(max_bytes, os.path.getsize(pdf_path)))
        if [e['zip'] for e in again] == [e['zip'] for e in kept]:
            break
        kept, dropped = again, again_dropped
    files = write_zip(zip_path, inputs, kept, pdf_path, zip_date(inputs))

    claims = claims_summary(inputs)
    business = clip((inputs.get('business') or {}).get('name') or 'the customer', 120)
    summary = '%d-page handover for %s and a zip of %d files' % (pages, business, len(files))
    if left:
        summary += ' (%d left out)' % len(left)
    if claims and claims['toConfirm']:
        summary += '; %d statement%s for the customer to confirm' % (claims['toConfirm'], '' if claims['toConfirm'] == 1 else 's')
    links = inputs.get('links') or {}
    notes = [n for n in content.get('notes') or [] if n] + auto_notes(inputs, plan, ctx, left)
    handover = {
        'version': CONTRACT['version'],
        'summary': clip(summary + '.', LIMITS['summary']),
        'sections': titles,
        'pages': pages,
        'files': files,
        'left': left[:LIMITS['left']],
        'links': {k: links.get(k) or '' for k in LINK_KEYS},
        'thisWeek': content['thisWeek'],
        'checklist': sorted(content['checklist'], key=lambda c: c['week']),
        'claims': claims,
        'notes': [clip(n, LIMITS['note']) for n in notes][:LIMITS['notes']],
    }
    write_json(os.path.join(args.out_dir, FILES['data']), handover)
    print('Built %s (%d pages), %s (%d files, %.1f MB), %s.' % (
        FILES['pdf'], pages, FILES['zip'], len(files), os.path.getsize(zip_path) / 1048576.0, FILES['data']))
    for l in left:
        print('Left out: %s: %s' % (l['file'], l['reason']))
    print('Next: validate_handover.py final %s' % args.out_dir)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
