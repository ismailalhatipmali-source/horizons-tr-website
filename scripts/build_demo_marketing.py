#!/usr/bin/env python3
"""Replace two reviewed marketing paragraph slots; preserve every other byte."""
from pathlib import Path
import hashlib,html,json,re
ROOT=Path(__file__).resolve().parents[1]
RELEASE='demo-marketing-20261004-r1'
OUT=ROOT/'release-assets'/RELEASE
SOURCE='src/demo-pwa/demo-marketing-locales.json'
LANGUAGES='en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'.split()
def sha(raw):return hashlib.sha256(raw).hexdigest()
def build():
 raw=(ROOT/SOURCE).read_bytes();copy=json.loads(raw)
 if list(copy)!=LANGUAGES or len(copy)!=32:raise ValueError('Marketing copy languages differ')
 files={};inputs={SOURCE:sha(raw)}
 for language in LANGUAGES:
  row=copy[language]
  if set(row)!={'demo_intro','product_subtitle'} or not all(isinstance(s,str) and s.strip() and '<'not in s and '>'not in s for s in row.values()):raise ValueError('Marketing copy invalid')
  for page,key in [('demo','demo_intro'),('product','product_subtitle')]:
   relative=f'{language}/{page}.html';source='dist/'+relative;before=(ROOT/source).read_bytes();text=before.decode()
   if page=='demo':
    matches=re.findall(r'<h1>[^<]*</h1><p>(.*?)</p>',text,re.S)
    if len(matches)!=1:raise ValueError('Demo introductory paragraph differs '+relative)
    old=matches[0]
   else:
    sections=re.findall(r'<section id="workbook-walkthrough"[^>]*>(.*?)</section>',text,re.S)
    if len(sections)!=1:raise ValueError('Product walkthrough differs '+relative)
    items=re.findall(r'<li><strong>[^<]*</strong><p>(.*?)</p></li>',sections[0],re.S)
    if len(items)!=7:raise ValueError('Product walkthrough steps differ '+relative)
    old=items[-1]
   new=html.escape(row[key],quote=True)
   if not old or '<'in old or text.count('<p>'+old+'</p>')!=1 or text.count('<p>'+new+'</p>')!=0:raise ValueError('Marketing slot is not unique '+relative)
   updated=text.replace('<p>'+old+'</p>','<p>'+new+'</p>',1)
   if updated.replace('<p>'+new+'</p>','<p>'+old+'</p>',1)!=text:raise ValueError('Marketing source changed outside paragraph '+relative)
   payload=updated.encode();target=OUT/'files'/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(payload);inputs[source]=sha(before)
   files[relative]={'source':f'release-assets/{RELEASE}/files/{relative}','baseline_source':source,'before':sha(before),'sha256':sha(payload),'bytes':len(payload),'slot_key':key,'old_html':old,'new_html':new}
 ancestors={f'release-assets/{name}/manifest.json':sha((ROOT/f'release-assets/{name}/manifest.json').read_bytes())for name in ['institution-20261003','global-currency-20261002']}
 manifest={'schema':1,'version':RELEASE,'interface_languages':LANGUAGES,'files':files,'input_sources':inputs,'ancestor_marketing_manifests':ancestors,'approved_paragraph_count':64}
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'status':'PASS','release':RELEASE,'manifest_sha256':sha((OUT/'manifest.json').read_bytes()),'languages':32,'exact_paragraph_changes':64}))
if __name__=='__main__':build()
