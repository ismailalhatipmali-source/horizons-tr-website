/* HORIZONS Windows pilot entry points. Public UI only: no activation or mail settings. */
(() => {
  'use strict';
  const isHome = document.body.classList.contains('home-page');
  const canonical = document.querySelector('link[rel="canonical"]');
  const isProduct = /\/product\.html(?:[?#]|$)/.test(canonical?.href || location.pathname);
  if ((!isHome && !isProduct) || document.documentElement.dataset.horizonsPilot === '1.3.0') return;
  const copy = {
    ar: ['تنزيل نسخة Windows', 'تجربة في المتصفح', 'تجربة مجانية لمدة 7 أيام على جهاز واحد، لأول 100 حساب بريد لشخص بالغ بعد تأكيد البريد برمز التفعيل. لا يلزم دفع.', 'التجربة المجانية المحدودة'],
    en: ['Download for Windows', 'Try in your browser', 'Free 7-day trial on one device for the first 100 verified adult email accounts. Activate with the code sent by email. No payment required.', 'Limited free trial'],
    tr: ['Windows sürümünü indir', 'Tarayıcıda dene', 'E-postasını doğrulayan ilk 100 yetişkin hesabı için tek cihazda 7 günlük ücretsiz deneme. E-postayla gelen kodla etkinleştirin. Ödeme gerekmez.', 'Sınırlı ücretsiz deneme'],
    fr: ['Télécharger pour Windows', 'Essayer dans le navigateur', 'Essai gratuit de 7 jours sur un appareil pour les 100 premiers comptes adultes dont l’e-mail est vérifié. Activation par code reçu par e-mail. Aucun paiement requis.', 'Essai gratuit limité'],
    es: ['Descargar para Windows', 'Probar en el navegador', 'Prueba gratuita de 7 días en un dispositivo para las primeras 100 cuentas de adultos con correo verificado. Activación con el código recibido por correo. Sin pago.', 'Prueba gratuita limitada'],
    de: ['Für Windows herunterladen', 'Im Browser ausprobieren', '7 Tage kostenlos auf einem Gerät für die ersten 100 verifizierten E-Mail-Konten erwachsener Nutzer. Aktivierung mit dem Code per E-Mail. Keine Zahlung erforderlich.', 'Begrenzte kostenlose Testphase'],
    it: ['Scarica per Windows', 'Prova nel browser', 'Prova gratuita di 7 giorni su un dispositivo per i primi 100 account di adulti con e-mail verificata. Attivazione tramite codice ricevuto via e-mail. Nessun pagamento richiesto.', 'Prova gratuita limitata'],
    pt: ['Descarregar para Windows', 'Experimentar no navegador', 'Teste gratuito de 7 dias num dispositivo para as primeiras 100 contas de adultos com e-mail verificado. Ativação com o código recebido por e-mail. Sem pagamento.', 'Teste gratuito limitado'],
    nl: ['Downloaden voor Windows', 'Proberen in de browser', '7 dagen gratis op één apparaat voor de eerste 100 geverifieerde e-mailaccounts van volwassenen. Activeren met de code per e-mail. Geen betaling nodig.', 'Beperkte gratis proefperiode'],
    ru: ['Скачать для Windows', 'Попробовать в браузере', '7 дней бесплатно на одном устройстве для первых 100 аккаунтов взрослых с подтверждённой почтой. Активация кодом из письма. Оплата не требуется.', 'Ограниченный бесплатный пробный доступ'],
    uk: ['Завантажити для Windows', 'Спробувати в браузері', '7 днів безкоштовно на одному пристрої для перших 100 облікових записів дорослих із підтвердженою поштою. Активація кодом із листа. Оплата не потрібна.', 'Обмежений безкоштовний пробний доступ'],
    pl: ['Pobierz dla Windows', 'Wypróbuj w przeglądarce', '7 dni bezpłatnie na jednym urządzeniu dla pierwszych 100 kont osób dorosłych ze zweryfikowanym adresem e-mail. Aktywacja kodem z wiadomości e-mail. Bez opłat.', 'Ograniczony bezpłatny okres próbny'],
    cs: ['Stáhnout pro Windows', 'Vyzkoušet v prohlížeči', '7 dní zdarma na jednom zařízení pro prvních 100 účtů dospělých s ověřeným e-mailem. Aktivace kódem zaslaným e-mailem. Bez platby.', 'Omezená bezplatná zkušební verze'],
    ro: ['Descarcă pentru Windows', 'Încearcă în browser', 'Probă gratuită de 7 zile pe un dispozitiv pentru primele 100 de conturi ale adulților cu e-mail verificat. Activare prin codul primit prin e-mail. Fără plată.', 'Probă gratuită limitată'],
    hu: ['Letöltés Windowsra', 'Kipróbálás böngészőben', '7 napos ingyenes próba egy eszközön az első 100, igazolt e-mail-című felnőtt fiók számára. Aktiválás az e-mailben kapott kóddal. Fizetés nem szükséges.', 'Korlátozott ingyenes próba'],
    el: ['Λήψη για Windows', 'Δοκιμή στο πρόγραμμα περιήγησης', 'Δωρεάν δοκιμή 7 ημερών σε μία συσκευή για τους πρώτους 100 λογαριασμούς ενηλίκων με επαληθευμένο email. Ενεργοποίηση με κωδικό μέσω email. Χωρίς πληρωμή.', 'Περιορισμένη δωρεάν δοκιμή'],
    sv: ['Ladda ned för Windows', 'Prova i webbläsaren', '7 dagars gratis provperiod på en enhet för de första 100 vuxenkontona med verifierad e-post. Aktivera med koden som skickas via e-post. Ingen betalning krävs.', 'Begränsad gratis provperiod'],
    da: ['Download til Windows', 'Prøv i browseren', '7 dages gratis prøveperiode på én enhed for de første 100 voksenkonti med bekræftet e-mail. Aktivér med koden fra e-mailen. Ingen betaling kræves.', 'Begrænset gratis prøveperiode'],
    no: ['Last ned for Windows', 'Prøv i nettleseren', '7 dagers gratis prøveperiode på én enhet for de første 100 voksenkontoene med bekreftet e-post. Aktiver med koden fra e-posten. Ingen betaling kreves.', 'Begrenset gratis prøveperiode'],
    fi: ['Lataa Windowsille', 'Kokeile selaimessa', '7 päivän ilmainen kokeilu yhdellä laitteella ensimmäisille 100 aikuisen tilille, joiden sähköposti on vahvistettu. Aktivointi sähköpostikoodilla. Ei maksua.', 'Rajoitettu ilmainen kokeilu'],
    bg: ['Изтегляне за Windows', 'Проба в браузъра', '7 дни безплатно на едно устройство за първите 100 профила на пълнолетни с потвърден имейл. Активиране с кода от имейла. Не се изисква плащане.', 'Ограничен безплатен пробен период'],
    sr: ['Преузми за Windows', 'Испробај у прегледачу', '7 дана бесплатно на једном уређају за првих 100 налога пунолетних особа са потврђеном имејл адресом. Активација кодом из имејла. Без плаћања.', 'Ограничени бесплатни пробни период'],
    hr: ['Preuzmi za Windows', 'Isprobaj u pregledniku', '7 dana besplatno na jednom uređaju za prvih 100 računa punoljetnih osoba s potvrđenom e-poštom. Aktivacija kodom iz e-pošte. Bez plaćanja.', 'Ograničeno besplatno probno razdoblje'],
    he: ['הורדה ל-Windows', 'התנסות בדפדפן', 'ניסיון חינם ל-7 ימים במכשיר אחד ל-100 חשבונות המבוגרים הראשונים עם דוא״ל מאומת. הפעלה באמצעות קוד בדוא״ל. אין צורך בתשלום.', 'תקופת ניסיון חינם מוגבלת'],
    fa: ['دانلود نسخه Windows', 'آزمایش در مرورگر', 'آزمایش رایگان 7 روزه روی یک دستگاه برای 100 حساب نخست بزرگسالان با ایمیل تأییدشده. فعال‌سازی با کد ارسال‌شده به ایمیل. بدون نیاز به پرداخت.', 'آزمایش رایگان محدود'],
    ur: ['Windows کے لیے ڈاؤن لوڈ', 'براؤزر میں آزمائیں', 'تصدیق شدہ ای میل والے پہلے 100 بالغ صارفین کے اکاؤنٹس کے لیے ایک آلے پر 7 دن کی مفت آزمائش۔ ای میل سے موصولہ کوڈ کے ذریعے فعال کریں۔ ادائیگی ضروری نہیں۔', 'محدود مفت آزمائش'],
    hi: ['Windows के लिए डाउनलोड करें', 'ब्राउज़र में आज़माएँ', 'सत्यापित ईमेल वाले पहले 100 वयस्क खातों के लिए एक डिवाइस पर 7 दिन का निःशुल्क परीक्षण। ईमेल से मिले कोड से सक्रिय करें। भुगतान आवश्यक नहीं है।', 'सीमित निःशुल्क परीक्षण'],
    bn: ['Windows-এর জন্য ডাউনলোড', 'ব্রাউজারে চেষ্টা করুন', 'যাচাইকৃত ইমেইলসহ প্রথম 100টি প্রাপ্তবয়স্ক অ্যাকাউন্টের জন্য একটি ডিভাইসে 7 দিনের বিনামূল্যে পরীক্ষা। ইমেইলে পাওয়া কোড দিয়ে সক্রিয় করুন। কোনো অর্থপ্রদান প্রয়োজন নেই।', 'সীমিত বিনামূল্যে পরীক্ষা'],
    id: ['Unduh untuk Windows', 'Coba di peramban', 'Uji coba gratis 7 hari pada satu perangkat untuk 100 akun dewasa pertama dengan email terverifikasi. Aktifkan dengan kode yang dikirim melalui email. Tanpa pembayaran.', 'Uji coba gratis terbatas'],
    ms: ['Muat turun untuk Windows', 'Cuba dalam pelayar', 'Percubaan percuma 7 hari pada satu peranti untuk 100 akaun dewasa pertama dengan e-mel disahkan. Aktifkan dengan kod melalui e-mel. Tiada bayaran diperlukan.', 'Percubaan percuma terhad'],
    zh: ['下载 Windows 版', '在浏览器中试用', '前100个通过电子邮箱验证的成人账户可在一台设备上免费试用7天。使用邮件中的验证码激活，无需付款。', '限量免费试用'],
    ja: ['Windows版をダウンロード', 'ブラウザーで試す', 'メール認証済みの成人アカウント先着100件に、1台の端末で7日間の無料体験を提供します。メールのコードで有効化してください。支払いは不要です。', '人数限定の無料体験']
  };
  const locale = (document.documentElement.lang || 'en').toLowerCase().split('-')[0];
  const t = copy[locale] || copy.en;
  const filename = 'HORIZONS_Arabic_Level_1_1.3.0_Pilot_Windows.zip';
  const href = '../downloads/' + filename;
  const platform = 'Windows 10/11 (64-bit) · Pilot 1.3.0 · ZIP ≈ 460 MB';
  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  };
  function applyActions(box, fallbackBrowser) {
    if (!box || box.dataset.pilotActions) return;
    const existing = [...box.querySelectorAll('a')];
    // Never relabel unrelated links, support links, or paid-product links.
    let browser = existing.find(a => /(?:\/try\/|\bdemo\.html)/.test(a.getAttribute('href') || ''));
    let download = existing.find(a => (a.getAttribute('href') || '').includes(filename));
    if (!download) { download = make('a', 'button primary-cta', t[0]); box.prepend(download); }
    download.href = href;
    download.download = filename;
    download.className = 'button primary-cta';
    download.textContent = t[0];
    download.setAttribute('aria-label', t[0] + ' — ' + platform);
    download.dataset.pilotDownload = '1.3.0';
    if (!browser) { browser = make('a', 'button ghost', t[1]); browser.href = fallbackBrowser; download.after(browser); }
    browser.textContent = t[1];
    browser.className = 'button ghost';
    box.dataset.pilotActions = 'true';
  }
  const style = make('style');
  style.id = 'horizons-pilot-style';
  style.textContent = '[data-pilot-actions]{display:flex;flex-wrap:wrap;gap:12px;align-items:center}[data-pilot-actions] .button{white-space:normal;text-align:center}.pilot-policy{line-height:1.75;margin-block:12px}.pilot-platform{font-size:.875rem;line-height:1.5;opacity:.82;margin-block:10px}.pilot-panel{padding:20px;border:1px solid #dce5ec;border-radius:16px;margin-block:20px;background:#f6f9fb;color:#071c3c}.pilot-panel h2{margin-block:0 10px}@media(max-width:540px){[data-pilot-actions] .button{max-width:100%;box-sizing:border-box}.hero-actions[data-pilot-actions] .button{width:100%}.pilot-panel{padding:16px}}';
  document.head.appendChild(style);
  if (isHome) {
    applyActions(document.querySelector('.hero-actions'), '../try/index.html?lang=' + encodeURIComponent(locale));
    const note = document.querySelector('.hero-copy .trial-note');
    if (note) { note.textContent = t[2]; note.classList.add('pilot-policy'); }
    const flagship = document.querySelector('#arabic');
    if (flagship) {
      applyActions(flagship.querySelector('.product-actions'), '../try/index.html?lang=' + encodeURIComponent(locale));
      const ps = flagship.querySelectorAll('.read-more p');
      for (const p of ps) if (p.textContent.includes('1.2.0')) p.textContent = p.textContent.replaceAll('1.2.0', '1.3.0');
      if (ps.length >= 3) ps[ps.length - 1].textContent = t[2];
      const status = flagship.querySelector('.status');
      if (status) status.textContent = t[3];
      const actions = flagship.querySelector('.product-actions');
      if (actions) {
        const info = make('p', 'pilot-platform', platform); info.dir = 'ltr'; actions.after(info);
        const policy = make('p', 'pilot-policy', t[2]); actions.before(policy);
      }
    }
  }
  if (isProduct) {
    const article = document.querySelector('main article');
    if (article) {
      const sections = [...article.children].filter(el => el.tagName === 'SECTION');
      const compatibility = sections.find(section => section.textContent.includes('1.2.0') && section.textContent.includes('Windows'));
      if (compatibility) for (const p of compatibility.querySelectorAll('p')) p.textContent = p.textContent.replaceAll('1.2.0', '1.3.0');
      const policy = sections[2];
      if (policy) {
        const title = policy.querySelector('h2'); if (title) title.textContent = t[3];
        const first = policy.querySelector('p'); if (first) first.textContent = t[2];
      }
      const existingActions = article.querySelector('.actions');
      applyActions(existingActions, 'demo.html');
      // Put a visible download choice before the cover and long product description.
      const intro = [...article.children].find(el => el.tagName === 'P' && !el.classList.contains('date'));
      if (intro) {
        const panel = make('section', 'pilot-panel'); panel.id = 'windows-pilot';
        panel.append(make('h2', '', t[3]), make('p', 'pilot-policy', t[2]));
        const info = make('p', 'pilot-platform', platform); info.dir = 'ltr'; panel.append(info);
        const actions = make('div', 'actions'); applyActions(actions, 'demo.html'); panel.append(actions);
        intro.after(panel);
      }
      const date = article.querySelector('.date'); if (date) date.textContent = '2026-09-27';
    }
  }
  document.documentElement.dataset.horizonsPilot = '1.3.0';
})();
