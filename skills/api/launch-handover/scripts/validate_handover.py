"""Checks the handover before it is built and after.

  validate_handover.py content [/tmp/handover/content.json] [--plan /tmp/handover/plan.json]
  validate_handover.py final   [/tmp/handover/out]          [--plan /tmp/handover/plan.json]

content: the words you wrote (references/content.md): exact keys, one plain
  line per text, the caps, exactly 5 things for this week, 4 to 24 checklist
  tasks covering weeks 1 to 4, and no invented facts: no guarantee, award,
  certification or "best"/#1 claim the inputs don't make, nothing in return
  for a review, no "we posted it for you", only links from
  handover-inputs.json, only file names that are in this kit.
final: handover.json against the contract (references/handover-json.md,
  the same caps as the server's sanitizeHandover), handover.pdf opens and
  has the pages handover.json says, launch-kit.zip holds exactly the files
  handover.json lists (handover.pdf first, the same bytes), stays under the
  zip cap, and every kit file that was sent is in it or listed in `left`.

Exit 0 = valid (warnings may print), 1 = errors to fix, 2 = unreadable.
"""
import argparse
import os
import sys
import zipfile

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (CONTENT_LIMITS, CONTRACT, FILES, LIMITS, LINK_KEYS, PLAN_PATH, ROOT_FILES, WORK_DIR,  # noqa: E402
                    is_zip_path, js_length, one_line, read_json, text_problems)

CONTENT_KEYS = ('intro', 'why', 'brandNote', 'thisWeek', 'checklist', 'closing', 'notes')
FINAL_KEYS = ('version', 'summary', 'sections', 'pages', 'files', 'left', 'links', 'thisWeek', 'checklist', 'claims', 'notes')
CLAIM_KEYS = ('checked', 'sourced', 'toConfirm', 'listed')
PDF_MAX = 25 * 1024 * 1024


def _keys(obj, want, where, errors):
    if not isinstance(obj, dict):
        errors.append('%s must be an object' % where)
        return False
    missing = [k for k in want if k not in obj]
    extra = [k for k in obj if k not in want]
    if missing:
        errors.append('%s is missing %s' % (where, ', '.join(missing)))
    if extra:
        errors.append('%s has keys the contract does not allow: %s' % (where, ', '.join(map(str, extra))))
    return not missing


def _text(v, where, max_len, errors, empty_ok=False):
    if not isinstance(v, str):
        errors.append('%s must be a string' % where)
        return False
    if not v.strip():
        if not empty_ok:
            errors.append('%s must not be empty' % where)
        return empty_ok
    if js_length(v) > max_len:
        errors.append('%s is %d characters (emoji count 2), max %d' % (where, js_length(v), max_len))
        return False
    if one_line(v) != v:
        errors.append('%s must be one plain line: no line breaks, tabs, doubled spaces or spaces at the ends' % where)
        return False
    return True


def _int(v, lo, hi):
    return isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi


def _week_and_tasks(data, errors):
    """thisWeek and checklist, the same rules in content.json and handover.json."""
    week = data.get('thisWeek')
    if not isinstance(week, list) or len(week) != LIMITS['thisWeek']:
        errors.append('thisWeek must be a list of exactly %d things' % LIMITS['thisWeek'])
    else:
        titles = set()
        for i, t in enumerate(week):
            where = 'thisWeek[%d]' % i
            if _keys(t, ('title', 'detail'), where, errors):
                _text(t['title'], where + '.title', LIMITS['title'], errors)
                _text(t['detail'], where + '.detail', LIMITS['detail'], errors)
                if isinstance(t['title'], str):
                    if t['title'].lower() in titles:
                        errors.append('%s.title repeats another thing on the list' % where)
                    titles.add(t['title'].lower())
    tasks = data.get('checklist')
    if not isinstance(tasks, list) or not LIMITS['checklistMin'] <= len(tasks) <= LIMITS['checklist']:
        errors.append('checklist must be a list of %d to %d tasks' % (LIMITS['checklistMin'], LIMITS['checklist']))
    else:
        weeks = set()
        for i, c in enumerate(tasks):
            where = 'checklist[%d]' % i
            if _keys(c, ('week', 'task'), where, errors):
                if not _int(c['week'], 1, LIMITS['weeks']):
                    errors.append('%s.week must be a whole number from 1 to %d' % (where, LIMITS['weeks']))
                else:
                    weeks.add(c['week'])
                _text(c['task'], where + '.task', LIMITS['task'], errors)
        gaps = [w for w in range(1, LIMITS['weeks'] + 1) if w not in weeks]
        if gaps:
            errors.append('checklist has no task for week %s: give every week at least one' % ', '.join(map(str, gaps)))


