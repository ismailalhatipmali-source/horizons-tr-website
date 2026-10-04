#!/usr/bin/env python3
"""Build creator attribution only, against exact reviewed public 1.4.5 baselines."""
from pathlib import Path
import hashlib,html,json,subprocess,re
ROOT=Path(__file__).resolve().parents[1]
BASE='50f24b9f23fb8d839f3229e8309e86a8ffe2edd5'
RELEASE='creator-credit-20261004-r1'
OUT=ROOT/'release-assets'/RELEASE
BEFORE={'try/index.html':'2c68fe39d5c0691d65112858cd905c49e2c596e5276eec9516a78eccd4e0217b','try/workbook.js':'399953768f9ff451efa4fac69e6f363d0773965bf97e5db4158ad9ff07f367d7','try/sw.js':'7ba9ee10c277221367906d994d2a69188190d23f5807858029db92da3ef948cb','try/demo-asset-manifest.json':'0dd6fd83f01f1b2b7c0bfbafbaa1011c792c9cab354ed2570c4078279ec1e0ec','learn/index.html':'bbcb72be19cc26dd2947fdffb1297a35ba6bcab778b5945e98fd8380025d5307'}
SOURCES={'try/index.html':'src/demo-pwa/index.html','try/workbook.js':'src/demo-pwa/workbook.js','try/sw.js':'src/demo-pwa/sw.js','try/demo-asset-manifest.json':'release-assets/1.4.5/files/try/demo-asset-manifest.json','learn/index.html':'src/workbook-web/index.html'}
def sha(raw):return hashlib.sha256(raw).hexdigest()
def base(path):
 raw=subprocess.check_output(['git','show',BASE+':'+path],cwd=ROOT)
 target=next(k for k,v in SOURCES.items() if v==path)
 if sha(raw)!=BEFORE[target]:raise ValueError('Reviewed live baseline differs: '+target)
 return raw

