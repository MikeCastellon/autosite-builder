"""Finds this request's uploads: claims-input.json (the sources and every
text to check) and the print pieces (kit-print-*.pdf), wherever the
container put them ($INPUT_DIR, /mnt/user-data/uploads, /mnt/data, the
working directory, $HOME, /tmp, ... then the filesystem a few levels deep).
Prints JSON {files: {name: path}, missing: [...]}; exit 1 when
claims-input.json isn't found.

  find_inputs.py [--root DIR]
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
    ap.add_argument('--root', action='append', default=[], help='extra folder to search first')
    args = ap.parse_args(argv[1:])
    found = claimlib.find_inputs(args.root)
    missing = [] if claimlib.INPUT_NAME in found else [claimlib.INPUT_NAME]
    listed = []
    if not missing:
        try:
            listed = claimlib.load_input(found[claimlib.INPUT_NAME]).get('printFiles') or []
        except (OSError, ValueError):
            listed = []
    missing += [n for n in listed if n not in found]
    print(json.dumps({'files': found, 'missing': missing}, indent=2))
    return 1 if claimlib.INPUT_NAME in missing else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
