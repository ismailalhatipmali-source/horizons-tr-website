#!/usr/bin/env python3
"""Compile a public-only demo UI overlay against the approved creator release."""
from pathlib import Path
import hashlib,json,re,subprocess
ROOT=Path(__file__).resolve().parents[1]
RELEASE='demo-experience-20261004-r1';OUT=ROOT/'release-assets'/RELEASE
SOURCES=['src/demo-pwa/index.html','src/demo-pwa/workbook.js','src/demo-pwa/sw.js','src/workbook-web/index.html','src/demo-pwa/demo-experience.css','src/demo-pwa/demo-experience.js','src/demo-pwa/demo-experience-locales.json','src/demo-pwa/demo-letter-overview.json','release-assets/demo-experience-20261004-r1/baseline-learn-sw.js']
PATHS=['try/index.html','try/workbook.js','try/sw.js','learn/index.html','try/demo-asset-manifest.json','try/demo-experience.css','learn/sw.js']
PAID_WORKER_SHA='b1fb25fd68b21fdd6f0dfc892297b31bd2205b490f1fa7f145ee3d38758cae71'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def packed(data):return json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
def build():
 creator=json.loads((ROOT/'release-assets/creator-credit-20261004-r1/manifest.json').read_text())
 baseline=ROOT/SOURCES[8]
 if not baseline.exists():
  raw=(ROOT.parent/'demo_ux_work/live-before/learn/sw.js').read_bytes()
  if sha(raw)!=PAID_WORKER_SHA:raise ValueError('Approved public paid worker differs')
  baseline.parent.mkdir(parents=True,exist_ok=True);baseline.write_bytes(raw)
 expected=creator['interface_languages'];raws={p:(ROOT/p).read_bytes() for p in SOURCES}
 if sha(raws[SOURCES[8]])!=PAID_WORKER_SHA:raise ValueError('Frozen public paid worker differs')
 copy=json.loads(raws[SOURCES[6]]);overview=json.loads(raws[SOURCES[7]])
 if set(copy)!=set(expected) or len(copy)!=32:raise ValueError('Incomplete 32-language demo copy')
 keys=set(copy['en'])
 for lang,row in copy.items():
  if set(row)!=keys or not all(isinstance(v,str) and v.strip() for v in row.values()) or not row.get('demoEntryLabel'):raise ValueError('Incomplete demo row: '+lang)
 if not isinstance(overview,list) or len(overview)!=28 or len({x['id'] for x in overview})!=28:raise ValueError('Invalid public 28-letter metadata')
 for x in overview:
  if set(x)!=set(['id','letter','name','order']) or not isinstance(x['order'],int) or not re.fullmatch('[a-z_]+',x['id']) or not re.fullmatch('[\u0600-\u06ff]{1,4}',x['letter']) or not isinstance(x['name'],str) or len(x['name'])>80:raise ValueError('Invalid letter metadata fields')
 if sorted(x['order'] for x in overview)!=list(range(1,29)):raise ValueError('Invalid letter order')
 workbook=raws[SOURCES[1]].decode();worker=raws[SOURCES[2]].decode()
 if sha(raws[SOURCES[1]])!=creator['files']['try/workbook.js']['sha256'] or sha(raws[SOURCES[2]])!=creator['files']['try/sw.js']['sha256']:raise ValueError('Frozen public workbook/worker differs')
 hook=raws[SOURCES[5]].decode();lp='/*HZN_DEMO_EXPERIENCE_LOCALES*/';op='/*HZN_DEMO_LETTER_OVERVIEW*/'
 if hook.count(lp)!=1 or hook.count(op)!=1 or hook.count('/*DEMO_EXPERIENCE_BEGIN*/')!=1 or hook.count('/*DEMO_EXPERIENCE_END*/')!=1:raise ValueError('Demo hook placeholders differ')
 hook=hook.replace(lp,packed(copy)).replace(op,packed(overview));tail='\ninit();\n\n})();'
 if workbook.count(tail)!=1 or '/*DEMO_EXPERIENCE_BEGIN*/' in workbook:raise ValueError('Demo init hook differs')
 updated=workbook.replace(tail,'\n'+hook.rstrip('\r\n')+'\n'+tail,1)
 if updated.replace('\n'+hook.rstrip('\r\n')+'\n'+tail,tail,1)!=workbook:raise ValueError('Original demo app changed outside hook')
 old="const CACHE='hzn-public-demo-'+VERSION+'-creator-credit-20261004-r1';";new="const CACHE='hzn-public-demo-'+VERSION+'-demo-experience-20261004-r1';"
 pattern='/^hzn-public-demo-\\d+\\.\\d+\\.\\d+(?:-creator-credit-\\d{8}-r\\d+)?$/';replacement='/^hzn-public-demo-\\d+\\.\\d+\\.\\d+(?:-(?:creator-credit|demo-experience)-\\d{8}-r\\d+)?$/'
 if worker.count(old)!=1 or worker.count(pattern)!=1:raise ValueError('Demo cache hooks differ')
 worker=worker.replace(old,new,1).replace(pattern,replacement,1)
 paid_worker=raws[SOURCES[8]].decode();old_paid="const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2-responsive-20261004-r3';";new_paid="const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1';"
 if paid_worker.count(old_paid)!=1:raise ValueError('Paid shell cache hook differs')
 paid_worker=paid_worker.replace(old_paid,new_paid,1)
 entry=raws[SOURCES[3]].decode()
 if entry.count(lp)!=1 or entry.count('/*DEMO_ENTRY_BEGIN*/')!=1 or entry.count('/*DEMO_ENTRY_END*/')!=1:raise ValueError('Paid entry hook differs')
 # Entry activation behavior may change only at the demo link and its isolated copy hook.
 restored=re.sub(r'<script>/\*DEMO_ENTRY_BEGIN\*/.*?/\*DEMO_ENTRY_END\*/</script>','',entry,count=1,flags=re.S)
 old_anchor='<a class="button secondary" id="demo" href="../try/" data-w="demo">جرّب 5 حروف دون تسجيل</a>'
 new_anchor='<a class="button secondary" id="demo" href="../try/" data-demo-entry>جرّب الكراسة مجانًا</a>'
 if restored.count(new_anchor)!=1:raise ValueError('Paid demo link differs')
 restored=restored.replace(new_anchor,old_anchor,1)
 if sha(restored.encode())!=creator['files']['learn/index.html']['sha256']:raise ValueError('Paid entry activation HTML changed')
 entry=entry.replace(lp,packed(copy),1)
 payloads={'try/index.html':raws[SOURCES[0]],'try/workbook.js':updated.encode(),'try/sw.js':worker.encode(),'learn/index.html':entry.encode(),'try/demo-experience.css':raws[SOURCES[4]],'learn/sw.js':paid_worker.encode()}
 demo=json.loads((ROOT/creator['files']['try/demo-asset-manifest.json']['source']).read_text());before=json.loads(json.dumps(demo))
 if 'demo-experience.css' in demo['files'] or 'demo-experience.css' in demo['shell']:raise ValueError('Demo CSS already exists')
 for name in ['index.html','workbook.js']:
  raw=payloads['try/'+name];demo['files'][name].update(bytes=len(raw),sha256=sha(raw))
 css=payloads['try/demo-experience.css'];demo['files']['demo-experience.css']={'bytes':len(css),'sha256':sha(css),'mime':'text/css; charset=utf-8'};demo['shell'].append('demo-experience.css')
 projection=json.loads(json.dumps(demo))
 for name in ['index.html','workbook.js']:projection['files'][name]=before['files'][name]
 projection['files'].pop('demo-experience.css');projection['shell'].remove('demo-experience.css')
 if projection!=before:raise ValueError('Demo curriculum/media changed')
 curriculum={n:e for n,e in before['files'].items() if n.startswith('course/') or n=='workbook-data.js'}
 if len(curriculum)!=497 or [x['id'] for x in overview if x['id'] in creator['chapter_ids']]==[]:raise ValueError('Approved demo curriculum differs')
 payloads['try/demo-asset-manifest.json']=(json.dumps(demo,ensure_ascii=False,indent=2)+'\n').encode()
 for path in PATHS:
  out=OUT/'files'/path;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(payloads[path])
 for name,raw in [('compiled-hook.js',hook.encode()),('compiled-workbook.js',updated.encode())]:
  check=OUT/name;check.write_bytes(raw);r=subprocess.run(['node','--check',str(check)],capture_output=True,text=True);check.unlink()
  if r.returncode:raise ValueError('Compiled demo JavaScript syntax differs: '+r.stderr)
 files={p:{'source':(OUT/'files'/p).relative_to(ROOT).as_posix(),'before':PAID_WORKER_SHA if p=='learn/sw.js' else creator['files'].get(p,{}).get('sha256'),'sha256':sha(payloads[p]),'bytes':len(payloads[p])} for p in PATHS}
 release={'schema':1,'version':RELEASE,'files':files,'input_sources':{p:sha(raws[p]) for p in SOURCES},'demo_curriculum_count':497,'demo_curriculum_sha256':creator['demo_curriculum_sha256'],'chapter_ids':creator['chapter_ids'],'interface_languages':expected,'compiled_demo_hook_sha256':sha(hook.encode()),'public_letter_metadata_count':28}
 (OUT/'manifest.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
 report={'status':'PASS','release':RELEASE,'public_allowlist':PATHS,'demo_manifest_entries':len(demo['files']),'unchanged_manifest_entries':len(before['files'])-2,'curriculum_media_preserved':497,'public_letter_metadata_count':28,'interface_languages':32,'original_app_outside_hook_unchanged':True,'paid_activation_outside_demo_link_hook_unchanged':True,'paid_worker_only_cache_suffix_changed':True,'compiled_demo_hook_sha256':sha(hook.encode())}
 (OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':build()
