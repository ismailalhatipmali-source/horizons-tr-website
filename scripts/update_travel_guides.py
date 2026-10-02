#!/usr/bin/env python3
from pathlib import Path
import json,sys
from normalize_travel_translations import guides
from build_travel_kit import REPO,LANGS,translations

count={
'en':'32 language editions. Every edition contains the same 40 document pages.',
'ar':'الحزمة متاحة بـ32 لغة. كل نسخة لغوية تتضمن صفحات المستندات الأربعين نفسها.',
'tr':'32 dil sürümü. Her sürüm aynı 40 belge sayfasını içerir.',
'fr':'32 éditions linguistiques. Chaque édition contient les mêmes 40 pages de documents.',
'es':'32 ediciones de idioma. Cada edición contiene las mismas 40 páginas de documentos.',
'de':'32 Sprachversionen. Jede Version enthält dieselben 40 Dokumentseiten.',
'it':'32 edizioni linguistiche. Ogni edizione contiene le stesse 40 pagine di documenti.',
'pt':'32 edições de idioma. Cada edição contém as mesmas 40 páginas de documentos.',
'nl':'32 taalversies. Elke versie bevat dezelfde 40 documentpagina’s.',
'ru':'32 языковые версии. Каждая версия содержит те же 40 страниц документов.',
'uk':'32 мовні версії. Кожна версія містить ті самі 40 сторінок документів.',
'pl':'32 wersje językowe. Każda wersja zawiera te same 40 stron dokumentów.',
'cs':'32 jazykových verzí. Každá verze obsahuje stejných 40 stránek dokumentů.',
'ro':'32 de ediții lingvistice. Fiecare ediție conține aceleași 40 de pagini de documente.',
'hu':'32 nyelvi változat. Minden változat ugyanazt a 40 dokumentumoldalt tartalmazza.',
'el':'32 γλωσσικές εκδόσεις. Κάθε έκδοση περιέχει τις ίδιες 40 σελίδες εγγράφων.',
'sv':'32 språkversioner. Varje version innehåller samma 40 dokumentsidor.',
'da':'32 sprogversioner. Hver version indeholder de samme 40 dokumentsider.',
'no':'32 språkversjoner. Hver versjon inneholder de samme 40 dokumentsidene.',
'fi':'32 kieliversiota. Jokainen versio sisältää samat 40 asiakirjasivua.',
'bg':'32 езикови версии. Всяка версия съдържа същите 40 страници документи.',
'sr':'32 језичке верзије. Свака верзија садржи истих 40 страница докумената.',
'hr':'32 jezične verzije. Svaka verzija sadrži istih 40 stranica dokumenata.',
'he':'32 גרסאות שפה. כל גרסה כוללת את אותם 40 עמודי מסמכים.',
'fa':'۳۲ نسخه زبانی. هر نسخه شامل همان ۴۰ صفحه سند است.',
'ur':'32 زبانوں کے نسخے۔ ہر نسخے میں وہی 40 دستاویزی صفحات شامل ہیں۔',
'hi':'32 भाषा संस्करण। प्रत्येक संस्करण में वही 40 दस्तावेज़ पृष्ठ हैं।',
'bn':'32টি ভাষার সংস্করণ। প্রতিটি সংস্করণে একই 40টি নথির পৃষ্ঠা রয়েছে।',
'id':'32 edisi bahasa. Setiap edisi berisi 40 halaman dokumen yang sama.',
'ms':'32 edisi bahasa. Setiap edisi mengandungi 40 halaman dokumen yang sama.',
'zh':'32 种语言版本。每个版本均包含相同的 40 页文档。',
'ja':'32言語版。各言語版には同じ40ページの書類が含まれています。'}
support={
'en':'Customise and send the 12 email scripts yourself. Replace all double-brace fields before sending. For file support, email support@horizons-tr.com with your HORIZONS order reference and the filename; omit sensitive client data.',
'ar':'عدّل قوالب الرسائل الاثني عشر وأرسلها بنفسك. استبدل جميع الحقول بين الأقواس المزدوجة قبل الإرسال. لدعم الملفات راسل support@horizons-tr.com مع مرجع طلب HORIZONS واسم الملف، دون بيانات العملاء الحساسة.',
'tr':'12 e-posta metnini düzenleyip kendiniz gönderin. Göndermeden önce çift süslü parantezli alanları değiştirin. Dosya desteği: support@horizons-tr.com. HORIZONS sipariş referansını ve dosya adını belirtin; hassas müşteri verisi göndermeyin.',
'fr':'Personnalisez et envoyez vous-même les 12 scripts e-mail. Remplacez les champs entre doubles accolades. Assistance fichiers : support@horizons-tr.com. Indiquez la référence HORIZONS et le nom du fichier, sans données sensibles du client.',
'es':'Personaliza y envía tú mismo los 12 correos. Sustituye los campos entre llaves dobles. Soporte de archivos: support@horizons-tr.com. Incluye la referencia HORIZONS y el nombre del archivo, sin datos sensibles del cliente.'}
# Localised instructions already explain the email workflow; replace only the
# outdated marketplace support sentence in the 27 new editions.
guide5={
'en':'Use the HTML editor in a Chromium browser on a computer. The XLSX files contain standard formulas. Enable automatic recalculation and check totals with the included example before using real client data.',
'ar':'استخدم محرر HTML في متصفح Chromium على الكمبيوتر. ملفات XLSX تحتوي صيغًا قياسية. فعّل إعادة الحساب التلقائي وتحقق من المجاميع باستخدام المثال المرفق قبل إدخال بيانات عملاء حقيقية.',
'tr':'HTML düzenleyiciyi bilgisayarda Chromium tarayıcısında kullanın. XLSX dosyaları standart formüller içerir. Otomatik yeniden hesaplamayı etkinleştirin ve gerçek müşteri verilerini kullanmadan önce toplamları örnekle kontrol edin.',
'fr':'Utilisez l’éditeur HTML dans un navigateur Chromium sur ordinateur. Les fichiers XLSX contiennent des formules standard. Activez le recalcul automatique et vérifiez les totaux avec l’exemple avant d’utiliser des données clients réelles.',
'es':'Usa el editor HTML en un navegador Chromium en el ordenador. Los archivos XLSX contienen fórmulas estándar. Activa el recálculo automático y comprueba los totales con el ejemplo antes de usar datos reales de clientes.'}

