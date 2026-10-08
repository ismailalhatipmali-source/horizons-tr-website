/* Presentation-only compact home. Existing lesson buttons keep their handlers.
 * Theory stays disabled until an explicit, reviewed content mapping exists. */
(function(scope){
 'use strict';
 const paths={sun:'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 1.4 1.4m10 10 1.4 1.4M5.6 18.4 1.4-1.4m10-10 1.4-1.4',moon:'M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5Z',gear:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',user:'M4 21v-2a8 8 0 0 1 16 0v2',play:'m8 5 11 7-11 7Z',book:'M12 5v15M3 4h5l4 2 4-2h5v15h-5l-4 2-4-2H3Z'};
 function icon(name){const extra=name==='sun'?'<circle cx="12" cy="12" r="4"/>':name==='gear'?'<circle cx="12" cy="12" r="3"/>':name==='user'?'<circle cx="12" cy="7" r="4"/>':'';return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[name]+'"/>'+extra+'</svg>';}
 function install(win,doc){
  if(win.hznCompactHome)return win.hznCompactHome;
  let pending=false,dead=false;
  const q=s=>doc.querySelector(s);
  const label=()=>doc.documentElement.lang.startsWith('ar')?{interactive:'الدرس التفاعلي',theory:'الشرح النظري',soon:'قريبًا — قيد الإعداد'}:{interactive:'Interactive lesson',theory:'Theory',soon:'Coming soon — in preparation'};
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
   for(const tile of futureList?[...futureList.children].filter(n=>n.tagName==='BUTTON'):[]){
    const key=tile.querySelector('strong')?.dataset.copy;
    const mapping=(win.HZN_REFERENCE_ROUTES||win.HZN_REFERENCE_REVIEW_ROUTES)?.[key];
    if(!mapping||!mapping.languages?.includes(doc.documentElement.lang.split('-')[0]))continue;
    const card=doc.createElement('article');card.className='hzn-future-reference-card';tile.before(card);card.append(tile);
    const theory=doc.createElement('button');theory.type='button';theory.className='hzn-theory-action';theory.innerHTML=icon('book');theory.append(doc.createTextNode(copy.theory));
    theory.setAttribute('aria-label',copy.theory+' — '+tile.querySelector('strong').textContent);card.append(theory);
    theory.onclick=()=>{const url=new URL(mapping.href,win.location.href);if(url.origin!==win.location.origin)return;url.searchParams.set('lang',doc.documentElement.lang);
     const dialog=doc.createElement('dialog');dialog.className='hzn-reference-dialog';dialog.setAttribute('aria-label',theory.getAttribute('aria-label'));
     const close=doc.createElement('button');close.type='button';close.textContent=doc.documentElement.lang.startsWith('ar')?'إغلاق':'Close';close.onclick=()=>dialog.close();
     const frame=doc.createElement('iframe');frame.title=theory.getAttribute('aria-label');frame.src=url.href;dialog.append(close,frame);doc.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();theory.focus();},{once:true});dialog.showModal();};
   }
   for(const button of [...nav.children].filter(n=>n.tagName==='BUTTON')){
    const title=button.querySelector('.demo-section-title')?.textContent.trim()||button.querySelector('span:last-of-type')?.textContent.trim()||button.textContent.trim();
    const card=doc.createElement('article');card.className='hzn-lesson-card';
    const heading=doc.createElement('h2');heading.className='hzn-card-title';heading.textContent=(button.querySelector('.demo-section-number')?.textContent.trim()||'')+' '+title;
    const actions=doc.createElement('div');actions.className='hzn-card-actions';
    button.before(card);card.append(heading,actions);actions.append(button);
    button.classList.add('hzn-interactive-action');button.setAttribute('aria-label',copy.interactive+' — '+title);
    const actionLabel=doc.createElement('span');actionLabel.className='hzn-action-label';actionLabel.innerHTML=icon('play');actionLabel.append(doc.createTextNode(copy.interactive));button.append(actionLabel);
    const theory=doc.createElement('button');theory.type='button';theory.className='hzn-theory-action';theory.disabled=true;
    theory.setAttribute('aria-label',copy.theory+' — '+title+' — '+copy.soon);theory.title=copy.soon;
    theory.innerHTML=icon('book');theory.append(doc.createTextNode(copy.theory));actions.append(theory);
    const status=doc.createElement('small');status.className='hzn-theory-status';status.textContent=copy.theory+': '+copy.soon;card.append(status);
    // Explicit local editorial-review routes only. Default production staging
    // remains closed; an unreviewed reference is never enabled implicitly.
    const key=button.dataset.demoSection||button.dataset.course||button.dataset.b4Course||button.dataset.b3Course||button.dataset.b2Course||button.dataset.phonicsCourse;
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
        const close=doc.createElement('button');close.type='button';close.textContent=doc.documentElement.lang.startsWith('ar')?'إغلاق':'Close';close.onclick=()=>dialog.close();
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
