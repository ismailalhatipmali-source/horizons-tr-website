#!/usr/bin/env python3
"""Repackage the 1.4.1 encrypted assets for a public-shell-only 1.4.2 update.

This does not decrypt or modify paid lessons and never reads owner keys. It
verifies the previous overlay before creating the new deployment manifest.
"""

import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = '1.4.0'
PREVIOUS = '1.4.1'
VERSION = '1.4.2'
OLD = ROOT / 'release-assets' / PREVIOUS
NEW = ROOT / 'release-assets' / VERSION


def sha(data):
    return hashlib.sha256(data).hexdigest()


def validate_previous():
    lines = (OLD / 'manifest.tsv').read_text().splitlines()
    if not lines or lines[0] != f'HORIZONS_WEB_OVERLAY_V1\t{PREVIOUS}\t{BASE}':
        raise ValueError('Unexpected predecessor manifest')
    for line in lines[1:]:
        digest, size, source, destination = line.split('\t')
        if not (source.startswith(('src/workbook-web/', 'src/learning-api/', f'release-assets/{PREVIOUS}/files/learn/')) and
                destination.startswith(('learn/', 'learning-api/'))):
            raise ValueError('Unapproved predecessor entry')
        body = (ROOT / source).read_bytes()
        if sha(body) != digest or len(body) != int(size):
            if not source.startswith(('src/workbook-web/', 'src/learning-api/')):
                raise ValueError(f'Predecessor mismatch: {source}')
            original = subprocess.run(['git', 'show', 'HEAD:' + source], cwd=ROOT,
                                      check=True, capture_output=True).stdout
            if sha(original) != digest or len(original) != int(size):
                raise ValueError(f'Predecessor mismatch: {source}')
    return len(lines) - 1


def build():
    verified = validate_previous()
    prior = OLD / 'files' / 'learn'
    next_files = NEW / 'files' / 'learn'
    if next_files.exists() and (not next_files.is_dir() or next_files.is_symlink()):
        raise ValueError('Unexpected release target')
    next_files.mkdir(parents=True, exist_ok=True)
    previous_paths = {p.relative_to(prior).as_posix() for p in prior.rglob('*') if p.is_file()}
    current_paths = {p.relative_to(next_files).as_posix() for p in next_files.rglob('*') if p.is_file()}
    if current_paths and current_paths != previous_paths:
        raise ValueError('Unexpected files in existing generated release')
    for source in sorted(prior.rglob('*')):
        if source.is_symlink():
            raise ValueError('Symlink in encrypted predecessor')
        if not source.is_file():
            continue
        relative = source.relative_to(prior)
        target = next_files / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if relative.as_posix() == 'asset-manifest.json':
            continue
        if target.exists():
            if target.is_symlink() or target.read_bytes() != source.read_bytes():
                raise ValueError('Existing encrypted release differs from predecessor')
        else:
            shutil.copyfile(source, target)
    manifest_file = next_files / 'asset-manifest.json'
    body = (prior / 'asset-manifest.json').read_text()
    if body.count('"version": "1.4.1"') != 1:
        raise ValueError('Unexpected encrypted asset manifest version')
    manifest_file.write_text(body.replace('"version": "1.4.1"', '"version": "1.4.2"', 1))
    manifest = json.loads(manifest_file.read_text())
    if (manifest['version'] != VERSION or manifest['product'] != 'horizons-arabic-level1' or
            manifest['content_versions'] != [BASE, PREVIOUS]):
        raise ValueError('Unexpected encrypted content versions')
    referenced = {item['url'] for item in manifest['files'].values() if item['url'].startswith(f'content/{PREVIOUS}/')}
    actual = {file.relative_to(next_files).as_posix() for file in next_files.rglob('*.hzn')}
    if referenced != actual:
        raise ValueError('Encrypted file set differs from the manifest')
    for item in manifest['files'].values():
        if item['url'] in referenced:
            encrypted = (next_files / item['url']).read_bytes()
            if len(encrypted) != item['bytes'] or sha(encrypted) != item['sha256']:
                raise ValueError('Encrypted asset checksum mismatch')
    rows = []
    for source_root, destination_root in [(ROOT / 'src/workbook-web', 'learn'),
                                           (ROOT / 'src/learning-api', 'learning-api'),
                                           (next_files, 'learn')]:
        for source in sorted(source_root.rglob('*')):
            if source.is_symlink():
                raise ValueError('Symlink in public release')
            if source.is_file():
                body = source.read_bytes()
                if not body or len(body) > 16777216:
                    raise ValueError('Invalid overlay file size')
                relative = source.relative_to(source_root).as_posix()
                rows.append((sha(body), str(len(body)), source.relative_to(ROOT).as_posix(), destination_root + '/' + relative))
    if len({row[3] for row in rows}) != len(rows):
        raise ValueError('Duplicate destination')
    (NEW / 'manifest.tsv').write_text(f'HORIZONS_WEB_OVERLAY_V1\t{VERSION}\t{BASE}\n' +
                                      ''.join('\t'.join(row) + '\n' for row in rows))
    report = {'version': VERSION, 'base_version': BASE, 'previous_overlay_verified': verified,
              'encrypted_files_reused_unchanged': len(referenced), 'encrypted_lesson_changes': 0,
              'public_overlay_files': len(rows), 'public_overlay_bytes': sum(int(row[1]) for row in rows),
              'owner_keys_read': False}
    (NEW / 'build-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    build()
