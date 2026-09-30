#!/usr/bin/env python3
"""Build a small public demo update from the verified, immutable 1.4.0 ZIP.

Only the public player, release label, worker and integrity manifest change.
No owner key, paid curriculum or learner records are read by this builder.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

BASE = '1.4.0'
VERSION = '1.4.3'
BASE_SHA = '03cc0471808336bde82b9de493cecde921c90352f65ee5a285cd2cc54c40a368'
CHAPTERS = ['baa', 'dhaa_emphatic', 'daad', 'yaa', 'dhaal']


def sha(body):
    return hashlib.sha256(body).hexdigest()


def build(repo):
    parts = sorted((repo / 'release-assets' / BASE / 'demo').glob('part-*'))
    if [p.name for p in parts] != [f'part-{i:04d}' for i in range(13)]:
        raise ValueError('Missing or unexpected original demo parts')
    for part in parts:
        if part.is_symlink():
            raise ValueError('Symlink in original demo')
    body = b''.join(p.read_bytes() for p in parts)
    if len(body) != 103415120 or sha(body) != BASE_SHA:
        raise ValueError('Original demo checksum mismatch')
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        manifest = json.loads(archive.read('try/demo-asset-manifest.json'))
        if (manifest['version'] != BASE or manifest['edition'] != 'demo' or
                manifest['chapterIds'] != CHAPTERS):
            raise ValueError('Unexpected demo curriculum')
        original = archive.read('try/workbook.js').decode()
        before = "$$('[data-course]').forEach(b=>b.onclick=()=>nav({course:b.dataset.course}))"
        after = "$$('#course-nav [data-course]').forEach(b=>b.onclick=()=>nav({course:b.dataset.course}))"
        if original.count(before) != 1:
            raise ValueError('Unexpected original navigation code')
        player = repo / 'src/demo-pwa/workbook.js'
        expected = original.replace(before, after, 1).replace("const BUILD_LABEL='1.4.0';", "const BUILD_LABEL='1.4.3';", 1)
        if player.read_text() != expected:
            raise ValueError('Demo player must contain only the reviewed navigation fix')
        release = repo / 'src/demo-pwa/release-config.js'
        if release.read_text() != archive.read('try/release-config.js').decode().replace(
                '"version": "1.4.0"', '"version": "1.4.3"', 1):
            raise ValueError('Unexpected demo release configuration change')
        curriculum_hashes = {path: item['sha256'] for path, item in manifest['files'].items()
                             if path.startswith('course/') or path == 'workbook-data.js'}
    output = repo / 'release-assets' / f'demo-{VERSION}'
    generated = output / 'files/try/demo-asset-manifest.json'
    generated.parent.mkdir(parents=True, exist_ok=True)
    manifest['version'] = VERSION
    sources = ['workbook.js', 'release-config.js', 'sw.js']
    rows = []
    for name in sources:
        file = repo / 'src/demo-pwa' / name
        if file.is_symlink():
            raise ValueError('Symlink in public demo source')
        content = file.read_bytes()
        if name in manifest['files']:
            manifest['files'][name].update(bytes=len(content), sha256=sha(content))
        rows.append((sha(content), str(len(content)), file.relative_to(repo).as_posix(), 'try/' + name))
    if curriculum_hashes != {path: item['sha256'] for path, item in manifest['files'].items()
                             if path.startswith('course/') or path == 'workbook-data.js'}:
        raise ValueError('Curriculum or media changed')
    generated.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    content = generated.read_bytes()
    rows.append((sha(content), str(len(content)), generated.relative_to(repo).as_posix(),
                 'try/demo-asset-manifest.json'))
    (output / 'manifest.tsv').write_text(f'HORIZONS_DEMO_OVERLAY_V1\t{VERSION}\t{BASE}\n' +
                                       ''.join('\t'.join(row) + '\n' for row in rows))
    report = {'edition': 'demo', 'version': VERSION, 'base_version': BASE,
              'base_archive_sha256': BASE_SHA, 'chapter_ids': CHAPTERS,
              'overlay_files': len(rows), 'overlay_bytes': sum(int(row[1]) for row in rows),
              'unchanged_curriculum_and_media_files': len(curriculum_hashes),
              'progress_storage_keys_changed': False, 'owner_keys_read': False}
    (output / 'build-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[1])
    build(parser.parse_args().repo.resolve())
