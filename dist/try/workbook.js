(()=>{
'use strict';
window.HORIZONS_BOOT={ready:false,errors:[]};
const {buildPenSvg,attachPenDemo,stopPenDemo}=(()=>{
/** Pen guides use authored directional routes aligned to the original glyph ink.
 * They are not generated from the order of a font's outline contours.
 * Geometry is checked; an independent handwriting-teacher certification is pending.
 */
const NS='http://www.w3.org/2000/svg';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let serial=0,frame=0,active=null;
function geometry(d){const p=document.createElementNS(NS,'path');p.setAttribute('d',d);return p;}
function number(n,locale){return new Intl.NumberFormat(locale,{useGrouping:false}).format(n);}
function buildPenSvg(form,{guide=true,locale='ar',title=''}={}){
 const id='pen-'+(++serial),strokes=form.penStrokes??[];
 let body=`<svg class="trace-guide pen-guide" viewBox="0 70 560 290" role="img" aria-labelledby="${id}"><title id="${id}">${escape(title)}</title><path d="M40 250H520 M40 150H520" class="pen-baselines"/>`;
 // Preserve the supplied letter shapes, positions, dots, and joining variants.
 if(guide)for(const s of form.strokes){
  if(s.kind==='dot'&&s.center)body+=`<circle class="pen-outline" cx="${s.center.x}" cy="${s.center.y}" r="${s.radius}"/>`;
  else body+=`<path d="${escape(s.path??s.d)}" class="${s.kind==='path'?'pen-outline-line':'pen-outline'}"/>`;
 }
 if(guide)strokes.forEach((s,i)=>{
  let start,arrows='';
  if(s.kind==='path'){
   const path=geometry(s.path),length=path.getTotalLength();start=path.getPointAtLength(0);
   const count=Math.max(1,Math.min(6,Math.ceil(length/95)));
   for(let j=0;j<count;j++){
    const at=length*(j+0.62)/(count+.25),a=path.getPointAtLength(Math.max(0,at-3)),b=path.getPointAtLength(Math.min(length,at+3)),p=path.getPointAtLength(at);
    const angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
    arrows+=`<path class="pen-arrow" d="M-5-3.2 L0 0 L-5 3.2" transform="translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${angle.toFixed(2)})"/>`;
   }
   body+=`<path class="pen-route" d="${escape(s.path)}"/><path class="pen-demo-stroke" data-pen-step="${i}" data-pen-length="${length}" d="${escape(s.path)}"/>${arrows}`;
  }else{
   start={x:s.x,y:s.y};body+=`<circle class="pen-dot-target" cx="${s.x}" cy="${s.y}" r="2"/><circle class="pen-demo-stroke pen-demo-dot" data-pen-step="${i}" cx="${s.x}" cy="${s.y}" r="${Math.min(6,s.radius??5)}"/>`;
  }
  // Small numbered start tags sit beside the ink; a leader identifies the exact start.
  const dy=i%2===0?-14:14,x=Math.max(12,Math.min(548,start.x)),y=Math.max(85,Math.min(341,start.y+dy));
  body+=`<g class="pen-start"><path d="M${x} ${y}L${start.x} ${start.y}"/><circle class="pen-start-point" cx="${start.x}" cy="${start.y}" r="2"/><circle cx="${x}" cy="${y}" r="6.5"/><text x="${x}" y="${y+.35}" dominant-baseline="central" text-anchor="middle" direction="ltr">${number(i+1,locale)}</text></g>`;
 });
 return body+'<circle class="pen-tip" r="4.5" hidden/></svg>';
}
function stopPenDemo(){cancelAnimationFrame(frame);frame=0;if(active){active.onStop?.();active=null;}document.querySelectorAll('.pen-tip').forEach(p=>p.setAttribute('hidden',''));}
function attachPenDemo({svg,playButton,stepButton,status,labels,onStroke,onReset,onUndo}){
 stopPenDemo();if(!svg||!playButton)return;
 const nodes=[...svg.querySelectorAll('[data-pen-step]')];let shown=0,playing=false,run=0;
 function hide(n){n.style.opacity=0;n.style.strokeDasharray='';n.style.strokeDashoffset='';}
 function writeStatus(n){if(status)status.textContent=n?labels.step.replace('{current}',n).replace('{total}',nodes.length):labels.ready;}
 function stopped(){run++;playing=false;playButton.textContent=labels.play;playButton.setAttribute('aria-pressed','false');}
 function stop(){stopPenDemo();stopped();}
 function reset(){nodes.forEach(hide);shown=0;writeStatus(0);onReset?.();}
 function reveal(index){
  const n=nodes[index];if(!n)return;
  n.style.opacity=1;
  // Count a stroke as soon as it is visible, so undo also removes a paused or
  // currently animating stroke rather than waiting for its animation to finish.
  if(index>=shown){shown=index+1;onStroke?.(index);}
  return n;
 }
 function clear(){stop();reset();}
 function undo(){
  stop();if(!shown)return false;
  const index=--shown;hide(nodes[index]);writeStatus(shown);onUndo?.(index);return true;
 }
 function showNext(){
  stop();if(shown>=nodes.length)reset();
  const n=reveal(shown);if(n){n.style.strokeDasharray='';n.style.strokeDashoffset=0;writeStatus(shown);}
 }
 playButton.onclick=()=>{
  if(playing){stop();return;}
  clear();playing=true;playButton.textContent=labels.stop;playButton.setAttribute('aria-pressed','true');
  const token=++run;active={onStop:stopped};
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
   nodes.forEach((n,index)=>{reveal(index);n.style.strokeDashoffset=0;});writeStatus(shown);stop();return;
  }
  const tip=svg.querySelector('.pen-tip');let index=0,start=null;
  function tick(time){
   if(!playing||token!==run)return;
   if(!svg.isConnected){stop();return;}
   const n=nodes[index];if(!n){stop();return;}
   if(start===null)start=time;
   const len=Number(n.dataset.penLength||0),duration=len?Math.max(600,Math.min(2600,len*5)):650,pct=Math.min(1,(time-start)/duration);
   reveal(index);
   if(len){n.style.strokeDasharray=String(len);n.style.strokeDashoffset=String(len*(1-pct));const p=n.getPointAtLength(len*pct);tip?.setAttribute('cx',p.x);tip?.setAttribute('cy',p.y);}
   else{tip?.setAttribute('cx',n.getAttribute('cx'));tip?.setAttribute('cy',n.getAttribute('cy'));}
   tip?.removeAttribute('hidden');writeStatus(index+1);
   if(pct===1&&time-start>duration+260){index++;start=null;if(index===nodes.length){stop();return;}}
   frame=requestAnimationFrame(tick);
  }
  frame=requestAnimationFrame(tick);
 };
 if(stepButton)stepButton.onclick=showNext;reset();
 return {hasInk:()=>shown>0,undo,clear,stop};
}

return {buildPenSvg,attachPenDemo,stopPenDemo};
})();
const {get,put}=(()=>{
// Existing database name, version, stores and keys are retained to preserve progress.
const ready = new Promise((resolve,reject)=>{
 if(!('indexedDB' in globalThis)){reject(new Error('IndexedDB unavailable'));return}
 let settled=false;let timer=setTimeout(()=>done(new Error('Database open timed out')),5000);
 function done(error,db){if(settled){if(db)db.close();return}settled=true;clearTimeout(timer);error?reject(error):resolve(db)}
 try{
  const r=indexedDB.open('horizons-reader-v1',1);
  r.onupgradeneeded=()=>{for(const store of ['books','progress'])if(!r.result.objectStoreNames.contains(store))r.result.createObjectStore(store)};
  r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();done(null,r.result)};
  r.onerror=()=>done(r.error||new Error('Database error'));
  r.onblocked=()=>done(new Error('Database blocked by another tab'));
 }catch(e){done(e)}
});
// Attach a rejection handler immediately; each caller still receives the original error.
ready.catch(()=>{});
async function get(store,key){const db=await ready;return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function put(store,key,value){const db=await ready;return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}

return {get,put};
})();
const {prepareOffline}=(()=>{
// Same-origin only. No remote storage, analytics, account, or subscription.
const OFFLINE_BUILD='1.0.2-demo';
function workerMessage(worker, data, onProgress = () => {}, timeout = 90000) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel(); let timer, settled = false;
    const finish = (error, value) => {
      if (settled) return; settled = true;
      clearTimeout(timer); channel.port1.close();
      error ? reject(error) : resolve(value);
    };
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => finish(new Error('Offline download timed out')), timeout);
    };
    channel.port1.onmessage = event => {
      if (settled) return;
      resetTimer(); const message = event.data;
      if (typeof message?.done === 'number') {
        try { onProgress(message); } catch (error) { finish(error); return; }
      }
      if (message?.ok === true || typeof message?.version === 'string') finish(null, message);
      else if (message?.ok === false) finish(new Error(message.error || 'Offline download failed'));
    };
    resetTimer();
    try { worker.postMessage(data, [channel.port2]); } catch (error) { finish(error); }
  });
}
async function prepareOffline(group, onProgress = () => {}) {
  if (/(?:^|[?&])local=1(?:&|$)/.test(location.search ?? '')) {
    const e = new Error('The complete local package is already served from this computer.');
    e.code = 'LOCAL_SERVER'; throw e;
  }
  if (!('serviceWorker' in navigator) || !window.isSecureContext || location.protocol === 'file:') {
    const e = new Error('Offline caching needs HTTPS or localhost. Local files still work through the local server.');
    e.code = 'UNSUPPORTED'; throw e;
  }
  const requested = await navigator.serviceWorker.register(new URL('sw.js', document.baseURI), {updateViaCache:'none'});
  let readyTimer;
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => { readyTimer = setTimeout(() => reject(new Error('Service worker activation timeout')), 20000); })
  ]).finally(() => clearTimeout(readyTimer));
  // Use this page's controller; an installing/waiting release must not download
  // different content while the current workbook is still open.
  if (registration.scope !== requested.scope) throw new Error('Offline workbook scope mismatch');
  const worker = navigator.serviceWorker.controller || registration.active;
  if (!worker) throw new Error('No active service worker');
  const info = await workerMessage(worker, {type:'get-version'}, () => {}, 10000);
  if (info.version !== OFFLINE_BUILD) {
    const e = new Error('A workbook update is ready. Close its open tabs and reopen the workbook before downloading.');
    e.code = 'UPDATE_REQUIRED'; throw e;
  }
  return workerMessage(worker, {type:'cache-group', group, version:OFFLINE_BUILD}, onProgress);
}

