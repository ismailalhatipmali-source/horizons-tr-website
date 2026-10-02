'use strict';
// Load the shared localized Windows-pilot entry points without changing backend settings.
(() => {
  if (document.getElementById('commerce-ui')) return;
  const product = /\/product\.html(?:[?#]|$)/.test(document.querySelector('link[rel="canonical"]')?.href || location.pathname);
  if ((!document.body.classList.contains('home-page') && !product) || document.getElementById('horizons-pilot-ui')) return;
  const script = document.createElement('script');
  script.id = 'horizons-pilot-ui';
  script.src = new URL('pilot.js?v=20260927-1', document.currentScript?.src || new URL('../home.js', location.href)).href;
  document.head.appendChild(script);
})();
document.body.classList.add('js-enabled');
const menu = document.querySelector('.menu');
const links = document.querySelector('.nav .links');
function closeMenu() {
  if (!menu || !links) return;
  links.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.textContent = '☰';
}
if (menu && links) {
  menu.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
    menu.textContent = open ? '×' : '☰';
  });
  links.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('click', event => { if (!event.target.closest('.nav')) closeMenu(); });
}
// Dismiss only the language popover; content disclosures stay open while reading.
document.addEventListener('click', event => {
  for (const popup of document.querySelectorAll('.language-switch[open]')) {
    if (!popup.contains(event.target)) popup.open = false;
  }
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (links?.classList.contains('open')) { closeMenu(); menu.focus(); }
  for (const popup of document.querySelectorAll('.language-switch[open]')) {
    popup.open = false;
    popup.querySelector('summary')?.focus();
  }
});
// Existing product bookmarks still work when their project is inside Coming soon.
function revealHashTarget() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  let ancestor = target.parentElement;
  let revealed = false;
  while (ancestor) {
    if (ancestor.tagName === 'DETAILS' && !ancestor.open) { ancestor.open = true; revealed = true; }
    ancestor = ancestor.parentElement;
  }
  if (revealed) requestAnimationFrame(() => target.scrollIntoView({block:'start', behavior:'instant'}));
}
revealHashTarget();
window.addEventListener('hashchange', revealHashTarget);
const video = document.querySelector('.hero-video');
if (video) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function syncVideo() {
    video.controls = false;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    const shouldPlay = !reducedMotion.matches && !navigator.connection?.saveData;
    video.autoplay = shouldPlay;
    if (shouldPlay) video.play().catch(() => { /* The poster stays visible if autoplay is blocked. */ });
    else { video.pause(); video.currentTime = 0; }
  }
  syncVideo();
  reducedMotion.addEventListener?.('change', syncVideo);
}


