/* Install and explicit offline controls for the public five-letter demo. */
(()=>{'use strict';
const L=globalThis.HORIZONS_DEMO_LOCALES;
const lang=()=>{const code=(document.querySelector('#locale')?.value||document.documentElement.lang||navigator.language||'en').toLowerCase().replaceAll('_','-').split('-')[0];const normalized=({nb:'no',nn:'no',iw:'he'})[code]||code;return Object.hasOwn(L,normalized)?normalized:'en';};
const t=(key,values={})=>(L[lang()][key]||L.en[key]||key).replace(/\{(\w+)\}/g,(_,k)=>formatValue(values[k]??''));
const rtl=()=>['ar','he','fa','ur'].includes(lang());
const formatValue=value=>{const text=typeof value==='number'?new Intl.NumberFormat(lang()).format(value):String(value);return rtl()?'\u2068'+text+'\u2069':text};
const bytes=n=>new Intl.NumberFormat(lang(),{style:'unit',unit:'megabyte',unitDisplay:'short',maximumFractionDigits:1}).format(n/1048576);
let deferredInstall=null,registration,working=false,lastState=null,lastMessage='checking',lastParams={},storageEstimate=null,persistentStorage=null;
let dialog,openButton,status,network,storage,persistNote,help,progress,saveButton,cancelButton,clearButton;
const supported='serviceWorker' in navigator&&isSecureContext&&location.protocol!=='file:';
function message(worker,data,onProgress=()=>{}){return new Promise((resolve,reject)=>{
  const channel=new MessageChannel();let timer,done=false;
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();error?reject(error):resolve(value);};
  const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(Error('WORKER_TIMEOUT')),65000);};
  channel.port1.onmessage=event=>{reset();const value=event.data||{};if(typeof value.done==='number')onProgress(value);if(value.ok===true)finish(null,value);else if(value.ok===false){const error=Error(value.error||'SAVE_FAILED');error.code=value.error;finish(error);}};
  reset();try{worker.postMessage(data,[channel.port2]);}catch(error){finish(error);}
});}
const ready=(async()=>{
  if(!supported){const error=Error('UNSUPPORTED');error.code='UNSUPPORTED';throw error;}
  registration=await navigator.serviceWorker.register(new URL('sw.js',document.baseURI),{updateViaCache:'none'});
  const watch=()=>{const worker=registration.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)setStatus('update');});};
  registration.addEventListener('updatefound',watch);watch();
  if(registration.waiting)setStatus('update');
  let timer;
  await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('WORKER_TIMEOUT')),120000);})]).finally(()=>clearTimeout(timer));
  const worker=navigator.serviceWorker.controller||registration.active;
  if(!worker||new URL(worker.scriptURL).pathname!==new URL('sw.js',document.baseURI).pathname)throw Error('WORKER_SCOPE');
  return worker;
})();
ready.catch(()=>{});
function setStatus(key,params={}){lastMessage=key;lastParams=params;if(status)status.textContent=t(key,params);}
function setBusy(value){working=value;if(saveButton){saveButton.disabled=value||!supported;clearButton.disabled=value||!supported;cancelButton.hidden=!value;progress.hidden=!value;}}
async function refresh(){
  if(!status)return;
  network.textContent=t(navigator.onLine?'online':'offline');
  try{lastState=await message(await ready,{type:'demo-state'});status.textContent=t('state',{saved:lastState.saved,total:lastState.total,size:bytes(lastState.savedBytes)});}
  catch{setStatus(supported?'error':'unsupported');}
  try{
    const estimate=storageEstimate=await navigator.storage?.estimate?.();
    storage.textContent=estimate?t('storage',{used:bytes(estimate.usage||0),quota:bytes(estimate.quota||0)}):'';
    const persistent=persistentStorage=await navigator.storage?.persisted?.();persistNote.textContent=t(persistent?'persistent':'notPersistent');
  }catch{storage.textContent='';persistNote.textContent=t('notPersistent');}
}
async function prepare(group='all',onProgress=()=>{}){
  if(working){const error=Error('DOWNLOAD_BUSY');error.code='DOWNLOAD_BUSY';throw error;}
  setBusy(true);setStatus('checking');
  try{
    const worker=await ready;
    // Persistence is requested only after the person chooses Save.
    try{await navigator.storage?.persist?.();}catch{}
    const result=await message(worker,{type:'demo-save',group},value=>{if(progress){progress.max=value.total;progress.value=value.done;}setStatus('saving',value);onProgress(value);});
    await refresh();setStatus(group==='all'?'done':'state',group==='all'?{}:{saved:result.saved,total:result.total,size:bytes(result.savedBytes)});return result;
  }catch(error){setStatus(error.code==='DOWNLOAD_CANCELLED'?'cancelled':error.code==='DOWNLOAD_BUSY'?'busy':error.code==='UNSUPPORTED'?'unsupported':'error');throw error;}
  finally{setBusy(false);}
}
window.HORIZONS_OFFLINE={prepare};
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;});
window.addEventListener('appinstalled',()=>{deferredInstall=null;});
function make(tag,attrs={},text=''){const el=document.createElement(tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);if(text)el.textContent=text;return el;}
function paint(){
  if(!dialog)return;
  dialog.dir=rtl()?'rtl':'ltr';dialog.lang=lang();
  document.querySelectorAll('[data-demo-label]').forEach(el=>{el.textContent=t(el.dataset.demoLabel);});
  network.textContent=t(navigator.onLine?'online':'offline');
  if(lastState&&!working)status.textContent=t('state',{saved:lastState.saved,total:lastState.total,size:bytes(lastState.savedBytes)});
  else setStatus(lastMessage,lastParams);
  if(storageEstimate)storage.textContent=t('storage',{used:bytes(storageEstimate.usage||0),quota:bytes(storageEstimate.quota||0)});
  if(persistentStorage!==null)persistNote.textContent=t(persistentStorage?'persistent':'notPersistent');
  progress.setAttribute('aria-label',t('progress'));openButton.dir=dialog.dir;
}
function start(){
  const style=make('style');style.textContent='.hzn-demo-dialog{width:min(92vw,620px);max-height:85dvh;overflow:auto;border:1px solid #cbd5da;border-radius:18px;padding:22px;background:#fff;color:#12384e}.hzn-demo-dialog::backdrop{background:#102a3a99}.hzn-demo-dialog h2,.hzn-demo-dialog p,.hzn-demo-dialog button{overflow-wrap:anywhere}.hzn-demo-dialog h2{font-size:1.35rem;line-height:1.5}.hzn-demo-dialog p{font-size:1rem;line-height:1.65}.hzn-demo-actions{display:flex;flex-wrap:wrap;gap:10px;margin-block:12px}.hzn-demo-dialog button{min-height:42px;white-space:normal}.hzn-demo-dialog progress{width:100%}.hzn-demo-open{font-size:.8rem!important;padding:6px 9px!important;white-space:normal!important;max-width:130px}.hzn-demo-close{float:inline-end}@media print{.hzn-demo-open,.hzn-demo-dialog{display:none!important}}';document.head.append(style);
  openButton=make('button',{type:'button',class:'secondary hzn-demo-open','data-demo-label':'button','aria-haspopup':'dialog'});
  const host=document.querySelector('.top-actions')||document.querySelector('header')||document.body;host.append(openButton);
  dialog=make('dialog',{class:'hzn-demo-dialog','aria-labelledby':'hzn-demo-title'});const close=make('button',{type:'button',class:'secondary hzn-demo-close','data-demo-label':'close'});close.onclick=()=>dialog.close();dialog.append(close,make('h2',{id:'hzn-demo-title','data-demo-label':'title'}),make('p',{'data-demo-label':'note'}));
  const actions=make('div',{class:'hzn-demo-actions'}),install=make('button',{type:'button',class:'secondary','data-demo-label':'install'});saveButton=make('button',{type:'button',class:'primary','data-demo-label':'save'});cancelButton=make('button',{type:'button',class:'secondary','data-demo-label':'cancel',hidden:''});clearButton=make('button',{type:'button',class:'text-button','data-demo-label':'clear'});actions.append(install,saveButton,cancelButton,clearButton);
  help=make('p',{'data-demo-label':'help',hidden:''});status=make('p',{role:'status','aria-live':'polite'});network=make('p',{});storage=make('p',{});persistNote=make('p',{});progress=make('progress',{hidden:'','aria-label':t('progress')});dialog.append(actions,help,status,progress,network,storage,persistNote);document.body.append(dialog);
  install.onclick=async()=>{if(deferredInstall){const prompt=deferredInstall;deferredInstall=null;try{await prompt.prompt();await prompt.userChoice;}catch{help.hidden=false;}}else help.hidden=false;};
  saveButton.onclick=()=>prepare('all').catch(()=>{});
  cancelButton.onclick=async()=>{try{await message(await ready,{type:'demo-cancel'});}catch{setStatus('error');}};
  clearButton.onclick=async()=>{if(!confirm(t('confirm')))return;try{await message(await ready,{type:'demo-clear'});await refresh();}catch{setStatus('error');}};
  openButton.onclick=()=>{paint();dialog.showModal();refresh();};
  document.querySelector('#locale')?.addEventListener('change',()=>setTimeout(paint,0));
  new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  addEventListener('online',()=>{if(dialog.open)refresh();});addEventListener('offline',()=>{network.textContent=t('offline');});
  paint();setBusy(false);if(!supported)setStatus('unsupported');
  if(!document.querySelector('link[rel="apple-touch-icon"]'))document.head.append(make('link',{rel:'apple-touch-icon',href:'icons/apple-touch-icon.png'}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
