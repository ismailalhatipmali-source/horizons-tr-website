"""Verify the shipped public edition and private-source publication boundary."""
from pathlib import Path
import json,hashlib,re
R=Path(__file__).resolve().parents[1]
P=R/'release-assets/theory-reference-20261008-r1'
m=json.loads((P/'manifest.json').read_text(encoding='utf-8'))
languages='en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'.split()
assert m['schema']==2 and m['languages']==languages and m['review_passes']==2
assert m['sources']['full']['path']=='.horizons-theory-incoming-20261008-r3/reference.html'
for key in ['demo','loader','guard']:
    item=m['sources'][key];raw=(R/item['path']).read_bytes()
    assert len(raw)==item['bytes'] and hashlib.sha256(raw).hexdigest()==item['sha256'],key
raw=(R/m['sources']['demo']['path']).read_text(encoding='utf-8')
d=json.loads(raw.split('window.HZN_ENRICHED_DATA=',1)[1].split(';</script>',1)[0])
assert d['mode']=='demo' and d['editorial_release'] is True
assert d['languages']==d['ready_locales']==languages
assert [c['id'] for c in d['book']['chapters']]==['foundations','profiles']
assert {c['letter'] for c in d['letters']}=={'ب','ظ','ض','ي','ذ'}
assert sum(len(c['examples']) for c in d['book']['chapters'])+sum(len(c['examples']) for c in d['letters'])==147
for lang in languages:
    assert d['credit'][lang] and d['labels'][lang]['font'] and d['labels'][lang]['theme']
    for c in d['book']['chapters']:
        assert c['titles'][lang] and c['exercise']['questions'][lang] and c['exercise']['answers'][lang]
        for s in c['sections']:assert s['titles'][lang] and len(s['prose'][lang])==2
        for e in c['examples']:assert e['meanings'][lang]
    for c in d['letters']:
        assert c['notes'][lang] and len(c['extended_explanations'][lang])==2
        for e in c['examples']:assert e['meanings'][lang]
review=json.loads((P/'edition-review.json').read_text(encoding='utf-8'))
assert review['kind']=='model_cross_review' and review['native_human_review'] is False
assert review['full_sha256']==m['sources']['full']['sha256'] and review['demo_sha256']==m['sources']['demo']['sha256']
assert [x['language'] for x in review['languages']]==languages
for entry in review['languages']:
    assert entry['passes']==['semantic','linguistic']
    assert set(entry['source_sha256'])=={'core','extension_locale','extension_source'}
    assert all(re.fullmatch('[a-f0-9]{64}',x) for x in entry['source_sha256'].values())
print('PASS: reviewed 32-language public demo, 147 rows, private full-source path and exact release fingerprints')