/* Available Travel Agent Client Kit — injected once across all 32 localized home pages. */
(() => {
  const catalog=document.querySelector('.catalog'); if(!catalog||document.getElementById('travel-client-kit'))return;
  const lang=document.documentElement.lang||'en';
  const names={en:'Travel Agent Templates & Client Kit',ar:'قوالب وكِت عمل وكيل السفر للعملاء',tr:'Seyahat Acentesi Şablonları ve Müşteri Kiti',fr:'Modèles d’agence de voyage & kit client',es:'Plantillas para agencias de viajes y kit de clientes',de:'Reisebüro-Vorlagen & Kunden-Kit',it:'Modelli per agenzie di viaggio e kit cliente',pt:'Modelos para agência de viagens e kit do cliente',nl:'Reisbureau-sjablonen & klantkit',ru:'Шаблоны турагентства и клиентский набор',uk:'Шаблони турагенції та клієнтський набір',pl:'Szablony biura podróży i zestaw klienta',cs:'Šablony cestovní kanceláře a klientský balíček',ro:'Șabloane agenție de turism și kit client',hu:'Utazási iroda sablonok és ügyfélcsomag',el:'Πρότυπα ταξιδιωτικού γραφείου & πακέτο πελάτη',sv:'Resebyråmallar & kundpaket',da:'Rejsebureauskabeloner & kundepakke',no:'Reisebyråmaler & kundepakke',fi:'Matkatoimiston mallipohjat ja asiakaspaketti',bg:'Шаблони за туристическа агенция и клиентски комплект',sr:'Шаблони туристичке агенције и клијентски пакет',hr:'Predlošci turističke agencije i klijentski paket',he:'תבניות לסוכנות נסיעות וערכת לקוח',fa:'قالب‌های آژانس مسافرتی و بسته مشتری',ur:'ٹریول ایجنسی ٹیمپلیٹس اور کلائنٹ کِٹ',hi:'ट्रैवल एजेंसी टेम्पलेट्स और क्लाइंट किट',bn:'ট্রাভেল এজেন্সি টেমপ্লেট ও ক্লায়েন্ট কিট',id:'Template Agen Perjalanan & Kit Klien',ms:'Templat Agensi Pelancongan & Kit Pelanggan',zh:'旅行社模板与客户工具包',ja:'旅行会社テンプレート＆クライアントキット'};
  const buy={ar:'اشترِ الآن',tr:'Satın al',fr:'Acheter',es:'Comprar',de:'Kaufen',it:'Acquista',pt:'Comprar',nl:'Kopen',ru:'Купить',uk:'Купити',pl:'Kup',cs:'Koupit',ro:'Cumpără',hu:'Vásárlás',el:'Αγορά',sv:'Köp',da:'Køb',no:'Kjøp',fi:'Osta',bg:'Купи',sr:'Купи',hr:'Kupi',he:'רכישה',fa:'خرید',ur:'خریدیں',hi:'खरीदें',bn:'কিনুন',id:'Beli',ms:'Beli',zh:'购买',ja:'購入',en:'Buy now'}[lang]||'Buy now';
  const details={ar:'التفاصيل',tr:'Detaylar',fr:'Détails',es:'Detalles',de:'Details',it:'Dettagli',pt:'Detalhes',nl:'Details',ru:'Подробнее',uk:'Деталі',pl:'Szczegóły',cs:'Podrobnosti',ro:'Detalii',hu:'Részletek',el:'Λεπτομέρειες',sv:'Detaljer',da:'Detaljer',no:'Detaljer',fi:'Tiedot',bg:'Детайли',sr:'Детаљи',hr:'Detalji',he:'פרטים',fa:'جزئیات',ur:'تفصیلات',hi:'विवरण',bn:'বিস্তারিত',id:'Detail',ms:'Butiran',zh:'详情',ja:'詳細',en:'Details'}[lang]||'Details';
  const article=document.createElement('article');article.className='product-row';article.id='travel-client-kit';
  article.innerHTML='<figure class="product-visual"><img loading="lazy" width="960" height="540"></figure><div class="product-info"><div class="product-meta"><span class="status">$29 USD</span></div><h3></h3><div class="product-actions"><a class="button primary-cta" ></a><a class="text-link"></a></div></div>';
  const img=article.querySelector('img');img.src='../assets/covers/'+lang+'/travel-kit.svg';img.alt=names[lang]||names.en;
  article.querySelector('h3').textContent=names[lang]||names.en;
  const [buyLink,detailLink]=article.querySelectorAll('a');buyLink.href='../manual-order.html?lang='+encodeURIComponent(lang);buyLink.textContent=buy;detailLink.href='../travel-kit.html?lang='+encodeURIComponent(lang);detailLink.textContent=details;
  catalog.appendChild(article);
})();

/* Localized workbook walkthrough: follows the selected page language. */
(() => {const actions=document.querySelector("#arabic .product-actions");if(!actions||actions.querySelector("[data-workbook-video]"))return;const lang=document.documentElement.lang||"en";const labels={"en":"Watch the walkthrough","ar":"شاهد شرح الاستخدام","tr":"Kullanım videosunu izleyin","fr":"Voir la vidéo explicative","es":"Ver el tutorial","de":"Anleitung ansehen","it":"Guarda il tutorial","pt":"Ver o tutorial","nl":"Bekijk de uitlegvideo","ru":"Смотреть инструкцию","uk":"Переглянути інструкцію","pl":"Obejrzyj instrukcję","cs":"Podívejte se na návod","ro":"Vezi tutorialul","hu":"Útmutató megtekintése","el":"Δείτε τον οδηγό","sv":"Se handledningen","da":"Se vejledningen","no":"Se veiledningen","fi":"Katso käyttöohjevideo","bg":"Гледайте ръководството","sr":"Погледајте упутство","hr":"Pogledajte upute","he":"צפו בסרטון ההדרכה","fa":"ویدیوی راهنما را ببینید","ur":"رہنمائی کی ویڈیو دیکھیں","hi":"उपयोग का वीडियो देखें","bn":"ব্যবহারের ভিডিও দেখুন","id":"Tonton panduan penggunaan","ms":"Tonton panduan penggunaan","zh":"观看使用教程","ja":"使い方の動画を見る"};const link=document.createElement("a");link.className="text-link";link.dataset.workbookVideo="";link.href="product.html#workbook-walkthrough";link.textContent=labels[lang]||labels.en;actions.appendChild(link);})();
