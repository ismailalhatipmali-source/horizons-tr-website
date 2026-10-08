#!/usr/bin/env python3
"""Build the expanded editorial reader. Release mode rejects incomplete editions."""
from pathlib import Path
import argparse,base64,hashlib,json
ROOT=Path(__file__).resolve().parents[1]
S=ROOT/'src/theory-reference'
def read(path):return json.loads((S/path).read_text(encoding='utf-8'))
LABEL_KEYS={'intro','warning','examples','practice','answer','notes','contents','view','all','original','answers','forms','words','draft','font','theme'}
def merge_locale(book,letters,lang,locale):
    if locale.get('language')!=lang:raise ValueError('Locale identity mismatch: '+lang)
    if [c.get('id') for c in locale.get('chapters',[])]!=[c['id'] for c in book['chapters']]:raise ValueError('Incomplete chapter sequence: '+lang)
    if [p.get('letter') for p in locale.get('letters',[])]!=[p['letter'] for p in letters]:raise ValueError('Incomplete alphabet: '+lang)
    if not LABEL_KEYS.issubset(locale.get('labels',{})):raise ValueError('Missing reader labels: '+lang)
    if any(not isinstance(locale['labels'][key],str) or not locale['labels'][key].strip() for key in LABEL_KEYS):raise ValueError('Empty label: '+lang)
    if not locale.get('notation_note'):raise ValueError('Missing notation explanation: '+lang)
    for c,lc in zip(book['chapters'],locale['chapters']):
        if lc.get('number')!=c['number'] or not lc.get('title'):raise ValueError('Invalid chapter: '+lang+':'+c['id'])
        if [s.get('id') for s in lc.get('sections',[])]!=[s['id'] for s in c['sections']]:raise ValueError('Missing section: '+lang+':'+c['id'])
        c['titles'][lang]=lc['title']
        for s,ls in zip(c['sections'],lc['sections']):
            if not ls.get('title') or len(ls.get('paragraphs',[]))!=len(s['prose']['en']) or any(not isinstance(p,str) or not p.strip() for p in ls['paragraphs']):raise ValueError('Incomplete prose: '+lang+':'+s['id'])
            if c['id']=='stories' and s['id']=='stories-1' and ls['paragraphs'][0]!=s['prose']['ar'][0]:raise ValueError('Arabic story changed: '+lang)
            s['titles'][lang]=ls['title'];s['prose'][lang]=ls['paragraphs']
        if len(lc.get('examples',[]))!=len(c['examples']):raise ValueError('Example count changed: '+lang+':'+c['id'])
        for ex,le in zip(c['examples'],lc['examples']):
            if le.get('ar')!=ex['ar'] or le.get('ipa')!=ex.get('ipa') or not le.get('meaning'):raise ValueError('Example target changed or meaning missing: '+lang+':'+c['id'])
            ex['meanings'][lang]=le['meaning']
        for dest,source in [('questions','question'),('answers','answer')]:
            value=lc.get('exercise',{}).get(source)
            if not value:raise ValueError('Exercise missing: '+lang+':'+c['id'])
            c['exercise'][dest][lang]=value
    for p,lp in zip(letters,locale['letters']):
        if lp.get('ipa')!=p['ipa'] or lp.get('forms')!=p['forms'] or not lp.get('note'):raise ValueError('Letter target changed: '+lang+':'+p['letter'])
        if len(lp.get('examples',[]))!=len(p['examples']):raise ValueError('Letter example count changed: '+lang)
        p['notes'][lang]=lp['note']
        for ex,le in zip(p['examples'],lp['examples']):
            if le.get('ar')!=ex['ar'] or not le.get('meaning'):raise ValueError('Letter word changed: '+lang+':'+ex['ar'])
            ex['meanings'][lang]=le['meaning']
