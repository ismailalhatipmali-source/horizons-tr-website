#!/usr/bin/env python3
"""Produce a hash-pinned, narrow successor to the approved demo-marketing release."""
import hashlib
import html
import json
import re
import unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
VERSION='pricing-cards-20261004-r1'
RELEASE=ROOT/'release-assets'/VERSION
MARKETING=ROOT/'release-assets/demo-marketing-20261004-r1'
sha=lambda raw:hashlib.sha256(raw).hexdigest()
marketing=json.loads((MARKETING/'manifest.json').read_text())
copy=json.loads((ROOT/'src/commerce/pricing-description-locales.json').read_text())
languages=marketing['interface_languages']
assert list(copy)==languages and len(languages)==32
files={}
for name in ['checkout.js','checkout.css','display-currency.js','display-currency.css']:
    previous=(ROOT/'dist'/name).read_bytes()
    updated=(RELEASE/'files'/name).read_bytes()
    assert updated!=previous
    files[name]={'source':f'release-assets/{VERSION}/files/{name}','before':sha(previous),'sha256':sha(updated),'bytes':len(updated)}
for lang in languages:
    for page in ('product','checkout','cart'):
        rel=f'{lang}/{page}.html'
        if page=='product':
            entry=marketing['files'][rel]
            before=(ROOT/entry['source']).read_bytes()
            assert sha(before)==entry['sha256']
        else:
            before=(ROOT/'dist'/rel).read_bytes()
        content=before.decode('utf-8')
        for asset,old_version in [
            ('display-currency.js','global-fx-1'),
            ('display-currency.css','global-fx-1'),
            ('checkout.js','institution-20261003'),
            ('checkout.css','admin-fx-1')]:
            old=asset+'?v='+old_version
            if asset.startswith('checkout.') and page=='product':continue
            assert content.count(old)==1,(rel,old,content.count(old))
            content=content.replace(old,asset+'?v='+VERSION)
        if page=='product':
            candidate_sections=list(re.finditer(r'<section><h2>[^<]+</h2><p>[^<]+</p></section>',content))
            matches=[match for match in candidate_sections if '560' in ''.join(str(unicodedata.digit(c)) if c.isdigit() else c for c in match.group())]
            assert len(matches)==1,(rel,len(matches))
            section=matches[0].group()
            label=re.match(r'<section><h2>([^<]+)</h2>',section).group(1)
            description=html.escape(copy[lang]['description'],quote=True)
            future=html.escape(copy[lang]['future'],quote=True)
            replacement=f'<section><h2>{label}</h2><p>{description}</p><p class="commerce-small">{future}</p></section>'
            content=content.replace(section,replacement)
        raw=content.encode('utf-8')
        dest=RELEASE/'files'/rel
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(raw)
        files[rel]={'source':f'release-assets/{VERSION}/files/{rel}','before':sha(before),'sha256':sha(raw),'bytes':len(raw)}
manifest={'schema':1,'version':VERSION,'languages':languages,'marketing_manifest_sha256':sha((MARKETING/'manifest.json').read_bytes()),'files':files}
(RELEASE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(f'Built {len(files)} pinned pricing assets and product/checkout pages across {len(languages)} languages.')
print('Manifest:',sha((RELEASE/'manifest.json').read_bytes()))
