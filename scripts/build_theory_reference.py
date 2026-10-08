#!/usr/bin/env python3
"""Build a self-contained local editorial review, never a production publisher."""
from pathlib import Path
import argparse, hashlib, json, re, base64
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'src/theory-reference'
def load(name):return json.loads((SOURCE/name).read_text(encoding='utf-8'))
def build():
    contract=load('editorial-contract.json');languages=contract['target_languages']
    bridges=load('thaa-language-bridges.json');ui_source=load('reader-ui.json')
    credit=json.loads((ROOT/'src/workbook-web/creator-credit-locales.json').read_text(encoding='utf-8'))['labels']
    if len(languages)!=32 or set(bridges)!=set(languages) or set(ui_source['rows'])!=set(languages) or set(credit)!=set(languages):raise ValueError('32-language contract mismatch')
    ui={lang:dict(zip(ui_source['keys'],ui_source['rows'][lang].split('|'))) for lang in languages}
    if any(len(ui_source['rows'][lang].split('|'))!=len(ui_source['keys']) for lang in languages):raise ValueError('Incomplete UI translation')
    required=['ثَ','ثُ','ثِ','ثَا','ثُو','ثِي','/θ/']
    if any(any(token not in row['text'] for token in required) for row in bridges.values()):raise ValueError('Arabic pronunciation examples changed in translation')
    profiles=load('letter-profiles-ar.json');overview=json.loads((ROOT/'src/demo-pwa/demo-letter-overview.json').read_text(encoding='utf-8'))
    if len(profiles)!=28 or [x['letter'] for x in profiles]!=[x['letter'] for x in overview]:raise ValueError('Alphabet does not match workbook')
    for profile,original in zip(profiles,overview):profile.update(id=original['id'],name=original['name'],order=original['order'])
    manuscript=(SOURCE/'manuscript-ar.md').read_text(encoding='utf-8')
    sections=re.split(r'^## ',manuscript,flags=re.M)[1:]
    pages=[]
    for section in sections:
        title,body=section.split('\n',1);paragraphs=[p.strip().replace('\n',' ') for p in body.strip().split('\n\n')]
        refs=[p for p in paragraphs if p.startswith(('المراجع:','مراجع الفصل:'))]
        ids=['ipa']
        if any('Unicode' in p for p in refs):ids.append('unicode')
        if any('OpenLearn' in p or 'Open University' in p for p in refs):ids.append('openlearn')
        if any('Basrah' in p for p in refs):ids.append('basrah')
        pages.append({'title':title,'paragraphs':paragraphs,'source_ids':ids})
    chapters=[{'id':'foundations','title':'01 — مدخل الحروف والكتابة','pages':pages[:3]},
              {'id':'baa','title':'الباء — فصل أولي موسّع','pages':pages[3:5]},
              {'id':'thaa','title':'الثاء — فصل أولي موسّع','pages':pages[5:9]},
              {'id':'blending2','title':'03 — بداية مرجع الدمج الثنائي','pages':pages[9:]},
              {'id':'profiles','title':'بطاقات الحروف الـ28 — مسودة مرجعية','pages':[{'title':f'الحروف: {profiles[i]["name"]} — {profiles[min(i+3,27)]["name"]}','profiles':profiles[i:i+4],'source_ids':['ipa','unicode']} for i in range(0,28,4)]}]
    chapters.insert(1,{'id':'phonics','title':'02 — التأسيس الصوتي: الحركات والمد والسكون','pages':[dict(pages[2]),{'title':'نسمع الفرق قبل أن نحفظ العلامة','paragraphs':['ابدأ بثلاث قراءات قصيرة: بَ، بُ، بِ. لا تغيّر الباء؛ ركّز على الحركة التي تأتي معها. الفتحة َ والضمة ُ والكسرة ِ علامات صغيرة، لكنها تغيّر القراءة. سمِّ العلامة ثم جرّب الصوت: معرفة الاسم تساعدك على وصف ما ترى، وتجربة الصوت تساعدك على القراءة.','قارن بَ وبَا، ثم بُ وبُو، ثم بِ وبِي. في كل زوج يتغير طول الحركة. المد ليس رفع الصوت؛ يمكنك إطالة الحركة بصوت هادئ. هذه أمثلة مقطعية للتدريب لا كلمات ذات معانٍ مستقلة.','ضع إصبعك تحت بَاب في بداية القراءة، ثم تتبّع الحروف من اليمين إلى اليسار. نقرأ /baːb/ عند الوقف. لا نضيف حركة إلى الباء الأخيرة من عندنا. ومع بِنْت /bint/ تساعدنا الكسرة على بداية القراءة والسكون على عدم إضافة حركة بعد النون. معنى بِنْت: طفلة أو ابنة بحسب السياق.','اختر هدفًا واحدًا للجولة: نوع الحركة، أو طولها، أو السكون. إذا خلط المتعلم نوع الحركة وطولها معًا، ابدأ بالنوع ثم بالطول. لا نحتاج إلى قائمة طويلة قبل فهم المقارنة القصيرة.'],'callouts':[{'label':'✓ تحقق','text':'أي الزوجين يغيّر الطول فقط: بَ/بَا أم بَ/بُ؟ الأول يغيّر الطول، والثاني يغيّر نوع الحركة.'}]}]})
    expanded=load('expanded-pages-ar.json')
    for c in chapters:
        c['pages'].extend(expanded.get(c['id'],[]))
    examples=load('example-bank.json')
    if any(set(e['gloss'])!=set(languages) for e in examples):raise ValueError('Missing example meaning translation')
    chapters.extend(load('future-chapters-ar.json'))
    names=dict(zip(languages,['English','العربية','Türkçe','Français','Español','Deutsch','Italiano','Português','Nederlands','Русский','Українська','Polski','Čeština','Română','Magyar','Ελληνικά','Svenska','Dansk','Norsk','Suomi','Български','Српски','Hrvatski','עברית','فارسی','اردو','हिन्दी','বাংলা','Bahasa Indonesia','Bahasa Melayu','中文','日本語']))
    unavailable=load('unavailable-locales.json')
    if set(unavailable)!=set(languages):raise ValueError('Missing translation notices')
    data={'symbol_notes':load('symbol-guide-locales.json'),'fonts':load('font-manifest.json'),'theme_labels':load('theme-locales.json'),'examples':examples,'languages':languages,'language_names':names,'owner':contract['owner'],'credit':credit,'bridges':bridges,'unavailable':unavailable,'ui':ui,'chapters':chapters,'sources':load('sources.json')}
    packed=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
    css=(SOURCE/'reader.css').read_text(encoding='utf-8');js=(SOURCE/'reader.js').read_text(encoding='utf-8')
    for f in data['fonts']:
        css+='@font-face{font-family:"HZN '+f['name']+'";src:url(data:font/ttf;base64,'+base64.b64encode((SOURCE/'fonts'/f['file']).read_bytes()).decode()+') format("truetype");font-display:swap}\n'
    html='''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HORIZONS — المرجع النظري المرافق</title><style>'''+css+'''</style></head><body><header class="reader-header"><div class="brand">HORIZONS</div><label><span id="language-label"></span> <select id="language"></select></label><label><span id="chapter-label"></span> <select id="chapter"></select></label><label><span id="font-label">خط العربية · Arabic font</span><select id="arabic-font" aria-labelledby="font-label"></select></label><button type="button" id="theme" aria-pressed="false">☾</button><button type="button" id="print"></button></header><p class="draft-note" id="draft" role="status"></p><main id="pages"></main><nav class="reader-nav"><button type="button" id="previous"></button><span id="position" role="status" dir="ltr"></span><button type="button" id="next"></button><button type="button" id="all" aria-pressed="false"></button></nav><script>window.HZN_REFERENCE_DATA='''+packed+';</script><script>'+js+'</script></body></html>'
    report={'status':'editorial_review_only','long_manuscript_languages':['ar'],'short_thaa_bridge_languages':languages,'independently_reviewed_languages':[],'manuscript_sections':sum(len(c['pages']) for c in chapters if c['id']!='profiles'),'example_gloss_languages':languages,'example_words':len(examples),'letter_profiles':len(profiles),'mailbox_delivery_verified':False,'production_published':False,'input_sha256':{p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in SOURCE.iterdir() if p.is_file()}}
    return html,report
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);args=p.parse_args()
    html,report=build();args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(html,encoding='utf-8');args.output.with_suffix('.report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in report.items() if k!='input_sha256'},ensure_ascii=False))
