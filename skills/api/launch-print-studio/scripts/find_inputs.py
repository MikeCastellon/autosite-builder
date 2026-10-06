"""Finds the files attached to this request (container_upload blocks).

The API documents that uploads land in the container but not a fixed
directory, so this looks where they usually are ($INPUT_DIR,
/mnt/user-data/uploads, /mnt/data, the working directory, $HOME, /tmp, ...)
and then walks the rest of the filesystem a few levels deep, skipping system
and skill folders. Prints JSON: print-inputs.json, the logo and the font
files, each with its folder, size and (images) pixel size.

  find_inputs.py [--names "print-inputs.json,logo-1.png"] [--root DIR]
  --names: only these file names (the request lists them); exit 1 when one
           is missing, so you know before you start.

The build reads the logo and fonts from the folder print-inputs.json is in;
pass build_print.py --files-dir when they landed somewhere else.
"""
import argparse
import json
import os
import sys

sys.dont_write_bytecode = True
MAX_LIST = 100

EXTS = {'json', 'ttf', 'otf', 'png', 'jpg', 'jpeg', 'webp', 'gif'}
LIKELY = ['/mnt/user-data/uploads', '/mnt/user-data', '/mnt/data', '/mnt/inputs', '/mnt/uploads', '/mnt',
          '/workspace', '/uploads', '/input', '/inputs', '/files', '/data', '/home', '/tmp']
SKIP_DIRS = {'/proc', '/sys', '/dev', '/usr', '/lib', '/lib32', '/lib64', '/libx32', '/bin', '/sbin', '/etc',
             '/var', '/opt', '/run', '/boot', '/snap', '/srv', '/skills', '/tmp/print', '/nix'}
SKIP_NAMES = {'node_modules', '__pycache__', 'site-packages', 'dist-packages', '.cache', '.git', '.local',
              '.config', '.npm', '.ipython', '.matplotlib'}


def kind_of(name):
    low = name.lower()
    if low == 'print-inputs.json':
        return 'inputs'
    if low.endswith(('.ttf', '.otf')):
        return 'font'
    if low.startswith('logo'):
        return 'logo'
    if low.endswith('.json'):
        return 'json'
    return 'image'


def describe(path):
    name = os.path.basename(path)
    out = {'path': path, 'dir': os.path.dirname(path), 'name': name, 'bytes': os.path.getsize(path), 'kind': kind_of(name)}
    if out['kind'] in ('logo', 'image'):
        try:
            from PIL import Image
            with Image.open(path) as im:
                out['size'] = list(im.size)
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
    usual = [os.environ.get('INPUT_DIR') or '', os.getcwd(), os.path.expanduser('~')] + LIKELY
    roots = list(extra_roots) + [r for r in usual if r not in SKIP_DIRS and r not in skip]
    for root in [r for r in roots if r]:
        walk(root, 3, found, skip)
    if not any(os.path.basename(p) == 'print-inputs.json' for p in found):
        walk('/', 4, found, skip)
    return sorted(found.values())


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--names', default='', help='comma-separated file names the request lists')
    ap.add_argument('--root', action='append', default=[], help='extra folder to search first')
    args = ap.parse_args(argv[1:])
    files = [describe(p) for p in find(args.root)]
    wanted = [n.strip() for n in args.names.split(',') if n.strip()]
    missing = []
    if wanted:
        by_name = {}
        for f in files:
            by_name.setdefault(f['name'], f)
        files = [by_name[n] for n in wanted if n in by_name]
        missing = [n for n in wanted if n not in by_name]
    else:
        files = [f for f in files if f['kind'] in ('inputs', 'font', 'logo')] or files
    out = {'files': files[:MAX_LIST], 'missing': missing}
    inputs = [f for f in files if f['kind'] == 'inputs']
    if inputs:
        out['inputs'] = inputs[0]['path']
        out['filesDir'] = inputs[0]['dir']
    if len(files) > MAX_LIST:
        out['truncated'] = '%d more files not listed: pass --names or --root' % (len(files) - MAX_LIST)
    print(json.dumps(out, indent=2))
    return 1 if missing or not inputs else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
