#!/usr/bin/env python3
"""Pin approved phonics audio and application-extension inputs for deployment."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1]
assets=root/'release-assets/phonics-20261003'
mapping=json.loads((assets/'audio-manifest.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
sources={p:sha(root/p) for p in ['src/phonics/phonics-extension.js','src/phonics/phonics.css','release-assets/phonics-20261003/audio-manifest.json']}
items=[]
for item in mapping['items']:
    assert sha(assets/item['path'])==item['sha256']
    items.append({'id':item['id'],'text':item['text'],'letterKey':item['letter_id'],'vowel':item['vowel'],'length':item['length'],'index':item['order']-1,'path':'course/audio/phonics/'+item['id']+'.mp3','sha256':item['sha256']})
assert len(items)==168 and len({x['id'] for x in items})==168
release={'schema':1,'patch':'phonics-20261003','audio':items,'sources':sources}
(assets/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
print('Pinned phonics release: 168 audio assets and 3 extension inputs.')
