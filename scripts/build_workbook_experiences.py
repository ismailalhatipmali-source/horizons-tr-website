#!/usr/bin/env python3
"""Build a public-demo successor from the immutable Focus release.

This prepares reviewable demo bytes and a compiled hook for the licensed reader.
The encrypted licensed reader is deliberately not produced outside its host.
"""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PRIOR = ROOT / 'release-assets/workbook-focus-20261005-r1'
OUT = ROOT / 'release-assets/workbook-experiences-20261007-r1'
RELEASE = 'workbook-experiences-20261007-r1'
PRIOR_MANIFEST_SHA = '402b0be57e53ba27137ecd1404b3f356ca058b71eafea085aa4592c56a0a6756'
SOURCES = [
    'src/workbook-experiences/experience-shell.js',
    'src/workbook-experiences/experience-shell.css',
    'src/workbook-experiences/experience-locales.json',
]


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def once(value, old, new):
    if value.count(old) != 1:
        raise ValueError('Expected exactly one approved hook: ' + old[:60])
    return value.replace(old, new, 1)


def packed(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')


def build():
    prior_raw = (PRIOR / 'manifest.json').read_bytes()
    if sha(prior_raw) != PRIOR_MANIFEST_SHA:
        raise ValueError('Immutable predecessor manifest changed')
    prior = json.loads(prior_raw)
    source_bytes = {name: (ROOT / name).read_bytes() for name in SOURCES}
    locales = json.loads(source_bytes[SOURCES[2]])
    if set(locales) != set(prior['languages']) or len(locales) != 32:
        raise ValueError('The existing 32 interface languages are required')
    keys = set(locales['en'])
    if any(set(row) != keys or not all(isinstance(x, str) and x.strip() for x in row.values()) for row in locales.values()):
        raise ValueError('Incomplete experience translations')
    old_hook = (PRIOR / 'focus-hook.js').read_text()
    if sha(old_hook.encode()) != prior['compiled_hook']['sha256']:
        raise ValueError('Predecessor hook changed')
    hook = source_bytes[SOURCES[0]].decode()
    for marker in ['/*WORKBOOK_FOCUS_BEGIN*/', '/*WORKBOOK_FOCUS_END*/']:
        if hook.count(marker) != 1:
            raise ValueError('Missing or duplicate presentation marker')
    hook = once(hook, '/*HZN_FOCUS_LOCALES*/', packed(locales))
    hook = once(hook, '/*HZN_FOCUS_CSS*/', packed(source_bytes[SOURCES[1]].decode()))
    previous = {}
    for name in ['try/workbook.js', 'try/demo-asset-manifest.json', 'try/sw.js']:
        entry = prior['files'][name]
        raw = (ROOT / entry['source']).read_bytes()
        if sha(raw) != entry['sha256'] or len(raw) != entry['bytes']:
            raise ValueError('Predecessor demo file changed: ' + name)
        previous[name] = raw
    workbook = previous['try/workbook.js'].decode()
    updated = once(workbook, old_hook, hook)
    if once(updated, hook, old_hook) != workbook:
        raise ValueError('Demo curriculum changed outside the presentation hook')
    worker = previous['try/sw.js'].decode()
    worker = once(worker, "const CACHE='hzn-public-demo-'+VERSION+'-workbook-focus-20261005-r1';",
                  "const CACHE='hzn-public-demo-'+VERSION+'-" + RELEASE + "';")
    worker = once(worker, 'comprehensive-meaning|workbook-focus)',
                  'comprehensive-meaning|workbook-focus|workbook-experiences)')
    manifest = json.loads(previous['try/demo-asset-manifest.json'])
    manifest['files']['workbook.js'].update(bytes=len(updated.encode()), sha256=sha(updated.encode()))
    payloads = {
        'try/workbook.js': updated.encode(),
        'try/demo-asset-manifest.json': (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode(),
        'try/sw.js': worker.encode(),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'experience-hook.js').write_text(hook)
    subprocess.run(['node', '--check', str(OUT / 'experience-hook.js')], check=True)
    for name, raw in payloads.items():
        target = OUT / 'files' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        if target.suffix == '.js':
            subprocess.run(['node', '--check', str(target)], check=True)
    release = {
        'schema': 1, 'release': RELEASE,
        'predecessor_manifest_sha256': PRIOR_MANIFEST_SHA,
        'sources': {name: sha(raw) for name, raw in source_bytes.items()},
        'compiled_hook': {'source': (OUT / 'experience-hook.js').relative_to(ROOT).as_posix(), 'sha256': sha(hook.encode()), 'bytes': len(hook.encode())},
        'files': {name: {'source': (OUT / 'files' / name).relative_to(ROOT).as_posix(), 'before': sha(previous[name]), 'sha256': sha(raw), 'bytes': len(raw)} for name, raw in payloads.items()},
        'languages': prior['languages'],
    }
    raw = (json.dumps(release, ensure_ascii=False, indent=2) + '\n').encode()
    (OUT / 'manifest.json').write_bytes(raw)
    (OUT / 'manifest.sha256').write_text(sha(raw) + '\n')
    print(json.dumps({'release': RELEASE, 'languages': len(locales), 'demo_bytes': len(payloads['try/workbook.js']), 'curriculum_unchanged': True, 'licensed_reader': 'not built or published'}))


if __name__ == '__main__':
    build()