def assemble(demo=False):
    contract=read('editorial-contract.json');book=read('enriched-chapters.json');letters=read('enriched-letter-profiles.json')
    languages=contract['target_languages'];matrix={};ids=[c['id'] for c in book['chapters']];locales={}
    assert len(ids)==len(set(ids))==13
    assert [c['number'] for c in book['chapters']]==[f'{i:02}' for i in range(1,14)]
    assert len(letters)==28
    keys=json.loads((ROOT/'src/demo-pwa/demo-letter-overview.json').read_text(encoding='utf-8'))
    assert [p['letter'] for p in letters]==[p['letter'] for p in keys]
    for lang in languages:
        path=S/'enriched-locales'/f'{lang}.json'
        if path.exists():
            locale=json.loads(path.read_text(encoding='utf-8'));merge_locale(book,letters,lang,locale);locales[lang]=locale
    ui_source=read('reader-ui.json');ui={lang:dict(zip(ui_source['keys'],ui_source['rows'][lang].split('|'))) for lang in languages}
    for lang in languages:
        missing=[]
        for c in book['chapters']:
            if not c['titles'].get(lang):missing.append(c['id']+':title')
            for sec in c['sections']:
                if not sec['titles'].get(lang) or not sec['prose'].get(lang):missing.append(sec['id']+':prose')
            for i,ex in enumerate(c['examples']):
                if not ex['meanings'].get(lang):missing.append(c['id']+f':example-{i+1}')
            for part in ['questions','answers']:
                if not c['exercise'][part].get(lang):missing.append(c['id']+':'+part)
        for p in letters:
            if not p['notes'].get(lang):missing.append('letter-'+p['letter']+':note')
            for i,w in enumerate(p['examples']):
                if not w['meanings'].get(lang):missing.append('letter-'+p['letter']+f':word-{i+1}')
        review=locales.get(lang,{}).get('review',{});passes=review.get('passes',[])
        reviewed=review.get('kind')=='model_self_review' and len(passes)>=2 and all(p.get('notes') for p in passes)
        matrix[lang]={'content_present':not missing,'missing':missing,'model_review_passes':len(passes),
                      'review_kind':review.get('kind','not_reviewed'),'independently_reviewed':False,
                      'publication_ready':not missing and reviewed}
    report={'schema':1,'edition_status':'authoring_review','target_languages':languages,'matrix':matrix,'chapters':len(book['chapters']),
            'explanatory_sections':sum(len(c['sections']) for c in book['chapters']),'lesson_example_rows':sum(len(c['examples']) for c in book['chapters']),
            'letter_cards':len(letters),'letter_example_rows':sum(len(p['examples']) for p in letters),
            'content_present_languages':[x for x in languages if matrix[x]['content_present']],
            'core_ready':all(x['publication_ready'] for x in matrix.values()),'release_ready':False,'production_published':False,
            'extension_status':'authoring_in_progress','final_reviews_status':'pending_after_all_content'}
    # The demo is a distinct artifact: never ship all chapters and hide them with a query parameter.
    # Current alphabet/catalog availability is established by the workbook's demo contract.
    if demo:
        book={**book,'chapters':[c for c in book['chapters'] if c['id'] in ['foundations','profiles']]}
        allowed_ids=json.loads((ROOT/'src/demo-pwa/demo-meanings-locales.json').read_text(encoding='utf-8'))['chapter_ids']
        allowed_letters={p['letter'] for p in keys if p['id'] in allowed_ids}
        letters=[p for p in letters if p['letter'] in allowed_letters]
        assert len(letters)==5
    credits=json.loads((ROOT/'src/workbook-web/creator-credit-locales.json').read_text(encoding='utf-8'))['labels']
    labels={
      'ar':{'intro':'مرجع HORIZONS المرافق — نسخة تحريرية موسعة','warning':'هذه نسخة للمراجعة. المحتوى والترجمة لم يجتازا المراجعة المستقلة بعد.','examples':'أمثلة ومعانيها','practice':'جرّب واشرح اختيارك','answer':'الإجابة وسببها','notes':'دليل النطق','contents':'الفهرس','view':'اقرأ الفصل كاملًا','all':'اطبع جميع الفصول المتاحة','original':'شرح وأمثلة من تأليف HORIZONS؛ المراجع المرتبطة تدعم النقاط الموضحة في قائمة المصادر.','answers':'حلول التدريبات','forms':'صور الكتابة','words':'كلمات ومعانيها','draft':'مسودة تحريرية'},
      'en':{'intro':'HORIZONS companion reference — expanded editorial edition','warning':'Review edition. Content and translations have not passed independent review.','examples':'Examples and meanings','practice':'Try it and explain your choice','answer':'Answer and reasoning','notes':'Pronunciation key','contents':'Contents','view':'Read the whole chapter','all':'Print all available chapters','original':'Original HORIZONS explanations and examples. Linked references support the points identified in the source list.','answers':'Exercise answers','forms':'Written forms','words':'Words and meanings','draft':'Editorial draft'},
      'tr':{'intro':'HORIZONS eşlikçi kaynak — genişletilmiş editör baskısı','warning':'İnceleme sürümü. İçerik ve çeviriler bağımsız incelemeden henüz geçmedi.','examples':'Örnekler ve anlamları','practice':'Dene ve seçimini açıkla','answer':'Cevap ve gerekçe','notes':'Telaffuz anahtarı','contents':'İçindekiler','view':'Bölümün tamamını oku','all':'Mevcut bütün bölümleri yazdır','original':'HORIZONS için özgün açıklamalar ve örnekler. Bağlantılı kaynaklar, kaynak listesindeki belirtilen noktaları destekler.','answers':'Alıştırma cevapları','forms':'Yazı biçimleri','words':'Kelimeler ve anlamları','draft':'Editör taslağı'}}
    fontlist=read('font-manifest.json')
    labels.update({lang:locale['labels'] for lang,locale in locales.items()})
    data={'book':book,'letters':letters,'languages':languages,'ready_locales':report['content_present_languages'],
          'ui':ui,'labels':labels,'owner':contract['owner'],'credit':credits,'fonts':fontlist,'sources':read('sources.json'),
          'bridges':read('thaa-language-bridges.json'),'unavailable':read('unavailable-locales.json'),
          'demo_copy':json.loads((ROOT/'src/demo-pwa/demo-experience-locales.json').read_text(encoding='utf-8')) if demo else {},
          'symbols':read('symbol-guide-locales.json'),'notations':{lang:loc['notation_note'] for lang,loc in locales.items()},'mode':'demo' if demo else 'full'}
    css=(S/'enriched-reader.css').read_text(encoding='utf-8')
    for f in fontlist:
        css+='@font-face{font-family:"HZN '+f['name']+'";src:url(data:font/ttf;base64,'+base64.b64encode((S/'fonts'/f['file']).read_bytes()).decode()+') format("truetype");font-display:swap}\n'
    html='''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HORIZONS — Expanded reference / المرجع الموسع</title><style>'''+css+'''</style></head><body><header class="reader-header"><a class="brand" href="#book-title">HORIZONS</a><label><span id="language-label"></span><select id="language"></select></label><label><span id="chapter-label"></span><select id="chapter"></select></label><label><span id="font-label">الخط العربي · Arabic font</span><select id="font"></select></label><button id="theme" type="button" aria-label="Light / dark">☾</button><button id="print" type="button"></button></header><main><section class="book-cover"><p class="eyebrow">HORIZONS · العربية</p><h1 id="book-title"></h1><p id="edition-note" role="status"></p><p id="chapter-position"></p></section><div id="reading-layout"><aside id="contents"></aside><div id="pages"></div></div><section id="unavailable" hidden></section></main><script>window.HZN_ENRICHED_DATA='''+json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')+';</script><script>'+(S/'enriched-reader.js').read_text(encoding='utf-8')+'</script></body></html>'
    report['mode']=data['mode'];report['included_chapters']=[c['id'] for c in book['chapters']]
    report['sha256']=hashlib.sha256(html.encode()).hexdigest()
    return html,report
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--demo',action='store_true');p.add_argument('--release',action='store_true');a=p.parse_args()
    html,report=assemble(a.demo)
    if a.release and not report['release_ready']:raise SystemExit('Release blocked: complete expanded content in 32 languages and two final post-completion reviews are not available.')
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_bytes(html.encode('utf-8'))
    a.output.with_suffix('.report.json').write_bytes((json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
    print(json.dumps({k:v for k,v in report.items() if k not in ['matrix','target_languages']},ensure_ascii=False))