def _notes(v, errors):
    if not isinstance(v, list) or len(v) > LIMITS['notes']:
        errors.append('notes must be a list of at most %d strings' % LIMITS['notes'])
        return
    for i, n in enumerate(v):
        _text(n, 'notes[%d]' % i, LIMITS['note'], errors)


# ─── The facts the words may lean on ─────────────────────────────────

def corpus_of(inputs):
    # The customer's answers and the business facts our team confirmed;
    # never the site's own copy, which may hold claims the ledger flagged.
    parts = [inputs.get('intake') or '', (inputs.get('site') or {}).get('facts') or '']
    b = inputs.get('business') or {}
    parts += [str(b.get(k) or '') for k in ('name', 'type', 'area')]
    parts += [str(v) for v in ((inputs.get('brand') or {}).get('reasons') or {}).values()]
    parts += [str(v) for v in (inputs.get('designReasons') or {}).values()]
    return '\n'.join(parts).lower()


def links_of(inputs):
    links = inputs.get('links') or {}
    return [v for v in links.values() if isinstance(v, str) and v]


def hosts_of(inputs):
    """Their own domain: the PDF says it is being connected, so the words
    may name it too."""
    name = (inputs.get('domain') or {}).get('name')
    return [name] if isinstance(name, str) and name.strip() else []


def zip_names(plan):
    """Every file name the zip will hold (base names) and the zip itself,
    for file mentions."""
    return {p.split('/')[-1] for p in plan.get('zipPlanned') or []} | {FILES['zip']}


def validate_content(data, inputs, plan):
    errors, warnings = [], []
    if not _keys(data, CONTENT_KEYS, 'content.json', errors) and not isinstance(data, dict):
        return errors, warnings
    C = CONTENT_LIMITS
    texts = []
    if _text(data.get('intro'), 'intro', C['intro'], errors):
        texts.append(('intro', data['intro']))
    why = data.get('why')
    if not isinstance(why, list) or not C['whyMin'] <= len(why) <= C['why']:
        errors.append('why must be a list of %d to %d lines' % (C['whyMin'], C['why']))
    else:
        for i, w in enumerate(why):
            if _text(w, 'why[%d]' % i, C['whyItem'], errors):
                texts.append(('why[%d]' % i, w))
    if _text(data.get('brandNote'), 'brandNote', C['brandNote'], errors, empty_ok=True) and data.get('brandNote'):
        texts.append(('brandNote', data['brandNote']))
    if _text(data.get('closing'), 'closing', C['closing'], errors, empty_ok=True) and data.get('closing'):
        texts.append(('closing', data['closing']))
    _week_and_tasks(data, errors)
    for i, t in enumerate(data.get('thisWeek') or []):
        if isinstance(t, dict):
            texts += [('thisWeek[%d].%s' % (i, k), t[k]) for k in ('title', 'detail') if isinstance(t.get(k), str)]
    for i, c in enumerate(data.get('checklist') or []):
        if isinstance(c, dict) and isinstance(c.get('task'), str):
            texts.append(('checklist[%d].task' % i, c['task']))
    _notes(data.get('notes'), errors)

    corpus, links, names, hosts = corpus_of(inputs), links_of(inputs), zip_names(plan), hosts_of(inputs)
    for where, text in texts:
        e, w = text_problems(text, where, corpus, links, names, hosts)
        errors += e
        warnings += w
    name = (inputs.get('business') or {}).get('name') or ''
    if name and isinstance(data.get('intro'), str) and name.lower() not in data['intro'].lower():
        warnings.append('intro does not name the business (%s)' % name)
    return errors, warnings


