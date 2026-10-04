/*DEMO_EXPERIENCE_BEGIN*/
/* Public preview of the workbook. Locked sections never enter learner state
 * and never request licensed content, recordings or activation endpoints. */
(function(){
 'use strict';
 const COPY=/*HZN_DEMO_EXPERIENCE_LOCALES*/;
 const LETTERS=/*HZN_DEMO_LETTER_OVERVIEW*/;
 const SECTIONS=['alphabet','phonics','blending2','blending3','blending4','catalog'];
 const RTL=new Set(['ar','he','fa','ur']);
 let preview=null,lockDialog;
 const text=key=>COPY[locale]?.[key]??COPY.en[key];
 const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const lock='<svg class="demo-lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg>';
 const buyUrl=()=>new URL('../'+(Object.hasOwn(COPY,locale)?locale:'en')+'/checkout.html?product=horizons-arabic-level1',document.baseURI).href;
 function buttonStatus(section){return section==='blending4'?text('comingSoon'):['alphabet','catalog'].includes(section)?text('availableLabel'):text('lockedLabel');}
 function panelMarkup(title,soon=false){
  return `<div class="demo-locked-preview"><div class="demo-lock-card"><span class="demo-lock-illustration" aria-hidden="true">${lock}</span><span class="demo-badge">${safe(soon?text('comingSoon'):text('lockedLabel'))}</span><h2>${safe(title)}</h2><p>${safe(soon?text('comingSoonText'):text('lockedText'))}</p><div class="demo-lock-actions"><a class="primary demo-buy-link" href="${safe(buyUrl())}">${safe(text('buyFull'))}</a><button type="button" class="secondary" data-demo-return>${safe(text('backToDemo'))}</button></div></div></div>`;
 }
 function showLock(title){
  stopPenDemo();stop();
  if(!lockDialog){lockDialog=document.createElement('dialog');lockDialog.id='demo-lock-dialog';lockDialog.setAttribute('aria-labelledby','demo-lock-title');document.body.append(lockDialog);}
  lockDialog.lang=locale;lockDialog.dir=RTL.has(locale)?'rtl':'ltr';
  lockDialog.innerHTML=`<button type="button" class="icon-button demo-lock-close" aria-label="${safe(text('closeLabel'))}">×</button>${panelMarkup(title)}`;
  lockDialog.querySelector('h2').id='demo-lock-title';
  lockDialog.querySelector('.demo-lock-close').onclick=()=>lockDialog.close();
  lockDialog.querySelector('[data-demo-return]').onclick=()=>lockDialog.close();
  lockDialog.showModal();
 }
 function overview(kind){
  const grid=document.querySelector(kind==='alphabet'?'.alphabet-grid':'.chapter-grid');
  if(!grid)return;
  const existing=new Map();
  for(const item of [...grid.children]){
   const key=kind==='alphabet'?alphabet.letters[Number(item.dataset.letter)]?.id?.replace('alphabet.',''):item.dataset.chapter;
   if(key)existing.set(key,item);
  }
  for(const letter of LETTERS){
   let item=existing.get(letter.id);
   if(item){
    item.classList.add('demo-free-card');
    const number=item.querySelector('.chapter-number');if(number)number.textContent=String(letter.order).padStart(2,'0');
    let badge=item.querySelector('.demo-card-status');if(!badge){badge=document.createElement('small');badge.className='demo-card-status';item.append(badge);}
    badge.textContent=text('availableLabel');badge.lang=locale;badge.dir=RTL.has(locale)?'rtl':'ltr';
   }else{
    item=document.createElement('button');item.type='button';item.className=(kind==='alphabet'?'letter-card':'chapter-card')+' is-locked demo-locked-letter';
    item.setAttribute('aria-haspopup','dialog');item.setAttribute('aria-label',letter.name+' · '+text('lockedLabel'));item.dataset.demoLockedLetter=letter.id;
    item.innerHTML=`${kind==='catalog'?`<span class="chapter-number">${String(letter.order).padStart(2,'0')}</span>`:''}<span class="arabic ${kind==='catalog'?'chapter-letter':''}" lang="ar" dir="rtl">${safe(letter.letter)}</span><${kind==='catalog'?'b':'small'} class="demo-letter-name" lang="ar" dir="rtl">${safe(letter.name)}</${kind==='catalog'?'b':'small'}><small class="demo-card-status" lang="${locale}" dir="${RTL.has(locale)?'rtl':'ltr'}">${lock}${safe(text('lockedLabel'))}</small>`;
    item.onclick=()=>showLock(letter.name);
   }
   grid.append(item);
  }
 }
 function mount(){
  if(typeof state==='undefined'||!state||!document.querySelector('#activity'))return;
  document.body.classList.add('hzn-demo-experience');
  let banner=document.querySelector('#demo-upgrade');
  if(!banner){banner=document.createElement('section');banner.id='demo-upgrade';document.querySelector('main').prepend(banner);}
  banner.lang=locale;banner.dir=RTL.has(locale)?'rtl':'ltr';banner.setAttribute('aria-label',text('buyFull'));
  banner.innerHTML=`<div class="demo-upgrade-copy"><span class="demo-badge">${safe(text('freeDemo'))}</span><p>${safe(text('upgradeTitle'))}</p></div><div class="demo-upgrade-actions"><a class="primary demo-buy-link" href="${safe(buyUrl())}">${safe(text('buyFull'))}<span aria-hidden="true">↗</span></a></div>`;
  const active=preview??(state.course==='alphabet'?'alphabet':'catalog');
  const navHost=document.querySelector('#course-nav');navHost.dataset.demoNav='';
  navHost.innerHTML=SECTIONS.map((section,i)=>`<button type="button" class="demo-section ${active===section?'is-active ':''}${section==='blending4'?'is-coming-soon':['alphabet','catalog'].includes(section)?'is-free':'is-locked'}" data-demo-section="${section}" ${['alphabet','catalog'].includes(section)?`data-course="${section}"`:''} aria-pressed="${active===section}"><span class="demo-section-number">${String(i+1).padStart(2,'0')}</span><span class="demo-section-title">${safe(text(section))}</span><small class="demo-section-status">${['alphabet','catalog','blending4'].includes(section)?'':lock}${safe(buttonStatus(section))}</small></button>`).join('');
  for(const item of navHost.querySelectorAll('[data-demo-section]'))item.onclick=()=>{
   const section=item.dataset.demoSection;
   if(['alphabet','catalog'].includes(section)){preview=null;nav({course:section});}
   else{stopPenDemo();stop();preview=section;render();}
  };
  document.querySelector('#eyebrow').textContent='HORIZONS · ARABIC LEVEL 1 · '+text('demoLabel');
  document.querySelector('#preview-note').textContent=text('demoNote');
  if(preview){
   document.querySelector('#lesson-title').textContent=text(preview);
   document.querySelector('#lesson-subtitle').textContent=buttonStatus(preview);
   document.querySelector('#stages').hidden=true;document.querySelector('.lesson-footer').hidden=true;
   document.querySelector('.progress-box').hidden=true;
   document.querySelector('#activity').innerHTML=panelMarkup(text(preview),preview==='blending4');
   document.querySelector('[data-demo-return]').onclick=()=>{preview=null;render();};
  }else{
   document.querySelector('.progress-box').hidden=false;
   document.querySelector('#lesson-subtitle').textContent=text('demoSubtitle');
   if(state.course==='alphabet'&&state.alphabetMode==='explore')overview('alphabet');
   if(state.course==='catalog')overview('catalog');
  }
 }
 const originalRender=render;
 render=function(...args){const value=originalRender.apply(this,args);mount();return value;};
 const originalNav=nav;
 nav=function(...args){preview=null;return originalNav.apply(this,args);};
})();
/*DEMO_EXPERIENCE_END*/
