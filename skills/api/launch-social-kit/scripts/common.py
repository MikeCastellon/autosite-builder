"""Shared helpers for the social kit scripts: the skill's data files, the
brief (social-input.json, written by the server) and where the uploaded
files are in the container.

The API copies attached files into the container but does not document a
fixed folder, so find_files() looks where they usually are ($INPUT_DIR,
/mnt/user-data/uploads, /mnt/data, the working directory, $HOME, /tmp, ...)
and then walks the rest of the filesystem a few levels deep, skipping
system and skill folders (the brand skill's find_inputs.py does the same).
"""
import json
import os
import re
import sys

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
WORK = '/tmp/social'
BRIEF_NAME = 'social-input.json'

LIKELY = ['/mnt/user-data/uploads', '/mnt/user-data', '/mnt/data', '/mnt/inputs', '/mnt/uploads', '/mnt',
          '/workspace', '/uploads', '/input', '/inputs', '/files', '/data', '/home', '/tmp']
SKIP_DIRS = {'/proc', '/sys', '/dev', '/usr', '/lib', '/lib32', '/lib64', '/libx32', '/bin', '/sbin', '/etc',
             '/var', '/opt', '/run', '/boot', '/snap', '/srv', '/skills', WORK, '/nix'}
SKIP_NAMES = {'node_modules', '__pycache__', 'site-packages', 'dist-packages', '.cache', '.git', '.local',
              '.config', '.npm', '.ipython', '.matplotlib'}
PLAIN_NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._()+-]{0,150}$')
HEX = re.compile(r'^#[0-9a-fA-F]{6}$')


def read_json(path):
    with open(path, 'r', encoding='utf-8-sig') as f:
        return json.load(f)


def write_json(path, value):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(value, f, indent=2, ensure_ascii=False)
        f.write('\n')


_cache = {}


def data_file(name):
    if name not in _cache:
        _cache[name] = read_json(os.path.join(DATA, name))
    return _cache[name]


def formats():
    return data_file('formats.json')


def rules():
    return data_file('text_rules.json')


def format_of(file_name):
    return formats()['formats'].get(file_name)


# ─── Finding the uploads ──────────────────────────────────────────────

def _walk(root, depth, wanted, found, skip):
    if depth < 0 or not os.path.isdir(root):
        return
    try:
        entries = sorted(os.scandir(root), key=lambda e: e.name)
    except OSError:
        return
    for e in entries:
        try:
            if e.is_dir(follow_symlinks=False):
                if e.path in SKIP_DIRS or e.name in SKIP_NAMES or e.path in skip or e.name.startswith('.'):
                    continue
                _walk(e.path, depth - 1, wanted, found, skip)
            elif e.is_file() and e.name in wanted and e.name not in found:
                found[e.name] = e.path
        except OSError:
            continue


def find_files(names, extra_roots=()):
    """{ name: path } for the plain file names asked for, searched in the
    usual upload folders first, then the whole filesystem (3 levels)."""
    wanted = set(n for n in names if PLAIN_NAME.match(n or ''))
    found = {}
    skip = {os.environ.get('OUTPUT_DIR') or ''}
    usual = [os.environ.get('INPUT_DIR') or '', os.getcwd(), os.path.expanduser('~')] + LIKELY
    roots = list(extra_roots) + [r for r in usual if r and r not in SKIP_DIRS and r not in skip]
    for root in roots:
        if wanted - set(found):
            _walk(root, 3, wanted, found, skip)
    if wanted - set(found):
        _walk('/', 3, wanted, found, skip)
    return found


def brief_files(brief):
    """Every container file the brief names: logo, photos, fonts."""
    names = []
    logo = brief.get('logo') or {}
    if logo.get('file'):
        names.append(logo['file'])
    for p in brief.get('photos') or []:
        if p.get('file'):
            names.append(p['file'])
    for slot in ('heading', 'body'):
        for f in ((brief.get('fonts') or {}).get(slot) or {}).get('files') or []:
            if f.get('name'):
                names.append(f['name'])
    return names


def load_brief(path):
    """The brief with `paths` ({ name: absolute path }) for its files. A
    brief written by find_inputs.py already has them; otherwise they are
    looked up next to the brief, then everywhere."""
    brief = read_json(path)
    paths = dict(brief.get('paths') or {})
    names = brief_files(brief)
    here = os.path.dirname(os.path.abspath(path))
    for n in names:
        if n in paths and os.path.isfile(paths[n]):
            continue
        local = os.path.join(here, n)
        if PLAIN_NAME.match(n) and os.path.isfile(local):
            paths[n] = local
    missing = [n for n in names if n not in paths or not os.path.isfile(paths[n])]
    if missing:
        paths.update(find_files(missing, extra_roots=[here]))
    brief['paths'] = {n: paths[n] for n in names if n in paths}
    return brief


def palette_of(brief):
    """The brief's five colors as '#rrggbb' (a neutral dark set when the
    brief has none, which the server notes)."""
    fallback = {'bg': '#111111', 'secondary': '#1f1f1f', 'text': '#ffffff', 'muted': '#aaaaaa', 'accent': '#e53e3e'}
    raw = brief.get('palette') or {}
    out = {}
    for role, value in fallback.items():
        v = raw.get(role)
        out[role] = v.lower() if isinstance(v, str) and HEX.match(v) else value
    return out


def photo_of(brief, name):
    for p in brief.get('photos') or []:
        if p.get('file') == name:
            return p
    return None
