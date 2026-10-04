/*CREATOR_CREDIT_BEGIN*/
/* Generic creator attribution shared by the demo, licensed workbook and entry page.
 * Replace the single locale placeholder with creator-credit-locales.json at build time.
 * No curriculum, licensing state or learner records are read or modified. */
(function(){
 'use strict';
 const DATA=/*HZN_CREATOR_CREDIT_LOCALES*/;
 const RTL=new Set(['ar','he','fa','ur']);
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 function normalizeLocale(value){
  const raw=String(value??'').trim().toLowerCase().replaceAll('_','-').split('-')[0];
  const code=({iw:'he',nb:'no',nn:'no'})[raw]??raw;
  return Object.hasOwn(DATA.labels,code)?code:'en';
 }
 function currentLocale(){
  return normalizeLocale(typeof locale!=='undefined'?locale:document.documentElement.lang);
 }
 function markup(value){
  const code=normalizeLocale(value??currentLocale()),dir=RTL.has(code)?'rtl':'ltr';
  return `<span class="hzn-creator-credit-content" lang="${code}" dir="${dir}"><span class="hzn-creator-role">${esc(DATA.labels[code])}</span><span class="hzn-creator-names" dir="ltr"><bdi lang="ar" dir="rtl"><b>${esc(DATA.names.ar)}</b></bdi><span aria-hidden="true"> — </span><bdi lang="tr" dir="ltr"><b>${esc(DATA.names.tr)}</b></bdi></span></span>`;
 }
 function ensureStyle(){
  if(document.getElementById('hzn-creator-credit-style'))return;
  const style=document.createElement('style');style.id='hzn-creator-credit-style';
  style.textContent='.hzn-creator-credit-content{display:inline-flex;flex-wrap:wrap;align-items:baseline;justify-content:center;gap:.1em .45em;max-width:100%;line-height:1.8;text-align:center}.hzn-creator-role{flex:1 0 100%;max-width:100%;overflow-wrap:anywhere;font-weight:500}.hzn-creator-names{display:inline-flex;flex-wrap:wrap;align-items:baseline;justify-content:center;column-gap:.35em;max-width:100%;direction:ltr;unicode-bidi:isolate;white-space:normal}.hzn-creator-names bdi{max-width:100%;unicode-bidi:isolate}.hzn-creator-names b{font-weight:650}@media print{.hzn-creator-credit-content{line-height:1.5;break-inside:avoid}}';
  document.head.append(style);
 }
 function sync(value){
  const code=normalizeLocale(value??currentLocale()),html=markup(code);
  ensureStyle();
  document.querySelectorAll('.author-credit,.print-author,[data-hzn-creator-credit]').forEach(node=>{
   if(node.innerHTML!==html)node.innerHTML=html;
   node.lang=code;node.dir=RTL.has(code)?'rtl':'ltr';
  });
  const meta=document.querySelector('meta[name="author"]');
  if(meta)meta.setAttribute('content',DATA.names.ar+' — '+DATA.names.tr);
  return html;
 }
 function wrapAfter(original){
  const wrapped=function(...args){const result=original.apply(this,args);sync();return result;};
  wrapped.hznCreatorCreditHook=true;return wrapped;
 }
 function installWorkbookHooks(){
  const installed=[];
  // These lexical functions are available when this block is installed inside
  // the protected workbook closure before init(), rather than as a global script.
  if(typeof render==='function'&&!render.hznCreatorCreditHook){render=wrapAfter(render);installed.push('render');}
  if(typeof settings==='function'&&!settings.hznCreatorCreditHook){settings=wrapAfter(settings);installed.push('settings');}
  if(typeof sheetHead==='function'&&!sheetHead.hznCreatorCreditHook){
   const original=sheetHead,previous=typeof AUTHOR_CREDIT==='string'?AUTHOR_CREDIT:null;
   const wrapped=function(...args){
    const html=original.apply(this,args);
    return typeof html==='string'&&previous?html.replaceAll(previous,markup(currentLocale())):html;
   };
   wrapped.hznCreatorCreditHook=true;sheetHead=wrapped;installed.push('sheetHead');
  }
  return installed;
 }
 globalThis.hznCreatorCreditMarkup=markup;
 globalThis.hznCreatorCredit=Object.freeze({schemaVersion:DATA.schema_version,markup,sync,installWorkbookHooks,normalizeLocale,labels:Object.freeze({...DATA.labels}),names:Object.freeze({...DATA.names})});
 installWorkbookHooks();sync();
 // beforeprint is synchronous: freshly generated worksheets are localized even
 // when fonts/images are already ready and printing starts immediately.
 addEventListener('beforeprint',()=>sync());
 if(typeof MutationObserver==='function'){
  const observer=new MutationObserver(()=>sync());
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 }
})();
/*CREATOR_CREDIT_END*/
