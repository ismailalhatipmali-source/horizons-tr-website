/* Install and explicit offline controls for the public five-letter demo. */
(()=>{'use strict';
const L={
ar:{button:'تثبيت وحفظ',title:'النسخة التجريبية على جهازك',install:'إضافة أيقونة التطبيق',save:'حفظ الحروف الخمسة دون إنترنت',cancel:'إيقاف التنزيل',clear:'حذف الدروس المنزّلة',close:'إغلاق',note:'إضافة الأيقونة لا تحفظ الصور والأصوات تلقائيًا. استخدم زر الحفظ لتنزيل الحروف الخمسة. قد يحذف الجهاز بيانات الموقع؛ صدّر تقدمك دوريًا.',state:'محفوظ: {saved} من {total} ملفًا · {size}',saving:'جارٍ الحفظ: {done} من {total}',done:'اكتمل حفظ النسخة التجريبية للاستخدام دون اتصال.',cancelled:'توقف التنزيل؛ بقيت الملفات المحفوظة.',error:'لم تكتمل العملية. تحقق من الإنترنت والمساحة المتاحة ثم أعد المحاولة. الملفات المحفوظة بنجاح باقية.',unsupported:'الحفظ دون اتصال غير متاح في هذا المتصفح. استخدم متصفحًا حديثًا وافتح الموقع عبر HTTPS.',help:'آيفون وآيباد: افتح الصفحة في Safari، ثم مشاركة ← إضافة إلى الشاشة الرئيسية. اختر فتح كتطبيق ويب إذا ظهر. على أندرويد استخدم تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية من قائمة Chrome. تختلف الخيارات بحسب الجهاز والمتصفح.',offline:'أنت دون اتصال. الملفات غير المحفوظة تحتاج إلى الإنترنت.',online:'الجهاز متصل بالشبكة.',storage:'المساحة المستخدمة لهذا الموقع: {used} من نحو {quota}.',notPersistent:'قد يحذف المتصفح البيانات عند الحاجة إلى مساحة. يمكنك إعادة حفظ الدروس لاحقًا.',persistent:'سمح المتصفح بالتخزين المستمر؛ حذف بيانات الموقع يدويًا ما يزال يزيل الملفات.',confirm:'حذف الصور والأصوات المحفوظة لهذه النسخة التجريبية؟ سيبقى تقدمك الدراسي.',update:'تحديث جاهز. أغلق نوافذ الكراسة ثم افتحها مجددًا.',busy:'يوجد تنزيل جارٍ؛ انتظر أو أوقفه أولًا.',checking:'جارٍ التحقق من الملفات المحفوظة…'},
en:{button:'Install & save',title:'Keep the demo on your device',install:'Add the app icon',save:'Save all five letters offline',cancel:'Stop download',clear:'Delete downloaded lessons',close:'Close',note:'Adding the icon does not save images and audio automatically. Use Save to download all five letters. Your device may clear website data; export your progress regularly.',state:'Saved: {saved} of {total} files · {size}',saving:'Saving: {done} of {total}',done:'The demo is saved for offline use.',cancelled:'Download stopped; saved files are kept.',error:'The action did not finish. Check your internet connection and available storage, then try again. Successfully saved files are kept.',unsupported:'Offline saving is unavailable in this browser. Use a modern browser and open the site over HTTPS.',help:'iPhone and iPad: open this page in Safari, then Share → Add to Home Screen. Select Open as Web App if shown. On Android, use Install app or Add to Home screen in the Chrome menu. Options vary by device and browser.',offline:'You are offline. Files that have not been saved need an internet connection.',online:'Your device is connected to a network.',storage:'Storage used by this site: {used} of about {quota}.',notPersistent:'The browser may clear saved data when space is needed. You can save the lessons again later.',persistent:'The browser allowed persistent storage; manually clearing website data still removes files.',confirm:'Delete the saved images and audio for this demo? Your learning progress will be kept.',update:'An update is ready. Close the workbook windows, then open it again.',busy:'A download is already running. Wait or stop it first.',checking:'Checking saved files…'},
tr:{button:'Yükle ve kaydet',title:'Demoyu cihazınızda saklayın',install:'Uygulama simgesini ekle',save:'Beş harfi çevrimdışı kaydet',cancel:'İndirmeyi durdur',clear:'İndirilen dersleri sil',close:'Kapat',note:'Simge eklemek resimleri ve sesleri otomatik olarak kaydetmez. Beş harfi indirmek için Kaydet düğmesini kullanın. Cihaz site verilerini silebilir; ilerlemenizi düzenli olarak dışa aktarın.',state:'Kaydedilen: {saved} / {total} dosya · {size}',saving:'Kaydediliyor: {done} / {total}',done:'Demo çevrimdışı kullanım için kaydedildi.',cancelled:'İndirme durduruldu; kaydedilen dosyalar korunur.',error:'İşlem tamamlanamadı. İnternet bağlantınızı ve boş depolama alanını kontrol edip yeniden deneyin. Başarıyla kaydedilen dosyalar korunur.',unsupported:'Bu tarayıcıda çevrimdışı kaydetme desteklenmiyor. Güncel bir tarayıcı kullanın ve siteyi HTTPS üzerinden açın.',help:'iPhone ve iPad: sayfayı Safari’de açın, ardından Paylaş → Ana Ekrana Ekle seçeneğini kullanın. Görünürse Web Uygulaması Olarak Aç seçeneğini seçin. Android’de Chrome menüsünden Uygulamayı yükle veya Ana ekrana ekle seçeneğini kullanın. Seçenekler cihaza göre değişir.',offline:'Çevrimdışısınız. Kaydedilmemiş dosyalar için internet gerekir.',online:'Cihazınız bir ağa bağlı.',storage:'Bu sitenin kullandığı alan: yaklaşık {quota} içinde {used}.',notPersistent:'Alan gerektiğinde tarayıcı verileri silebilir. Dersleri daha sonra yeniden kaydedebilirsiniz.',persistent:'Tarayıcı kalıcı depolamaya izin verdi; site verilerini elle silmek yine de dosyaları kaldırır.',confirm:'Bu demonun kaydedilen resimleri ve sesleri silinsin mi? Öğrenme ilerlemeniz korunacak.',update:'Güncelleme hazır. Çalışma kitabı pencerelerini kapatıp yeniden açın.',busy:'İndirme sürüyor. Bekleyin veya önce durdurun.',checking:'Kaydedilen dosyalar kontrol ediliyor…'},
fr:{button:'Installer et enregistrer',title:'Garder la démo sur votre appareil',install:'Ajouter l’icône de l’application',save:'Enregistrer les cinq lettres hors connexion',cancel:'Arrêter le téléchargement',clear:'Supprimer les leçons téléchargées',close:'Fermer',note:'Ajouter l’icône n’enregistre pas automatiquement les images et les sons. Utilisez Enregistrer pour télécharger les cinq lettres. L’appareil peut effacer les données du site ; exportez régulièrement votre progression.',state:'Enregistrés : {saved} sur {total} fichiers · {size}',saving:'Enregistrement : {done} sur {total}',done:'La démo est enregistrée pour une utilisation hors connexion.',cancelled:'Téléchargement arrêté ; les fichiers enregistrés sont conservés.',error:'L’action n’est pas terminée. Vérifiez la connexion et l’espace disponible, puis réessayez. Les fichiers déjà enregistrés sont conservés.',unsupported:'L’enregistrement hors connexion n’est pas disponible dans ce navigateur. Utilisez un navigateur récent et ouvrez le site en HTTPS.',help:'iPhone et iPad : ouvrez cette page dans Safari, puis Partager → Sur l’écran d’accueil. Sélectionnez Ouvrir comme app web si proposé. Sur Android, choisissez Installer l’application ou Ajouter à l’écran d’accueil dans le menu Chrome. Les options varient selon l’appareil.',offline:'Vous êtes hors connexion. Les fichiers non enregistrés nécessitent Internet.',online:'Votre appareil est connecté à un réseau.',storage:'Espace utilisé par ce site : {used} sur environ {quota}.',notPersistent:'Le navigateur peut effacer les données s’il manque de place. Vous pourrez enregistrer les leçons à nouveau.',persistent:'Le navigateur a autorisé le stockage persistant ; effacer manuellement les données du site supprime toujours les fichiers.',confirm:'Supprimer les images et les sons enregistrés pour cette démo ? Votre progression sera conservée.',update:'Une mise à jour est prête. Fermez les fenêtres du cahier, puis rouvrez-le.',busy:'Un téléchargement est en cours. Attendez ou arrêtez-le d’abord.',checking:'Vérification des fichiers enregistrés…'},
es:{button:'Instalar y guardar',title:'Guarda la demo en tu dispositivo',install:'Añadir el icono de la aplicación',save:'Guardar las cinco letras sin conexión',cancel:'Detener descarga',clear:'Eliminar lecciones descargadas',close:'Cerrar',note:'Añadir el icono no guarda las imágenes y los sonidos automáticamente. Usa Guardar para descargar las cinco letras. El dispositivo puede borrar los datos del sitio; exporta tu progreso con frecuencia.',state:'Guardados: {saved} de {total} archivos · {size}',saving:'Guardando: {done} de {total}',done:'La demo está guardada para usar sin conexión.',cancelled:'Descarga detenida; se conservan los archivos guardados.',error:'No se completó la operación. Revisa tu conexión y el espacio disponible, y vuelve a intentarlo. Se conservan los archivos guardados correctamente.',unsupported:'Este navegador no permite guardar sin conexión. Usa un navegador moderno y abre el sitio mediante HTTPS.',help:'iPhone y iPad: abre esta página en Safari, luego Compartir → Añadir a la pantalla de inicio. Selecciona Abrir como app web si aparece. En Android, elige Instalar aplicación o Añadir a la pantalla de inicio en el menú de Chrome. Las opciones dependen del dispositivo.',offline:'Estás sin conexión. Los archivos que no hayas guardado necesitan Internet.',online:'Tu dispositivo está conectado a una red.',storage:'Espacio usado por este sitio: {used} de unos {quota}.',notPersistent:'El navegador puede borrar los datos si necesita espacio. Podrás volver a guardar las lecciones.',persistent:'El navegador permitió el almacenamiento persistente; borrar manualmente los datos del sitio sigue eliminando los archivos.',confirm:'¿Eliminar las imágenes y los sonidos guardados de esta demo? Se conservará tu progreso.',update:'Hay una actualización lista. Cierra las ventanas del cuaderno y vuelve a abrirlo.',busy:'Ya hay una descarga en curso. Espera o detenla primero.',checking:'Comprobando los archivos guardados…'}
};
const lang=()=>{const code=(document.querySelector('#locale')?.value||document.documentElement.lang||navigator.language||'en').split('-')[0];return L[code]?code:'en';};
const t=(key,values={})=>(L[lang()][key]||L.en[key]||key).replace(/\{(\w+)\}/g,(_,k)=>String(values[k]??''));
const bytes=n=>new Intl.NumberFormat(lang(),{maximumFractionDigits:1}).format(n/1048576)+' MB';
let deferredInstall=null,registration,working=false,lastState=null,lastMessage='checking';
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
function setStatus(key,params){lastMessage=key;if(status)status.textContent=t(key,params);}
function setBusy(value){working=value;if(saveButton){saveButton.disabled=value||!supported;clearButton.disabled=value||!supported;cancelButton.hidden=!value;progress.hidden=!value;}}
async function refresh(){
  if(!status)return;
  network.textContent=t(navigator.onLine?'online':'offline');
  try{lastState=await message(await ready,{type:'demo-state'});status.textContent=t('state',{saved:lastState.saved,total:lastState.total,size:bytes(lastState.savedBytes)});}
  catch{setStatus(supported?'error':'unsupported');}
  try{
    const estimate=await navigator.storage?.estimate?.();
    storage.textContent=estimate?t('storage',{used:bytes(estimate.usage||0),quota:bytes(estimate.quota||0)}):'';
    const persistent=await navigator.storage?.persisted?.();persistNote.textContent=t(persistent?'persistent':'notPersistent');
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
  dialog.dir=lang()==='ar'?'rtl':'ltr';dialog.lang=lang();
  document.querySelectorAll('[data-demo-label]').forEach(el=>{el.textContent=t(el.dataset.demoLabel);});
  network.textContent=t(navigator.onLine?'online':'offline');
  if(lastState&&!working)status.textContent=t('state',{saved:lastState.saved,total:lastState.total,size:bytes(lastState.savedBytes)});
  else if(!working)setStatus(lastMessage);
}
function start(){
  const style=make('style');style.textContent='.hzn-demo-dialog{width:min(92vw,620px);max-height:85dvh;overflow:auto;border:1px solid #cbd5da;border-radius:18px;padding:22px;background:#fff;color:#12384e}.hzn-demo-dialog::backdrop{background:#102a3a99}.hzn-demo-dialog h2{font-size:1.35rem;line-height:1.5}.hzn-demo-dialog p{font-size:1rem;line-height:1.65}.hzn-demo-actions{display:flex;flex-wrap:wrap;gap:10px;margin-block:12px}.hzn-demo-dialog button{min-height:42px;white-space:normal}.hzn-demo-dialog progress{width:100%}.hzn-demo-open{font-size:.8rem!important;padding:6px 9px!important;white-space:normal!important;max-width:130px}.hzn-demo-close{float:inline-end}@media print{.hzn-demo-open,.hzn-demo-dialog{display:none!important}}';document.head.append(style);
  openButton=make('button',{type:'button',class:'secondary hzn-demo-open','data-demo-label':'button','aria-haspopup':'dialog'});
  const host=document.querySelector('.top-actions')||document.querySelector('header')||document.body;host.append(openButton);
  dialog=make('dialog',{class:'hzn-demo-dialog','aria-labelledby':'hzn-demo-title'});const close=make('button',{type:'button',class:'secondary hzn-demo-close','data-demo-label':'close'});close.onclick=()=>dialog.close();dialog.append(close,make('h2',{id:'hzn-demo-title','data-demo-label':'title'}),make('p',{'data-demo-label':'note'}));
  const actions=make('div',{class:'hzn-demo-actions'}),install=make('button',{type:'button',class:'secondary','data-demo-label':'install'});saveButton=make('button',{type:'button',class:'primary','data-demo-label':'save'});cancelButton=make('button',{type:'button',class:'secondary','data-demo-label':'cancel',hidden:''});clearButton=make('button',{type:'button',class:'text-button','data-demo-label':'clear'});actions.append(install,saveButton,cancelButton,clearButton);
  help=make('p',{'data-demo-label':'help',hidden:''});status=make('p',{role:'status','aria-live':'polite'});network=make('p',{});storage=make('p',{});persistNote=make('p',{});progress=make('progress',{hidden:'','aria-label':'Download progress'});dialog.append(actions,help,status,progress,network,storage,persistNote);document.body.append(dialog);
  install.onclick=async()=>{if(deferredInstall){const prompt=deferredInstall;deferredInstall=null;try{await prompt.prompt();await prompt.userChoice;}catch{help.hidden=false;}}else help.hidden=false;};
  saveButton.onclick=()=>prepare('all').catch(()=>{});
  cancelButton.onclick=async()=>{try{await message(await ready,{type:'demo-cancel'});}catch{setStatus('error');}};
  clearButton.onclick=async()=>{if(!confirm(t('confirm')))return;try{await message(await ready,{type:'demo-clear'});await refresh();}catch{setStatus('error');}};
  openButton.onclick=()=>{paint();dialog.showModal();refresh();};
  document.querySelector('#locale')?.addEventListener('change',()=>setTimeout(paint,0));
  addEventListener('online',()=>{if(dialog.open)refresh();});addEventListener('offline',()=>{network.textContent=t('offline');});
  paint();setBusy(false);if(!supported)setStatus('unsupported');
  if(!document.querySelector('link[rel="apple-touch-icon"]'))document.head.append(make('link',{rel:'apple-touch-icon',href:'icons/apple-touch-icon.png'}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
