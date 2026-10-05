"""Lists the files attached to this request (container_upload blocks).

The API documents that uploads land in the container but not a fixed
directory, so this looks where they usually are ($INPUT_DIR,
/mnt/user-data/uploads, /mnt/data, the working directory, $HOME, /tmp, ...)
and then walks the rest of the filesystem a few levels deep, skipping system
and skill folders. Prints JSON: one entry per image/PDF/design file with its
size, pixel dimensions or page count, and a kind guessed from the file name
(the request message's own list wins over the guess).

  find_inputs.py [--names "logo-1.png,reference-2.jpg"] [--root DIR]
  --names: only these file names (the request lists them); exit 1 when one
           is missing, so you know before you start.
"""
import argparse
import json
import logging
import os
import re
import sys

sys.dont_write_bytecode = True
logging.getLogger('pypdf').setLevel(logging.ERROR)  # malformed-PDF chatter on stderr
MAX_LIST = 150

EXTS = {'png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif', 'avif', 'svg', 'tif', 'tiff', 'bmp',
        'pdf', 'ai', 'eps', 'psd'}
LIKELY = ['/mnt/user-data/uploads', '/mnt/user-data', '/mnt/data', '/mnt/inputs', '/mnt/uploads', '/mnt',
          '/workspace', '/uploads', '/input', '/inputs', '/files', '/data', '/home', '/tmp']
SKIP_DIRS = {'/proc', '/sys', '/dev', '/usr', '/lib', '/lib32', '/lib64', '/libx32', '/bin', '/sbin', '/etc',
             '/var', '/opt', '/run', '/boot', '/snap', '/srv', '/skills', '/tmp/brand', '/nix'}
SKIP_NAMES = {'node_modules', '__pycache__', 'site-packages', 'dist-packages', '.cache', '.git', '.local',
              '.config', '.npm', '.ipython', '.matplotlib'}
KIND_WORDS = [
    ('logo', r'logo'),
    ('brand', r'brand|guide|guideline|card|flyer|wrap|van|truck|sign'),
    ('reference', r'ref|reference|inspiration|insp|screenshot|screen'),
    ('photo', r'photo|img|pic|gallery|work'),
]


def guess_kind(name):
    low = name.lower()
    for kind, pattern in KIND_WORDS:
        if re.search(r'(^|[^a-z])(%s)' % pattern, low):
            return kind
    return 'unknown'


def describe(path):
    ext = os.path.splitext(path)[1].lower().lstrip('.')
    out = {'path': path, 'name': os.path.basename(path), 'ext': ext, 'bytes': os.path.getsize(path),
           'kind': guess_kind(os.path.basename(path))}
    if ext == 'pdf' or ext == 'ai':
        try:
            from pypdf import PdfReader
            out['pages'] = len(PdfReader(path).pages)
        except Exception:
            pass
    elif ext != 'svg':
        try:
            from PIL import Image
            with Image.open(path) as im:
                out['size'] = list(im.size)
                out['mode'] = im.mode
                out['alpha'] = im.mode in ('RGBA', 'LA', 'PA') or 'transparency' in im.info
        except Exception as e:
            out['unreadable'] = str(e)[:120]
    return out


def walk(root, depth, found, skip):
    if depth < 0 or not os.path.isdir(root):
        return
    try:
        entries = list(os.scandir(root))
    except OSError:
        return
    for e in sorted(entries, key=lambda x: x.name):
        try:
            if e.is_dir(follow_symlinks=False):
                if e.path in SKIP_DIRS or e.name in SKIP_NAMES or e.path in skip:
                    continue
                walk(e.path, depth - 1, found, skip)
            elif e.is_file() and e.name.rsplit('.', 1)[-1].lower() in EXTS and not e.name.startswith('._'):
                found.setdefault(os.path.realpath(e.path), e.path)
        except OSError:
            continue


def find(extra_roots=()):
    found = {}
    skip = {os.environ.get('OUTPUT_DIR') or ''}
    # A skipped folder is skipped as a search root too (only --root may name
    # one): run from /tmp/brand, the working directory would otherwise list
    # raster/logo-1.png (the decoded copy) ahead of the real upload.
    usual = [os.environ.get('INPUT_DIR') or '', os.getcwd(), os.path.expanduser('~')] + LIKELY
    roots = list(extra_roots) + [r for r in usual if r not in SKIP_DIRS and r not in skip]
    for root in [r for r in roots if r]:
        walk(root, 3, found, skip)
    if not found:
        walk('/', 3, found, skip)
    return sorted(found.values())


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--names', default='', help='comma-separated file names the request lists')
    ap.add_argument('--root', action='append', default=[], help='extra folder to search first')
    args = ap.parse_args(argv[1:])
    paths = find(args.root)
    wanted = [n.strip() for n in args.names.split(',') if n.strip()]
    files = [describe(p) for p in paths]
    missing = []
    if wanted:
        by_name = {}
        for f in files:
            by_name.setdefault(f['name'], f)
        files = [by_name[n] for n in wanted if n in by_name]
        missing = [n for n in wanted if n not in by_name]
    out = {'files': files[:MAX_LIST], 'missing': missing}
    if len(files) > MAX_LIST:
        out['truncated'] = '%d more files not listed: pass --names or --root' % (len(files) - MAX_LIST)
    print(json.dumps(out, indent=2))
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
