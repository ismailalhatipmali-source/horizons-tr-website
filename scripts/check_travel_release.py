#!/usr/bin/env python3
"""Verify the finished package, then create its private-release ZIP/manifest."""
from pathlib import Path
import sys,json,zipfile,hashlib,re
from lxml import etree,html
from pypdf import PdfReader
from build_travel_kit import REPO,LANGS,RTL,NS,formula
root=Path(sys.argv[1]);checks=Path(sys.argv[2]);original=root.parent/'travel-kit-original';specs=root.parent/'travel-kit-build-inputs'
required={'Agency_Documents.html','Worked_Example.html','Agency_Documents_A4.pdf','Agency_Documents_Letter.pdf','Worked_Example_A4.pdf','Operations_Blank.xlsx','Operations_Example.xlsx','Email_Scripts.txt','Email_Scripts.pdf','START_HERE.txt','START_HERE.pdf','Document_Index.txt','License.txt','License.pdf','Manrope_OFL.txt','Cairo_OFL.txt'}
results=[]
assert {f.name for f in root.iterdir() if f.is_dir()}=={'Agency_Kit_'+l.upper() for l in LANGS}
for lang in LANGS:
 d=root/('Agency_Kit_'+lang.upper());assert required<={f.name for f in d.iterdir() if f.is_file()},lang
 for f in d.iterdir():assert f.is_file() and f.stat().st_size>0,(lang,f)
 for name,count in [('Agency_Documents',40),('Worked_Example',8)]:
  doc=html.fromstring((d/(name+'.html')).read_bytes());assert doc.get('lang')==lang,(lang,'HTML language')
  if lang in RTL:assert doc.get('dir')=='rtl' or doc.xpath('//body[@dir="rtl"]'),(lang,'RTL')
  assert len(doc.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," page ")]'))==count,(lang,'pages')
  assert doc.xpath('//*[@contenteditable]'),(lang,'editable')
  for control in ['paper','font']:assert doc.xpath('//*[@id="'+control+'"]'),(lang,'controls')
  text=' '.join(doc.xpath('//body//text()[not(parent::script) and not(parent::style)]'))
  assert not re.search(r'\[\[\[?\d{4}\]\]\]|<<<HZN\d{4}>>>',text),(lang,'unresolved translation')
 for name,count in [('Agency_Documents_A4',40),('Agency_Documents_Letter',40),('Worked_Example_A4',8)]:
  r=PdfReader(d/(name+'.pdf'));assert len(r.pages)==count,(lang,name,len(r.pages));assert all(p.get_contents() is not None for p in r.pages)
 for name in ['START_HERE','Email_Scripts','License']:
  r=PdfReader(d/(name+'.pdf'));assert len(r.pages)>0
 assert len((d/'Document_Index.txt').read_text().splitlines())==40,(lang,'index')
 emails=(d/'Email_Scripts.txt').read_text();assert len(re.findall(r'^\d{2}\s',emails,re.M))==12,(lang,'12 email scripts')
 assert 'Etsy' not in (d/'START_HERE.txt').read_text(),lang
 for name in ['Operations_Blank.xlsx','Operations_Example.xlsx']:
  with zipfile.ZipFile(d/name) as z:
   assert z.testzip() is None,(lang,name,'ZIP integrity');w=etree.fromstring(z.read('xl/workbook.xml'));names=[s.get('name') for s in w.find('m:sheets',NS)]
   assert len(names)==10 and len(set(names))==10
   if lang in ['en','ar','tr','fr','es']:assert (d/name).read_bytes()==(original/('Agency_Kit_'+lang.upper())/name).read_bytes()
   else:
    s=json.loads((specs/(lang+'-'+name+'.json')).read_text());src=zipfile.ZipFile(s['source']);assert z.read('xl/styles.xml')==src.read('xl/styles.xml')
    assert set(z.namelist())==set(src.namelist())
    for i in range(1,11):
     a=etree.fromstring(src.read(f'xl/worksheets/sheet{i}.xml'));b=etree.fromstring(z.read(f'xl/worksheets/sheet{i}.xml'))
     old={c.get('r'):c.find('m:f',NS).text for c in a.findall('.//m:c',NS) if c.find('m:f',NS) is not None};new={c.get('r'):c.find('m:f',NS).text for c in b.findall('.//m:c',NS) if c.find('m:f',NS) is not None}
     assert new=={k:formula(v,s['mapping'],s['sheetmap']) for k,v in old.items()},(lang,'formula preservation',i)
     for tag in ['dataValidations','conditionalFormatting','tableParts','pane','sheetProtection']:
      assert len(a.findall('.//m:'+tag,NS))==len(b.findall('.//m:'+tag,NS)),(lang,tag)
     if lang in RTL:assert all(v.get('rightToLeft')=='1' for v in b.findall('.//m:sheetView',NS))
 results.append({'locale':lang,'required_files':len(required),'document_pages':40,'example_pages':8,'workbooks':2,'formula_structure':'preserved','pdf_files':6})
base=json.loads((checks/'final-workbooks.json').read_text());patched=json.loads((checks/'final-corrected-workbooks.json').read_text()) if (checks/'final-corrected-workbooks.json').exists() else [];res={(x['locale'],x['file']):x for x in base+patched};assert len(res)==64
(checks/'final-workbooks.json').write_text(json.dumps(list(res.values()),indent=2))
report={'version':'2.0.0','languages':LANGS,'language_count':32,'xlsx_files':64,'pdf_files':192,'tested_calculation_engine':'Artifact Tool','excel_directly_tested':False,'checks':results}
(root/'RELEASE_VERIFICATION.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
zipname=root.name+'.zip';dest=root.parent/zipname;tmp=dest.with_suffix('.zip.building')
with zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in sorted(root.rglob('*')):
  if f.is_file():z.write(f,f.relative_to(root).as_posix())
with zipfile.ZipFile(tmp) as z:assert z.testzip() is None
(tmp).replace(dest)
manifest={'verified':True,'version':'2.0.0','filename':zipname,'languages':LANGS,'size_bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'document_pages_per_language':40,'workbook_sheets_per_file':10,'email_scripts_per_language':12,'xlsx_count':64,'pdf_count':192,'original_sha256':hashlib.sha256(Path(sys.argv[3]).read_bytes()).hexdigest()}
(REPO/'release-assets/travel-kit-2.0.0/product.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(checks/'release-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(manifest,indent=2))
