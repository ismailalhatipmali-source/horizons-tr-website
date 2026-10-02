#!/usr/bin/env python3
"""Prepare localized kit documents and Artifact Tool workbook authoring inputs.

The original archive is an explicit input, never committed or copied under dist.
The XLSX native-preservation step keeps the original styles/tables/validation.
"""
from pathlib import Path
import argparse, json, re, shutil, hashlib, zipfile, html, base64, io, os
from lxml import etree, html as lh
from fontTools.ttLib import TTFont
from fontTools import subset

REPO = Path(__file__).resolve().parents[1]
LANGS = 'en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'.split()
RTL = {'ar','he','fa','ur'}
VERSION = '2.0.0'
NS = {'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def sources(name, pattern):
    return dict(re.findall(pattern, (REPO/'src/travel-kit/i18n'/name).read_text(), re.M))

def translations():
    src = sources('source-master.txt', r'^<<<HZN(\d+)>>> (.*)$')
    ws = sources('workbook-source.txt', r'^\[\[\[(\d+)\]\]\] (.*)$')
    docs, books = {}, {}
    for n in ('01','02','03'):
        docs.update(json.loads((REPO/f'src/travel-kit/i18n/translations-{n}.json').read_text()))
        books.update(json.loads((REPO/f'src/travel-kit/i18n/workbook-translations-{n}.json').read_text()))
    assert set(docs) == set(books) == set(LANGS)-{'en','ar','tr','fr','es'}
    for lang in docs:
        assert set(docs[lang]) == set(src), (lang,'missing document translations')
        assert set(books[lang]) == set(ws), (lang,'missing workbook translations')
        for k,v in docs[lang].items():
            assert isinstance(v,str) and v.strip(),(lang,k)
            # Never translate technical font/paper names or syntax.
            if src[k] in ('html','Manrope','Arial','Georgia','A4','Letter') or re.fullmatch(r'[\d\W]+',src[k]):
                docs[lang][k]=src[k]
            a=re.findall(r'\{\{[^}]+\}\}',src[k]); b=re.findall(r'\{\{[^}]+\}\}',docs[lang][k])
            assert len(a)==len(b),(lang,k,'placeholder mismatch')
            if a and sorted(a)!=sorted(b):
                it=iter(a);docs[lang][k]=re.sub(r'\{\{[^}]+\}\}',lambda _:next(it),docs[lang][k])
    return src,ws,docs,books

def translate_html(raw, lang, mapping):
    root=lh.document_fromstring(raw)
    for el in root.iter():
        if not isinstance(el.tag,str): continue
        if el.tag not in ('script','style'):
            if el.text and el.text.strip() in mapping:
                el.text=el.text.replace(el.text.strip(),mapping[el.text.strip()])
        if el.tail and el.tail.strip() in mapping:
            el.tail=el.tail.replace(el.tail.strip(),mapping[el.tail.strip()])
        for key in ('placeholder','data-placeholder','title','aria-label','value'):
            value=el.get(key)
            if value in mapping and not (el.tag=='option' and key=='value'):
                el.set(key,mapping[value])
        if el.tag=='script' and el.text and 'const I18N=' in el.text:
            def patch(m):
                d=json.loads(m.group(1)); d={k:mapping.get(v,v) for k,v in d.items()}
                return 'const I18N='+json.dumps(d,ensure_ascii=False)+';'
            el.text=re.sub(r'const I18N=(\{.*?\});',patch,el.text,flags=re.S)
    root.set('lang',lang);root.set('dir','rtl' if lang in RTL else 'ltr')
    root.find('body').set('dir','rtl' if lang in RTL else 'ltr')
    if lang in RTL: root.set('style','--font:Cairo')
    style=etree.SubElement(root.find('head'),'style',id='localization-layout')
    style.text='html[dir=rtl] .tools,html[dir=rtl] .setup{text-align:right}.tag{white-space:normal}.page-header{align-items:flex-start}.meta{flex-wrap:wrap}.tools select{max-width:100%}'
    # Embed a licensed locale font so the generated text also works offline.
    fr=Path(os.environ.get('HZN_TRAVEL_FONT_ROOT','/usr/share/fonts'))
    family={'he':'Hebrew','hi':'Devanagari','bn':'Bengali','fa':'Arabic','ur':'Arabic'}.get(lang,'')
    fp=fr/'truetype/noto'/('NotoSans'+family+'-Regular.ttf')
    if lang in ('zh','ja'): fp=fr/'opentype/noto/NotoSansCJK-Regular.ttc'
    if fp.is_file():
        font=TTFont(fp,fontNumber=0 if lang=='ja' else 2) if fp.suffix=='.ttc' else TTFont(fp)
        text=''.join(mapping.values())+''.join(chr(i) for i in range(32,127))
        options=subset.Options();options.flavor='woff'
        ss=subset.Subsetter(options=options);ss.populate(text=text);ss.subset(font)
        font.flavor='woff';buffer=io.BytesIO();font.save(buffer)
        style.text+='@font-face{font-family:HznLocale;src:url(data:font/woff;base64,'+base64.b64encode(buffer.getvalue()).decode()+')}body{font-family:var(--font),HznLocale,Manrope,Cairo,Arial,sans-serif}'
        fontselect=root.get_element_by_id('font');option=etree.Element('option',value='HznLocale',selected='selected');option.text='Noto Sans';fontselect.insert(0,option)
        for opt in list(fontselect)[1:]:opt.attrib.pop('selected',None)
    return '<!doctype html>\n'+lh.tostring(root,encoding='unicode',method='html')

def formula(f, mapping, sheetmap):
    # Only quoted labels and quoted sheet names change. Operators, functions,
    # numbers, coordinates and accounting rules remain exactly the same.
    f=re.sub(r"'((?:[^']|'')*)'!",lambda m:"'"+sheetmap.get(m[1].replace("''","'"),m[1]).replace("'","''")+"'!",f)
    return re.sub(r'"((?:[^"]|"")*)"',lambda m:'"'+mapping.get(m[1].replace('""','"'),m[1]).replace('"','""')+'"',f)

def workbook_spec(path, mapping, lang):
    z=zipfile.ZipFile(path);wb=etree.fromstring(z.read('xl/workbook.xml'))
    names=[s.get('name') for s in wb.find('m:sheets',NS)]
    sheetmap={}
    for name in names:
        n=re.sub(r'[\[\]:*?/\\]','',mapping.get(name,name)).strip(" '")[:31]
        assert n and n not in sheetmap.values(),(lang,'invalid/duplicate sheet name',n)
        sheetmap[name]=n
    shared=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        shared=[''.join(s.itertext()) for s in etree.fromstring(z.read('xl/sharedStrings.xml'))]
    sheets=[]
    for i,name in enumerate(names,1):
        root=etree.fromstring(z.read(f'xl/worksheets/sheet{i}.xml'))
        cells=[]
        for c in root.findall('.//m:sheetData/m:row/m:c',NS):
            f=c.find('m:f',NS); v=c.find('m:v',NS)
            if f is not None:
                cells.append({'address':c.get('r'),'formula':'='+formula(f.text or '',mapping,sheetmap)})
            elif c.get('t') in ('s','inlineStr','str'):
                old=shared[int(v.text)] if c.get('t')=='s' else ((v.text or '') if v is not None else '') if c.get('t')=='str' else ''.join(c.find('m:is',NS).itertext())
                if old in mapping:cells.append({'address':c.get('r'),'value':mapping[old]})
        dimension=root.find('m:dimension',NS)
        if dimension is None:
            refs=[c.get('r') for c in root.findall('.//m:sheetData/m:row/m:c',NS)]
            def colnum(s):
                n=0
                for ch in s:n=n*26+ord(ch)-64
                return n
            end=max(refs,key=lambda s:(colnum(re.match(r'[A-Z]+',s)[0]),int(re.search(r'\d+',s)[0])))
            lastcol=re.match(r'[A-Z]+',end)[0];lastrow=max(int(re.search(r'\d+',s)[0]) for s in refs)
            dim=f'A1:{lastcol}{lastrow}'
        else:dim=dimension.get('ref')
        sheets.append({'original_name':name,'name':sheetmap[name],'cells':cells,'dimension':dim})
    return {'source':str(path),'locale':lang,'rtl':lang in RTL,'mapping':mapping,'sheetmap':sheetmap,'sheets':sheets}

def prepare(archive, output):
    src,ws,docs,books=translations()
    original=output.parent/'travel-kit-original'
    if not original.exists():
        original.mkdir(parents=True)
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None
            for name in z.namelist():
                assert '..' not in Path(name).parts and not Path(name).is_absolute()
            z.extractall(original)
    output.mkdir(parents=True,exist_ok=True)
    specs=output.parent/'travel-kit-build-inputs';specs.mkdir(exist_ok=True)
    tasks=[]
    base=original/'Agency_Kit_EN'
    for lang in LANGS:
        target=output/('Agency_Kit_'+lang.upper());target.mkdir(exist_ok=True)
        if lang in ('en','ar','tr','fr','es'):
            for f in (original/('Agency_Kit_'+lang.upper())).iterdir():shutil.copy2(f,target/f.name)
        else:
            dm={src[k]:v for k,v in docs[lang].items()};wm={ws[k]:v for k,v in books[lang].items()}
            for n in ('Agency_Documents.html','Worked_Example.html'):
                (target/n).write_text(translate_html((base/n).read_text(),lang,dm))
            for n in ('START_HERE.txt','Email_Scripts.txt','Document_Index.txt','License.txt'):
                lines=[]
                for line in (base/n).read_text().splitlines():
                    assert not line.strip() or line.strip() in dm,(n,line)
                    lines.append(dm.get(line.strip(),line))
                (target/n).write_text('\n'.join(lines)+'\n')
            for n in ('Manrope_OFL.txt','Cairo_OFL.txt'):shutil.copy2(base/n,target/n)
            nf=Path(os.environ.get('HZN_TRAVEL_FONT_LICENSE','/usr/share/doc/fonts-noto-core/copyright'))
            if nf.is_file():shutil.copy2(nf,target/'Noto_Font_License.txt')
            for n in ('Operations_Blank.xlsx','Operations_Example.xlsx'):
                spec=workbook_spec(base/n,wm,lang);spec['output']=str(target/n)
                sp=specs/(lang+'-'+n+'.json');sp.write_text(json.dumps(spec,ensure_ascii=False));tasks.append(str(sp))
        print('Prepared',lang,flush=True)
    (specs/'tasks.json').write_text(json.dumps(tasks))
    (output/'00_START_HERE.txt').write_text('HORIZONS Travel Agent Client Kit\nVersion '+VERSION+' - 32 languages\n\nChoose your Agency_Kit_<LANGUAGE> folder and read START_HERE.txt.\nThe original English, Arabic, Turkish, French and Spanish editions are retained.\nAdditional editions contain localized documents, guides, email scripts and workbooks.\nOne business licence applies to all editions. Keep original backups.\nWorkbook formulas calculate in your spreadsheet application; changing currency labels does not convert amounts.\n\nLanguages: '+', '.join(LANGS)+'\nSupport: support@horizons-tr.com\n')
    (specs/'build-info.json').write_text(json.dumps({'version':VERSION,'languages':LANGS,'original_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'original':str(original),'output':str(output)},indent=2))
    print('Document preparation complete; workbook authoring tasks:',len(tasks))

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('archive',type=Path);ap.add_argument('output',type=Path)
    a=ap.parse_args();prepare(a.archive.resolve(),a.output.resolve())
