#!/usr/bin/env python3
"""Institution policy: 500 seats, annual access, planned institution updates."""
import json,re,html,hashlib,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASELINE="9b67ccfcd8efc10e32d1cb876871e880fcebf2b8"
NOTES={
'en':'One year from activation, renewable. We will add institution-specific program updates during the subscription to support structured, ongoing use. These improvements are planned and are not current features.',
'ar':'سنة من تاريخ التفعيل، قابلة للتجديد. سنضيف خلال الاشتراك تحديثات خاصة بالمؤسسات لدعم الاستخدام المنهجي والمستمر. هذه التحسينات مخطط لها وليست ميزات متاحة حاليًا.',
'tr':'Etkinleştirmeden itibaren bir yıl, yenilenebilir. Abonelik süresince düzenli ve sürekli kullanımı desteklemek için kuruma özel program güncellemeleri ekleyeceğiz. Bu iyileştirmeler planlanmaktadır; henüz mevcut özellikler değildir.',
'fr':'Un an à compter de l’activation, renouvelable. Pendant l’abonnement, nous ajouterons des mises à jour dédiées aux établissements pour un usage structuré et continu. Ces améliorations sont prévues et ne sont pas encore disponibles.',
'es':'Un año desde la activación, renovable. Durante la suscripción añadiremos actualizaciones específicas para instituciones que apoyen el uso estructurado y continuo. Estas mejoras están previstas y aún no son funciones disponibles.',
'de':'Ein Jahr ab Aktivierung, verlängerbar. Während des Abonnements ergänzen wir institutionelle Programmupdates für einen strukturierten, kontinuierlichen Einsatz. Diese Verbesserungen sind geplant und noch nicht verfügbar.',
'it':'Un anno dall’attivazione, rinnovabile. Durante l’abbonamento aggiungeremo aggiornamenti dedicati agli istituti per un uso strutturato e continuativo. Questi miglioramenti sono pianificati e non ancora disponibili.',
'pt':'Um ano a partir da ativação, renovável. Durante a assinatura adicionaremos atualizações específicas para instituições, apoiando o uso estruturado e contínuo. Essas melhorias estão previstas e ainda não estão disponíveis.',
'nl':'Eén jaar vanaf activering, verlengbaar. Tijdens het abonnement voegen we updates voor instellingen toe om gestructureerd, doorlopend gebruik te ondersteunen. Deze verbeteringen zijn gepland en nog niet beschikbaar.',
'ru':'Один год с момента активации с возможностью продления. В течение подписки мы добавим обновления для организаций, поддерживающие систематическое и постоянное использование. Эти улучшения запланированы и пока недоступны.',
'uk':'Один рік від активації з можливістю продовження. Протягом підписки ми додамо оновлення для установ, що підтримують систематичне й постійне використання. Ці поліпшення заплановані та поки недоступні.',
'pl':'Rok od aktywacji, z możliwością odnowienia. W czasie subskrypcji dodamy aktualizacje dla instytucji wspierające uporządkowane, stałe korzystanie. Te ulepszenia są planowane i nie są jeszcze dostępne.',
'cs':'Jeden rok od aktivace, s možností obnovení. Během předplatného přidáme aktualizace pro instituce podporující systematické a dlouhodobé používání. Tato vylepšení jsou plánována a zatím nejsou dostupná.',
'ro':'Un an de la activare, cu posibilitate de reînnoire. Pe durata abonamentului vom adăuga actualizări pentru instituții, susținând utilizarea structurată și continuă. Aceste îmbunătățiri sunt planificate și încă nu sunt disponibile.',
'hu':'Az aktiválástól számított egy év, megújítható. Az előfizetés alatt intézményi frissítésekkel támogatjuk a rendszeres, folyamatos használatot. Ezek a fejlesztések tervezettek, még nem elérhetők.',
'el':'Ένα έτος από την ενεργοποίηση, με δυνατότητα ανανέωσης. Κατά τη συνδρομή θα προσθέσουμε ενημερώσεις για οργανισμούς που υποστηρίζουν τη συστηματική, συνεχή χρήση. Αυτές οι βελτιώσεις είναι προγραμματισμένες και δεν είναι ακόμη διαθέσιμες.',
'sv':'Ett år från aktivering, kan förnyas. Under abonnemanget lägger vi till uppdateringar för organisationer som stödjer strukturerad, löpande användning. Dessa förbättringar är planerade och ännu inte tillgängliga.',
'da':'Et år fra aktivering, kan fornyes. Under abonnementet tilføjer vi opdateringer til institutioner, som støtter struktureret, løbende brug. Disse forbedringer er planlagt og endnu ikke tilgængelige.',
'no':'Ett år fra aktivering, kan fornyes. I abonnementsperioden legger vi til oppdateringer for institusjoner som støtter strukturert, kontinuerlig bruk. Disse forbedringene er planlagt og ennå ikke tilgjengelige.',
'fi':'Vuosi aktivoinnista, uusittavissa. Tilauksen aikana lisäämme oppilaitoksille tarkoitettuja päivityksiä, jotka tukevat suunnitelmallista ja jatkuvaa käyttöä. Nämä parannukset ovat suunnitteilla eivätkä vielä käytettävissä.',
'bg':'Една година от активирането, с възможност за подновяване. По време на абонамента ще добавим обновления за институции, подкрепящи системната и постоянна употреба. Тези подобрения са планирани и още не са налични.',
'sr':'Годину дана од активације, уз могућност обнове. Током претплате додаћемо ажурирања за установе која подржавају систематичну и сталну употребу. Ова побољшања су планирана и још нису доступна.',
'hr':'Godinu dana od aktivacije, uz mogućnost obnove. Tijekom pretplate dodat ćemo ažuriranja za ustanove koja podržavaju sustavnu i stalnu uporabu. Ta poboljšanja su planirana i još nisu dostupna.',
'he':'שנה ממועד ההפעלה, עם אפשרות לחידוש. במהלך המנוי נוסיף עדכוני תוכנה ייעודיים למוסדות לתמיכה בשימוש מובנה ומתמשך. שיפורים אלה מתוכננים ואינם זמינים עדיין.',
'fa':'یک سال از زمان فعال‌سازی، قابل تمدید. در طول اشتراک، به‌روزرسانی‌های ویژه مؤسسات را برای استفاده منظم و مستمر اضافه خواهیم کرد. این بهبودها برنامه‌ریزی شده‌اند و هنوز در دسترس نیستند.',
'ur':'فعال کرنے کی تاریخ سے ایک سال، قابل تجدید۔ اشتراک کے دوران منظم اور مسلسل استعمال کے لیے اداروں کی مخصوص پروگرام اپ ڈیٹس شامل کریں گے۔ یہ بہتریاں منصوبے میں ہیں اور ابھی دستیاب خصوصیات نہیں ہیں۔',
'hi':'सक्रियण से एक वर्ष, नवीनीकरण योग्य। सदस्यता के दौरान व्यवस्थित और निरंतर उपयोग के लिए संस्थानों के विशेष प्रोग्राम अपडेट जोड़ेंगे। ये सुधार नियोजित हैं और अभी उपलब्ध सुविधाएँ नहीं हैं।',
'bn':'সক্রিয়করণ থেকে এক বছর, নবায়নযোগ্য। সাবস্ক্রিপশন চলাকালে নিয়মিত ও পরিকল্পিত ব্যবহারের জন্য প্রতিষ্ঠানের বিশেষ প্রোগ্রাম আপডেট যোগ করব। এই উন্নয়নগুলো পরিকল্পিত এবং এখনো উপলব্ধ নয়।',
'id':'Satu tahun sejak aktivasi, dapat diperpanjang. Selama langganan kami akan menambahkan pembaruan program khusus institusi untuk mendukung penggunaan terstruktur dan berkelanjutan. Peningkatan ini direncanakan dan belum tersedia.',
'ms':'Satu tahun dari pengaktifan, boleh diperbaharui. Sepanjang langganan kami akan menambah kemas kini program khusus institusi untuk penggunaan berstruktur dan berterusan. Penambahbaikan ini dirancang dan belum tersedia.',
'zh':'自激活起一年，可续订。订阅期间，我们将添加面向机构的专用程序更新，以支持系统化、持续使用。这些改进正在规划中，尚未提供。',
'ja':'有効化から1年間、更新可能です。契約期間中、体系的で継続的な利用を支援するため、教育機関向けの専用アップデートを追加します。これらの改善は計画段階で、現在利用できる機能ではありません。'
}
def counts(s):
    return s.replace('100','500').replace('۱۰۰','۵۰۰').replace('১০০','৫০০')
