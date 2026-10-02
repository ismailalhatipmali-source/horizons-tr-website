#!/usr/bin/env python3
"""Recover markers accidentally merged by the previous translation importer."""
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]/'src/travel-kit/i18n'
commission={'de':'Provision','nl':'Provisie','pl':'Prowizja','cs':'Provize','ro':'Comision','hu':'Jutalék','el':'Προμήθεια','sv':'Provision','da':'Provision','no':'Provisjon','fi':'Välityspalkkio','bg':'Комисиона','sr':'Провизија','hr':'Provizija','he':'עמלה','hi':'कमीशन','ja':'手数料'}
outstanding={'de':'Offener Kundensaldo','pl':'Pozostała kwota do zapłaty przez klienta','hu':'Ügyfél fennmaradó tartozása','fi':'Asiakkaan maksamaton saldo','fa':'مانده بدهی مشتری','ja':'顧客の未払い残高'}
metric={'de':'Kennzahl','nl':'Kengetal','pl':'Wskaźnik','cs':'Ukazatel','ro':'Indicator','hu':'Mutató','sv':'Nyckeltal','da':'Nøgletal','no':'Nøkkeltall','hr':'Pokazatelj','zh':'指标'}
guides={
'de':'Verwenden Sie den HTML-Editor in einem Chromium-Browser auf einem Computer. Die XLSX-Dateien enthalten Standardformeln. Aktivieren Sie die automatische Neuberechnung und prüfen Sie die Summen anhand des enthaltenen Beispiels, bevor Sie echte Kundendaten verwenden.',
'it':'Usa l’editor HTML in un browser Chromium su computer. I file XLSX contengono formule standard. Attiva il ricalcolo automatico e verifica i totali con l’esempio incluso prima di usare dati reali dei clienti.',
'pt':'Use o editor HTML num navegador Chromium no computador. Os ficheiros XLSX contêm fórmulas padrão. Ative o recálculo automático e confira os totais com o exemplo incluído antes de usar dados reais de clientes.',
'nl':'Gebruik de HTML-editor in een Chromium-browser op een computer. De XLSX-bestanden bevatten standaardformules. Schakel automatisch herberekenen in en controleer de totalen met het meegeleverde voorbeeld voordat u echte klantgegevens gebruikt.',
'ru':'Используйте HTML-редактор в браузере Chromium на компьютере. Файлы XLSX содержат стандартные формулы. Включите автоматический пересчёт и проверьте итоги по включённому примеру перед использованием реальных данных клиентов.',
'uk':'Використовуйте HTML-редактор у браузері Chromium на комп’ютері. Файли XLSX містять стандартні формули. Увімкніть автоматичний перерахунок і перевірте підсумки за включеним прикладом перед використанням реальних даних клієнтів.',
'pl':'Korzystaj z edytora HTML w przeglądarce Chromium na komputerze. Pliki XLSX zawierają standardowe formuły. Włącz automatyczne przeliczanie i sprawdź sumy na dołączonym przykładzie przed użyciem rzeczywistych danych klientów.',
'cs':'Používejte HTML editor v prohlížeči Chromium na počítači. Soubory XLSX obsahují standardní vzorce. Zapněte automatický přepočet a ověřte součty na přiloženém příkladu před použitím skutečných údajů klientů.',
'ro':'Folosiți editorul HTML într-un browser Chromium pe computer. Fișierele XLSX conțin formule standard. Activați recalcularea automată și verificați totalurile cu exemplul inclus înainte de a folosi date reale ale clienților.',
'hu':'Használja a HTML-szerkesztőt Chromium böngészőben, számítógépen. Az XLSX-fájlok szabványos képleteket tartalmaznak. Kapcsolja be az automatikus újraszámítást, és ellenőrizze az összegeket a mellékelt példával, mielőtt valós ügyféladatokat használ.',
'el':'Χρησιμοποιήστε τον επεξεργαστή HTML σε πρόγραμμα περιήγησης Chromium σε υπολογιστή. Τα αρχεία XLSX περιέχουν τυπικούς τύπους. Ενεργοποιήστε τον αυτόματο επανυπολογισμό και ελέγξτε τα σύνολα με το παράδειγμα πριν χρησιμοποιήσετε πραγματικά στοιχεία πελατών.',
'sv':'Använd HTML-redigeraren i en Chromium-webbläsare på datorn. XLSX-filerna innehåller standardformler. Aktivera automatisk omberäkning och kontrollera summorna med det medföljande exemplet innan du använder verkliga kunduppgifter.',
'da':'Brug HTML-editoren i en Chromium-browser på en computer. XLSX-filerne indeholder standardformler. Aktivér automatisk genberegning, og kontrollér totalerne med det medfølgende eksempel, før du bruger faktiske kundedata.',
'no':'Bruk HTML-redigereren i en Chromium-nettleser på en datamaskin. XLSX-filene inneholder standardformler. Aktiver automatisk omberegning og kontroller summene med eksemplet før du bruker virkelige kundedata.',
'fi':'Käytä HTML-editoria Chromium-selaimessa tietokoneella. XLSX-tiedostot sisältävät vakiokaavoja. Ota automaattinen uudelleenlaskenta käyttöön ja tarkista summat mukana olevalla esimerkillä ennen oikeiden asiakastietojen käyttämistä.',
'bg':'Използвайте HTML редактора в браузър Chromium на компютър. Файловете XLSX съдържат стандартни формули. Включете автоматичното преизчисляване и проверете сумите с включения пример, преди да използвате реални клиентски данни.',
'sr':'Користите HTML уређивач у прегледачу Chromium на рачунару. XLSX датотеке садрже стандардне формуле. Укључите аутоматско прерачунавање и проверите износе на приложеном примеру пре употребе стварних података клијената.',
'hr':'Koristite HTML uređivač u pregledniku Chromium na računalu. XLSX datoteke sadrže standardne formule. Uključite automatski ponovni izračun i provjerite ukupne iznose priloženim primjerom prije uporabe stvarnih podataka klijenata.',
'he':'השתמשו בעורך HTML בדפדפן Chromium במחשב. קובצי XLSX כוללים נוסחאות רגילות. הפעילו חישוב מחדש אוטומטי ובדקו את הסכומים באמצעות הדוגמה המצורפת לפני שימוש בנתוני לקוחות אמיתיים.',
'fa':'ویرایشگر HTML را در مرورگر Chromium روی رایانه باز کنید. فایل‌های XLSX دارای فرمول‌های استاندارد هستند. محاسبه مجدد خودکار را فعال کنید و پیش از استفاده از اطلاعات واقعی مشتری، مجموع‌ها را با مثال همراه بررسی کنید.',
'ur':'HTML ایڈیٹر کو کمپیوٹر پر Chromium براؤزر میں استعمال کریں۔ XLSX فائلوں میں معیاری فارمولے ہیں۔ خودکار دوبارہ حساب فعال کریں اور حقیقی کلائنٹ ڈیٹا استعمال کرنے سے پہلے شامل مثال کے ذریعے مجموعے جانچیں۔',
'hi':'HTML संपादक का उपयोग कंप्यूटर पर Chromium ब्राउज़र में करें। XLSX फ़ाइलों में मानक सूत्र हैं। स्वचालित पुनर्गणना चालू करें और वास्तविक ग्राहक डेटा उपयोग करने से पहले शामिल उदाहरण से कुल राशियों की जाँच करें।',
'bn':'কম্পিউটারে Chromium ব্রাউজারে HTML সম্পাদক ব্যবহার করুন। XLSX ফাইলে মানক সূত্র রয়েছে। স্বয়ংক্রিয় পুনর্গণনা চালু করুন এবং প্রকৃত গ্রাহকের তথ্য ব্যবহারের আগে অন্তর্ভুক্ত উদাহরণ দিয়ে মোট অঙ্ক যাচাই করুন।',
'id':'Gunakan editor HTML di browser Chromium pada komputer. File XLSX berisi rumus standar. Aktifkan penghitungan ulang otomatis dan periksa total dengan contoh yang disertakan sebelum menggunakan data klien sebenarnya.',
'ms':'Gunakan editor HTML dalam pelayar Chromium pada komputer. Fail XLSX mengandungi formula standard. Aktifkan pengiraan semula automatik dan semak jumlah menggunakan contoh yang disertakan sebelum menggunakan data pelanggan sebenar.',
'zh':'请在电脑上的 Chromium 浏览器中使用 HTML 编辑器。XLSX 文件使用标准公式。请启用自动重新计算，并在使用真实客户数据之前通过附带示例核对合计金额。',
'ja':'パソコンの Chromium ブラウザで HTML エディターを使用してください。XLSX ファイルは標準の数式を使用しています。自動再計算を有効にし、実際の顧客データを入力する前に付属の例で合計金額を確認してください。'}
if __name__=='__main__':
    for p in sorted(ROOT.glob('*translations-0?.json')):
        data=json.loads(p.read_text());n=0
        for lang,values in data.items():
            recovered={}
            for k,v in values.items():
                chunks=re.split(r'\n\[{2,3}(\d{4})\]{3}\s*',v)
                if len(chunks)>1:
                    recovered[k]=chunks[0]
                    for j in range(1,len(chunks),2):recovered[chunks[j]]=chunks[j+1]
            values.update(recovered);n+=len(recovered)
            if p.name.startswith('workbook'):
                for k,fixes in [('0019',commission),('0069',outstanding),('0057',metric)]:
                    if lang in fixes:values[k]=fixes[lang]
            else:values['0447']=guides[lang]
            assert not any(re.search(r'\[{2,3}\d{4}\]{3}|<<<HZN',s) for s in values.values())
        p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(p.name,'recovered',n)
