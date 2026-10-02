#!/usr/bin/env python3
"""Restore original native XML around Artifact Tool-authored cells.

This avoids an import/export restyling of the commercial source workbook.
Only translated labels/references, cached results, RTL and header row height
are applied to the original package; calculations and all numeric inputs remain.
"""
from pathlib import Path
import json,sys,zipfile,hashlib,re
from lxml import etree
from build_travel_kit import NS,formula

M='{'+NS['m']+'}'
def coordinate(address):
    col,row=re.fullmatch(r'([A-Z]+)(\d+)',address).groups(); n=0
    for c in col:n=n*26+ord(c)-64
    return int(row)-1,n-1

def preserve(spec,model):
    src=zipfile.ZipFile(spec['source']); files={n:src.read(n) for n in src.namelist()}
    mapping=spec['mapping'];sm=spec['sheetmap']; stats={'formula_count':0,'labels':0}
    root=etree.fromstring(files['xl/workbook.xml'])
    for sheet in root.find('m:sheets',NS):sheet.set('name',sm[sheet.get('name')])
    calc=root.find('m:calcPr',NS)
    if calc is None:calc=etree.SubElement(root,M+'calcPr')
    calc.set('calcMode','auto');calc.set('fullCalcOnLoad','1');calc.set('forceFullCalc','1')
    files['xl/workbook.xml']=etree.tostring(root,xml_declaration=True,encoding='utf-8')
    for i,(s,auth) in enumerate(zip(spec['sheets'],model['sheets']),1):
        key=f'xl/worksheets/sheet{i}.xml';root=etree.fromstring(files[key]);changed={c['address']:c for c in s['cells']}
        for c in root.findall('.//m:sheetData/m:row/m:c',NS):
            patch=changed.get(c.get('r'));f=c.find('m:f',NS)
            if f is not None:
                old=f.text;assert patch and patch['formula'][1:]==formula(old,mapping,sm)
                f.text=patch['formula'][1:];r,col=coordinate(c.get('r'));value=auth['values'][r][col]
                v=c.find('m:v',NS)
                if v is None:v=etree.SubElement(c,M+'v')
                if value is None or isinstance(value,str):c.set('t','str');v.text=value or ''
                elif isinstance(value,bool):c.set('t','b');v.text='1' if value else '0'
                else:c.set('t','n');v.text=str(value)
                stats['formula_count']+=1
            elif patch:
                assert 'value' in patch
                for tag in ('v','is'):
                    e=c.find('m:'+tag,NS)
                    if e is not None:c.remove(e)
                c.set('t','str');etree.SubElement(c,M+'v').text=patch['value'];stats['labels']+=1
        for view in root.findall('.//m:sheetViews/m:sheetView',NS):view.set('rightToLeft','1' if spec['rtl'] else '0')
        header=root.find(".//m:sheetData/m:row[@r='6']",NS)
        if header is not None:header.set('ht',str(max(54,float(header.get('ht','15')))));header.set('customHeight','1')
        for f in root.findall('.//m:dataValidations/m:dataValidation/m:formula1',NS):
            if f.text and f.text.startswith('"'):
                items=[mapping.get(s,s).replace(',',' / ') for s in f.text[1:-1].split(',')]
                assert len(items)==len(set(items)),(spec['locale'],'collapsed dropdown values',items)
                f.text='"'+','.join(items)+'"';assert len(f.text.encode('utf-16-le'))//2<=255
            elif f.text:f.text=formula(f.text,mapping,sm)
        for f in root.findall('.//m:conditionalFormatting/m:cfRule/m:formula',NS):
            f.text=formula(f.text or '',mapping,sm)
        files[key]=etree.tostring(root,xml_declaration=True,encoding='utf-8')
    for key,data in list(files.items()):
        if key.startswith('xl/tables/') and key.endswith('.xml'):
            root=etree.fromstring(data)
            for col in root.findall('.//m:tableColumn',NS):
                n=col.get('name');col.set('name',mapping.get(n,n))
            files[key]=etree.tostring(root,xml_declaration=True,encoding='utf-8')
    dest=Path(spec['output'])
    temp=dest.with_suffix('.xlsx.building')
    with zipfile.ZipFile(temp,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for key in src.namelist():z.writestr(key,files[key])
    with zipfile.ZipFile(temp) as z:assert z.testzip() is None
    temp.replace(dest)
    assert zipfile.ZipFile(dest).read('xl/styles.xml')==src.read('xl/styles.xml')
    return {'locale':spec['locale'],'file':dest.name,**stats,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}

if __name__=='__main__':
    tasks=Path(sys.argv[1]);authored=Path(sys.argv[2]);results=[]
    for task in json.loads(tasks.read_text()):
        spec=json.loads(Path(task).read_text());mf=authored/(spec['locale']+'-'+Path(spec['source']).name+'.model.json')
        results.append(preserve(spec,json.loads(mf.read_text())))
        print('Preserved',results[-1]['locale'],results[-1]['file'],flush=True)
    (authored/'native-preservation.json').write_text(json.dumps(results,indent=2))