def update(output):
    src,_,docs,_=translations();original=output.parent/'travel-kit-original'
    english=[x for x in (original/'Agency_Kit_EN/START_HERE.txt').read_text().splitlines() if x.strip()]
    overrides={}
    for lang in LANGS:
        guide=output/('Agency_Kit_'+lang.upper())/'START_HERE.txt'
        lines=guide.read_text().splitlines();nonempty=[i for i,x in enumerate(lines) if x.strip()]
        assert len(nonempty)==len(english)
        replacements={'0426':count[lang],'0447':(guide5|guides)[lang]}
        for key,value in replacements.items():lines[nonempty[english.index(src[key])]]=value
        if lang in support:new=support[lang]
        else:
            old=docs[lang]['0448'];first=old.split('.')[0]
            # Preserve the translated workflow paragraph and remove the old
            # marketplace contact route. The address is language-independent.
            cut=old.find('Etsy')
            if cut>=0:
                start=old.rfind('.',0,cut)+1
                new=old[:start].strip()+'\nSupport: support@horizons-tr.com · HORIZONS · '+src['0017']+' / filename'
            else:new=old+'\nSupport: support@horizons-tr.com'
        lines[nonempty[english.index(src['0448'])]]=new.replace('\n',' ')
        replacements['0448']=lines[nonempty[english.index(src['0448'])]]
        guide.write_text('\n'.join(lines)+'\n');overrides[lang]=replacements
    (REPO/'src/travel-kit/i18n/guide-overrides.json').write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+'\n')
    merged={}
    for n in ('01','02','03'):merged.update(json.loads((REPO/f'src/travel-kit/i18n/translations-{n}.json').read_text()))
    for l,d in merged.items():d.update(overrides[l])
    (REPO/'src/travel-kit/i18n/translations-27.json').write_text(json.dumps(merged,ensure_ascii=False,indent=2)+'\n')
    print('Updated 32 launch guides and consolidated corrected translations')

if __name__=='__main__':update(Path(sys.argv[1]).resolve())
