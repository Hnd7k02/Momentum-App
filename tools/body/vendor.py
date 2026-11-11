#!/usr/bin/env python3
"""Copy the MakeHuman files the candidates read into tools/body/makehuman/.

    python3 tools/body/vendor.py <unpacked>/anny/data/mpfb2 --wheel <anny-0.6.2-…whl>
    python3 tools/body/vendor.py --check

The data comes from the PyPI wheel `anny==0.6.2`, folder `anny/data/mpfb2/`
only — never its code. The folder carries its own LICENSE.md (CC0 1.0
Universal), which is copied with the files and read in tools/body/README.md.

The first form shapes every candidate of candidates.json against the full
folder, notes each file that was opened, and copies exactly those, byte for
byte, with a MANIFEST.json of their sha256 and the wheel's. Files of an earlier
run that no candidate reads any more are removed. The second form checks the
copies against the manifest and changes nothing.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

import bodylib as B
from build import resolve

HERE = Path(__file__).resolve().parent
TARGET = HERE / 'makehuman'
MANIFEST = TARGET / 'MANIFEST.json'
WHEEL = {
    'package': 'anny',
    'version': '0.6.2',
    'file': 'anny-0.6.2-py3-none-any.whl',
    'sha256': 'bad70bdc2be0dfa9880d60129c3a1339678f08f493184f637dc2825c3e27b8d2',
    'folder': 'anny/data/mpfb2/',
}
LICENSE = 'LICENSE.md'


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def files_read(source: Path) -> list[str]:
    candidates = json.loads((HERE / 'candidates.json').read_text())
    base = B.Base(source)
    for name in candidates:
        if name.startswith('_'):
            continue
        spec = resolve(candidates, name)
        macro, local = spec.get('macro', {}), spec.get('local', {})
        B.shape(base, macro, local)
        if spec.get('relief', {}).get('muscle_detail'):
            B.muscle_detail(base, macro, local)
    return sorted(base.read)


def vendor(source: Path, wheel: Path | None):
    if wheel is not None and sha256(wheel) != WHEEL['sha256']:
        raise SystemExit(f'{wheel} is not the wheel this pipeline was written against (sha256 differs)')
    licence = source / LICENSE
    if 'CC0 1.0 Universal' not in licence.read_text():
        raise SystemExit(f'{licence} does not state CC0 1.0 Universal — stop and read it')
    wanted = files_read(source) + [LICENSE]
    for old in sorted(TARGET.rglob('*')) if TARGET.exists() else []:
        if old.is_file() and old != MANIFEST and str(old.relative_to(TARGET)) not in wanted:
            old.unlink()
    for relative in wanted:
        destination = TARGET / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / relative, destination)
    for folder in sorted((p for p in TARGET.rglob('*') if p.is_dir()), reverse=True):
        if not any(folder.iterdir()):
            folder.rmdir()
    manifest = {
        'about': 'MakeHuman base mesh, rig and targets as MPFB2 ships them, copied unchanged. '
                 'Licence: CC0 1.0 Universal, see LICENSE.md beside this file. '
                 'Written by tools/body/vendor.py; do not edit.',
        'source': WHEEL,
        'files': {relative: {'bytes': (TARGET / relative).stat().st_size, 'sha256': sha256(TARGET / relative)}
                  for relative in sorted(wanted)},
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
    total = sum(entry['bytes'] for entry in manifest['files'].values())
    print(f'{len(wanted)} files, {total / 1e6:.2f} MB in {TARGET}')


def check() -> int:
    manifest = json.loads(MANIFEST.read_text())
    wrong = []
    for relative, entry in manifest['files'].items():
        path = TARGET / relative
        if not path.is_file():
            wrong.append(f'missing: {relative}')
        elif sha256(path) != entry['sha256']:
            wrong.append(f'changed: {relative}')
    listed = set(manifest['files'])
    for path in sorted(TARGET.rglob('*')):
        if path.is_file() and path != MANIFEST and str(path.relative_to(TARGET)) not in listed:
            wrong.append(f'not in the manifest: {path.relative_to(TARGET)}')
    for line in wrong:
        print(line)
    if not wrong:
        print(f'{len(listed)} files match MANIFEST.json')
    return 1 if wrong else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('source', nargs='?', help='the unpacked anny/data/mpfb2 folder')
    parser.add_argument('--wheel', help='the wheel itself, to check its sha256')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        sys.exit(check())
    if not args.source:
        parser.error('name the unpacked anny/data/mpfb2 folder, or pass --check')
    vendor(Path(args.source), Path(args.wheel) if args.wheel else None)


if __name__ == '__main__':
    main()
