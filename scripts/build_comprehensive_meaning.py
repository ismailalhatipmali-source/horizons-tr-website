#!/usr/bin/env python3
"""Compile reviewed free-only meanings over the immutable public demo release."""
from pathlib import Path
import hashlib, json, subprocess

ROOT = Path(__file__).resolve().parents[1]
RELEASE = 'comprehensive-meaning-20261004-r1'
OUT = ROOT / 'release-assets' / RELEASE
PREDECESSOR = ROOT / 'release-assets/demo-experience-20261004-r1'
SOURCES = ['src/workbook-web/story-meaning-control.js', 'src/demo-pwa/demo-meaning-extension.js', 'src/demo-pwa/demo-meanings-locales.json']
PATHS = ['try/index.html','try/workbook.js','try/sw.js','learn/index.html','try/demo-asset-manifest.json','try/demo-experience.css','learn/sw.js']
TAIL = '\ninit();\n\n})();'
def sha(b): return hashlib.sha256(b).hexdigest()
def pack(value): return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
def main():
    old_raw = (PREDECESSOR / 'manifest.json').read_bytes()
    old = json.loads(old_raw)
    assert sha(old_raw) == '4ae2afa672ed4ab2c6236a256c535b0557b1dd7b8cb9740994ad2735e77575af'
    sources = {p: (ROOT/p).read_bytes() for p in SOURCES}
    meanings = json.loads(sources[SOURCES[2]])
    assert set(meanings) == {'schema_version','chapter_ids','language_codes','ui','lesson_words','stories'}
    assert meanings['schema_version'] == 1 and meanings['chapter_ids'] == old['chapter_ids']
    assert len(meanings['language_codes']) == 32 and set(meanings['language_codes']) == set(old['interface_languages'])
    assert len(meanings['lesson_words']) == 100 and len(meanings['stories']) == 10
    assert set(meanings['lesson_words']) == {f'{chapter}-{number:02d}' for chapter in old['chapter_ids'] for number in range(1,21)}
    assert set(meanings['stories']) == {f'{chapter}-story-{number:02d}' for chapter in old['chapter_ids'] for number in range(1,3)}
    assert set(meanings['ui']) == set(meanings['language_codes'])
    text = lambda value: isinstance(value,str) and bool(value.strip())
    for row in meanings['ui'].values():
        assert set(row) == {'language','languageSync'} and all(text(value) for value in row.values())
    for group, fields in [('lesson_words', {'word_meaning','sentence_meaning'}), ('stories', {'title','lines','question','options'})]:
        for entry in meanings[group].values():
            assert set(entry) == {'translations'}
            assert set(entry['translations']) == set(meanings['language_codes'])
            for row in entry['translations'].values():
                assert set(row) == fields
                if group == 'lesson_words': assert all(text(value) for value in row.values())
                else:
                    assert text(row['title']) and text(row['question']) and isinstance(row['lines'],list) and len(row['lines']) == 4 and all(text(value) for value in row['lines'])
                    assert isinstance(row['options'],dict) and set(row['options']) == {'a','b','c'} and all(text(value) for value in row['options'].values())
    payloads = {p: (ROOT/old['files'][p]['source']).read_bytes() for p in PATHS}
    assert all(sha(payloads[p]) == old['files'][p]['sha256'] for p in PATHS)
    extension = sources[SOURCES[1]].decode()
    placeholder = '/*HZN_DEMO_MEANINGS_LOCALES*/'
    assert extension.count(placeholder) == 1
    extension = extension.replace(placeholder, pack(meanings))
    story = sources[SOURCES[0]].decode()
    assert story.count('/*STORY_MEANING_CONTROL_BEGIN*/') == story.count('/*STORY_MEANING_CONTROL_END*/') == 1
    hook = '\n' + extension.rstrip('\r\n') + '\n' + story.rstrip('\r\n') + '\n'
    app = payloads['try/workbook.js'].decode()
    assert app.count(TAIL) == 1 and '/*DEMO_MEANING_EXTENSION_BEGIN*/' not in app
    updated = app.replace(TAIL, hook+TAIL, 1)
    assert updated.replace(hook+TAIL, TAIL, 1) == app
    payloads['try/workbook.js'] = updated.encode()
    old_cache = "const CACHE='hzn-public-demo-'+VERSION+'-demo-experience-20261004-r1';"
    new_cache = "const CACHE='hzn-public-demo-'+VERSION+'-comprehensive-meaning-20261004-r1';"
    old_pattern = '/^hzn-public-demo-\\d+\\.\\d+\\.\\d+(?:-(?:creator-credit|demo-experience)-\\d{8}-r\\d+)?$/'
    new_pattern = '/^hzn-public-demo-\\d+\\.\\d+\\.\\d+(?:-(?:creator-credit|demo-experience|comprehensive-meaning)-\\d{8}-r\\d+)?$/'
    worker = payloads['try/sw.js'].decode()
    assert worker.count(old_cache) == worker.count(old_pattern) == 1
    payloads['try/sw.js'] = worker.replace(old_cache,new_cache,1).replace(old_pattern,new_pattern,1).encode()
    old_shell = "const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1';"
    new_shell = "const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1-comprehensive-meaning-20261004-r1';"
    worker = payloads['learn/sw.js'].decode()
    assert worker.count(old_shell) == 1
    payloads['learn/sw.js'] = worker.replace(old_shell,new_shell,1).encode()
    demo = json.loads(payloads['try/demo-asset-manifest.json'])
    demo['files']['workbook.js'].update(bytes=len(payloads['try/workbook.js']),sha256=sha(payloads['try/workbook.js']))
    payloads['try/demo-asset-manifest.json'] = (json.dumps(demo,ensure_ascii=False,indent=2)+'\n').encode()
    for path, raw in payloads.items():
        target = OUT/'files'/path; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(raw)
    check = OUT/'compiled-demo-check.js'; check.write_text(updated)
    result = subprocess.run(['node','--check',str(check)],capture_output=True,text=True); check.unlink()
    assert result.returncode == 0, result.stderr
    manifest = {'schema':1,'version':RELEASE,'predecessor_demo_manifest_sha256':sha(old_raw),
        'files':{p:{'source':f'release-assets/{RELEASE}/files/{p}','before':old['files'][p]['sha256'],'sha256':sha(payloads[p]),'bytes':len(payloads[p])} for p in PATHS},
        'input_sources':{p:sha(sources[p]) for p in SOURCES},'interface_languages':old['interface_languages'],
        'free_chapter_ids':old['chapter_ids'],'free_word_count':100,'free_story_count':10,
        'demo_curriculum_count':497,'compiled_demo_hook_sha256':sha(hook.encode())}
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':'PASS','release':RELEASE,'manifest_sha256':sha((OUT/'manifest.json').read_bytes()),'interface_languages':32,'free_words':100,'free_stories':10,'public_files':PATHS}))
if __name__ == '__main__': main()