# ─── The built files ─────────────────────────────────────────────────

def validate_final(out_dir, inputs, plan):
    errors, warnings = [], []
    try:
        data = read_json(os.path.join(out_dir, FILES['data']))
    except (OSError, ValueError) as e:
        return ['cannot read %s: %s' % (FILES['data'], e)], warnings
    if not _keys(data, FINAL_KEYS, FILES['data'], errors):
        return errors, warnings
    if data['version'] != CONTRACT['version'] or isinstance(data['version'], bool):
        errors.append('version must be %d' % CONTRACT['version'])
    _text(data['summary'], 'summary', LIMITS['summary'], errors)
    if not isinstance(data['sections'], list) or not 1 <= len(data['sections']) <= LIMITS['sections']:
        errors.append('sections must be a list of 1 to %d titles' % LIMITS['sections'])
    else:
        for i, s in enumerate(data['sections']):
            _text(s, 'sections[%d]' % i, LIMITS['section'], errors)
    if not _int(data['pages'], 1, LIMITS['pages']):
        errors.append('pages must be a whole number from 1 to %d' % LIMITS['pages'])
    files = data['files']
    if not isinstance(files, list) or len(files) > LIMITS['files'] or not all(is_zip_path(f) for f in files):
        errors.append('files must be a list of at most %d plain zip paths' % LIMITS['files'])
        files = []
    elif len(set(files)) != len(files):
        errors.append('files lists a path twice')
    left = data['left']
    if not isinstance(left, list) or len(left) > LIMITS['left']:
        errors.append('left must be a list of at most %d entries' % LIMITS['left'])
        left = []
    for i, l in enumerate(left):
        if _keys(l, ('file', 'reason'), 'left[%d]' % i, errors):
            if not is_zip_path(l['file']) or l['file'] in files:
                errors.append('left[%d].file must be a zip path that is not in files' % i)
            _text(l['reason'], 'left[%d].reason' % i, LIMITS['reason'], errors)
    links = data['links']
    given = inputs.get('links') or {}
    if _keys(links, LINK_KEYS, 'links', errors):
        for k in LINK_KEYS:
            v = links[k]
            if not isinstance(v, str) or (v and v != given.get(k)):
                errors.append('links.%s must be exactly handover-inputs.json links.%s or ""' % (k, k))
        if given.get('site') and links.get('site') != given.get('site'):
            errors.append('links.site must be the site link')
    _week_and_tasks(data, errors)
    # The admin page shows these words as handover.json holds them: the same
    # checks as content.json, so an edit after the build can't slip through.
    texts = [('thisWeek[%d].%s' % (i, k), t[k]) for i, t in enumerate(data['thisWeek'] if isinstance(data['thisWeek'], list) else [])
             if isinstance(t, dict) for k in ('title', 'detail') if isinstance(t.get(k), str)]
    texts += [('checklist[%d].task' % i, c['task']) for i, c in enumerate(data['checklist'] if isinstance(data['checklist'], list) else [])
              if isinstance(c, dict) and isinstance(c.get('task'), str)]
    corpus, names = corpus_of(inputs), zip_names(plan)
    for where, text in texts:
        e, _ = text_problems(text, where, corpus, links_of(inputs), names, hosts_of(inputs))
        errors += e
    claims = data['claims']
    if claims is not None and _keys(claims, CLAIM_KEYS, 'claims', errors):
        for k in CLAIM_KEYS:
            if not _int(claims[k], 0, 100000):
                errors.append('claims.%s must be a whole number >= 0' % k)
    if isinstance((inputs.get('parts') or {}).get('claims'), dict) and claims is None:
        errors.append('claims must summarize the sign-off page: the claims ledger is in the inputs')
    _notes(data['notes'], errors)

    pdf_path = os.path.join(out_dir, FILES['pdf'])
    pdf_bytes = b''
    try:
        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()
        if not pdf_bytes.startswith(b'%PDF-'):
            errors.append('%s is not a PDF' % FILES['pdf'])
        elif len(pdf_bytes) > PDF_MAX:
            errors.append('%s is %d bytes, max %d' % (FILES['pdf'], len(pdf_bytes), PDF_MAX))
        else:
            from pypdf import PdfReader
            pages = len(PdfReader(pdf_path).pages)
            if pages != data['pages']:
                errors.append('pages says %r, %s has %d' % (data['pages'], FILES['pdf'], pages))
    except Exception as e:  # pypdf raises many kinds
        errors.append('%s cannot be read: %s' % (FILES['pdf'], e))

    zip_path = os.path.join(out_dir, FILES['zip'])
    max_zip = int((inputs.get('zip') or {}).get('maxBytes') or 48 * 1024 * 1024)
    try:
        size = os.path.getsize(zip_path)
        if size > max_zip:
            errors.append('%s is %d bytes, over the %d the server takes back' % (FILES['zip'], size, max_zip))
        with zipfile.ZipFile(zip_path) as zf:
            bad = zf.testzip()
            if bad:
                errors.append('%s: %s is corrupt' % (FILES['zip'], bad))
            names = zf.namelist()
            if names != files:
                errors.append('files must list the zip entries in order: zip has %s' % ', '.join(names))
            for root in ROOT_FILES:
                if root not in names:
                    errors.append('%s must hold %s' % (FILES['zip'], root))
            if FILES['pdf'] in names and pdf_bytes and zf.read(FILES['pdf']) != pdf_bytes:
                errors.append('the handover.pdf inside the zip differs from %s' % FILES['pdf'])
    except (OSError, zipfile.BadZipFile) as e:
        errors.append('%s cannot be read: %s' % (FILES['zip'], e))

    accounted = set(files) | {l.get('file') for l in left if isinstance(l, dict)}
    for z in plan.get('zipFiles') or []:
        if z['zip'] not in accounted:
            errors.append('%s was sent but is neither in the zip nor in left' % z['zip'])
    for g in plan.get('generated') or []:
        if g not in accounted:
            errors.append('%s should be in the zip' % g)
    return errors, warnings


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('mode', choices=('content', 'final'))
    ap.add_argument('path', nargs='?', default=None)
    ap.add_argument('--plan', default=PLAN_PATH)
    args = ap.parse_args(argv[1:])
    try:
        plan = read_json(args.plan)
        inputs = read_json(plan['inputs'])
    except (OSError, ValueError, KeyError) as e:
        print('FAIL: cannot read the plan (%s): %s. Run plan.py first.' % (args.plan, e))
        return 2
    if args.mode == 'content':
        path = args.path or os.path.join(WORK_DIR, 'content.json')
        try:
            data = read_json(path)
        except (OSError, ValueError) as e:
            print('FAIL: cannot read %s as UTF-8 JSON: %s' % (path, e))
            return 2
        errors, warnings = validate_content(data, inputs, plan)
        label = 'content.json'
    else:
        errors, warnings = validate_final(args.path or os.path.join(WORK_DIR, 'out'), inputs, plan)
        label = 'the handover'
    for w in warnings:
        print('WARN  ' + w)
    for e in errors:
        print('ERROR ' + e)
    if errors:
        print('FAIL: %d error(s). Fix them and run this again.' % len(errors))
        return 1
    print('OK: %s is valid%s.' % (label, ' (%d warning(s))' % len(warnings) if warnings else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