def save(p,o):p.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n')
def build():
    account=ROOT/'src/commerce/account-locales.json';labels=json.loads(account.read_text());assert set(labels)==set(NOTES)
    for lang,t in labels.items():
        t['count_institution']=counts(t['count_institution'])
        if NOTES[lang] not in t['institution_note']:t['institution_note']+=' '+NOTES[lang]
    save(account,labels)
    for rel,key in [('src/commerce/locales.json','access_note'),('src/workbook-web/web-locales.json','deviceNote')]:
        p=ROOT/rel;m=json.loads(p.read_text())
        for t in m.values():t[key]=counts(t[key])
        save(p,m)
    for rel in ['src/commerce/catalog.json','src/commerce/products.json','dist/products.json']:
        p=ROOT/rel;m=json.loads(p.read_text())
        if 'accounts' in m:m['accounts']['institution']['max_learners']=500
        else:
            for offer in m['products']['horizons-arabic-level1']['offers']:
                if offer.get('account_type')=='institution':assert offer['term']=='annual';offer['max_learners']=500
        save(p,m)
    replacements={
      'src/commerce/MembershipLedger.php':[("?5:100)","?5:500)"),("'institution'=>100]","'institution'=>500]")],
      'src/commerce/PurchaseLedger.php':[("'institution'=>100]","'institution'=>500]")],
      'src/commerce/membership-manager.js':[('institution:100','institution:500')],
      'src/workbook-web/membership-manager.js':[('institution:100','institution:500')],
      'src/workbook-web/index.html':[('حتى 100 متعلم','حتى 500 متعلم')],
      'src/admin/admin.js':[('حتى 100 متعلم','حتى 500 متعلم')],
      'src/workbook-web/web-config.js':[("VERSION = '1.4.5'","VERSION = '1.4.6'")],
      'src/workbook-web/sw.js':[('Interface release 1.4.5','Interface release 1.4.6')],
      'tests/test_membership_ledger.php':[('$i<100','$i<500'),('===100)','===500)'),('institution 100','institution 500')],
      'tests/test_admin_fx.php':[("'institution'=>100]","'institution'=>500]"),('1/5/100,','1/5/500,')],
      'tests/test_membership_manager.mjs':[('institution:100','institution:500')]
    }
    for rel,pairs in replacements.items():
        p=ROOT/rel;s=p.read_text()
        for old,new in pairs:s=s.replace(old,new)
        p.write_text(s)
    # Patch only the existing localized policy strings and embedded catalog.
    # Preserve checkout modes, walkthroughs, currency display and legal text.
    base=json.loads((ROOT/'src/commerce/locales.json').read_text())
    for lang in labels:
        for p in (ROOT/'dist'/lang).glob('*.html'):
            old=p.read_text();s=old
            prior=json.loads(subprocess.check_output(['git','show',BASELINE+':src/commerce/account-locales.json'],cwd=ROOT))[lang]
            priorbase=json.loads(subprocess.check_output(['git','show',BASELINE+':src/commerce/locales.json'],cwd=ROOT))[lang]
            for key in ['count_institution','institution_note']:
                s=s.replace(html.escape(prior[key],quote=True),html.escape(labels[lang][key],quote=True))
            s=s.replace(html.escape(priorbase['access_note'],quote=True),html.escape(base[lang]['access_note'],quote=True))
            def embedded(m):
                data=json.loads(m[2]);words=data.get('words',{})
                for key in ['count_institution','institution_note']: 
                    if key in words:words[key]=labels[lang][key]
                if 'access_note' in words:words['access_note']=base[lang]['access_note']
                catalog=data.get('catalog',{})
                for offer in catalog.get('products',{}).get('horizons-arabic-level1',{}).get('offers',[]):
                    if offer.get('account_type')=='institution':offer['max_learners']=500
                return m[1]+json.dumps(data,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')+m[3]
            s=re.sub(r'(<script id="(?:checkout-config|display-currency-config)" type="application/json">)(.*?)(</script>)',embedded,s,flags=re.S)
            if p.name=='product.html':
                block='<section id="institution-plan"><h2>'+html.escape(labels[lang]['account_institution'])+'</h2><p><strong>'+html.escape(labels[lang]['count_institution'])+'</strong></p><p>'+html.escape(labels[lang]['institution_note'])+'</p></section>'
                s=re.sub(r'<section id="institution-plan">.*?</section>','',s,flags=re.S)
                s=s.replace('<section id="workbook-walkthrough"',block+'<section id="workbook-walkthrough"',1)
                assert 'id="institution-plan"' in s
            if s!=old:p.write_text(s)
    release=ROOT/'release-assets/1.4.6/files/learn';release.mkdir(parents=True,exist_ok=True)
    for name in ['membership-manager.js','web-locales.json','index.html','web-config.js','sw.js']:(release/name).write_bytes((ROOT/'src/workbook-web'/name).read_bytes())
    m=json.loads((ROOT/'release-assets/1.4.5/files/learn/asset-manifest.json').read_text());m['version']='1.4.6';save(release/'asset-manifest.json',m)
    # Keep the earlier display publisher idempotent after this release.
    p=ROOT/'release-assets/global-currency-20261002/manifest.json';m=json.loads(p.read_text())
    for entry in m['files'].values():
        source=ROOT/entry['source'];b=source.read_bytes();newhash=hashlib.sha256(b).hexdigest()
        if newhash!=entry['sha256']:
            previous=entry['sha256'];entry['before']=list(dict.fromkeys((entry['before'] if isinstance(entry['before'],list) else [entry['before']])+[previous]));entry['sha256']=newhash;entry['bytes']=len(b)
    m['requires']['learn/web-config.js']=hashlib.sha256((release/'web-config.js').read_bytes()).hexdigest();save(p,m)
    print('Updated institution policy in 32 languages; annual prices and other plans unchanged.')
def manifest():
    digest=lambda b:hashlib.sha256(b).hexdigest()
    old=lambda p:subprocess.check_output(['git','show',BASELINE+':'+p],cwd=ROOT)
    files={}
    def add(target,source,previous):
        b=(ROOT/source).read_bytes();files[target]={'source':source,'bytes':len(b),'sha256':digest(b),'before':digest(previous)}
    for lang in NOTES:
        for name in ['index','product','cart','checkout','terms','distance-sales']:
            source='dist/'+lang+'/'+name+'.html';add('public/'+source[5:],source,old(source))
    for name in ['products.json','checkout.js','site-commerce.js']:add('public/'+name,'dist/'+name,old('dist/'+name))
    for name in ['MembershipLedger.php','PurchaseLedger.php']:add('commerce/'+name,'src/commerce/'+name,old('src/commerce/'+name))
    add('private/products.json','src/commerce/products.json',old('src/commerce/products.json'))
    add('public/admin/admin.js','src/admin/admin.js',old('src/admin/admin.js'))
    for p in sorted((ROOT/'release-assets/1.4.6/files/learn').iterdir()):
        prior=old('src/workbook-web/'+p.name) if p.name!='asset-manifest.json' else (ROOT/'release-assets/1.4.5/files/learn/asset-manifest.json').read_bytes()
        add('public/learn/'+p.name,p.relative_to(ROOT).as_posix(),prior)
    # Private authority first; version declaration last for the next PWA shell.
    priority=lambda p:(0 if not p.startswith('public/') else 3 if p=='public/learn/web-config.js' else 1 if p.count('/')==1 else 2,p)
    files=dict(sorted(files.items(),key=lambda item:priority(item[0])))
    p=ROOT/'release-assets/institution-20261003/manifest.json';p.parent.mkdir(exist_ok=True)
    save(p,{'version':'institution-20261003','policy':{'institution':{'max_learners':500,'term':'annual'}},'requires':{'learn/web-config.js':[digest(old('src/workbook-web/web-config.js')),digest((ROOT/'src/workbook-web/web-config.js').read_bytes())]},'files':files})
if __name__=='__main__':
    build()
    manifest()

