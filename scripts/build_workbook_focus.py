#!/usr/bin/env python3
"""Build the UI successor without touching any historical source or curriculum.

The full reader is patched privately by deploy-workbook-focus.php after it has
verified the installed release. No decrypted reader or teaching assets belong
in this build's output.
"""
from pathlib import Path
import copy
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
RELEASE = 'workbook-focus-20261005-r1'
PREVIOUS = 'comprehensive-meaning-20261004-r1'
OUT = ROOT / 'release-assets' / RELEASE
TAIL = '\ninit();\n\n})();'
SOURCES = [
    'src/workbook-focus/focus-shell.js',
    'src/workbook-focus/focus-shell.css',
    'src/workbook-focus/focus-locales.json',
    'src/workbook-focus/blending4-component.js',
    'src/workbook-focus/blending4-component.css',
    'scripts/comprehensive-meaning-preservation.php',
    'scripts/blending4-preservation.php',
]
DEMO_CHANGES = [
    ("function buttonStatus(section){return section==='blending4'?text('comingSoon'):['alphabet','catalog'].includes(section)?text('availableLabel'):text('lockedLabel');}",
     "function buttonStatus(section){return ['alphabet','catalog'].includes(section)?text('availableLabel'):text('lockedLabel');}"),
    ("${section==='blending4'?'is-coming-soon':['alphabet','catalog'].includes(section)?'is-free':'is-locked'}",
     "${['alphabet','catalog'].includes(section)?'is-free':'is-locked'}"),
    ("panelMarkup(text(preview),preview==='blending4')", "panelMarkup(text(preview),false)"),
]


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def packed(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError('Expected exactly one known UI hook: ' + old[:70])
    return text.replace(old, new, 1)


def build():
    prior_raw = (ROOT / 'release-assets' / PREVIOUS / 'manifest.json').read_bytes()
    if sha(prior_raw) != '488bbaee728c687fbb7bd4f5b308778648dd8eaef9fadf4558cf76bbd582b530':
        raise ValueError('Immutable predecessor manifest changed')
    prior = json.loads(prior_raw)
    locales = json.loads((ROOT / SOURCES[2]).read_text())
    languages = prior['interface_languages']
    if set(locales) != set(languages) or len(languages) != 32:
        raise ValueError('Expected the existing 32 interface languages')
    keys = set(locales['en'])
    for language, row in locales.items():
        if set(row) != keys or not all(isinstance(x, str) and x.strip() for x in row.values()):
            raise ValueError('Incomplete interface copy: ' + language)
    source_names = SOURCES[:]
    for name in ['blending3-component.js', 'blending3-responsive.css']:
        path = 'src/workbook-focus/' + name
        if (ROOT / path).exists():
            source_names.append(path)
    sources = {p: (ROOT / p).read_bytes() for p in source_names}
    hook = sources[SOURCES[0]].decode()
    for marker in ['/*WORKBOOK_FOCUS_BEGIN*/', '/*WORKBOOK_FOCUS_END*/']:
        if hook.count(marker) != 1:
            raise ValueError('Missing or duplicate successor marker: ' + marker)
    hook = replace_once(hook, '/*HZN_FOCUS_LOCALES*/', packed(locales))
    hook = replace_once(hook, '/*HZN_FOCUS_CSS*/', packed(sources[SOURCES[1]].decode()))
    insertion = '\n' + hook.rstrip('\r\n') + '\n'
    previous = {}
    for name in ['try/workbook.js', 'try/demo-asset-manifest.json', 'try/sw.js']:
        raw = (ROOT / prior['files'][name]['source']).read_bytes()
        if sha(raw) != prior['files'][name]['sha256'] or len(raw) != prior['files'][name]['bytes']:
            raise ValueError('Immutable predecessor payload changed: ' + name)
        previous[name] = raw
    workbook = previous['try/workbook.js'].decode()
    if '/*WORKBOOK_FOCUS_BEGIN*/' in workbook:
        raise ValueError('Successor already installed in predecessor')
    revised = workbook
    for before, after in DEMO_CHANGES:
        revised = replace_once(revised, before, after)
    revised = replace_once(revised, TAIL, insertion + TAIL)
    restored = replace_once(revised, insertion + TAIL, TAIL)
    for before, after in reversed(DEMO_CHANGES):
        restored = replace_once(restored, after, before)
    if restored != workbook:
        raise ValueError('Demo content changed outside reviewed UI hooks')
    worker = previous['try/sw.js'].decode()
    worker = replace_once(worker, "const CACHE='hzn-public-demo-'+VERSION+'-comprehensive-meaning-20261004-r1';",
                          "const CACHE='hzn-public-demo-'+VERSION+'-" + RELEASE + "';")
    worker = replace_once(worker, '(?:creator-credit|demo-experience|comprehensive-meaning)',
                          '(?:creator-credit|demo-experience|comprehensive-meaning|workbook-focus)')
    manifest = json.loads(previous['try/demo-asset-manifest.json'])
    updated_manifest = copy.deepcopy(manifest)
    updated_manifest['files']['workbook.js'].update(bytes=len(revised.encode()), sha256=sha(revised.encode()))
    projected = copy.deepcopy(updated_manifest)
    projected['files']['workbook.js'] = manifest['files']['workbook.js']
    if projected != manifest:
        raise ValueError('Demo curriculum, shell or media manifest changed')
    payloads = {
        'try/workbook.js': revised.encode(),
        'try/demo-asset-manifest.json': (json.dumps(updated_manifest, ensure_ascii=False, indent=2) + '\n').encode(),
        'try/sw.js': worker.encode(),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    hook_path = OUT / 'focus-hook.js'
    hook_path.write_text(hook)
    subprocess.run(['node', '--check', str(hook_path)], check=True, capture_output=True, text=True)
    for path, raw in payloads.items():
        output = OUT / 'files' / path
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(raw)
        if output.suffix == '.js':
            subprocess.run(['node', '--check', str(output)], check=True, capture_output=True, text=True)
    release = {
        'schema': 1, 'release': RELEASE,
        'sources': {p: sha(raw) for p, raw in sources.items()},
        'compiled_hook': {'source': hook_path.relative_to(ROOT).as_posix(), 'bytes': len(hook.encode()), 'sha256': sha(hook.encode())},
        'files': {p: {'source': (OUT / 'files' / p).relative_to(ROOT).as_posix(), 'before': sha(previous[p]), 'bytes': len(raw), 'sha256': sha(raw)} for p, raw in payloads.items()},
        'languages': languages,
    }
    manifest_raw = (json.dumps(release, ensure_ascii=False, indent=2) + '\n').encode()
    (OUT / 'manifest.json').write_bytes(manifest_raw)
    (OUT / 'manifest.sha256').write_text(sha(manifest_raw) + '\n')
    teaching = {k: v for k, v in manifest['files'].items() if k.startswith('course/') or k == 'workbook-data.js'}
    report = {
        'release': RELEASE, 'build': 'PASS', 'interface_languages': len(languages),
        'new_copy_keys': len(keys), 'demo_teaching_manifest_entries_unchanged': len(teaching),
        'demo_teaching_manifest_sha256': sha(packed(teaching).encode()),
        'original_demo_restored_byte_for_byte': True,
        'paid_reader': 'Private in-place patch prepared; not decrypted or validated by this build',
        'browser_verification': 'Separate required gate', 'deployment': 'Not performed by build',
        'demo_workbook_byte_delta': len(payloads['try/workbook.js']) - len(previous['try/workbook.js']),
    }
    (OUT / 'build-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    build()
