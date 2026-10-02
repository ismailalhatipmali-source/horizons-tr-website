import json
from pathlib import Path
rows='''en|Install for Windows|Optional: adds an icon that opens the workbook in your browser. Windows 10/11, 64-bit.
ar|تثبيت أيقونة الكراسة لويندوز|اختياري: يضيف أيقونة تفتح الكراسة في متصفحك. ويندوز 10 أو 11، إصدار 64 بت.
tr|Windows için yükle|İsteğe bağlı: çalışma kitabını tarayıcınızda açan bir simge ekler. Windows 10/11, 64 bit.
fr|Installer pour Windows|Facultatif : ajoute une icône ouvrant le cahier dans votre navigateur. Windows 10/11, 64 bits.
es|Instalar para Windows|Opcional: añade un icono que abre el cuaderno en tu navegador. Windows 10/11, 64 bits.
de|Für Windows installieren|Optional: fügt ein Symbol hinzu, das das Arbeitsheft im Browser öffnet. Windows 10/11, 64 Bit.
it|Installa per Windows|Facoltativo: aggiunge un’icona che apre il quaderno nel browser. Windows 10/11, 64 bit.
pt|Instalar para Windows|Opcional: adiciona um ícone que abre o caderno no navegador. Windows 10/11, 64 bits.
nl|Installeren voor Windows|Optioneel: voegt een pictogram toe dat het werkboek in je browser opent. Windows 10/11, 64-bits.
ru|Установить для Windows|Необязательно: добавляет значок для открытия тетради в браузере. Windows 10/11, 64 бита.
uk|Установити для Windows|Необов’язково: додає значок для відкриття зошита в браузері. Windows 10/11, 64 біти.
pl|Zainstaluj dla Windows|Opcjonalnie: dodaje ikonę otwierającą zeszyt w przeglądarce. Windows 10/11, 64 bity.
cs|Nainstalovat pro Windows|Volitelné: přidá ikonu pro otevření sešitu v prohlížeči. Windows 10/11, 64 bitů.
ro|Instalează pentru Windows|Opțional: adaugă o pictogramă care deschide caietul în browser. Windows 10/11, 64 de biți.
hu|Telepítés Windowsra|Opcionális: ikont ad hozzá, amely a böngészőben nyitja meg a munkafüzetet. Windows 10/11, 64 bites.
el|Εγκατάσταση για Windows|Προαιρετικό: προσθέτει εικονίδιο που ανοίγει το τετράδιο στο πρόγραμμα περιήγησης. Windows 10/11, 64 bit.
sv|Installera för Windows|Valfritt: lägger till en ikon som öppnar arbetsboken i webbläsaren. Windows 10/11, 64 bitar.
da|Installer til Windows|Valgfrit: tilføjer et ikon, der åbner arbejdsbogen i din browser. Windows 10/11, 64-bit.
no|Installer for Windows|Valgfritt: legger til et ikon som åpner arbeidsboken i nettleseren. Windows 10/11, 64-bit.
fi|Asenna Windowsille|Valinnainen: lisää kuvakkeen, joka avaa työkirjan selaimessasi. Windows 10/11, 64-bittinen.
bg|Инсталиране за Windows|По избор: добавя икона, която отваря тетрадката в браузъра. Windows 10/11, 64 бита.
sr|Инсталирај за Windows|Опционо: додаје икону која отвара радну свеску у прегледачу. Windows 10/11, 64 бита.
hr|Instaliraj za Windows|Neobavezno: dodaje ikonu koja otvara radnu bilježnicu u pregledniku. Windows 10/11, 64 bita.
he|התקנה ל-Windows|לבחירה: מוסיף סמל שפותח את חוברת הלימוד בדפדפן. Windows 10/11, ‏64 סיביות.
fa|نصب برای ویندوز|اختیاری: نمادی اضافه می‌کند که دفتر تمرین را در مرورگر باز می‌کند. ویندوز ۱۰ یا ۱۱، نسخهٔ ۶۴ بیتی.
ur|ونڈوز کے لیے انسٹال کریں|اختیاری: ایک آئیکن شامل کرتا ہے جو مشقی کتاب کو آپ کے براؤزر میں کھولتا ہے۔ ونڈوز 10 یا 11، 64 بٹ۔
hi|Windows के लिए इंस्टॉल करें|वैकल्पिक: एक आइकन जोड़ता है जो कार्यपुस्तिका को आपके ब्राउज़र में खोलता है। Windows 10/11, 64-बिट।
bn|Windows-এর জন্য ইনস্টল করুন|ঐচ্ছিক: একটি আইকন যোগ করে যা আপনার ব্রাউজারে অনুশীলন বই খুলবে। Windows 10/11, 64-বিট।
id|Instal untuk Windows|Opsional: menambahkan ikon yang membuka buku latihan di browser Anda. Windows 10/11, 64-bit.
ms|Pasang untuk Windows|Pilihan: menambah ikon yang membuka buku latihan dalam pelayar anda. Windows 10/11, 64-bit.
zh|安装 Windows 启动图标|可选：添加一个在浏览器中打开练习册的图标。适用于 Windows 10/11，64 位。
ja|Windows 用にインストール|任意：ブラウザーでワークブックを開くアイコンを追加します。Windows 10/11、64 ビット。'''
data={k:{'download':label,'note':note} for k,label,note in (r.split('|') for r in rows.splitlines())}
(Path(__file__).resolve().parents[1]/'src/commerce/windows-locales.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