return {prepareOffline};
})();
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Keep each letter and its diacritics together; color alone preserves Arabic joining.
function lessonText(value,letter=data?.letter){
 const target=letter==='ا'?'اأإآٱ':letter;
 return (String(value??'').match(/[^\p{M}]\p{M}*|\p{M}+/gu)??[]).map(cluster=>{
  const base=cluster[0].normalize('NFC');
  return target?.includes(base)?`<span class="target-letter">${esc(cluster)}</span>`:esc(cluster);
 }).join('');
}
const IS_DEMO=window.HORIZONS_RELEASE?.edition==='demo';
const BUILD_LABEL='1.2.0';
const LOCAL_SERVER_MODE=true||location.protocol==='file:'||/(?:^|[?&])local=1(?:&|$)/.test(location.search??'');
const AUTHOR_CREDIT='<span lang="ar" dir="rtl">إعداد وتنفيذ: <b>إسماعيل الخطيب</b></span><span aria-hidden="true"> · </span><span lang="en" dir="ltr">ismail alhatip</span>';
const SPEAKER='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4 6 8H2v8h4l5 4zM15 8q5 4 0 8M18 4q10 8 0 16"/></svg>';
const DBKEY=IS_DEMO?'horizons-arabic-level1|demo|1':'horizons-arabic-complete|0.3.0|local-1',AUDIO_REVISION='female-2026-09-24',FORMS=['isolated','initial','medial','final'],LANGS=["en", "ar", "tr", "fr", "es", "de", "it", "pt", "nl", "ru", "uk", "pl", "cs", "ro", "hu", "el", "sv", "da", "no", "fi", "bg", "sr", "hr", "he", "fa", "ur", "hi", "bn", "id", "ms", "zh", "ja"];
let course,chapters={},guideBank={},sceneIndex={},data,alphabet,dict,audioIndex={},traces,state,locale='ar',audio=new Audio(),playing='',heardQuestion=false,answer='',feedback='',observer,activePointer,toastTimer,savingError=false;
const TYPOGRAPHY_KEY='horizons.typography|1';
const TYPOGRAPHY_SIZES=[90,100,115,130,145];
const TYPOGRAPHY_DEFAULT=Object.freeze({font:'noto-naskh',size:2});
const TYPOGRAPHY_FONTS=Object.freeze([
 {id:'noto-naskh',label:'Noto Naskh Arabic',arLabel:'نوتو نسخ عربي',family:'"HZN Noto Naskh Arabic",serif'},
 {id:'amiri',label:'Amiri',arLabel:'أميري',family:'"HZN Amiri",serif'},
 {id:'scheherazade',label:'Scheherazade',arLabel:'شهرزاد',family:'"HZN Scheherazade",serif'},
 {id:'noto-sans',label:'Noto Sans Arabic',arLabel:'نوتو سانس عربي',family:'"HZN Noto Sans Arabic",sans-serif'},
 {id:'noto-kufi',label:'Noto Kufi Arabic',arLabel:'نوتو كوفي عربي',family:'"HZN Noto Kufi Arabic",sans-serif'}
]);
const TYPOGRAPHY_VARIABLES=Object.freeze({
 ui:'--reader-ui-size',chapterLetter:'--reader-chapter-letter-size',chapterName:'--reader-chapter-name-size',alphabetCard:'--reader-alphabet-card-size',letterNameSmall:'--reader-letter-name-small-size',letterName:'--reader-letter-name-size',letterOrbit:'--reader-letter-orbit-size',miniForm:'--reader-mini-form-size',choiceLetter:'--reader-choice-letter-size',matchLetter:'--reader-match-letter-size',vocabWord:'--reader-vocab-word-size',sentence:'--reader-sentence-size',stripWord:'--reader-strip-word-size',position:'--reader-position-size',story:'--reader-story-size',storyQuestion:'--reader-story-question-size',form:'--reader-form-size',traceExample:'--reader-trace-example-size',vowel:'--reader-vowel-size'
});
const TYPOGRAPHY_BASE=Object.freeze({
 desktop:Object.freeze({ui:18,chapterLetter:67,chapterName:22,alphabetCard:43,letterNameSmall:15,letterName:26,letterOrbit:125,miniForm:34,choiceLetter:78,matchLetter:82,vocabWord:76,sentence:28,stripWord:23,position:26,story:31,storyQuestion:26,form:45,traceExample:37,vowel:28}),
 mobile:Object.freeze({ui:18,chapterLetter:55,chapterName:20,alphabetCard:35,letterNameSmall:13,letterName:24,letterOrbit:96,miniForm:35,choiceLetter:65,matchLetter:80,vocabWord:63,sentence:27,stripWord:20,position:26,story:28,storyQuestion:24,form:38,traceExample:34,vowel:26})
});
function validTypographyPrefs(value){return value&&typeof value==='object'&&value.schemaVersion===1&&TYPOGRAPHY_FONTS.some(font=>font.id===value.font)&&Number.isInteger(value.size)&&value.size>=0&&value.size<TYPOGRAPHY_SIZES.length}
let typographyStorageReadable=true;
function loadTypographyPrefs(fallback=TYPOGRAPHY_DEFAULT){if(!typographyStorageReadable)return {font:fallback.font,size:fallback.size};try{const value=JSON.parse(localStorage.getItem(TYPOGRAPHY_KEY));if(validTypographyPrefs(value))return {font:value.font,size:value.size}}catch{typographyStorageReadable=false}return {font:fallback.font,size:fallback.size}}
let typography=loadTypographyPrefs();
function typographyFont(){return TYPOGRAPHY_FONTS.find(font=>font.id===typography.font)??TYPOGRAPHY_FONTS[0]}
function typographyAccessibleFontName(font=typographyFont()){return locale==='ar'?font.arLabel:font.label}
function typographySizeLabel(size=TYPOGRAPHY_SIZES[typography.size]){if(locale==='ar')return String(size).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d])+'٪';if(locale==='tr')return '%'+size;if(locale==='fr'||locale==='es')return size+' %';return size+'%'}
function persistTypographyPrefs(){try{localStorage.setItem(TYPOGRAPHY_KEY,JSON.stringify({schemaVersion:1,font:typography.font,size:typography.size}));typographyStorageReadable=true}catch{typographyStorageReadable=false;notice(t('saveError'))}}
function updateTypographyUi(){
 const font=typographyFont(),size=TYPOGRAPHY_SIZES[typography.size],sizeLabel=typographySizeLabel(size);
 const toolbar=$('#typography-toolbar');
 if(toolbar){toolbar.setAttribute('aria-label',t('typographyTitle'));$('#typography-toolbar-title').textContent=t('typographyTitle');$('#typography-font-label').textContent=t('fontLabel');$('#typography-font').setAttribute('aria-label',t('fontLabel'));$('#typography-decrease').setAttribute('aria-label',t('decreaseText'));$('#typography-increase').setAttribute('aria-label',t('increaseText'));$('#typography-reset').setAttribute('aria-label',t('resetTypography'));$('#typography-reset-label').textContent=t('resetTypography');$('#typography-size-controls').setAttribute('aria-label',t('textSize'));$('#typography-size').value=size;$('#typography-size').textContent=sizeLabel;$('#typography-font').value=font.id;$('#typography-decrease').disabled=typography.size===0;$('#typography-increase').disabled=typography.size===TYPOGRAPHY_SIZES.length-1;}
 $$('select[data-typography-font]').forEach(select=>select.value=font.id);
 $$('[data-font-choice]').forEach(button=>{const choice=TYPOGRAPHY_FONTS.find(item=>item.id===button.dataset.fontChoice);const selected=button.dataset.fontChoice===font.id;button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',t('fontChoiceLabel',{font:choice?typographyAccessibleFontName(choice):''}))});
 $$('[data-typography-action="decrease"]').forEach(button=>{button.disabled=typography.size===0;button.setAttribute('aria-label',t('decreaseText'))});
 $$('[data-typography-action="increase"]').forEach(button=>{button.disabled=typography.size===TYPOGRAPHY_SIZES.length-1;button.setAttribute('aria-label',t('increaseText'))});
 $$('[data-typography-action="reset"]').forEach(button=>button.setAttribute('aria-label',t('resetTypography')));
 $$('span[data-typography-size]').forEach(output=>{output.value=size;output.textContent=sizeLabel});
}
function announceTypography(){const message=t('typographyStatus',{font:typographyAccessibleFontName(),size:TYPOGRAPHY_SIZES[typography.size]});const live=$('#typography-live'),settingsStatus=$('#typography-settings-status');if(live){live.textContent='';requestAnimationFrame(()=>live.textContent=message)}if(settingsStatus)settingsStatus.textContent=message}
function applyTypography({persist=false,announce=false}={}){
 const font=typographyFont(),scale=TYPOGRAPHY_SIZES[typography.size]/100,base=matchMedia('(max-width:760px)').matches?TYPOGRAPHY_BASE.mobile:TYPOGRAPHY_BASE.desktop,root=document.documentElement;
 root.dataset.typographyFont=font.id;root.dataset.typographySize=String(typography.size);root.style.setProperty('--arabic-reading-font',font.family);
 for(const [name,property] of Object.entries(TYPOGRAPHY_VARIABLES))root.style.setProperty(property,(Math.round(base[name]*scale*10)/10)+'px');
 if(persist)persistTypographyPrefs();updateTypographyUi();if(announce)announceTypography();
}
function changeTypographySize(delta){const stored=loadTypographyPrefs(typography);typography={font:stored.font,size:Math.max(0,Math.min(TYPOGRAPHY_SIZES.length-1,stored.size+delta))};applyTypography({persist:true,announce:true})}
function changeTypographyFont(id){if(!TYPOGRAPHY_FONTS.some(font=>font.id===id))return;const stored=loadTypographyPrefs(typography);typography={font:id,size:stored.size};applyTypography({persist:true,announce:true})}
function resetTypography(){typography={...TYPOGRAPHY_DEFAULT};applyTypography({persist:true,announce:true})}
function bindTypographyControls(root=document){
 root.querySelectorAll('select[data-typography-font]').forEach(select=>select.onchange=()=>changeTypographyFont(select.value));
 root.querySelectorAll('[data-font-choice]').forEach(button=>button.onclick=()=>changeTypographyFont(button.dataset.fontChoice));
 root.querySelectorAll('[data-typography-action]').forEach(button=>button.onclick=()=>{if(button.dataset.typographyAction==='decrease')changeTypographySize(-1);else if(button.dataset.typographyAction==='increase')changeTypographySize(1);else resetTypography()});
}
function ensureTypographyToolbar(){
 if($('#typography-toolbar'))return;
 const toolbar=document.createElement('section');toolbar.id='typography-toolbar';toolbar.className='typography-toolbar';toolbar.setAttribute('role','region');
 toolbar.innerHTML=`<strong id="typography-toolbar-title" class="typography-toolbar-title"></strong><div class="typography-control"><label id="typography-font-label" for="typography-font"></label><select id="typography-font" data-typography-font dir="ltr">${TYPOGRAPHY_FONTS.map(font=>`<option value="${font.id}" lang="en" dir="ltr">${esc(font.label)}</option>`).join('')}</select></div><div id="typography-size-controls" class="typography-size-controls" role="group"><button id="typography-decrease" data-typography-action="decrease" type="button">A−</button><span id="typography-size" data-typography-size></span><button id="typography-increase" data-typography-action="increase" type="button">A+</button></div><button id="typography-reset" class="typography-reset" data-typography-action="reset" type="button"><span aria-hidden="true">↺</span><span id="typography-reset-label"></span></button><span id="typography-live" class="sr-only" role="status" aria-live="polite"></span>`;
 const credit=document.querySelector('body>.author-credit');(credit??document.querySelector('.topbar')).insertAdjacentElement('afterend',toolbar);bindTypographyControls(toolbar);updateTypographyUi();
}
function typographySettingsSection(){return `<section class="setting-section typography-settings"><h3>${esc(t('typographyTitle'))}</h3><p class="typography-hint">${esc(t('typographyHint'))}</p><div class="font-choice-grid" role="group" aria-label="${esc(t('fontLabel'))}">${TYPOGRAPHY_FONTS.map(font=>`<button type="button" class="font-choice" data-font-choice="${font.id}" style="--choice-font:${esc(font.family)}"><span lang="en" dir="ltr">${esc(font.label)}</span><b class="arabic" lang="ar">أَبْجَدْ</b></button>`).join('')}</div><div class="setting-row"><span>${esc(t('textSize'))}</span><div class="typography-size-controls" role="group" aria-label="${esc(t('textSize'))}"><button type="button" data-typography-action="decrease">A−</button><span data-typography-size></span><button type="button" data-typography-action="increase">A+</button></div></div><p class="typography-preview arabic" lang="ar" dir="rtl">بَابٌ · ظِلٌّ · يَدٌ</p><button type="button" class="secondary" data-typography-action="reset">${esc(t('resetTypography'))}</button><p id="typography-settings-status" class="typography-settings-status" role="status" aria-live="polite"></p></section>`}
function openSettingsWithTypography(){settings();$('#settings-content').insertAdjacentHTML('afterbegin',`<section class="setting-section"><h3>${esc(t('meaningLanguage'))}</h3><p>${esc(t('meaningHelp'))}</p><select id="meaning-language" aria-label="${esc(t('meaningLanguage'))}">${[['ar','العربية'],['en','English'],['tr','Türkçe'],['fr','Français'],['es','Español']].map(([code,label])=>`<option value="${code}" ${code===meaningLocale?'selected':''}>${label}</option>`).join('')}</select></section>`);$('#meaning-language').onchange=()=>{meaningLocale=$('#meaning-language').value;try{localStorage.setItem('horizons-meaning-language',meaningLocale)}catch{}render()};$('#settings-content').insertAdjacentHTML('afterbegin',typographySettingsSection());bindTypographyControls($('#settings-content'));updateTypographyUi()}
const baseUi={alphabet:'الحروف العربية',baa:'حرف الباء',words:'الكلمات',stories:'القصص',write:'تتبّع واكتب',listenName:'استمع إلى الحرف',listenWord:'استمع إلى الكلمة',listenSentence:'استمع إلى الجملة',audioPending:'الصوت قيد التجهيز',saved:'حُفظ التقدم على هذا الجهاز',reviewCopy:'معاينة للمراجعة',previous:'السابق',next:'التالي',showMeaning:'إظهار المعنى',hideMeaning:'إخفاء المعنى',correct:'أحسنت!',retry:'حاول مرة أخرى',listenFirst:'استمع أولًا',initial:'في أول الكلمة',medial:'في وسط الكلمة',final:'في آخر الكلمة',isolated:'منفصل',letterForms:'أشكال الحرف',printSheet:'اطبع ورقة التدريب',undo:'تراجع',clear:'امسح',finished:'أنهيت التدريب',guide:'تغيير المساعدة',exploreLetter:'استكشف الحروف',chooseHeard:'استمع واختر',readTogether:'نقرأ معًا',matching:'طابق الشكل',check:'تحقق',group:'المجموعة {n}',wordOf:'الكلمة {current} من {total}',storyQuestion:'فهم القصة',nextStory:'القصة التالية',localOnly:'التقدم محفوظ على هذا الجهاز فقط.',adultHelp:'إعدادات البالغ',name:'اسم الحرف',nonJoiningNote:'هذا الحرف لا يتصل بالحرف الذي يليه.',alphabetIntro:'تعرف إلى الحروف الثمانية والعشرين، ثم ابدأ رحلة الباء.',alphabetHint:'اختر حرفًا لتراه أكبر وتسمع اسمه.',shortVowels:'الحركات القصيرة',longVowels:'المدود',resetConfirm:'هل تريد مسح التقدم؟',syntheticAudioNote:'ملفات الصوت آلية وتجريبية؛ مراجعة النطق البشرية لم تكتمل.'};
Object.assign(baseUi,{typographyTitle:'وضوح القراءة',fontLabel:'الخط العربي',textSize:'حجم النص',decreaseText:'تصغير النص',increaseText:'تكبير النص',resetTypography:'إعادة ضبط القراءة',typographyHint:'اختر خطًا واضحًا وحجمًا مريحًا. لا تتغيّر أسهم الكتابة أو مساحة التتبّع.',fontChoiceLabel:'استخدم خط {font}',typographyStatus:'الخط {font}، الحجم {size}%'});
const t=(k,p={})=>{let v=dict?.[locale]?.[k]??dict?.en?.[k]??baseUi[k]??k;for(const[a,b]of Object.entries(p))v=String(v).replaceAll('{'+a+'}',b);return v};
let meaningLocale='en';
const meaning=w=>dict?.[meaningLocale]?.word?.[w.id]??{wordMeaning:w.word,sentenceMeaning:w.sentence};
const storyMeaning=s=>dict?.[meaningLocale]?.story?.[s.id]??{title:s.title,lines:s.sentences,question:s.comprehensionTask.question,options:Object.fromEntries(s.comprehensionTask.options.map(o=>[o.id,o.label]))};
const img=(id,kind='word')=>(kind==='sentence'?sceneIndex['sentence.'+id]?.path:null)??sceneIndex[id]?.path??sceneIndex[id]?.png??'course/scenes/pending.svg';
let visualMode='word';
const inkKey=(form=state.form)=>state.chapter+':'+form;
const freshPosition=()=>({tab:'words',word:0,quiz:0,quizMode:'word',story:0,frame:0,form:'isolated'});
const bookmark=()=>Object.fromEntries(Object.keys(freshPosition()).map(k=>[k,state[k]]));
const fresh=()=>({schemaVersion:'3.0',bookId:'horizons-arabic-complete',contentVersion:'0.3.0',audioRevision:AUDIO_REVISION,locale,course:'alphabet',chapter:'baa',...freshPosition(),alphabetMode:'explore',letter:0,meaning:true,guide:true,heard:{},attempts:{},ink:{},written:{},bookmarks:{},updatedAt:new Date().toISOString()});
function valid(s){const obj=x=>x&&typeof x==='object'&&!Array.isArray(x), pos=x=>obj(x)&&['words','quiz','stories','write'].includes(x.tab)&&['word','sentence'].includes(x.quizMode)&&['word','quiz'].every(k=>Number.isInteger(x[k])&&x[k]>=0&&x[k]<20)&&Number.isInteger(x.story)&&x.story>=0&&x.story<2&&Number.isInteger(x.frame)&&x.frame>=0&&x.frame<4&&FORMS.includes(x.form), key=k=>{const [ch,f]=k.split(':');return Object.hasOwn(chapters,ch)&&FORMS.includes(f)&&k===ch+':'+f};return obj(s)&&s.schemaVersion==='3.0'&&s.bookId==='horizons-arabic-complete'&&s.contentVersion==='0.3.0'&&LANGS.includes(s.locale)&&['alphabet','catalog','lesson'].includes(s.course)&&Object.hasOwn(chapters,s.chapter)&&pos(s)&&['explore','quiz','match'].includes(s.alphabetMode)&&Number.isInteger(s.letter)&&s.letter>=0&&s.letter<alphabet.letters.length&&typeof s.meaning==='boolean'&&typeof s.guide==='boolean'&&obj(s.bookmarks)&&Object.entries(s.bookmarks).every(([k,v])=>Object.hasOwn(chapters,k)&&pos(v))&&obj(s.heard)&&Object.keys(s.heard).length<3000&&Object.entries(s.heard).every(([k,v])=>typeof v==='boolean'&&/^(alphabet\.|word\.|sentence\.|story\.)[a-z0-9_-]+$/.test(k))&&obj(s.attempts)&&Object.keys(s.attempts).length<3000&&Object.entries(s.attempts).every(([k,v])=>/^(alpha-|match-|word-|sentence-|story-)[a-z0-9_.-]+$/.test(k)&&obj(v)&&typeof v.completed==='boolean'&&Number.isInteger(v.count)&&v.count>=0&&v.count<100000)&&obj(s.written)&&Object.entries(s.written).every(([k,v])=>key(k)&&typeof v==='boolean')&&obj(s.ink)&&Object.entries(s.ink).every(([k,a])=>key(k)&&Array.isArray(a)&&a.length<=250&&a.every(stroke=>Array.isArray(stroke)&&stroke.length<=1500&&stroke.every(p=>obj(p)&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=560&&p.y>=70&&p.y<=360)))&&Object.values(s.ink).reduce((n,a)=>n+a.reduce((m,b)=>m+b.length,0),0)<=60000;}
function migrateAudioRevision(snapshot){if(snapshot.audioRevision===AUDIO_REVISION)return false;snapshot.audioRevision=AUDIO_REVISION;return true}
async function save(){state.locale=locale;state.updatedAt=new Date().toISOString();const snapshot=structuredClone(state);let checkpointSaved=false;try{localStorage.setItem(DBKEY,JSON.stringify(snapshot));checkpointSaved=true}catch{}try{await put('progress',DBKEY,snapshot);savingError=false}catch{savingError=!checkpointSaved}$('#saved-label').textContent=t(savingError?'saveError':'saved')}
function notice(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500)}
let playbackToken=0,playbackTimer;
function stop(){playbackToken++;clearTimeout(playbackTimer);audio.onended=null;audio.onerror=null;audio.oncanplay=null;audio.pause();try{audio.currentTime=0}catch{}if('speechSynthesis'in window)speechSynthesis.cancel();playing='';$$('[data-audio]').forEach(b=>{b.classList.remove('playing');b.setAttribute('aria-pressed','false')})}
function resetFeedback(){heardQuestion=false;answer='';feedback=''}
function nav(changes){stopPenDemo();stop();visualMode='word';if(state.course==='lesson')state.bookmarks[state.chapter]=bookmark();if(changes.chapter&&changes.chapter!==state.chapter)Object.assign(state,state.bookmarks[changes.chapter]??freshPosition());Object.assign(state,changes);resetFeedback();render();save()}
function audioRecord(key){const a=audioIndex[key];return typeof a==='string'?{path:a}:a}
function audioRejected(a){return a?.status==='rejected_by_owner_unclear_pronunciation'}
const resolveAudioPath=p=>{const raw=String(p??'');if(!raw)return '';const base=new URL(document.baseURI),u=new URL(raw,base);if(base.protocol==='file:'){const folder=new URL('.',base).href;if(u.protocol!=='file:'||!u.href.startsWith(folder))throw Error('Non-local audio URL')}else if(u.origin!==base.origin||!/^https?:$/.test(u.protocol))throw Error('Non-local audio URL');return u.href};
function fallbackText(key){const [kind,id]=String(key).split('.',2);if(kind==='alphabet')return alphabet?.letters?.find(x=>x.id===key)?.spokenNameText??'';if(kind==='word')return data?.words?.find(x=>x.id===id)?.word??'';if(kind==='sentence')return data?.words?.find(x=>x.id===id)?.sentence??'';if(kind==='story'){const m=String(id).match(/^(.+)-([1-4])$/);if(m){const s=data?.microstories?.find(x=>x.id===m[1]);return s?.sentences?.[Number(m[2])-1]??''}}return ''}
function soundButton(key,label,cls='primary',id=''){const a=audioRecord(key),rejected=audioRejected(a);return `<button ${id?`id="${id}"`:''} class="${cls} sound" data-audio="${esc(key)}" ${rejected?'disabled aria-disabled="true"':''}>${SPEAKER}${esc(t(rejected?'audioPending':label))}</button>`}
// Local recordings are deterministic and work without a system speech voice.
// Device speech is opt-in, local-only, and restricted to an ar-SA voice.
// A language tag is not a pronunciation certificate: unreviewed recordings stay drafts.
function allowDeviceVoice(){return false}
function exactLocalArabicVoice(){if(!('speechSynthesis'in window))return null;return speechSynthesis.getVoices().find(v=>v.localService===true&&/^ar[-_]SA$/i.test(v.lang))??null}
async function play(key,callback){
 if(playing===key){stop();return}
 stop();const token=playbackToken,a=audioRecord(key),text=fallbackText(key);if(audioRejected(a)){notice(t('audioPending'));return}playing=key;
 const active=()=>token===playbackToken&&playing===key;
 $$('[data-audio]').forEach(b=>{if(b.dataset.audio===key){b.classList.add('playing');b.setAttribute('aria-pressed','true')}});
 const fail=()=>{if(!active())return;stop();notice(t('audioError'))};
 const finish=()=>{if(!active())return;clearTimeout(playbackTimer);audio.onended=null;audio.onerror=null;state.heard[key]=true;playing='';$$('[data-audio]').forEach(b=>{b.classList.remove('playing');b.setAttribute('aria-pressed','false')});save();updateProgress();callback?.();$$('[data-heard-key]').forEach(el=>{if(state.heard[el.dataset.heardKey])el.classList.add('heard')})};
 const device=()=>{if(!active())return;clearTimeout(playbackTimer);const voice=allowDeviceVoice()?exactLocalArabicVoice():null;if(!voice||!text){fail();return}const u=new SpeechSynthesisUtterance(text);u.lang='ar-SA';u.voice=voice;u.rate=.84;u.onend=finish;u.onerror=fail;speechSynthesis.speak(u);playbackTimer=setTimeout(fail,45000)};
 // Legacy formal/carrier recordings are deliberately NOT used as fallbacks.
 // Only an explicitly reviewed, direct-text fallback may be used in a future build.
 const paths=[a?.path];if(a?.fallbackApproved===true&&a?.fallbackDirectText===true&&a?.fallbackPath)paths.push(a.fallbackPath);
 let i=0;
 const attempt=async()=>{if(!active())return;clearTimeout(playbackTimer);const path=paths[i++];if(!path){device();return}
  audio.onended=null;audio.onerror=null;audio.pause();let transitioned=false;const next=()=>{if(!active()||transitioned)return;transitioned=true;attempt()};
  try{if(location.protocol==='file:')audio.removeAttribute('crossorigin');else audio.crossOrigin='anonymous';audio.preload='auto';audio.src=resolveAudioPath(path);audio.playbackRate=1;audio.preservesPitch=true;audio.onended=finish;audio.onerror=next;audio.load();playbackTimer=setTimeout(next,20000);await audio.play();if(active()){clearTimeout(playbackTimer);playbackTimer=setTimeout(fail,Math.max(15000,((a?.durationSeconds||20)+8)*1000))}}
  catch(e){if(!active())return;if(e.name==='NotAllowedError'){fail();return}if(e.name!=='AbortError')next()}
 };
 await attempt();
}
function bindAudio(extra){$$('[data-audio]').forEach(b=>b.onclick=()=>{if(state.course==='lesson'&&state.tab==='words'){visualMode=b.dataset.audio.startsWith('sentence.')?'sentence':'word';updateWordVisual()}play(b.dataset.audio,()=>{if(b.dataset.audio===extra)heardQuestion=true})});}
function updateProgress(){const playableLetters=state.course==='alphabet'?alphabet.letters.filter(l=>!audioRejected(audioRecord(l.id))):[];const total=state.course==='alphabet'?playableLetters.length:state.course==='catalog'?course.chapters.length*20:20;const pool=state.course==='catalog'?Object.values(chapters).flatMap(c=>c.words):data.words;const count=state.course==='alphabet'?playableLetters.filter(l=>state.heard[l.id]).length:pool.filter(w=>state.heard['word.'+w.id]&&state.heard['sentence.'+w.id]).length;$('#progress-label').textContent=t('heardCount',{count,total});$('#progress-bar').style.width=100*count/total+'%';$('#saved-label').textContent=t(savingError?'saveError':'saved');}
function render(){try{localStorage.setItem('horizons-interface-language',locale)}catch{}stopPenDemo();stop();observer?.disconnect();activePointer=undefined;data=chapters[state.chapter];traces=guideBank[state.chapter];state.ink[inkKey()]??=[];document.documentElement.lang=locale;document.documentElement.dir=['ar','he','fa','ur'].includes(locale)?'rtl':'ltr';$('#locale').value=locale;$('#stages').setAttribute('aria-label',t('activities'));$('#course-nav').setAttribute('aria-label',t('chapters'));$('#language-label').textContent=t('language');$('#locale').setAttribute('aria-label',t('language'));$('#settings-button').setAttribute('aria-label',t('adultHelp'));$('#course-nav').setAttribute('aria-label',t('chapters'));$('#stages').setAttribute('aria-label',t('exploreLetter'));$('.skip').textContent=t('skip');$('#eyebrow').textContent='HORIZONS · ARABIC LEVEL 1 · '+(IS_DEMO?'DEMO · ':'')+BUILD_LABEL;$('#lesson-title').textContent=state.course==='alphabet'?t('alphabet'):state.course==='catalog'?t('courseTitle'):t('letterLesson',{letter:data.letter});$('#lesson-subtitle').textContent=t(state.course==='alphabet'?'alphabetIntro':state.course==='catalog'?'catalogIntro':'chapterIntro');$('#preview-note').textContent=t('releaseNotice');$('#course-nav').innerHTML=`<button data-course="alphabet" aria-pressed="${state.course==='alphabet'}"><span>01</span>${esc(t('alphabet'))}</button><button data-course="catalog" aria-pressed="${state.course!=='alphabet'}"><span>02</span>${esc(t('chapters'))}<small>${course.chapters.length}</small></button>`;$$('[data-course]').forEach(b=>b.onclick=()=>nav({course:b.dataset.course}));const tabs=state.course==='alphabet'?[['explore','exploreLetter'],['quiz','chooseHeard'],['match','matching']]:[['words','words'],['quiz','chooseHeard'],['stories','stories'],['write','write']];$('#stages').hidden=state.course==='catalog';$('#stages').classList.toggle('four',state.course==='lesson');$('#stages').innerHTML=tabs.map(([k,label])=>`<button class="stage ${k===(state.course==='alphabet'?state.alphabetMode:state.tab)?'active':''}" data-tab="${k}" aria-pressed="${k===(state.course==='alphabet'?state.alphabetMode:state.tab)}">${esc(t(label))}</button>`).join('');$$('[data-tab]').forEach(b=>b.onclick=()=>nav(state.course==='alphabet'?{alphabetMode:b.dataset.tab}:{tab:b.dataset.tab}));updateProgress();if(state.course==='alphabet')renderAlphabet();else if(state.course==='catalog')renderCatalog();else if(state.tab==='words')renderWords();else if(state.tab==='quiz')renderQuiz();else if(state.tab==='stories')renderStory();else renderTrace();$('.lesson-footer').hidden=state.course==='catalog';$('#previous').textContent=t('previous');$('#next').textContent=t('next');$('#previous').disabled=state.course==='alphabet'&&state.letter===0;$('#previous').onclick=()=>move(-1);$('#next').onclick=()=>move(1);$('#page-label').textContent=state.course==='alphabet'?`${state.letter+1} / ${alphabet.letters.length}`:state.tab==='words'||state.tab==='quiz'?t('wordOf',{current:(state.tab==='words'?state.word:state.quiz)+1,total:20}):state.tab==='stories'?`${state.story+1} / 2 · ${state.frame+1} / 4`:`${FORMS.indexOf(state.form)+1} / 4`;}
function renderCatalog(){$('#activity').innerHTML=`<div class="activity-header"><div><h2>${esc(t('chooseChapter'))}</h2><p>${esc(t('catalogHint'))}</p></div><span class="pill">${course.chapters.length} · ${course.chapters.length*20}</span></div><div class="chapter-grid" dir="rtl">${course.chapters.map((c,i)=>{const n=chapters[c.id].words.filter(w=>state.heard['word.'+w.id]&&state.heard['sentence.'+w.id]).length;return `<button data-chapter="${c.id}" class="chapter-card ${state.chapter===c.id?'current':''}"><span class="chapter-number">${String(i+1).padStart(2,'0')}</span><span class="chapter-letter arabic" lang="ar">${c.letter}</span><b class="arabic" lang="ar">${c.nameAr}</b><small dir="${['ar','he','fa','ur'].includes(locale)?'rtl':'ltr'}">${esc(t('chapterCard'))}</small><span class="chapter-meter"><i style="width:${n*5}%"></i></span><small dir="${['ar','he','fa','ur'].includes(locale)?'rtl':'ltr'}">${esc(t('heardCount',{count:n,total:20}))}</small></button>`}).join('')}</div>`;$$('[data-chapter]').forEach(b=>b.onclick=()=>nav({chapter:b.dataset.chapter,course:'lesson'}));}
function move(delta){if(state.course==='alphabet'){const n=state.letter+delta;if(n>=alphabet.letters.length)nav({course:'catalog'});else nav({letter:Math.max(0,n)});return}if(state.tab==='words'){const n=state.word+delta;if(n>19)nav({tab:'quiz',quiz:0});else if(n<0)nav({course:'alphabet'});else nav({word:n});}else if(state.tab==='quiz'){const n=state.quiz+delta;if(n>19)nav({tab:'stories',story:0,frame:0});else if(n<0)nav({tab:'words',word:19});else nav({quiz:n});}else if(state.tab==='stories'){const n=state.story*4+state.frame+delta;if(n>7)nav({tab:'write'});else if(n<0)nav({tab:'quiz',quiz:19});else nav({story:Math.floor(n/4),frame:n%4});}else{const n=FORMS.indexOf(state.form)+delta;if(n>3){nav({course:'catalog'});return}if(n<0)nav({tab:'stories',story:1,frame:3});else nav({form:FORMS[n]});}}
function lettersGrid(){return `<div class="alphabet-grid" dir="rtl">${alphabet.letters.map((l,i)=>`<button class="letter-card ${state.letter===i?'selected':''} ${!audioRejected(audioRecord(l.id))&&state.heard[l.id]?'heard':''}" data-letter="${i}" data-heard-key="${l.id}" lang="ar" dir="rtl" aria-label="${esc(l.spokenNameText)}" aria-pressed="${state.letter===i}"><span class="arabic" lang="ar">${l.letter}</span><small lang="ar">${l.spokenNameText}</small></button>`).join('')}</div>`}
function renderAlphabet(){
 const l=alphabet.letters[state.letter],mode=state.alphabetMode;
 const unavailable=mode==='quiz'&&audioRejected(audioRecord(l.id));
 const count=alphabet.letters.length;
 const options=[...new Set((count<8?[0,1,2]:[0,7,15]).map(n=>(state.letter+n)%count))].sort((a,b)=>((a+state.letter*5)%count)-((b+state.letter*5)%count));
 const show=l.displayForms,feedbackKey=unavailable?'audioPending':feedback;
 $('#activity').innerHTML=mode==='explore'
  ?`<div class="activity-header"><div><h2>${esc(t('exploreLetter'))}</h2><p>${esc(t('alphabetHint'))}</p></div><button id="print-alphabet" class="secondary">${esc(t('printSheet'))} ↗</button></div><div class="alphabet-layout">${lettersGrid()}<div class="letter-focus"><span class="letter-orbit arabic" lang="ar">${l.letter}</span><h2 class="arabic" lang="ar">${l.spokenNameText}</h2>${soundButton(l.id,'listenName')}<div class="mini-forms" dir="rtl">${FORMS.map(f=>`<div><span class="arabic" lang="ar">${show[f]}</span><small>${esc(t(f))}</small></div>`).join('')}</div>${l.joiningType==='right_only'?`<p class="joining-note">${esc(t('nonJoiningNote'))}</p>`:''}${l.id==='alphabet.alif'?`<p class="joining-note">${esc(t('alifNote'))}</p>`:''}<button class="text-button" id="go-baa">${esc(t('startLetter',{letter:l.letter}))} ←</button></div></div>`
  :`<div class="activity-header"><div><h2>${esc(t(mode==='quiz'?'chooseHeard':'matching'))}</h2><p>${esc(t(mode==='quiz'?'alphabetQuizHint':'matchHint'))}</p></div><span class="pill">${state.letter+1} / ${alphabet.letters.length}</span></div><div class="letter-question">${mode==='quiz'?soundButton(l.id,'listenName'):`<span class="match-model arabic" lang="ar">${l.letter}</span>`}</div><div class="alpha-choices" dir="rtl">${options.map(i=>`<button data-letter-answer="${i}" class="alpha-choice arabic ${answer===String(i)?i===state.letter?'correct':'wrong':''}" lang="ar" aria-label="${esc(alphabet.letters[i].spokenNameText)}" ${unavailable?'disabled aria-disabled="true"':''}>${alphabet.letters[i].letter}</button>`).join('')}</div><p class="feedback" role="status">${feedbackKey?esc(t(feedbackKey)):''}</p>${unavailable||state.attempts[(mode==='quiz'?'alpha-':'match-')+l.id]?.completed?`<button id="continue-alpha" class="primary">${esc(t('next'))} ←</button>`:''}`;
 bindAudio(l.id);
 $$('[data-letter]').forEach(b=>b.onclick=()=>{nav({letter:+b.dataset.letter});play(alphabet.letters[state.letter].id)});
 $$('[data-letter-answer]').forEach(b=>b.onclick=()=>{
  if(unavailable){feedback='audioPending';renderAlphabet();return}
  if(mode==='quiz'&&!unavailable&&!heardQuestion){feedback='listenFirst';renderAlphabet();return}
  answer=b.dataset.letterAnswer;const correct=+answer===state.letter;record((mode==='quiz'?'alpha-':'match-')+l.id,correct);feedback=correct?'correct':'retry';renderAlphabet();
 });
 if($('#continue-alpha'))$('#continue-alpha').onclick=()=>move(1);
 if($('#go-baa'))$('#go-baa').onclick=()=>nav({course:'lesson',chapter:l.id.split('.')[1]});
 if($('#print-alphabet'))$('#print-alphabet').onclick=()=>printAlphabet();
}
function groupNav(current){return `<div class="group-nav" role="group" aria-label="${esc(t('words'))}">${[0,1,2,3].map(n=>`<button data-group="${n}" aria-pressed="${Math.floor(current/5)===n}">${esc(t('group',{n:n+1}))}<small>${n*5+1}–${n*5+5}</small></button>`).join('')}</div>`;}
function updateWordVisual(){
 const scene=$('#word-scene-image');if(!scene)return;const w=data.words[state.word],m=meaning(w);scene.src=img(w.id,visualMode);scene.alt=visualMode==='sentence'?m.sentenceMeaning:m.wordMeaning;
 $$('[data-visual-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.visualMode===visualMode)));
}
function renderWords(){const w=data.words[state.word],m=meaning(w),start=Math.floor(state.word/5)*5;$('#activity').innerHTML=`<div class="activity-header"><div><h2>${esc(t('words'))}</h2><p>${esc(t('wordHint'))}</p></div><span class="pill">${esc(t('wordOf',{current:state.word+1,total:20}))}</span></div>${groupNav(state.word)}<div class="word-scene-layout"><div class="illustration-panel"><div class="visual-switch media-switch" role="group" aria-label="${esc(t('illustrations'))}"><button data-visual-mode="word" aria-pressed="${visualMode==='word'}"><img src="${img(w.id)}" alt="">${esc(t('wordPicture'))}</button><button data-visual-mode="sentence" aria-pressed="${visualMode==='sentence'}"><img src="${img(w.id,'sentence')}" alt="">${esc(t('sentencePicture'))}</button></div><div class="sentence-scene"><img id="word-scene-image" src="${img(w.id,visualMode)}" alt="${esc(visualMode==='sentence'?m.sentenceMeaning:m.wordMeaning)}" width="1000" height="1000" fetchpriority="high"></div></div><div class="vocab-panel"><p class="vocab-word arabic" lang="ar" dir="rtl">${lessonText(w.word)}</p>${state.meaning&&locale!=='ar'?`<p class="translation">${esc(m.wordMeaning)}</p>`:''}${soundButton('word.'+w.id,'listenWord')}<div class="sentence-block"><p class="sentence arabic" lang="ar" dir="rtl">${lessonText(w.sentence)}</p>${state.meaning&&locale!=='ar'?`<p class="translation">${esc(m.sentenceMeaning)}</p>`:''}${soundButton('sentence.'+w.id,'listenSentence','secondary')}</div>${locale!=='ar'?`<button class="text-button" id="meaning-toggle">${esc(t(state.meaning?'hideMeaning':'showMeaning'))}</button>`:''}<div class="position-tags">${w.targetOccurrences.map(o=>`<span><b class="arabic" lang="ar">${o.displayShape}</b>${esc(t(o.positionInWord))}</span>`).join('')}</div></div></div><div class="vocab-strip" dir="rtl">${data.words.slice(start,start+5).map((x,i)=>`<button data-word="${start+i}" class="${state.word===start+i?'selected':''}" aria-pressed="${state.word===start+i}"><img src="${img(x.id)}" alt="" loading="lazy"><span class="arabic" lang="ar">${lessonText(x.word)}</span><i class="${state.heard['word.'+x.id]&&state.heard['sentence.'+x.id]?'heard':''}" aria-hidden="true"></i></button>`).join('')}</div><div class="section-bottom"><p>${esc(t('readTogether'))}</p>${LOCAL_SERVER_MODE?'':`<button id="cache-chapter" class="secondary">${esc(t('chapterDownload'))}</button>`}<button id="word-print" class="text-button">${esc(t('printWords'))} ↗</button></div>`;
 bindAudio();$$('[data-group]').forEach(b=>b.onclick=()=>nav({word:+b.dataset.group*5}));$$('[data-word]').forEach(b=>b.onclick=()=>nav({word:+b.dataset.word}));$$('[data-visual-mode]').forEach(b=>b.onclick=()=>{visualMode=b.dataset.visualMode;updateWordVisual()});if($('#meaning-toggle'))$('#meaning-toggle').onclick=()=>{state.meaning=!state.meaning;render();save()};$('#word-print').onclick=()=>printWords();if($('#cache-chapter'))$('#cache-chapter').onclick=()=>downloadOffline(state.chapter,$('#cache-chapter'));}
function record(id,correct){const old=state.attempts[id]??{count:0,completed:false};state.attempts[id]={count:old.count+1,completed:old.completed||correct};save()}
function renderQuiz(){const w=data.words[state.quiz],key=state.quizMode+'.'+w.id;const choices=[state.quiz,(state.quiz+7)%20,(state.quiz+13)%20];const offset=state.quiz%3;const options=choices.slice(offset).concat(choices.slice(0,offset));$('#activity').innerHTML=`<div class="activity-header"><div><h2>${esc(t('chooseHeard'))}</h2><p>${esc(t('quizHint'))}</p></div><span class="pill">${state.quiz+1} / 20</span></div><div class="visual-switch quiz-switch"><button data-quiz-mode="word" aria-pressed="${state.quizMode==='word'}">${esc(t('listenWord'))}</button><button data-quiz-mode="sentence" aria-pressed="${state.quizMode==='sentence'}">${esc(t('listenSentence'))}</button></div><div class="quiz-audio">${soundButton(key,state.quizMode==='word'?'listenWord':'listenSentence')}</div><div class="sentence-choices">${options.map(i=>`<button data-answer="${i}" class="choice ${answer===String(i)?i===state.quiz?'correct':'wrong':''}" aria-label="${esc(meaning(data.words[i])[state.quizMode==='word'?'wordMeaning':'sentenceMeaning'])}"><img src="${img(data.words[i].id,state.quizMode)}" alt="" width="1000" height="750"><span class="choice-result">${answer===String(i)?i===state.quiz?'✓':'↺':''}</span></button>`).join('')}</div><p class="feedback" role="status">${feedback?esc(t(feedback)):''}</p>${state.attempts[state.quizMode+'-'+w.id]?.completed?`<div class="quiz-audio"><button id="continue-quiz" class="primary">${esc(t('next'))} ←</button></div>`:''}`;bindAudio(key);$$('[data-quiz-mode]').forEach(b=>b.onclick=()=>nav({quizMode:b.dataset.quizMode}));$$('[data-answer]').forEach(b=>b.onclick=()=>{if(!heardQuestion){feedback='listenFirst';renderQuiz();return}answer=b.dataset.answer;const correct=+answer===state.quiz;record(state.quizMode+'-'+w.id,correct);feedback=correct?'correct':'retry';renderQuiz()});if($('#continue-quiz'))$('#continue-quiz').onclick=()=>move(1);}
function renderStory(){const s=data.microstories[state.story],m=storyMeaning(s),q=s.comprehensionTask;$('#activity').innerHTML=`<div class="activity-header"><div><h2 class="arabic" lang="ar" dir="rtl">${lessonText(s.title)}</h2>${locale!=='ar'?`<p>${esc(m.title)}</p>`:''}</div><div class="visual-switch">${data.microstories.map((x,i)=>`<button data-story="${i}" aria-pressed="${state.story===i}">${i+1}</button>`).join('')}</div></div><div class="story-layout"><div class="story-picture"><img src="${img(s.id+'-'+(state.frame+1))}" alt="${esc(m.lines[state.frame])}" width="1000" height="750"></div><div class="story-text"><span class="pill">${state.frame+1} / 4</span><p class="story-sentence arabic" lang="ar" dir="rtl">${lessonText(s.sentences[state.frame])}</p>${state.meaning&&locale!=='ar'?`<p class="translation">${esc(m.lines[state.frame])}</p>`:''}${soundButton('story.'+s.id+'-'+(state.frame+1),'listenSentence')}<div class="story-steps">${s.sentences.map((x,i)=>`<button data-frame="${i}" aria-label="${esc(t('sceneNumber',{n:i+1}))}" aria-current="${state.frame===i?'step':'false'}">${i+1}</button>`).join('')}</div><p>${esc(t('readTogether'))}</p></div></div>${state.frame===3?`<div class="story-question"><h3>${esc(t('storyQuestion'))}</h3><p class="arabic" lang="ar" dir="rtl">${lessonText(q.question)}</p>${locale!=='ar'?`<p>${esc(m.question)}</p>`:''}<div class="story-options">${q.options.map(o=>`<button data-story-answer="${o.id}" class="secondary ${answer===o.id?o.id===q.correctOptionId?'correct':'wrong':''}">${o.wordIds.map(id=>`<img src="${img(id)}" alt="${esc(meaning(data.words.find(w=>w.id===id)).wordMeaning)}">`).join('')}</button>`).join('')}</div><p class="feedback" role="status">${feedback?esc(t(feedback)):''}</p></div>`:''}`;bindAudio();$$('[data-story]').forEach(b=>b.onclick=()=>nav({story:+b.dataset.story,frame:0}));$$('[data-frame]').forEach(b=>b.onclick=()=>nav({frame:+b.dataset.frame}));$$('[data-story-answer]').forEach(b=>b.onclick=()=>{answer=b.dataset.storyAnswer;const correct=answer===q.correctOptionId;record('story-'+s.id,correct);feedback=correct?'correct':'retry';renderStory()});}
function traceSvg(form,guide=true){return buildPenSvg(traces.forms[form],{guide,locale,title:t('write')+' · '+t(form)});}
function renderTrace(){const f=traces.forms[state.form];$('#activity').innerHTML=`<div class="activity-header"><div><h2>${esc(t('write'))}</h2><p>${esc(t('traceHint'))}</p></div><button id="print-writing" class="secondary">${esc(t('printSheet'))} ↗</button></div><div class="form-tabs">${FORMS.map(x=>`<button data-form="${x}" aria-pressed="${state.form===x}"><span class="arabic" lang="ar">${esc(traces.forms[x].display??traces.forms[x].label)}</span><small>${esc(t(x))}</small>${state.written[inkKey(x)]?'<i>✓</i>':''}</button>`).join('')}</div><div class="trace-example"><span class="arabic" lang="ar" dir="rtl">${lessonText(f.example)}</span><p>${esc(formNote(state.form))}</p><p class="trace-direction">${esc(t('penGuideHint'))}</p></div><div class="trace-wrap">${traceSvg(state.form,state.guide)}<canvas id="ink" tabindex="0" aria-label="${esc(t('write'))}"></canvas></div><div class="pen-demo-tools"><button id="play-pen" class="secondary" aria-pressed="false" ${state.guide?'':'disabled'}>${esc(t('penPlay'))}</button><button id="step-pen" class="secondary" ${state.guide?'':'disabled'}>${esc(t('penNext'))}</button><span id="pen-status" role="status" aria-live="polite"></span></div><div class="trace-tools"><button id="undo" class="secondary">${esc(t('undo'))}</button><button id="clear" class="secondary">${esc(t('clear'))}</button><button id="guide" class="secondary">${esc(t('guide'))}</button><button id="finish-writing" class="primary">${esc(t('finished'))}</button></div><div class="vowel-cards"><div><span>${esc(t('shortVowels'))}</span><b class="arabic" lang="ar">${esc(vowels().short)}</b></div><div><span>${esc(t('longVowels'))}</span><b class="arabic" lang="ar">${esc(vowels().long)}</b></div></div><p class="trace-note">${esc(t('traceNoScore'))}</p>`;$$('[data-form]').forEach(b=>b.onclick=()=>nav({form:b.dataset.form}));let traceHistory=state.ink[inkKey()].map(()=>({kind:'manual'})),penDemo;
 const stopWriting=()=>{penDemo?.stop();if(activePointer!==undefined){activePointer=undefined;save()}};
 $('#undo').onclick=()=>{
  stopWriting();
  const last=traceHistory.at(-1);
  if(last?.kind==='demo')penDemo.undo();
  else if(last){traceHistory.pop();state.ink[inkKey()].pop();draw();save()}
 };
 $('#clear').onclick=()=>{
  stopWriting();
  confirmAction(t('clearConfirm'),()=>{penDemo?.clear();state.ink[inkKey()]=[];traceHistory=[];draw();save()});
 };$('#guide').onclick=()=>{state.guide=!state.guide;render();save()};$('#finish-writing').onclick=()=>{state.written[inkKey()]=true;render();save();notice(t('finished'))};$('#print-writing').onclick=()=>printWriting();setupCanvas(()=>traceHistory.push({kind:'manual'}));penDemo=attachPenDemo({
 onStroke:index=>traceHistory.push({kind:'demo',index}),
 onReset:()=>{traceHistory=traceHistory.filter(action=>action.kind!=='demo')},
 onUndo:index=>{for(let at=traceHistory.length-1;at>=0;at--){const action=traceHistory[at];if(action.kind==='demo'&&action.index===index){traceHistory.splice(at,1);break}}},
 svg:$('.trace-wrap .pen-guide'),playButton:$('#play-pen'),stepButton:$('#step-pen'),status:$('#pen-status'),labels:{play:t('penPlay'),stop:t('penStop'),step:t('penStep'),ready:t(state.guide?'penReady':'penHidden')}});}
function setupCanvas(onStroke=()=>{}){const c=$('#ink');let pointCount=0;const totalPoints=()=>Object.values(state.ink).reduce((n,a)=>n+a.reduce((m,s)=>m+s.length,0),0);const point=e=>{const r=c.getBoundingClientRect();return{x:Math.round(Math.max(0,Math.min(560,(e.clientX-r.left)/r.width*560))*10)/10,y:Math.round(Math.max(70,Math.min(360,70+(e.clientY-r.top)/r.height*290))*10)/10}};c.onpointerdown=e=>{stopPenDemo();pointCount=totalPoints();if(pointCount>=60000){notice(t('inkLimit'));return}if(activePointer!==undefined||e.button>0||state.ink[inkKey()].length>=250)return;e.preventDefault();activePointer=e.pointerId;c.setPointerCapture(activePointer);state.ink[inkKey()].push([point(e)]);onStroke();pointCount++;draw()};c.onpointermove=e=>{if(e.pointerId!==activePointer)return;e.preventDefault();const stroke=state.ink[inkKey()].at(-1);if(stroke&&stroke.length<1500&&pointCount<60000){stroke.push(point(e));pointCount++}draw()};const end=e=>{if(e.pointerId!==activePointer)return;activePointer=undefined;save()};c.onpointerup=end;c.onpointercancel=end;c.onlostpointercapture=end;observer=new ResizeObserver(draw);observer.observe(c);draw();}
function draw(){const c=$('#ink');if(!c)return;const r=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,3);c.width=Math.round(r.width*dpr);c.height=Math.round(r.height*dpr);const ctx=c.getContext('2d');ctx.scale(c.width/560,c.height/290);ctx.translate(0,-70);ctx.strokeStyle='#0b253b';ctx.fillStyle='#0b253b';ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';for(const stroke of state.ink[inkKey()]){if(!stroke.length)continue;if(stroke.length===1){ctx.beginPath();ctx.arc(stroke[0].x,stroke[0].y,3,0,Math.PI*2);ctx.fill()}else{ctx.beginPath();ctx.moveTo(stroke[0].x,stroke[0].y);for(const p of stroke.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke()}}}
function confirmAction(message,fn){$('#confirm-title').textContent=t('confirm');$('#confirm-message').textContent=message;$('#confirm-cancel').textContent=t('cancel');$('#confirm-yes').textContent=t('confirm');$('#confirm-dialog').showModal();$('#confirm-cancel').onclick=()=>$('#confirm-dialog').close();$('#confirm-yes').onclick=()=>{$('#confirm-dialog').close();fn()}}
function download(data,name,type){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000)}
function settings(){stopPenDemo();stop();$('#settings-title').textContent=t('adultHelp');$('#close-settings').setAttribute('aria-label',t('close'));$('#settings-content').innerHTML=`<section class="setting-section"><h3>${esc(t('localOnly'))}</h3><p>${esc(t('storageNote'))}</p><button id="export-progress" class="secondary">${esc(t('exportProgress'))}</button><button id="restore-progress" class="secondary">${esc(t('importProgress'))}</button><button id="reset-progress" class="text-button">${esc(t('resetProgress'))}</button></section><section class="setting-section"><h3>${esc(t('offlineTitle'))}</h3><p>${esc(t(LOCAL_SERVER_MODE?'localServerReady':'offlineNote'))}</p>${LOCAL_SERVER_MODE?'':`<button id="cache-all" class="primary">${esc(t('downloadAll'))}</button>`}<p id="offline-progress" role="status"></p></section><section class="setting-section"><h3>${esc(t('printSheet'))}</h3><p>${esc(t('currentPrintNotice'))}</p><div class="print-actions"><button id="print-all-writing" class="secondary">${esc(t('printAllWriting'))}</button><button id="print-all-alphabet" class="secondary">${esc(t('printAlphabet'))}</button></div></section><section class="setting-section"><h3>${esc(t('aboutWorkbook'))}</h3><p>${esc(t('scopeNote'))}</p><p>${esc(t('releaseScope'))}</p><p>${esc(t('voiceUpdate'))}</p><p>${esc(t('privacyBrief'))}</p><p><a href="guides/${locale}.html" target="_blank">${esc(t('releaseHelp'))}</a> · <a href="guides/${locale}.html#privacy" target="_blank">${esc(t('releasePolicy'))}</a></p><p>${esc(t('readTogether'))}</p><p>${esc(t('joiningHelp'))}</p><p><a href="course/CREDITS.txt" target="_blank">${esc(t('credits'))}</a></p></section><p class="author-credit dialog-author">${AUTHOR_CREDIT}</p>`;$('#settings').showModal();$('#print-all-writing').onclick=()=>printAllWriting();$('#print-all-alphabet').onclick=()=>printAlphabet();if($('#cache-all'))$('#cache-all').onclick=()=>downloadOffline('all',$('#cache-all'));$('#export-progress').onclick=()=>download(JSON.stringify(state,null,2),IS_DEMO?'HORIZONS-Demo-progress.json':'HORIZONS-Level1-progress.json','application/json');$('#restore-progress').onclick=()=>$('#progress-input').click();$('#reset-progress').onclick=()=>confirmAction(t('resetConfirm'),()=>{state=fresh();render();save();$('#settings').close()});}
async function downloadOffline(group,button){if(LOCAL_SERVER_MODE){notice(t('localServerReady'));return}if(button)button.disabled=true;const status=$('#offline-progress');try{await prepareOffline(group,({done,total})=>{const msg=t('offlineProgress',{done,total});if(status)status.textContent=msg;if(button)button.textContent=msg});notice(t(group==='all'?'offlineAllReady':'offlineReady'));if(status)status.textContent=t('offlineAllReady')}catch(e){const key=e.code==='LOCAL_SERVER'?'localServerReady':e.code==='UNSUPPORTED'?'offlineUnsupported':e.code==='UPDATE_REQUIRED'?'offlineUpdateRequired':'offlineFailed';notice(t(key));if(status)status.textContent=t(key)}finally{if(button){button.disabled=false;button.textContent=t(group==='all'?'downloadAll':'chapterDownload')}}}
function sheetHead(title){return `<header class="worksheet-head"><div class="worksheet-brand"><b>HORIZONS</b><p class="print-author">${AUTHOR_CREDIT}</p></div><h1>${esc(title)}</h1></header>`}
async function printHtml(html){
 stopPenDemo();stop();$('#settings').close();const sheet=$('#print-sheet');sheet.innerHTML=html;sheet.dir=['ar','he','fa','ur'].includes(locale)?'rtl':'ltr';sheet.lang=locale;sheet.className='expanded-print';
 await document.fonts.ready;const imgs=[...sheet.querySelectorAll('img')];await Promise.all(imgs.map(im=>im.complete?Promise.resolve():new Promise(r=>{im.onload=r;im.onerror=r})));
 const body=document.body,finish=()=>body?.classList.remove('horizons-printing');
 body?.classList.add('horizons-printing');window.addEventListener?.('afterprint',finish,{once:true});
 try{window.print()}finally{setTimeout(finish,0)}
}
function printAlphabet(){printHtml(`<article class="worksheet">${sheetHead(t('alphabet'))}<div class="print-alpha-grid" dir="rtl">${alphabet.letters.map(l=>`<div><b class="arabic" lang="ar">${l.letter}</b><span class="arabic" lang="ar">${l.spokenNameText}</span></div>`).join('')}</div><p>${esc(t('nonJoiningNote'))} <span class="arabic">ا د ذ ر ز و</span></p></article>`)}
function printWriting(){printHtml(FORMS.map(f=>`<article class="worksheet">${sheetHead(t('write')+' · '+t(f))}<div class="print-form-top"><span class="arabic" lang="ar">${esc(traces.forms[f].display??traces.forms[f].label)}</span><b class="arabic" lang="ar">${lessonText(traces.forms[f].example)}</b></div><p>${esc(formNote(f))}</p><p class="print-direction-note">${esc(t('penGuideHint'))}</p>${[0,1,2].map(n=>`<div class="print-trace-row ${n===2?'faded':''}">${[0,1,2].map(()=>traceSvg(f,true)).join('')}</div>`).join('')}<p>${esc(t('freeWrite'))}</p><div class="print-free-line"></div><div class="print-free-line"></div><p class="print-small">${esc(t('traceNoScore'))}</p></article>`).join(''))}
function printAllWriting(){
 const pages=course.chapters.flatMap(c=>FORMS.map(f=>{
  const form=guideBank[c.id].forms[f],title=t('letterLesson',{letter:c.letter})+' · '+t(f);
  const svg=()=>buildPenSvg(form,{guide:true,locale,title});
  const note=t(c.id==='alif'&&f==='initial'?'alifNote':chapters[c.id].joiningType==='right_only'?'nonJoiningNote':'generalFormNote');
  return `<article class="worksheet">${sheetHead(title)}<div class="print-form-top"><span class="arabic" lang="ar">${esc(form.display??form.label)}</span><b class="arabic" lang="ar">${lessonText(form.example,c.letter)}</b></div><p>${esc(note)}</p><p class="print-direction-note">${esc(t('penGuideHint'))}</p>${[0,1,2].map(n=>`<div class="print-trace-row ${n===2?'faded':''}">${[0,1,2].map(()=>svg()).join('')}</div>`).join('')}<p>${esc(t('freeWrite'))}</p><div class="print-free-line"></div><div class="print-free-line"></div><p class="print-small">${esc(t('traceNoScore'))}</p></article>`;
 }));return printHtml(pages.join(''));
}
function printWords(){printHtml([0,1,2,3].map(n=>`<article class="worksheet">${sheetHead(t('letterLesson',{letter:data.letter})+' · '+t('group',{n:n+1}))}${data.words.slice(n*5,n*5+5).map(w=>`<div class="print-vocab-row"><div class="print-picture-pair"><img src="${img(w.id)}" alt=""><img src="${img(w.id,'sentence')}" alt=""></div><div><b class="arabic" lang="ar">${lessonText(w.word)}</b><p class="arabic" lang="ar" dir="rtl">${lessonText(w.sentence)}</p></div></div>`).join('')}</article>`).join(''))}
$('#locale').onchange=e=>{locale=e.target.value;render();save()};$('#settings-button').onclick=settings;$('#close-settings').onclick=()=>$('#settings').close();$('#progress-input').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>10*1024*1024)throw Error();const s=JSON.parse(await f.text());if(!valid(s))throw Error();confirmAction(t('restoreConfirm'),()=>{state=s;migrateAudioRevision(state);locale=s.locale;render();save();$('#settings').close()})}catch{notice(t('invalidProgress'))}};
$('#settings-button').onclick=openSettingsWithTypography;
function formNote(f){if(data?.id==='alif'&&f==='initial')return t('alifNote');return t(data.joiningType==='right_only'?'nonJoiningNote':'generalFormNote');}
function vowels(){const c=data.letter;return {short:c==='ا'?'أَ · إِ · أُ':c+'َ · '+c+'ِ · '+c+'ُ',long:c==='ا'?'بَا · مَا · لَا':c==='و'?'نُورٌ · سُورٌ · حُوتٌ':c==='ي'?'فِي · دِيكٌ · فِيلٌ':c+'َا · '+c+'ِي · '+c+'ُو'};}
async function loadJson(path){if(window.HORIZONS_DATA?.[path])return structuredClone(window.HORIZONS_DATA[path]);const r=await fetch(path);if(!r.ok)throw Error(path);return r.json();}
async function init(){try{[course,dict,audioIndex,guideBank,sceneIndex]=await Promise.all(['course/course.json','course/locales/ui.json','course/audio-index.json','course/tracing.json','course/scene-index.json'].map(loadJson));alphabet=course.alphabet;sceneIndex=sceneIndex.scenes??sceneIndex;const list=await Promise.all(course.chapters.map(c=>loadJson(c.path)));chapters=Object.fromEntries(list.map(c=>[c.id,c]));for(const lang of LANGS){dict[lang].word??={};dict[lang].story??={};for(const c of list){Object.assign(dict[lang].word,c.locales?.[lang]?.word??{});Object.assign(dict[lang].story,c.locales?.[lang]?.story??{});}}let chosenLocale;try{chosenLocale=localStorage.getItem('horizons-interface-language')}catch{}const requestedLocale=new URLSearchParams(location.search).get("lang");locale=[requestedLocale,chosenLocale,...(navigator.languages||[navigator.language]).map(x=>x.toLowerCase().split('-')[0]).map(x=>['nb','nn'].includes(x)?'no':x)].find(x=>LANGS.includes(x))||'en';const databaseSaved=await get('progress',DBKEY).catch(()=>null);let checkpoint=null;try{checkpoint=JSON.parse(localStorage.getItem(DBKEY))}catch{}const saved=[databaseSaved,checkpoint].filter(valid).sort((a,b)=>(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0))[0];state=saved??fresh();if(!saved){let localOld;try{localOld=JSON.parse(localStorage.getItem('horizons-expanded|0.2.0|local-1'))}catch{}const dbOld=await get('progress','horizons-expanded|0.2.0|local-1').catch(()=>null);const old=[localOld,dbOld].filter(x=>x?.bookId==='horizons-expanded-baa').sort((a,b)=>(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0))[0];if(old){const candidate={...fresh(),locale:old.locale,heard:old.heard??{},attempts:old.attempts??{},ink:Object.fromEntries(FORMS.map(f=>['baa:'+f,old.ink?.[f]??[]])),written:Object.fromEntries(FORMS.map(f=>['baa:'+f,!!old.written?.[f]]))};if(valid(candidate))state=candidate;}}const audioRevisionMigrated=migrateAudioRevision(state);locale=LANGS.includes(requestedLocale)?requestedLocale:state.locale;state.locale=locale;try{meaningLocale=localStorage.getItem('horizons-meaning-language')||(['ar','en','tr','fr','es'].includes(locale)?locale:'en')}catch{meaningLocale='en'};if(!['ar','en','tr','fr','es'].includes(meaningLocale))meaningLocale='en';render();if(window.HORIZONS_BOOT)window.HORIZONS_BOOT.ready=true;if(!saved||audioRevisionMigrated)save();if(!IS_DEMO&&!LOCAL_SERVER_MODE&&'serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register(new URL('sw.js',document.baseURI),{updateViaCache:'none'}).catch(()=>{});document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPenDemo();stop()}});}catch(e){if(window.HORIZONS_BOOT)window.HORIZONS_BOOT.errors.push(String(e?.message??e));$('#activity').innerHTML='<h2>تعذّر فتح الكراسة / Unable to open workbook</h2>'+(IS_DEMO?'<p>فكّ ضغط الحزمة كاملة ثم افتح index.html. أبقِ الملفات والمجلدات معًا.</p><p>Extract the complete package, then open index.html. Keep all files and folders together.</p>':'<p>شغّل Horizons-Arabic-Level-1.exe بعد استخراج الحزمة كاملة.</p><p>Extract the complete package and run Horizons-Arabic-Level-1.exe.</p>')+'<pre>'+esc(String(e?.message??e))+'</pre>';console.error(e)}}
if(typeof matchMedia==='function'){
 ensureTypographyToolbar();applyTypography();
 const typographyBreakpoint=matchMedia('(max-width:760px)');
 if(typographyBreakpoint.addEventListener)typographyBreakpoint.addEventListener('change',()=>applyTypography());else typographyBreakpoint.addListener(()=>applyTypography());
 if(typeof MutationObserver==='function')new MutationObserver(()=>updateTypographyUi()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
}
if(typeof addEventListener==='function')addEventListener('storage',event=>{if(event.key===TYPOGRAPHY_KEY||event.key===null){typographyStorageReadable=true;typography=loadTypographyPrefs(typography);applyTypography()}});
init();

})();