def build():
 locale_path=ROOT/'src/workbook-web/creator-credit-locales.json';script_path=ROOT/'src/workbook-web/creator-credit.js'
 rawdata=locale_path.read_bytes();data=json.loads(rawdata);generic=script_path.read_text()
 expected=set(json.loads((ROOT/'src/workbook-web/web-locales.json').read_text()))
 if data['schema_version']!=1 or set(data['labels'])!=expected or len(expected)!=32:raise ValueError('Incomplete creator locales')
 if data['names']!={'ar':'إسماعيل الخطيب','tr':'İsmail Alhatip'}:raise ValueError('Creator names differ')
 marker='/*HZN_CREATOR_CREDIT_LOCALES*/'
 if generic.count(marker)!=1:raise ValueError('Shared creator placeholder differs')
 compiled=generic.replace(marker,json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c'))
 if '</script' in compiled.lower():raise ValueError('Unsafe inline creator script')
 fallback='<span class="hzn-creator-credit-content" lang="ar" dir="rtl"><span class="hzn-creator-role">'+html.escape(data['labels']['ar'])+'</span><span class="hzn-creator-names" dir="ltr"><bdi lang="ar" dir="rtl"><b>'+html.escape(data['names']['ar'])+'</b></bdi><span aria-hidden="true">—</span><bdi lang="tr" dir="ltr"><b>'+html.escape(data['names']['tr'])+'</b></bdi></span></span>'
 original_credit='<span lang="ar" dir="rtl">إعداد وتنفيذ: <b>إسماعيل الخطيب</b></span><span aria-hidden="true"> · </span><span lang="en" dir="ltr">ismail alhatip</span>'
 demo_index=base(SOURCES['try/index.html']).decode();old='<p class="author-credit">'+original_credit+'</p>';new='<p class="author-credit" data-hzn-creator-credit>'+fallback+'</p>'
 if demo_index.count(old)!=1:raise ValueError('Demo credit placement differs')
 demo_index=demo_index.replace(old,new,1)
 workbook=base(SOURCES['try/workbook.js']).decode();old_const="const AUTHOR_CREDIT='"+original_credit+"';";new_const="const AUTHOR_CREDIT=()=>hznCreatorCreditMarkup(locale);"
 if workbook.count(old_const)!=1 or workbook.count('${AUTHOR_CREDIT}')!=2:raise ValueError('Demo credit hooks differ')
 workbook=workbook.replace(old_const,new_const,1).replace('${AUTHOR_CREDIT}','${AUTHOR_CREDIT()}')
 tail='\ninit();\n\n})();'
 if workbook.count(tail)!=1:raise ValueError('Demo initialization hook differs')
 workbook=workbook.replace(tail,'\n'+compiled+'\n'+tail,1)
 restored=workbook.replace('\n'+compiled+'\n'+tail,tail,1).replace(new_const,old_const,1).replace('${AUTHOR_CREDIT()}','${AUTHOR_CREDIT}')
 if restored!=base(SOURCES['try/workbook.js']).decode():raise ValueError('Demo behavior outside credit changed')
 if "$$('#course-nav [data-course]').forEach" not in workbook:raise ValueError('Existing navigation fix absent')
 paid=base(SOURCES['learn/index.html']).decode();old_footer='<small>© 2026 HORIZONS · 1.4.5 · إسماعيل الخطيب</small>'
 new_footer='<p class="author-credit" data-hzn-creator-credit>'+fallback+'</p><small>© 2026 HORIZONS · 1.4.5</small>'
 if paid.count(old_footer)!=1 or paid.count('</body>')!=1:raise ValueError('Paid entry footer differs')
 paid=paid.replace(old_footer,new_footer,1).replace('</body>','<script>'+compiled+'</script></body>',1)
 restored_paid=paid.replace(new_footer,old_footer,1).replace('<script>'+compiled+'</script></body>','</body>',1)
 if restored_paid!=base(SOURCES['learn/index.html']).decode():raise ValueError('Paid entry activation HTML changed')
 worker=base(SOURCES['try/sw.js']).decode();old_cache="const CACHE='hzn-public-demo-'+VERSION;";new_cache="const CACHE='hzn-public-demo-'+VERSION+'-creator-credit-20261004-r1';"
 if worker.count(old_cache)!=1:raise ValueError('Demo worker cache hook differs')
 worker=worker.replace(old_cache,new_cache,1)
 original_pattern='/^hzn-public-demo-\\d+\\.\\d+\\.\\d+$/';new_pattern='/^hzn-public-demo-\\d+\\.\\d+\\.\\d+(?:-creator-credit-\\d{8}-r\\d+)?$/'
 if worker.count(original_pattern)!=1:raise ValueError('Demo verified-cache migration hook differs')
 worker=worker.replace(original_pattern,new_pattern,1)
 if worker.replace(new_cache,old_cache,1).replace(new_pattern,original_pattern,1)!=base(SOURCES['try/sw.js']).decode():raise ValueError('Demo offline behavior changed')
 payloads={'try/index.html':demo_index.encode(),'try/workbook.js':workbook.encode(),'try/sw.js':worker.encode(),'learn/index.html':paid.encode()}
 for target,raw in payloads.items():(ROOT/SOURCES[target]).write_bytes(raw)
 manifest=json.loads(base(SOURCES['try/demo-asset-manifest.json']));previous=json.loads(base(SOURCES['try/demo-asset-manifest.json']))
 for target in ['try/index.html','try/workbook.js']:
  name=target[4:];manifest['files'][name].update(bytes=len(payloads[target]),sha256=sha(payloads[target]))
 projection=json.loads(json.dumps(manifest));
 for name in ['index.html','workbook.js']:projection['files'][name]=previous['files'][name]
 if projection!=previous:raise ValueError('Demo manifest changed beyond two UI entries')
 curriculum={name:entry for name,entry in previous['files'].items() if name.startswith('course/')or name=='workbook-data.js'}
 if len(curriculum)!=497 or any(manifest['files'][k]!=v for k,v in curriculum.items()):raise ValueError('Public demo curriculum/media changed')
 out_manifest=OUT/'files/try/demo-asset-manifest.json';out_manifest.parent.mkdir(parents=True,exist_ok=True);out_manifest.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 payloads['try/demo-asset-manifest.json']=out_manifest.read_bytes();SOURCES['try/demo-asset-manifest.json']=out_manifest.relative_to(ROOT).as_posix()
 files={target:{'source':SOURCES[target],'before':BEFORE[target],'sha256':sha(raw),'bytes':len(raw)} for target,raw in payloads.items()}
 compiled_sha=sha(compiled.encode());release={'schema':1,'version':RELEASE,'files':files,'shared_sources':{str(locale_path.relative_to(ROOT)):sha(rawdata),str(script_path.relative_to(ROOT)):sha(script_path.read_bytes())},'compiled_credit_sha256':compiled_sha,'demo_curriculum_count':497,'demo_curriculum_sha256':sha(json.dumps(curriculum,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()),'chapter_ids':previous['chapterIds'],'interface_languages':list(data['labels'])}
 (OUT/'manifest.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
 report={'release':RELEASE,'public_files':5,'languages':32,'demo_curriculum_and_media_preserved':497,'demo_manifest_entries':len(manifest['files']),'demo_progress_keys_unchanged':True,'demo_navigation_binding_preserved':True,'paid_activation_html_reversible_exact':True,'demo_manifest_only_index_workbook_changed':True,'compiled_creator_sha256':compiled_sha,'files':{k:{'bytes':len(v),'sha256':sha(v)}for k,v in payloads.items()}}
 (OUT/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':build()
