/* Presentation-only compact home. Existing lesson buttons keep their handlers.
 * Theory stays disabled until an explicit, reviewed content mapping exists. */
(function(scope){
 'use strict';
 const paths={sun:'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 1.4 1.4m10 10 1.4 1.4M5.6 18.4 1.4-1.4m10-10 1.4-1.4',moon:'M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5Z',gear:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',user:'M4 21v-2a8 8 0 0 1 16 0v2',lock:'M6 10h12v11H6ZM8 10V7a4 4 0 0 1 8 0v3',play:'m8 5 11 7-11 7Z',book:'M12 5v15M3 4h5l4 2 4-2h5v15h-5l-4 2-4-2H3Z'};
 function icon(name){const extra=name==='sun'?'<circle cx="12" cy="12" r="4"/>':name==='gear'?'<circle cx="12" cy="12" r="3"/>':name==='user'?'<circle cx="12" cy="7" r="4"/>':'';return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[name]+'"/>'+extra+'</svg>';}
 function install(win,doc){
  if(win.hznCompactHome)return win.hznCompactHome;
  let pending=false,dead=false;
  const q=s=>doc.querySelector(s);
  const copies={"en": {"interactive": "Interactive lesson", "theory": "Theory", "soon": "Coming soon — in preparation", "close": "Close"}, "ar": {"interactive": "الدرس التفاعلي", "theory": "الشرح النظري", "soon": "قريبًا — قيد الإعداد", "close": "إغلاق"}, "tr": {"interactive": "Etkileşimli ders", "theory": "Kuramsal açıklama", "soon": "Yakında — hazırlanıyor", "close": "Kapat"}, "fr": {"interactive": "Leçon interactive", "theory": "Explications théoriques", "soon": "Bientôt — en préparation", "close": "Fermer"}, "es": {"interactive": "Lección interactiva", "theory": "Explicación teórica", "soon": "Próximamente — en preparación", "close": "Cerrar"}, "de": {"interactive": "Interaktive Lektion", "theory": "Theoretische Erklärung", "soon": "Demnächst — in Vorbereitung", "close": "Schließen"}, "it": {"interactive": "Lezione interattiva", "theory": "Spiegazione teorica", "soon": "In arrivo — in preparazione", "close": "Chiudi"}, "pt": {"interactive": "Lição interativa", "theory": "Explicação teórica", "soon": "Em breve — em preparação", "close": "Fechar"}, "nl": {"interactive": "Interactieve les", "theory": "Theoretische uitleg", "soon": "Binnenkort — in voorbereiding", "close": "Sluiten"}, "ru": {"interactive": "Интерактивный урок", "theory": "Теоретическое объяснение", "soon": "Скоро — готовится", "close": "Закрыть"}, "uk": {"interactive": "Інтерактивний урок", "theory": "Теоретичне пояснення", "soon": "Незабаром — готується", "close": "Закрити"}, "pl": {"interactive": "Lekcja interaktywna", "theory": "Wyjaśnienie teoretyczne", "soon": "Wkrótce — w przygotowaniu", "close": "Zamknij"}, "cs": {"interactive": "Interaktivní lekce", "theory": "Teoretický výklad", "soon": "Brzy — v přípravě", "close": "Zavřít"}, "ro": {"interactive": "Lecție interactivă", "theory": "Explicație teoretică", "soon": "În curând — în pregătire", "close": "Închide"}, "hu": {"interactive": "Interaktív lecke", "theory": "Elméleti magyarázat", "soon": "Hamarosan — előkészületben", "close": "Bezárás"}, "el": {"interactive": "Διαδραστικό μάθημα", "theory": "Θεωρητική εξήγηση", "soon": "Σύντομα — υπό προετοιμασία", "close": "Κλείσιμο"}, "sv": {"interactive": "Interaktiv lektion", "theory": "Teoretisk förklaring", "soon": "Kommer snart — förbereds", "close": "Stäng"}, "da": {"interactive": "Interaktiv lektion", "theory": "Teoretisk forklaring", "soon": "Kommer snart — under forberedelse", "close": "Luk"}, "no": {"interactive": "Interaktiv leksjon", "theory": "Teoretisk forklaring", "soon": "Kommer snart — under arbeid", "close": "Lukk"}, "fi": {"interactive": "Vuorovaikutteinen oppitunti", "theory": "Teoreettinen selitys", "soon": "Tulossa pian — valmistelussa", "close": "Sulje"}, "bg": {"interactive": "Интерактивен урок", "theory": "Теоретично обяснение", "soon": "Скоро — в подготовка", "close": "Затваряне"}, "sr": {"interactive": "Интерактивна лекција", "theory": "Теоријско објашњење", "soon": "Ускоро — у припреми", "close": "Затвори"}, "hr": {"interactive": "Interaktivna lekcija", "theory": "Teorijsko objašnjenje", "soon": "Uskoro — u pripremi", "close": "Zatvori"}, "he": {"interactive": "שיעור אינטראקטיבי", "theory": "הסבר תאורטי", "soon": "בקרוב — בהכנה", "close": "סגירה"}, "fa": {"interactive": "درس تعاملی", "theory": "توضیح نظری", "soon": "به‌زودی — در حال آماده‌سازی", "close": "بستن"}, "ur": {"interactive": "تفاعلی سبق", "theory": "نظری وضاحت", "soon": "جلد — تیاری جاری ہے", "close": "بند کریں"}, "hi": {"interactive": "इंटरैक्टिव पाठ", "theory": "सैद्धांतिक व्याख्या", "soon": "जल्द — तैयारी जारी", "close": "बंद करें"}, "bn": {"interactive": "ইন্টার‌্যাক্টিভ পাঠ", "theory": "তাত্ত্বিক ব্যাখ্যা", "soon": "শীঘ্রই — প্রস্তুতি চলছে", "close": "বন্ধ করুন"}, "id": {"interactive": "Pelajaran interaktif", "theory": "Penjelasan teori", "soon": "Segera hadir — sedang disiapkan", "close": "Tutup"}, "ms": {"interactive": "Pelajaran interaktif", "theory": "Penerangan teori", "soon": "Akan datang — sedang disediakan", "close": "Tutup"}, "zh": {"interactive": "互动课程", "theory": "理论讲解", "soon": "即将推出 — 准备中", "close": "关闭"}, "ja": {"interactive": "対話型レッスン", "theory": "理論解説", "soon": "近日公開 — 準備中", "close": "閉じる"}};
  const label=()=>copies[doc.documentElement.lang.split("-")[0]]||copies.en;
  function iconButton(button,name){
   if(!button)return;
   if(!button.querySelector('.hzn-compact-icon')){
    const text=button.id==='hzn-experience-button'?button.getAttribute('aria-label'):button.textContent.trim()||button.getAttribute('aria-label');
    button.setAttribute('aria-label',text);button.title=text;
    button.innerHTML='<span class="hzn-compact-icon">'+icon(name)+'</span>';
   }else if(button.dataset.compactIcon!==name){button.querySelector('.hzn-compact-icon').innerHTML=icon(name);}
   button.dataset.compactIcon=name;button.classList.add('hzn-icon-control');
  }
  function sync(){
   pending=false;if(dead||!q('body[data-hzn-experiences-ready]'))return;
   const copy=label();
   iconButton(q('#settings-button'),'gear');iconButton(q('#hzn-account-button'),'user');
   iconButton(q('#hzn-experience-button'),doc.body.dataset.hznTone==='dark'?'moon':'sun');
   const nav=q('#hzn-home-nav #course-nav');if(!nav)return;
   const futureList=q('#hzn-exp-future .hzn-future-grid');
   for(const [offset,sourceTile] of (futureList?[...futureList.children].filter(n=>n.tagName==='BUTTON'):[]).entries()){
    const sourceKey=sourceTile.querySelector('strong')?.dataset.copy;
    if(nav.querySelector('[data-reference-key="'+sourceKey+'"]'))continue;
    const tile=sourceTile.cloneNode(true);
    const title=tile.querySelector('strong');if(!title)continue;
    const key=title.dataset.copy;
    tile.dataset.referenceKey=key;tile.dataset.futureNumber=String(offset+7).padStart(2,'0');
    tile.innerHTML='<span class="demo-section-number">'+tile.dataset.futureNumber+'</span>';
    title.className='demo-section-title';tile.append(title);nav.append(tile);
   }
   const futureSection=q('#hzn-exp-future');if(futureSection)futureSection.hidden=true;
   for(const button of [...nav.children].filter(n=>n.tagName==='BUTTON')){
    const title=button.querySelector('.demo-section-title')?.textContent.trim()||button.querySelector('span:last-of-type')?.textContent.trim()||button.textContent.trim();
    const card=doc.createElement('article');card.className='hzn-lesson-card';
    const heading=doc.createElement('h2');heading.className='hzn-card-title';heading.textContent=(button.querySelector('.demo-section-number')?.textContent.trim()||'')+' '+title;
    const actions=doc.createElement('div');actions.className='hzn-card-actions';
    button.before(card);card.append(heading,actions);actions.append(button);
    button.classList.add('hzn-interactive-action');button.setAttribute('aria-label',copy.interactive+' — '+title);
    const actionLabel=doc.createElement('span');actionLabel.className='hzn-action-label';actionLabel.innerHTML=icon(button.dataset.referenceKey?'lock':'play');actionLabel.append(doc.createTextNode(button.dataset.referenceKey?copy.soon:copy.interactive));button.append(actionLabel);
    const theory=doc.createElement('button');theory.type='button';theory.className='hzn-theory-action';theory.disabled=true;
    theory.setAttribute('aria-label',copy.theory+' — '+title+' — '+copy.soon);theory.title=copy.soon;
    theory.innerHTML=icon('book');theory.append(doc.createTextNode(copy.theory));actions.append(theory);
    const status=doc.createElement('small');status.className='hzn-theory-status';status.textContent=copy.theory+': '+copy.soon;card.append(status);
    // Explicit local editorial-review routes only. Default production staging
    // remains closed; an unreviewed reference is never enabled implicitly.
    const key=button.dataset.referenceKey||button.dataset.demoSection||button.dataset.course||button.dataset.b4Course||button.dataset.b3Course||button.dataset.b2Course||button.dataset.phonicsCourse;
    const mapping=(win.HZN_REFERENCE_ROUTES||win.HZN_REFERENCE_REVIEW_ROUTES)?.[key];
    const code=doc.documentElement.lang.split('-')[0];
    const route=typeof mapping==='string'?mapping:mapping?.languages?.includes(code)?mapping.href:null;
    if(route){try{
      const url=new URL(route,win.location.href);
      if(url.origin===win.location.origin){
       const draft=copy.theory;
       theory.disabled=false;theory.title=draft;theory.setAttribute('aria-label',copy.theory+' — '+title);status.remove();
       theory.onclick=()=>{
        url.searchParams.set('lang',doc.documentElement.lang);
        const dialog=doc.createElement('dialog');dialog.className='hzn-reference-dialog';dialog.setAttribute('aria-label',copy.theory+' — '+title);
        const close=doc.createElement('button');close.type='button';close.textContent=copy.close;close.onclick=()=>dialog.close();
        const frame=doc.createElement('iframe');frame.title=copy.theory+' — '+title;frame.src=url.href;
        dialog.append(close,frame);doc.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();theory.focus();},{once:true});dialog.showModal();
       };
      }
    }catch(_){/* Invalid review route stays disabled. */}}
    const access=button.querySelector('.demo-section-status');if(access){const note=doc.createElement('small');note.className='hzn-access-status';note.textContent=access.textContent;card.append(note);}
   }
  }
  function schedule(){if(!pending&&!dead){pending=true;win.requestAnimationFrame(sync);}}
  const observer=new win.MutationObserver(schedule);observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['lang','data-hzn-tone','data-focus-view']});
  const api=Object.freeze({refresh:schedule,destroy(){dead=true;observer.disconnect();}});win.hznCompactHome=api;sync();return api;
 }
 scope.HZNInstallCompactHome=install;
})(typeof globalThis!=='undefined'?globalThis:this);
