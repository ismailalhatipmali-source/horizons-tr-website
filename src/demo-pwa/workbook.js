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
const {get,put,learnerStorage}=(()=>{
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

// Full-reader learner storage. Progress belongs to an opaque learner ID, never
// to an email or the three-device entitlement limit. The native API owns disk IO;
// the browser service worker supplies the same API using local IndexedDB.
const learnerStorage = (()=>{
 let native=false, profiles=[], selected=null, queue=Promise.resolve();
 const pending=new Map(), blocked=new Map();
 const sessionKey='horizons.learners.active.v1';
 async function api(route='',payload){
  const response=await fetch(new URL('api/learners'+route,document.baseURI),{method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined,cache:'no-store'});
  let data;try{data=await response.json()}catch{throw Object.assign(Error('learner_service_unavailable'),{code:'learner_service_unavailable'})}
  if(!response.ok)throw Object.assign(Error(data.error||'save_failed'),{code:data.error,status:response.status,data});return data;
 }
 function choose(profile){selected=profile;try{sessionStorage.setItem(sessionKey,profile.id)}catch{}return profile}
 function replace(profile){const i=profiles.findIndex(x=>x.id===profile.id);if(i<0)profiles.push(profile);else profiles[i]=profile;if(selected?.id===profile.id)selected=profile}
 return {
  get enabled(){return native}, get current(){return selected},get blocked(){return selected&&blocked.get(selected.id)},
  get pending(){return selected&&pending.has(selected.id)},get profiles(){return profiles.filter(x=>!x.deleted_at)},
  async start(migrations){
   const desktop=location.hostname==='127.0.0.1'&&/^\/[a-f0-9]{48}\//.test(location.pathname);
   const browser=/^\/learn\/app\//.test(location.pathname)&&!!navigator.serviceWorker?.controller;
   native=window.HORIZONS_RELEASE?.edition==='full'&&(desktop||browser);
   if(!native)return null;
   // Failure is surfaced; an unreadable learner store must never fall back to
   // a fresh empty database that silently replaces a person's progress.
   let store=await api();
   if(migrations.length){await api('/migrate',{profiles:migrations});store=await api()}
   profiles=store.profiles;let id;try{id=sessionStorage.getItem(sessionKey)}catch{}
   const profile=profiles.find(x=>x.id===id&&!x.deleted_at)||profiles.find(x=>!x.deleted_at);return profile?choose(profile):null;
  },
  async create(nickname,progress,settings){await queue;const r=await api('/create',{nickname,progress,settings});replace(r.profile);return choose(r.profile)},
  async select(id){await queue;const store=await api();profiles=store.profiles;const profile=profiles.find(x=>x.id===id&&!x.deleted_at);if(!profile)throw Error('profile_missing');return choose(profile)},
  save(progress,settings,nickname=selected?.nickname){
   if(!selected)return Promise.reject(Error('profile_missing'));
   const id=selected.id,snapshot={progress:structuredClone(progress),settings:structuredClone(settings),nickname};pending.set(id,snapshot);
   const task=async()=>{
    if(blocked.has(id))throw blocked.get(id);
    const p=profiles.find(x=>x.id===id);if(!p||p.deleted_at)throw Error('profile_missing');
    try{const result=await api('/save',{id,revision:p.revision,...snapshot});replace(result.profile);if(pending.get(id)===snapshot)pending.delete(id);return result.profile}
    catch(e){if(e.status===409||e.status===410)blocked.set(id,e);throw e}
   };
   const result=queue.then(task);queue=result.catch(()=>{});return result;
  },
  async flush(){await queue;if(selected&&(blocked.has(selected.id)||pending.has(selected.id)))throw blocked.get(selected.id)||Error('save_failed')},
  async remove(){await queue;const p=selected;const r=await api('/delete',{id:p.id,revision:p.revision});replace(r.profile);pending.delete(p.id);blocked.delete(p.id);selected=null;return this.profiles[0]||null},
  async exportAll(){await queue;const store=await api('/export');store.unsaved_profiles=[...pending].map(([id,snapshot])=>({id,...snapshot}));return store},
  async importAll(incoming){await queue;const result=await api('/import',{profiles:incoming});const store=await api();profiles=store.profiles;return result.profiles[0]?choose(result.profiles[0]):selected},
  async recoverAsNew(){const p=selected,snapshot=p&&pending.get(p.id);if(!snapshot)throw Error('no_pending_changes');const r=await api('/create',snapshot);replace(r.profile);pending.delete(p.id);blocked.delete(p.id);return choose(r.profile)}
 };
})();

return {get,put,learnerStorage};
})();
const {prepareOffline}=(()=>{
// Both web editions provide a scoped offline adapter; native content is already local.
async function prepareOffline(group,onProgress=()=>{}) {
 if(window.HORIZONS_OFFLINE?.prepare)return window.HORIZONS_OFFLINE.prepare(group,onProgress);
 if(location.pathname.startsWith('/learn/app/')) {
  await import('../pwa-client.js');
  if(window.HORIZONS_OFFLINE?.prepare)return window.HORIZONS_OFFLINE.prepare(group,onProgress);
 }
 const error=new Error('Offline storage is not available in this session');
 error.code=location.protocol==='file:'||/[?&]local=1(?:&|$)/.test(location.search)?'LOCAL_SERVER':'UNSUPPORTED';
 throw error;
}

return {prepareOffline};
})();
// New learner-management strings are authored in all 32 interface languages; independent linguistic review is pending.
// Existing lesson content and the 32-language interface dictionary stay untouched.
const LEARNER_UI={
  "en": {
    "title": "Learners",
    "account": "My settings",
    "name": "Optional nickname",
    "learner": "Learner",
    "add": "Add learner",
    "rename": "Save nickname",
    "remove": "Delete this learner",
    "deleteConfirm": "Delete this learner’s progress from this device? Other learners are unaffected. Exported files and migration backups remain separate copies.",
    "saved": "Saved on this device",
    "saving": "Saving on this device…",
    "failed": "Changes are not saved. Keep this window open and export a backup.",
    "conflict": "Another window changed this learner. Existing progress was not overwritten. Export your changes or save them as a new learner.",
    "recover": "Save my changes as a new learner",
    "cloud": "Cloud sync is not enabled. Last sync: never. Progress stays on this device.",
    "migration": "Previous browser progress is copied with a recovery backup. To migrate older progress, use the same browser and address as before, or import an exported file.",
    "previous": "Previous progress",
    "export": "Export all learners and recovery copies",
    "import": "Import as new learners",
    "importHint": "Import creates separate learner IDs and preserves existing progress.",
    "fallback": "These controls use English when the selected language is unavailable.",
    "browser": "Browser-only storage; use the desktop reader for durable learner files.",
    "ready": "Learner files saved on this device",
    "reload": "Reload saved learner",
    "newConfirm": "Import this file as separate learners, keeping existing progress?",
    "empty": "No valid learner progress found."
  },
  "ar": {
    "title": "المتعلمون",
    "account": "إعداداتي",
    "name": "اسم مستعار اختياري",
    "learner": "متعلم",
    "add": "إضافة متعلم",
    "rename": "حفظ الاسم",
    "remove": "حذف هذا المتعلم",
    "deleteConfirm": "هل تريد حذف تقدم هذا المتعلم من هذا الجهاز؟ لا يتأثر بقية المتعلمين. الملفات المصدّرة ونسخ استرجاع الترحيل تبقى نسخًا مستقلة.",
    "saved": "محفوظ على الجهاز",
    "saving": "جارٍ الحفظ على الجهاز…",
    "failed": "هناك تغييرات غير محفوظة. أبقِ النافذة مفتوحة وصدّر نسخة احتياطية.",
    "conflict": "عدّلت نافذة أخرى هذا الملف. بقي التقدم الموجود دون استبدال؛ صدّر تغييراتك أو احفظها في ملف متعلم جديد.",
    "recover": "حفظ تغييراتي كمتعلم جديد",
    "cloud": "المزامنة السحابية غير مفعلة. آخر مزامنة: لم تحدث. التقدم يبقى على هذا الجهاز.",
    "migration": "يُنقل تقدم المتصفح القديم مع نسخة استرجاع. لترحيله، استخدم المتصفح والعنوان السابقين أو استورد ملف تقدم مصدّرًا.",
    "previous": "التقدم السابق",
    "export": "تصدير جميع المتعلمين ونسخ الاسترجاع",
    "import": "استيراد كملفات متعلمين جديدة",
    "importHint": "ينشئ الاستيراد معرّفات مستقلة ويحافظ على التقدم الموجود.",
    "fallback": "تظهر هذه الأدوات بالإنجليزية عندما لا تتوفر اللغة المختارة.",
    "browser": "الحفظ في المتصفح فقط؛ استخدم مشغّل الحاسوب لملفات المتعلمين الدائمة.",
    "ready": "ملفات المتعلمين محفوظة على الجهاز",
    "reload": "تحميل النسخة المحفوظة",
    "newConfirm": "هل تريد استيراد الملف كملفات متعلمين مستقلة مع الاحتفاظ بالتقدم الموجود؟",
    "empty": "لم يُعثر على تقدم متعلم صالح."
  },
  "tr": {
    "title": "Öğrenenler",
    "account": "Ayarlarım",
    "name": "İsteğe bağlı takma ad",
    "learner": "Öğrenen",
    "add": "Öğrenen ekle",
    "rename": "Adı kaydet",
    "remove": "Bu öğreneni sil",
    "deleteConfirm": "Bu öğrenenin ilerlemesi bu cihazdan silinsin mi? Diğer öğrenenler etkilenmez. Dışa aktarılan dosyalar ve taşıma yedekleri ayrı kopyalar olarak kalır.",
    "saved": "Bu cihaza kaydedildi",
    "saving": "Bu cihaza kaydediliyor…",
    "failed": "Değişiklikler kaydedilmedi. Pencereyi açık tutun ve yedek dışa aktarın.",
    "conflict": "Başka bir pencere bu profili değiştirdi. Mevcut ilerlemenin üzerine yazılmadı. Değişikliklerinizi dışa aktarın veya yeni öğrenen olarak kaydedin.",
    "recover": "Değişikliklerimi yeni öğrenen olarak kaydet",
    "cloud": "Bulut eşitleme etkin değil. Son eşitleme: hiç. İlerleme bu cihazda kalır.",
    "migration": "Eski tarayıcı ilerlemesi kurtarma yedeğiyle taşınır. Aynı tarayıcı ve adresi kullanın veya dışa aktarılan dosyayı içe aktarın.",
    "previous": "Önceki ilerleme",
    "export": "Tüm öğrenenleri ve kurtarma kopyalarını dışa aktar",
    "import": "Yeni öğrenenler olarak içe aktar",
    "importHint": "İçe aktarma yeni kimlikler oluşturur ve mevcut ilerlemeyi korur.",
    "browser": "Yalnızca tarayıcı depolaması; kalıcı dosyalar için masaüstü okuyucuyu kullanın.",
    "ready": "Öğrenen dosyaları bu cihaza kaydedildi",
    "reload": "Kayıtlı öğreneni yeniden yükle",
    "newConfirm": "Mevcut ilerlemeyi koruyarak ayrı öğrenenler olarak içe aktarılsın mı?",
    "empty": "Geçerli ilerleme bulunamadı.",
    "fallback": "Seçilen dil bulunmadığında bu araçlar İngilizce gösterilir."
  },
  "fr": {
    "title": "Apprenants",
    "account": "Mes paramètres",
    "name": "Pseudonyme facultatif",
    "learner": "Apprenant",
    "add": "Ajouter un apprenant",
    "rename": "Enregistrer le nom",
    "remove": "Supprimer cet apprenant",
    "deleteConfirm": "Supprimer la progression de cet apprenant sur cet appareil ? Les autres apprenants ne sont pas concernés. Les exports et sauvegardes de migration restent des copies distinctes.",
    "saved": "Enregistré sur cet appareil",
    "saving": "Enregistrement sur cet appareil…",
    "failed": "Modifications non enregistrées. Gardez cette fenêtre ouverte et exportez une sauvegarde.",
    "conflict": "Une autre fenêtre a modifié ce profil. La progression existante a été conservée. Exportez vos modifications ou enregistrez-les dans un nouveau profil.",
    "recover": "Enregistrer mes modifications dans un nouveau profil",
    "cloud": "Synchronisation cloud désactivée. Dernière synchronisation : jamais. La progression reste sur cet appareil.",
    "migration": "La progression du navigateur est copiée avec une sauvegarde. Utilisez le même navigateur et la même adresse ou importez un fichier exporté.",
    "previous": "Progression précédente",
    "export": "Exporter tous les apprenants et les copies de récupération",
    "import": "Importer de nouveaux apprenants",
    "importHint": "L’import crée de nouveaux identifiants et conserve la progression existante.",
    "browser": "Stockage dans le navigateur uniquement ; utilisez le lecteur de bureau pour des fichiers durables.",
    "ready": "Profils enregistrés sur cet appareil",
    "reload": "Recharger le profil enregistré",
    "newConfirm": "Importer ce fichier dans de nouveaux profils en conservant la progression existante ?",
    "empty": "Aucune progression valide trouvée.",
    "fallback": "Ces commandes s’affichent en anglais si la langue choisie est indisponible."
  },
  "es": {
    "title": "Estudiantes",
    "account": "Mis ajustes",
    "name": "Apodo opcional",
    "learner": "Estudiante",
    "add": "Añadir estudiante",
    "rename": "Guardar nombre",
    "remove": "Eliminar este estudiante",
    "deleteConfirm": "¿Eliminar el progreso de este estudiante en este dispositivo? Los demás no se verán afectados. Las exportaciones y copias de migración seguirán siendo copias independientes.",
    "saved": "Guardado en este dispositivo",
    "saving": "Guardando en este dispositivo…",
    "failed": "Hay cambios sin guardar. Mantén la ventana abierta y exporta una copia.",
    "conflict": "Otra ventana cambió este perfil. El progreso existente no se sobrescribió. Exporta tus cambios o guárdalos como un nuevo estudiante.",
    "recover": "Guardar mis cambios como un nuevo estudiante",
    "cloud": "La sincronización en la nube está desactivada. Última sincronización: nunca. El progreso permanece en este dispositivo.",
    "migration": "El progreso del navegador se copia con una copia de recuperación. Usa el mismo navegador y dirección o importa un archivo exportado.",
    "previous": "Progreso anterior",
    "export": "Exportar todos los estudiantes y copias de recuperación",
    "import": "Importar como nuevos estudiantes",
    "importHint": "La importación crea identificadores nuevos y conserva el progreso existente.",
    "browser": "Solo almacenamiento del navegador; usa el lector de escritorio para archivos duraderos.",
    "ready": "Perfiles guardados en este dispositivo",
    "reload": "Recargar el perfil guardado",
    "newConfirm": "¿Importar como perfiles separados conservando el progreso existente?",
    "empty": "No se encontró progreso válido.",
    "fallback": "Estos controles se muestran en inglés si el idioma elegido no está disponible."
  },
  "de": {
    "title": "Lernende",
    "account": "Meine Einstellungen",
    "name": "Freiwilliger Spitzname",
    "learner": "Lernende Person",
    "add": "Lernende Person hinzufügen",
    "rename": "Spitznamen speichern",
    "remove": "Dieses Lernprofil löschen",
    "deleteConfirm": "Den Lernfortschritt dieses Profils von diesem Gerät löschen? Andere Lernende sind nicht betroffen. Exportierte Dateien und Sicherungen der Datenübernahme bleiben als separate Kopien erhalten.",
    "saved": "Auf diesem Gerät gespeichert",
    "saving": "Wird auf diesem Gerät gespeichert…",
    "failed": "Änderungen sind nicht gespeichert. Lass dieses Fenster geöffnet und exportiere eine Sicherung.",
    "conflict": "Dieses Lernprofil wurde in einem anderen Fenster geändert. Der vorhandene Fortschritt wurde nicht überschrieben. Exportiere deine Änderungen oder speichere sie als neues Lernprofil.",
    "recover": "Meine Änderungen als neues Lernprofil speichern",
    "cloud": "Die Cloud-Synchronisierung ist nicht aktiviert. Letzte Synchronisierung: noch nie. Der Fortschritt bleibt auf diesem Gerät.",
    "migration": "Der bisherige Lernfortschritt im Browser wird mit einer Sicherung zur Wiederherstellung übernommen. Verwende dafür denselben Browser und dieselbe Adresse wie zuvor oder importiere eine exportierte Datei.",
    "previous": "Bisheriger Lernfortschritt",
    "export": "Alle Lernprofile und Wiederherstellungskopien exportieren",
    "import": "Als neue Lernprofile importieren",
    "importHint": "Beim Import werden eigene Kennungen für die Lernprofile erstellt. Vorhandener Fortschritt bleibt erhalten.",
    "fallback": "Diese Bedienelemente werden auf Englisch angezeigt, wenn die gewählte Sprache nicht verfügbar ist.",
    "browser": "Speicherung nur im Browser; verwende für dauerhaft gespeicherte Lernprofile die Desktop-Anwendung.",
    "ready": "Lernprofile auf diesem Gerät gespeichert",
    "reload": "Gespeichertes Lernprofil neu laden",
    "newConfirm": "Diese Datei als separate Lernprofile importieren und vorhandenen Fortschritt beibehalten?",
    "empty": "Kein gültiger Lernfortschritt gefunden."
  },
  "it": {
    "title": "Studenti",
    "account": "Le mie impostazioni",
    "name": "Soprannome facoltativo",
    "learner": "Studente",
    "add": "Aggiungi studente",
    "rename": "Salva soprannome",
    "remove": "Elimina questo studente",
    "deleteConfirm": "Eliminare i progressi di questo studente da questo dispositivo? Gli altri studenti non saranno interessati. I file esportati e i backup della migrazione rimarranno copie separate.",
    "saved": "Salvato su questo dispositivo",
    "saving": "Salvataggio su questo dispositivo…",
    "failed": "Le modifiche non sono salvate. Tieni aperta questa finestra ed esporta un backup.",
    "conflict": "Un’altra finestra ha modificato questo profilo. I progressi esistenti non sono stati sovrascritti. Esporta le modifiche o salvale come nuovo studente.",
    "recover": "Salva le mie modifiche come nuovo studente",
    "cloud": "La sincronizzazione cloud non è attiva. Ultima sincronizzazione: mai. I progressi rimangono su questo dispositivo.",
    "migration": "I precedenti progressi nel browser vengono copiati insieme a un backup di ripristino. Per trasferirli, usa lo stesso browser e lo stesso indirizzo di prima, oppure importa un file esportato.",
    "previous": "Progressi precedenti",
    "export": "Esporta tutti gli studenti e le copie di ripristino",
    "import": "Importa come nuovi studenti",
    "importHint": "L’importazione crea identificativi distinti per gli studenti e conserva i progressi esistenti.",
    "fallback": "Questi comandi sono in inglese se la lingua scelta non è disponibile.",
    "browser": "Salvataggio solo nel browser; usa l’applicazione desktop per conservare i profili degli studenti in file duraturi.",
    "ready": "Profili degli studenti salvati su questo dispositivo",
    "reload": "Ricarica il profilo salvato",
    "newConfirm": "Importare questo file come profili separati, mantenendo i progressi esistenti?",
    "empty": "Nessun progresso valido trovato."
  },
  "pt": {
    "title": "Alunos",
    "account": "Minhas configurações",
    "name": "Apelido opcional",
    "learner": "Aluno",
    "add": "Adicionar aluno",
    "rename": "Salvar apelido",
    "remove": "Excluir este aluno",
    "deleteConfirm": "Excluir o progresso deste aluno deste dispositivo? Os outros alunos não serão afetados. Os arquivos exportados e os backups da migração continuarão como cópias separadas.",
    "saved": "Salvo neste dispositivo",
    "saving": "Salvando neste dispositivo…",
    "failed": "As alterações não foram salvas. Mantenha esta janela aberta e exporte um backup.",
    "conflict": "Outra janela alterou este perfil. O progresso existente não foi substituído. Exporte suas alterações ou salve-as como um novo aluno.",
    "recover": "Salvar minhas alterações como um novo aluno",
    "cloud": "A sincronização na nuvem não está ativada. Última sincronização: nunca. O progresso permanece neste dispositivo.",
    "migration": "O progresso anterior do navegador é copiado com um backup para recuperação. Para transferi-lo, use o mesmo navegador e endereço de antes ou importe um arquivo exportado.",
    "previous": "Progresso anterior",
    "export": "Exportar todos os alunos e as cópias de recuperação",
    "import": "Importar como novos alunos",
    "importHint": "A importação cria identificadores separados para os alunos e preserva o progresso existente.",
    "fallback": "Estes controlos são apresentados em inglês quando o idioma escolhido não está disponível.",
    "browser": "Armazenamento apenas no navegador; use o aplicativo para computador para manter arquivos duráveis dos alunos.",
    "ready": "Perfis dos alunos salvos neste dispositivo",
    "reload": "Recarregar o perfil salvo",
    "newConfirm": "Importar este arquivo como perfis separados, mantendo o progresso existente?",
    "empty": "Nenhum progresso válido encontrado."
  },
  "nl": {
    "title": "Cursisten",
    "account": "Mijn instellingen",
    "name": "Optionele bijnaam",
    "learner": "Cursist",
    "add": "Cursist toevoegen",
    "rename": "Bijnaam opslaan",
    "remove": "Deze cursist verwijderen",
    "deleteConfirm": "De voortgang van deze cursist van dit apparaat verwijderen? Andere cursisten worden niet beïnvloed. Geëxporteerde bestanden en migratieback-ups blijven als afzonderlijke kopieën bewaard.",
    "saved": "Op dit apparaat opgeslagen",
    "saving": "Opslaan op dit apparaat…",
    "failed": "De wijzigingen zijn niet opgeslagen. Houd dit venster open en exporteer een back-up.",
    "conflict": "Dit profiel is in een ander venster gewijzigd. De bestaande voortgang is niet overschreven. Exporteer je wijzigingen of sla ze op als een nieuwe cursist.",
    "recover": "Mijn wijzigingen opslaan als een nieuwe cursist",
    "cloud": "Cloudsynchronisatie is niet ingeschakeld. Laatste synchronisatie: nooit. De voortgang blijft op dit apparaat.",
    "migration": "De eerdere voortgang in de browser wordt gekopieerd met een herstelback-up. Gebruik dezelfde browser en hetzelfde adres als voorheen om de voortgang over te zetten, of importeer een geëxporteerd bestand.",
    "previous": "Eerdere voortgang",
    "export": "Alle cursisten en herstelkopieën exporteren",
    "import": "Als nieuwe cursisten importeren",
    "importHint": "Bij het importeren krijgt elke cursist een afzonderlijke ID en blijft de bestaande voortgang behouden.",
    "fallback": "Deze bedieningselementen worden in het Engels weergegeven als de gekozen taal niet beschikbaar is.",
    "browser": "Opslag alleen in de browser; gebruik de desktopapp om cursistbestanden blijvend te bewaren.",
    "ready": "Cursistprofielen opgeslagen op dit apparaat",
    "reload": "Opgeslagen profiel opnieuw laden",
    "newConfirm": "Dit bestand als afzonderlijke profielen importeren en de bestaande voortgang behouden?",
    "empty": "Geen geldige leervoortgang gevonden."
  },
  "ru": {
    "title": "Учащиеся",
    "account": "Мои настройки",
    "name": "Псевдоним (необязательно)",
    "learner": "Учащийся",
    "add": "Добавить учащегося",
    "rename": "Сохранить псевдоним",
    "remove": "Удалить этого учащегося",
    "deleteConfirm": "Удалить прогресс этого учащегося с этого устройства? Данные других учащихся не изменятся. Экспортированные файлы и резервные копии переноса сохранятся отдельно.",
    "saved": "Сохранено на этом устройстве",
    "saving": "Сохранение на этом устройстве…",
    "failed": "Изменения не сохранены. Оставьте это окно открытым и экспортируйте резервную копию.",
    "conflict": "Этот профиль изменён в другом окне. Существующий прогресс не перезаписан. Экспортируйте свои изменения или сохраните их в новом профиле учащегося.",
    "recover": "Сохранить мои изменения в новом профиле",
    "cloud": "Синхронизация с облаком не включена. Последняя синхронизация: никогда. Прогресс остаётся на этом устройстве.",
    "migration": "Предыдущий прогресс из браузера копируется с созданием резервной копии для восстановления. Для переноса используйте тот же браузер и адрес, что и раньше, либо импортируйте экспортированный файл.",
    "previous": "Предыдущий прогресс",
    "export": "Экспортировать всех учащихся и копии для восстановления",
    "import": "Импортировать как новые профили",
    "importHint": "При импорте создаются отдельные идентификаторы учащихся. Существующий прогресс сохраняется.",
    "fallback": "Если выбранный язык недоступен, эти элементы управления отображаются на английском.",
    "browser": "Данные хранятся только в браузере; для постоянного хранения файлов учащихся используйте приложение для компьютера.",
    "ready": "Профили учащихся сохранены на этом устройстве",
    "reload": "Загрузить сохранённый профиль заново",
    "newConfirm": "Импортировать этот файл как отдельные профили, сохранив существующий прогресс?",
    "empty": "Допустимые данные о прогрессе не найдены."
  },
  "uk": {
    "title": "Учні",
    "account": "Мої налаштування",
    "name": "Псевдонім (необов’язково)",
    "learner": "Учень",
    "add": "Додати учня",
    "rename": "Зберегти псевдонім",
    "remove": "Видалити цього учня",
    "deleteConfirm": "Видалити прогрес цього учня з цього пристрою? Дані інших учнів не зміняться. Експортовані файли та резервні копії перенесення залишаться окремими копіями.",
    "saved": "Збережено на цьому пристрої",
    "saving": "Збереження на цьому пристрої…",
    "failed": "Зміни не збережено. Залиште це вікно відкритим та експортуйте резервну копію.",
    "conflict": "Цей профіль змінено в іншому вікні. Наявний прогрес не перезаписано. Експортуйте свої зміни або збережіть їх у новому профілі учня.",
    "recover": "Зберегти мої зміни в новому профілі",
    "cloud": "Синхронізацію з хмарою не ввімкнено. Остання синхронізація: ніколи. Прогрес залишається на цьому пристрої.",
    "migration": "Попередній прогрес із браузера копіюється зі створенням резервної копії для відновлення. Для перенесення використовуйте той самий браузер і адресу, що й раніше, або імпортуйте експортований файл.",
    "previous": "Попередній прогрес",
    "export": "Експортувати всіх учнів і копії для відновлення",
    "import": "Імпортувати як нові профілі",
    "importHint": "Під час імпорту створюються окремі ідентифікатори учнів, а наявний прогрес зберігається.",
    "fallback": "Якщо вибрана мова недоступна, ці елементи керування відображаються англійською.",
    "browser": "Дані зберігаються лише в браузері; для постійного зберігання файлів учнів використовуйте застосунок для комп’ютера.",
    "ready": "Профілі учнів збережено на цьому пристрої",
    "reload": "Знову завантажити збережений профіль",
    "newConfirm": "Імпортувати цей файл як окремі профілі, зберігши наявний прогрес?",
    "empty": "Коректних даних про прогрес не знайдено."
  },
  "pl": {
    "title": "Uczący się",
    "account": "Moje ustawienia",
    "name": "Pseudonim (opcjonalnie)",
    "learner": "Osoba ucząca się",
    "add": "Dodaj osobę uczącą się",
    "rename": "Zapisz pseudonim",
    "remove": "Usuń ten profil",
    "deleteConfirm": "Usunąć postępy tej osoby z tego urządzenia? Nie wpłynie to na pozostałe osoby. Wyeksportowane pliki i kopie zapasowe migracji pozostaną oddzielnymi kopiami.",
    "saved": "Zapisano na tym urządzeniu",
    "saving": "Zapisywanie na tym urządzeniu…",
    "failed": "Zmiany nie zostały zapisane. Nie zamykaj tego okna i wyeksportuj kopię zapasową.",
    "conflict": "Ten profil zmieniono w innym oknie. Istniejące postępy nie zostały nadpisane. Wyeksportuj swoje zmiany lub zapisz je jako nowy profil.",
    "recover": "Zapisz moje zmiany jako nowy profil",
    "cloud": "Synchronizacja z chmurą jest wyłączona. Ostatnia synchronizacja: nigdy. Postępy pozostają na tym urządzeniu.",
    "migration": "Poprzednie postępy z przeglądarki są kopiowane wraz z kopią do odzyskiwania. Aby je przenieść, użyj tej samej przeglądarki i adresu co wcześniej albo zaimportuj wyeksportowany plik.",
    "previous": "Poprzednie postępy",
    "export": "Eksportuj wszystkie profile i kopie do odzyskiwania",
    "import": "Importuj jako nowe profile",
    "importHint": "Import tworzy oddzielne identyfikatory profili i zachowuje istniejące postępy.",
    "fallback": "Te elementy sterujące są wyświetlane po angielsku, gdy wybrany język jest niedostępny.",
    "browser": "Dane są przechowywane tylko w przeglądarce; aby trwale zapisywać pliki profili, użyj aplikacji komputerowej.",
    "ready": "Profile zapisano na tym urządzeniu",
    "reload": "Wczytaj ponownie zapisany profil",
    "newConfirm": "Zaimportować ten plik jako oddzielne profile, zachowując istniejące postępy?",
    "empty": "Nie znaleziono prawidłowych danych o postępach."
  },
  "cs": {
    "title": "Studující",
    "account": "Moje nastavení",
    "name": "Přezdívka (nepovinné)",
    "learner": "Studující",
    "add": "Přidat studujícího",
    "rename": "Uložit přezdívku",
    "remove": "Smazat tento profil",
    "deleteConfirm": "Smazat pokrok tohoto studujícího z tohoto zařízení? Ostatní studující nebudou ovlivněni. Exportované soubory a zálohy převodu zůstanou jako samostatné kopie.",
    "saved": "Uloženo v tomto zařízení",
    "saving": "Ukládání do tohoto zařízení…",
    "failed": "Změny nejsou uložené. Nechte toto okno otevřené a exportujte zálohu.",
    "conflict": "Tento profil byl změněn v jiném okně. Dosavadní pokrok nebyl přepsán. Exportujte své změny nebo je uložte jako nový profil.",
    "recover": "Uložit moje změny jako nový profil",
    "cloud": "Synchronizace s cloudem není zapnutá. Poslední synchronizace: nikdy. Pokrok zůstává v tomto zařízení.",
    "migration": "Předchozí pokrok z prohlížeče se kopíruje se zálohou pro obnovení. K převodu použijte stejný prohlížeč a adresu jako dříve nebo importujte exportovaný soubor.",
    "previous": "Předchozí pokrok",
    "export": "Exportovat všechny profily a kopie pro obnovení",
    "import": "Importovat jako nové profily",
    "importHint": "Import vytvoří samostatné identifikátory profilů a zachová dosavadní pokrok.",
    "fallback": "Pokud vybraný jazyk není dostupný, tyto ovládací prvky se zobrazí anglicky.",
    "browser": "Ukládání pouze v prohlížeči; pro trvalé soubory profilů použijte počítačovou aplikaci.",
    "ready": "Profily jsou uložené v tomto zařízení",
    "reload": "Znovu načíst uložený profil",
    "newConfirm": "Importovat tento soubor jako samostatné profily a zachovat dosavadní pokrok?",
    "empty": "Nebyly nalezeny platné údaje o pokroku."
  },
  "ro": {
    "title": "Cursanți",
    "account": "Setările mele",
    "name": "Pseudonim opțional",
    "learner": "Cursant",
    "add": "Adaugă un cursant",
    "rename": "Salvează pseudonimul",
    "remove": "Șterge acest cursant",
    "deleteConfirm": "Ștergi progresul acestui cursant de pe acest dispozitiv? Ceilalți cursanți nu vor fi afectați. Fișierele exportate și copiile de siguranță ale migrării vor rămâne copii separate.",
    "saved": "Salvat pe acest dispozitiv",
    "saving": "Se salvează pe acest dispozitiv…",
    "failed": "Modificările nu sunt salvate. Păstrează această fereastră deschisă și exportă o copie de siguranță.",
    "conflict": "Acest profil a fost modificat în altă fereastră. Progresul existent nu a fost suprascris. Exportă modificările sau salvează-le ca profil nou.",
    "recover": "Salvează modificările mele ca profil nou",
    "cloud": "Sincronizarea în cloud nu este activată. Ultima sincronizare: niciodată. Progresul rămâne pe acest dispozitiv.",
    "migration": "Progresul anterior din browser este copiat împreună cu o copie de siguranță pentru recuperare. Pentru a-l transfera, folosește același browser și aceeași adresă ca înainte sau importă un fișier exportat.",
    "previous": "Progres anterior",
    "export": "Exportă toți cursanții și copiile de recuperare",
    "import": "Importă ca profiluri noi",
    "importHint": "Importul creează identificatori separați pentru cursanți și păstrează progresul existent.",
    "fallback": "Aceste comenzi sunt afișate în engleză când limba aleasă nu este disponibilă.",
    "browser": "Stocare numai în browser; folosește aplicația pentru computer pentru păstrarea durabilă a fișierelor cursanților.",
    "ready": "Profilurile cursanților sunt salvate pe acest dispozitiv",
    "reload": "Reîncarcă profilul salvat",
    "newConfirm": "Importi acest fișier ca profiluri separate, păstrând progresul existent?",
    "empty": "Nu s-au găsit date valide despre progres."
  },
  "hu": {
    "title": "Tanulók",
    "account": "Saját beállítások",
    "name": "Becenév (nem kötelező)",
    "learner": "Tanuló",
    "add": "Tanuló hozzáadása",
    "rename": "Becenév mentése",
    "remove": "Tanuló törlése",
    "deleteConfirm": "Törli ennek a tanulónak az előrehaladását erről az eszközről? A többi tanuló adatai nem változnak. Az exportált fájlok és az átvitelkor készült biztonsági másolatok külön másolatként megmaradnak.",
    "saved": "Elmentve ezen az eszközön",
    "saving": "Mentés erre az eszközre…",
    "failed": "A módosítások nincsenek elmentve. Tartsa nyitva ezt az ablakot, és exportáljon biztonsági másolatot.",
    "conflict": "Ezt a profilt egy másik ablakban módosították. A meglévő előrehaladás nem íródott felül. Exportálja a módosításait, vagy mentse őket új tanulói profilként.",
    "recover": "Módosításaim mentése új tanulói profilként",
    "cloud": "A felhőszinkronizálás nincs bekapcsolva. Utolsó szinkronizálás: még nem történt. Az előrehaladás ezen az eszközön marad.",
    "migration": "A böngészőben tárolt korábbi előrehaladás másolásakor helyreállítási másolat is készül. Az átvitelhez használja a korábbi böngészőt és címet, vagy importáljon egy exportált fájlt.",
    "previous": "Korábbi előrehaladás",
    "export": "Minden tanuló és helyreállítási másolat exportálása",
    "import": "Importálás új tanulói profilokként",
    "importHint": "Az importálás külön tanulói azonosítókat hoz létre, és megőrzi a meglévő előrehaladást.",
    "fallback": "Ezek a vezérlők angolul jelennek meg, ha a kiválasztott nyelv nem érhető el.",
    "browser": "Tárolás csak a böngészőben; a tanulói fájlok tartós tárolásához használja az asztali alkalmazást.",
    "ready": "A tanulói profilok elmentve ezen az eszközön",
    "reload": "Mentett profil újbóli betöltése",
    "newConfirm": "Importálja ezt a fájlt külön profilokként, a meglévő előrehaladás megőrzésével?",
    "empty": "Nem találhatók érvényes előrehaladási adatok."
  },
  "el": {
    "title": "Εκπαιδευόμενοι",
    "account": "Οι ρυθμίσεις μου",
    "name": "Προαιρετικό ψευδώνυμο",
    "learner": "Εκπαιδευόμενος",
    "add": "Προσθήκη εκπαιδευόμενου",
    "rename": "Αποθήκευση ψευδωνύμου",
    "remove": "Διαγραφή αυτού του εκπαιδευόμενου",
    "deleteConfirm": "Να διαγραφεί η πρόοδος αυτού του εκπαιδευόμενου από αυτή τη συσκευή; Οι υπόλοιποι εκπαιδευόμενοι δεν επηρεάζονται. Τα εξαγόμενα αρχεία και τα αντίγραφα ασφαλείας της μεταφοράς θα παραμείνουν ξεχωριστά αντίγραφα.",
    "saved": "Αποθηκεύτηκε σε αυτή τη συσκευή",
    "saving": "Αποθήκευση σε αυτή τη συσκευή…",
    "failed": "Οι αλλαγές δεν έχουν αποθηκευτεί. Κρατήστε ανοιχτό αυτό το παράθυρο και εξαγάγετε ένα αντίγραφο ασφαλείας.",
    "conflict": "Αυτό το προφίλ άλλαξε σε άλλο παράθυρο. Η υπάρχουσα πρόοδος δεν αντικαταστάθηκε. Εξαγάγετε τις αλλαγές σας ή αποθηκεύστε τις ως νέο προφίλ εκπαιδευόμενου.",
    "recover": "Αποθήκευση των αλλαγών μου ως νέου προφίλ",
    "cloud": "Ο συγχρονισμός στο cloud δεν είναι ενεργοποιημένος. Τελευταίος συγχρονισμός: ποτέ. Η πρόοδος παραμένει σε αυτή τη συσκευή.",
    "migration": "Η προηγούμενη πρόοδος από το πρόγραμμα περιήγησης αντιγράφεται μαζί με ένα αντίγραφο ανάκτησης. Για τη μεταφορά της, χρησιμοποιήστε το ίδιο πρόγραμμα περιήγησης και την ίδια διεύθυνση όπως πριν ή εισαγάγετε ένα αρχείο που έχετε εξαγάγει.",
    "previous": "Προηγούμενη πρόοδος",
    "export": "Εξαγωγή όλων των εκπαιδευόμενων και των αντιγράφων ανάκτησης",
    "import": "Εισαγωγή ως νέα προφίλ",
    "importHint": "Η εισαγωγή δημιουργεί ξεχωριστά αναγνωριστικά εκπαιδευόμενων και διατηρεί την υπάρχουσα πρόοδο.",
    "fallback": "Αυτά τα στοιχεία ελέγχου εμφανίζονται στα αγγλικά όταν η επιλεγμένη γλώσσα δεν είναι διαθέσιμη.",
    "browser": "Αποθήκευση μόνο στο πρόγραμμα περιήγησης· χρησιμοποιήστε την εφαρμογή υπολογιστή για μόνιμη αποθήκευση των αρχείων εκπαιδευόμενων.",
    "ready": "Τα προφίλ εκπαιδευόμενων αποθηκεύτηκαν σε αυτή τη συσκευή",
    "reload": "Επαναφόρτωση αποθηκευμένου προφίλ",
    "newConfirm": "Να εισαχθεί αυτό το αρχείο ως ξεχωριστά προφίλ, διατηρώντας την υπάρχουσα πρόοδο;",
    "empty": "Δεν βρέθηκαν έγκυρα δεδομένα προόδου."
  },
  "sv": {
    "title": "Deltagare",
    "account": "Mina inställningar",
    "name": "Valfritt smeknamn",
    "learner": "Deltagare",
    "add": "Lägg till deltagare",
    "rename": "Spara smeknamn",
    "remove": "Ta bort den här deltagaren",
    "deleteConfirm": "Ta bort den här deltagarens framsteg från enheten? Andra deltagare påverkas inte. Exporterade filer och säkerhetskopior från överföringen finns kvar som separata kopior.",
    "saved": "Sparat på den här enheten",
    "saving": "Sparar på den här enheten…",
    "failed": "Ändringarna har inte sparats. Låt det här fönstret vara öppet och exportera en säkerhetskopia.",
    "conflict": "Den här profilen ändrades i ett annat fönster. Befintliga framsteg skrevs inte över. Exportera dina ändringar eller spara dem som en ny deltagare.",
    "recover": "Spara mina ändringar som en ny deltagare",
    "cloud": "Molnsynkronisering är inte aktiverad. Senaste synkronisering: aldrig. Framstegen stannar på den här enheten.",
    "migration": "Tidigare framsteg i webbläsaren kopieras tillsammans med en återställningskopia. För att överföra dem använder du samma webbläsare och adress som tidigare, eller importerar en exporterad fil.",
    "previous": "Tidigare framsteg",
    "export": "Exportera alla deltagare och återställningskopior",
    "import": "Importera som nya deltagare",
    "importHint": "Importen skapar separata deltagar-ID:n och behåller befintliga framsteg.",
    "fallback": "Dessa kontroller visas på engelska om det valda språket inte är tillgängligt.",
    "browser": "Lagring endast i webbläsaren; använd datorappen för att spara deltagarfiler varaktigt.",
    "ready": "Deltagarprofiler sparade på den här enheten",
    "reload": "Läs in den sparade profilen igen",
    "newConfirm": "Importera den här filen som separata profiler och behålla befintliga framsteg?",
    "empty": "Inga giltiga framstegsdata hittades."
  },
  "da": {
    "title": "Deltagere",
    "account": "Mine indstillinger",
    "name": "Valgfrit kaldenavn",
    "learner": "Deltager",
    "add": "Tilføj deltager",
    "rename": "Gem kaldenavn",
    "remove": "Slet denne deltager",
    "deleteConfirm": "Slet denne deltagers fremskridt fra denne enhed? Andre deltagere påvirkes ikke. Eksporterede filer og sikkerhedskopier fra overførslen bevares som separate kopier.",
    "saved": "Gemt på denne enhed",
    "saving": "Gemmer på denne enhed…",
    "failed": "Ændringerne er ikke gemt. Hold dette vindue åbent, og eksportér en sikkerhedskopi.",
    "conflict": "Denne profil blev ændret i et andet vindue. De eksisterende fremskridt blev ikke overskrevet. Eksportér dine ændringer, eller gem dem som en ny deltager.",
    "recover": "Gem mine ændringer som en ny deltager",
    "cloud": "Synkronisering med skyen er ikke aktiveret. Seneste synkronisering: aldrig. Fremskridtene forbliver på denne enhed.",
    "migration": "Tidligere fremskridt i browseren kopieres sammen med en gendannelseskopi. Brug den samme browser og adresse som før for at overføre dem, eller importér en eksporteret fil.",
    "previous": "Tidligere fremskridt",
    "export": "Eksportér alle deltagere og gendannelseskopier",
    "import": "Importér som nye deltagere",
    "importHint": "Importen opretter separate deltager-id’er og bevarer eksisterende fremskridt.",
    "fallback": "Disse betjeningselementer vises på engelsk, hvis det valgte sprog ikke er tilgængeligt.",
    "browser": "Kun lagring i browseren; brug computerappen til varig lagring af deltagerfiler.",
    "ready": "Deltagerprofiler er gemt på denne enhed",
    "reload": "Genindlæs den gemte profil",
    "newConfirm": "Importér denne fil som separate profiler, og behold de eksisterende fremskridt?",
    "empty": "Der blev ikke fundet gyldige fremskridtsdata."
  },
  "no": {
    "title": "Deltakere",
    "account": "Mine innstillinger",
    "name": "Valgfritt kallenavn",
    "learner": "Deltaker",
    "add": "Legg til deltaker",
    "rename": "Lagre kallenavn",
    "remove": "Slett denne deltakeren",
    "deleteConfirm": "Slette fremgangen til denne deltakeren fra enheten? Andre deltakere påvirkes ikke. Eksporterte filer og sikkerhetskopier fra overføringen blir beholdt som separate kopier.",
    "saved": "Lagret på denne enheten",
    "saving": "Lagrer på denne enheten…",
    "failed": "Endringene er ikke lagret. Hold dette vinduet åpent og eksporter en sikkerhetskopi.",
    "conflict": "Denne profilen ble endret i et annet vindu. Eksisterende fremgang ble ikke overskrevet. Eksporter endringene dine eller lagre dem som en ny deltaker.",
    "recover": "Lagre endringene mine som en ny deltaker",
    "cloud": "Skysynkronisering er ikke aktivert. Siste synkronisering: aldri. Fremgangen blir på denne enheten.",
    "migration": "Tidligere fremgang i nettleseren kopieres med en gjenopprettingskopi. Bruk samme nettleser og adresse som før for å overføre den, eller importer en eksportert fil.",
    "previous": "Tidligere fremgang",
    "export": "Eksporter alle deltakere og gjenopprettingskopier",
    "import": "Importer som nye deltakere",
    "importHint": "Importen oppretter separate deltaker-ID-er og bevarer eksisterende fremgang.",
    "fallback": "Disse kontrollene vises på engelsk hvis det valgte språket ikke er tilgjengelig.",
    "browser": "Lagring bare i nettleseren; bruk skrivebordsappen for varig lagring av deltakerfiler.",
    "ready": "Deltakerprofiler er lagret på denne enheten",
    "reload": "Last inn den lagrede profilen på nytt",
    "newConfirm": "Importere denne filen som separate profiler og beholde eksisterende fremgang?",
    "empty": "Fant ingen gyldige fremgangsdata."
  },
  "fi": {
    "title": "Oppijat",
    "account": "Omat asetukset",
    "name": "Vapaaehtoinen nimimerkki",
    "learner": "Oppija",
    "add": "Lisää oppija",
    "rename": "Tallenna nimimerkki",
    "remove": "Poista tämä oppija",
    "deleteConfirm": "Poistetaanko tämän oppijan edistyminen tältä laitteelta? Muiden oppijoiden tiedot eivät muutu. Viedyt tiedostot ja siirron palautusvarmuuskopiot säilyvät erillisinä kopioina.",
    "saved": "Tallennettu tälle laitteelle",
    "saving": "Tallennetaan tälle laitteelle…",
    "failed": "Muutoksia ei ole tallennettu. Pidä tämä ikkuna auki ja vie varmuuskopio.",
    "conflict": "Tätä oppijaa muutettiin toisessa ikkunassa. Olemassa olevaa edistymistä ei korvattu. Vie muutoksesi tai tallenna ne uutena oppijana.",
    "recover": "Tallenna muutokseni uutena oppijana",
    "cloud": "Pilvisynkronointi ei ole käytössä. Viimeisin synkronointi: ei koskaan. Edistyminen säilyy tällä laitteella.",
    "migration": "Aiempi selaimeen tallennettu edistyminen kopioidaan, ja siitä tehdään palautusvarmuuskopio. Siirrä aiemmat tiedot käyttämällä samaa selainta ja osoitetta kuin ennen tai tuo aiemmin viety tiedosto.",
    "previous": "Aiempi edistyminen",
    "export": "Vie kaikki oppijat ja palautuskopiot",
    "import": "Tuo uusina oppijoina",
    "importHint": "Tuonti luo erilliset oppijatunnisteet ja säilyttää olemassa olevan edistymisen.",
    "fallback": "Nämä toiminnot näytetään englanniksi, jos valittua kieltä ei ole saatavilla.",
    "browser": "Tiedot tallennetaan vain selaimeen. Käytä työpöytäsovellusta, jotta oppijatiedostot tallentuvat pysyvästi.",
    "ready": "Oppijatiedostot on tallennettu tälle laitteelle",
    "reload": "Lataa tallennettu oppija uudelleen",
    "newConfirm": "Tuodaanko tämä tiedosto erillisinä oppijoina ja säilytetäänkö olemassa oleva edistyminen?",
    "empty": "Kelvollista oppijan edistymistietoa ei löytynyt."
  },
  "bg": {
    "title": "Обучаващи се",
    "account": "Моите настройки",
    "name": "Псевдоним по желание",
    "learner": "Обучаващ се",
    "add": "Добавяне на обучаващ се",
    "rename": "Запазване на псевдонима",
    "remove": "Изтриване на този обучаващ се",
    "deleteConfirm": "Да се изтрие ли напредъкът на този обучаващ се от това устройство? Другите обучаващи се няма да бъдат засегнати. Експортираните файлове и резервните копия от прехвърлянето остават отделни копия.",
    "saved": "Запазено на това устройство",
    "saving": "Запазване на това устройство…",
    "failed": "Промените не са запазени. Оставете този прозорец отворен и експортирайте резервно копие.",
    "conflict": "Друг прозорец е променил този профил. Съществуващият напредък не е презаписан. Експортирайте промените си или ги запазете като нов обучаващ се.",
    "recover": "Запазване на моите промени като нов обучаващ се",
    "cloud": "Синхронизирането с облака не е включено. Последна синхронизация: никога. Напредъкът остава на това устройство.",
    "migration": "Предишният напредък от браузъра се копира заедно с резервно копие за възстановяване. За да прехвърлите по-стар напредък, използвайте същия браузър и адрес като преди или импортирайте експортиран файл.",
    "previous": "Предишен напредък",
    "export": "Експортиране на всички обучаващи се и копия за възстановяване",
    "import": "Импортиране като нови обучаващи се",
    "importHint": "Импортирането създава отделни идентификатори на обучаващи се и запазва съществуващия напредък.",
    "fallback": "Тези контроли се показват на английски, ако избраният език не е наличен.",
    "browser": "Данните се съхраняват само в браузъра. Използвайте настолното приложение за трайно съхранение на файловете на обучаващите се.",
    "ready": "Файловете на обучаващите се са запазени на това устройство",
    "reload": "Повторно зареждане на запазения профил",
    "newConfirm": "Да се импортира ли този файл като отделни обучаващи се, като се запази съществуващият напредък?",
    "empty": "Не е намерен валиден напредък на обучаващ се."
  },
  "sr": {
    "title": "Полазници",
    "account": "Моја подешавања",
    "name": "Надимак по жељи",
    "learner": "Полазник",
    "add": "Додај полазника",
    "rename": "Сачувај надимак",
    "remove": "Обриши овог полазника",
    "deleteConfirm": "Обрисати напредак овог полазника са овог уређаја? Остали полазници неће бити погођени. Извезене датотеке и резервне копије направљене при преносу остају засебне копије.",
    "saved": "Сачувано на овом уређају",
    "saving": "Чување на овом уређају…",
    "failed": "Измене нису сачуване. Оставите овај прозор отворен и извезите резервну копију.",
    "conflict": "Овај профил је измењен у другом прозору. Постојећи напредак није преписан. Извезите своје измене или их сачувајте као новог полазника.",
    "recover": "Сачувај моје измене као новог полазника",
    "cloud": "Синхронизација са облаком није укључена. Последња синхронизација: никада. Напредак остаје на овом уређају.",
    "migration": "Претходни напредак из прегледача копира се уз резервну копију за опоравак. За пренос старијег напретка користите исти прегледач и адресу као раније или увезите извезену датотеку.",
    "previous": "Претходни напредак",
    "export": "Извези све полазнике и копије за опоравак",
    "import": "Увези као нове полазнике",
    "importHint": "Увоз прави засебне идентификаторе полазника и чува постојећи напредак.",
    "fallback": "Ове контроле се приказују на енглеском ако изабрани језик није доступан.",
    "browser": "Подаци се чувају само у прегледачу. Користите рачунарску апликацију за трајне датотеке полазника.",
    "ready": "Датотеке полазника су сачуване на овом уређају",
    "reload": "Поново учитај сачуваног полазника",
    "newConfirm": "Увести ову датотеку као засебне полазнике уз очување постојећег напретка?",
    "empty": "Нису пронађени исправни подаци о напретку полазника."
  },
  "hr": {
    "title": "Polaznici",
    "account": "Moje postavke",
    "name": "Nadimak po želji",
    "learner": "Polaznik",
    "add": "Dodaj polaznika",
    "rename": "Spremi nadimak",
    "remove": "Izbriši ovog polaznika",
    "deleteConfirm": "Izbrisati napredak ovog polaznika s ovog uređaja? Ostali polaznici neće biti zahvaćeni. Izvezene datoteke i sigurnosne kopije napravljene pri prijenosu ostaju zasebne kopije.",
    "saved": "Spremljeno na ovom uređaju",
    "saving": "Spremanje na ovom uređaju…",
    "failed": "Promjene nisu spremljene. Ostavite ovaj prozor otvoren i izvezite sigurnosnu kopiju.",
    "conflict": "Ovaj je profil promijenjen u drugom prozoru. Postojeći napredak nije prepisan. Izvezite svoje promjene ili ih spremite kao novog polaznika.",
    "recover": "Spremi moje promjene kao novog polaznika",
    "cloud": "Sinkronizacija s oblakom nije uključena. Posljednja sinkronizacija: nikad. Napredak ostaje na ovom uređaju.",
    "migration": "Prethodni napredak iz preglednika kopira se uz sigurnosnu kopiju za oporavak. Za prijenos starijeg napretka upotrijebite isti preglednik i adresu kao prije ili uvezite izvezenu datoteku.",
    "previous": "Prethodni napredak",
    "export": "Izvezi sve polaznike i kopije za oporavak",
    "import": "Uvezi kao nove polaznike",
    "importHint": "Uvoz stvara zasebne identifikatore polaznika i čuva postojeći napredak.",
    "fallback": "Ove se kontrole prikazuju na engleskom ako odabrani jezik nije dostupan.",
    "browser": "Podaci se pohranjuju samo u pregledniku. Za trajne datoteke polaznika upotrijebite aplikaciju za računalo.",
    "ready": "Datoteke polaznika spremljene su na ovom uređaju",
    "reload": "Ponovno učitaj spremljenog polaznika",
    "newConfirm": "Uvesti ovu datoteku kao zasebne polaznike uz očuvanje postojećeg napretka?",
    "empty": "Nisu pronađeni valjani podaci o napretku polaznika."
  },
  "he": {
    "title": "לומדים",
    "account": "ההגדרות שלי",
    "name": "כינוי לבחירה",
    "learner": "לומד",
    "add": "הוספת לומד",
    "rename": "שמירת הכינוי",
    "remove": "מחיקת הלומד הזה",
    "deleteConfirm": "האם למחוק את ההתקדמות של הלומד הזה מהמכשיר? שאר הלומדים לא יושפעו. קבצים שיוצאו וגיבויים שנוצרו בעת העברת הנתונים יישארו כעותקים נפרדים.",
    "saved": "נשמר במכשיר הזה",
    "saving": "מתבצעת שמירה במכשיר הזה…",
    "failed": "השינויים לא נשמרו. יש להשאיר את החלון פתוח ולייצא עותק גיבוי.",
    "conflict": "הפרופיל הזה השתנה בחלון אחר. ההתקדמות הקיימת לא נדרסה. אפשר לייצא את השינויים או לשמור אותם כלומד חדש.",
    "recover": "שמירת השינויים שלי כלומד חדש",
    "cloud": "סנכרון בענן אינו מופעל. סנכרון אחרון: מעולם לא. ההתקדמות נשארת במכשיר הזה.",
    "migration": "ההתקדמות הקודמת מהדפדפן מועתקת יחד עם גיבוי לשחזור. כדי להעביר התקדמות ישנה יותר, יש להשתמש באותו דפדפן ובאותה כתובת כמו קודם, או לייבא קובץ שיוצא.",
    "previous": "התקדמות קודמת",
    "export": "ייצוא כל הלומדים ועותקי השחזור",
    "import": "ייבוא כלומדים חדשים",
    "importHint": "הייבוא יוצר מזהי לומדים נפרדים ושומר על ההתקדמות הקיימת.",
    "fallback": "פקדים אלה מוצגים באנגלית כאשר השפה שנבחרה אינה זמינה.",
    "browser": "שמירה בדפדפן בלבד. לשמירה קבועה של קובצי הלומדים יש להשתמש ביישום למחשב.",
    "ready": "קובצי הלומדים נשמרו במכשיר הזה",
    "reload": "טעינה מחדש של הלומד השמור",
    "newConfirm": "האם לייבא את הקובץ הזה כלומדים נפרדים, תוך שמירה על ההתקדמות הקיימת?",
    "empty": "לא נמצאו נתוני התקדמות תקינים של לומד."
  },
  "fa": {
    "title": "زبان‌آموزان",
    "account": "تنظیمات من",
    "name": "نام مستعار اختیاری",
    "learner": "زبان‌آموز",
    "add": "افزودن زبان‌آموز",
    "rename": "ذخیرهٔ نام مستعار",
    "remove": "حذف این زبان‌آموز",
    "deleteConfirm": "پیشرفت این زبان‌آموز از این دستگاه حذف شود؟ اطلاعات سایر زبان‌آموزان تغییری نمی‌کند. فایل‌های خروجی و نسخه‌های پشتیبانِ انتقال، به‌عنوان نسخه‌های جداگانه باقی می‌مانند.",
    "saved": "در این دستگاه ذخیره شد",
    "saving": "در حال ذخیره در این دستگاه…",
    "failed": "تغییرات ذخیره نشده‌اند. این پنجره را باز نگه دارید و یک نسخهٔ پشتیبان خروجی بگیرید.",
    "conflict": "این پروفایل در پنجرهٔ دیگری تغییر کرده است. پیشرفت موجود بازنویسی نشد. از تغییرات خود خروجی بگیرید یا آن‌ها را به‌عنوان زبان‌آموزی جدید ذخیره کنید.",
    "recover": "ذخیرهٔ تغییرات من به‌عنوان زبان‌آموزی جدید",
    "cloud": "همگام‌سازی ابری فعال نیست. آخرین همگام‌سازی: هرگز. پیشرفت در همین دستگاه باقی می‌ماند.",
    "migration": "پیشرفت قبلی مرورگر همراه با یک نسخهٔ پشتیبان برای بازیابی کپی می‌شود. برای انتقال پیشرفت قدیمی‌تر، از همان مرورگر و نشانی قبلی استفاده کنید یا یک فایل خروجی را وارد کنید.",
    "previous": "پیشرفت قبلی",
    "export": "خروجی گرفتن از همهٔ زبان‌آموزان و نسخه‌های بازیابی",
    "import": "وارد کردن به‌عنوان زبان‌آموزان جدید",
    "importHint": "وارد کردن، شناسه‌های جداگانه‌ای برای زبان‌آموزان می‌سازد و پیشرفت موجود را حفظ می‌کند.",
    "fallback": "اگر زبان انتخاب‌شده در دسترس نباشد، این ابزارها به انگلیسی نمایش داده می‌شوند.",
    "browser": "ذخیره‌سازی فقط در مرورگر انجام می‌شود؛ برای ذخیرهٔ پایدار فایل‌های زبان‌آموزان از برنامهٔ رایانه استفاده کنید.",
    "ready": "فایل‌های زبان‌آموزان در این دستگاه ذخیره شده‌اند",
    "reload": "بارگذاری دوبارهٔ زبان‌آموز ذخیره‌شده",
    "newConfirm": "این فایل به‌عنوان زبان‌آموزان جداگانه وارد شود و پیشرفت موجود حفظ شود؟",
    "empty": "دادهٔ معتبری از پیشرفت زبان‌آموز پیدا نشد."
  },
  "ur": {
    "title": "سیکھنے والے",
    "account": "میری ترتیبات",
    "name": "اختیاری عرفی نام",
    "learner": "سیکھنے والا",
    "add": "نیا سیکھنے والا شامل کریں",
    "rename": "عرفی نام محفوظ کریں",
    "remove": "اس سیکھنے والے کو حذف کریں",
    "deleteConfirm": "کیا اس سیکھنے والے کی پیش رفت اس آلے سے حذف کرنی ہے؟ دوسرے سیکھنے والوں پر کوئی اثر نہیں پڑے گا۔ برآمد شدہ فائلیں اور منتقلی کے وقت بنائے گئے بیک اپ الگ نقول کے طور پر موجود رہیں گے۔",
    "saved": "اس آلے پر محفوظ ہے",
    "saving": "اس آلے پر محفوظ کیا جا رہا ہے…",
    "failed": "تبدیلیاں محفوظ نہیں ہوئیں۔ یہ ونڈو کھلی رکھیں اور بیک اپ کی ایک نقل برآمد کریں۔",
    "conflict": "کسی دوسری ونڈو میں اس پروفائل کو تبدیل کیا گیا ہے۔ موجودہ پیش رفت تبدیل نہیں کی گئی۔ اپنی تبدیلیاں برآمد کریں یا انہیں نئے سیکھنے والے کے طور پر محفوظ کریں۔",
    "recover": "میری تبدیلیاں نئے سیکھنے والے کے طور پر محفوظ کریں",
    "cloud": "کلاؤڈ کے ساتھ ہم وقت سازی فعال نہیں ہے۔ آخری ہم وقت سازی: کبھی نہیں۔ پیش رفت اسی آلے پر رہتی ہے۔",
    "migration": "براؤزر کی پچھلی پیش رفت بحالی کے بیک اپ کے ساتھ نقل کی جاتی ہے۔ پرانی پیش رفت منتقل کرنے کے لیے پہلے والا براؤزر اور پتہ استعمال کریں، یا برآمد شدہ فائل درآمد کریں۔",
    "previous": "پچھلی پیش رفت",
    "export": "تمام سیکھنے والوں اور بحالی کی نقول کو برآمد کریں",
    "import": "نئے سیکھنے والوں کے طور پر درآمد کریں",
    "importHint": "درآمد کرنے سے سیکھنے والوں کے الگ شناختی نمبر بنتے ہیں اور موجودہ پیش رفت محفوظ رہتی ہے۔",
    "fallback": "اگر منتخب زبان دستیاب نہ ہو تو یہ کنٹرول انگریزی میں دکھائے جاتے ہیں۔",
    "browser": "ڈیٹا صرف براؤزر میں محفوظ ہے؛ سیکھنے والوں کی فائلیں مستقل محفوظ رکھنے کے لیے کمپیوٹر کی ایپ استعمال کریں۔",
    "ready": "سیکھنے والوں کی فائلیں اس آلے پر محفوظ ہیں",
    "reload": "محفوظ سیکھنے والے کو دوبارہ لوڈ کریں",
    "newConfirm": "کیا موجودہ پیش رفت محفوظ رکھتے ہوئے اس فائل کو الگ سیکھنے والوں کے طور پر درآمد کرنا ہے؟",
    "empty": "سیکھنے والے کی پیش رفت کا کوئی درست ڈیٹا نہیں ملا۔"
  },
  "hi": {
    "title": "सीखने वाले",
    "account": "मेरी सेटिंग",
    "name": "उपनाम (वैकल्पिक)",
    "learner": "सीखने वाला",
    "add": "सीखने वाला जोड़ें",
    "rename": "उपनाम सहेजें",
    "remove": "इस सीखने वाले को हटाएँ",
    "deleteConfirm": "क्या इस सीखने वाले की प्रगति इस डिवाइस से हटानी है? अन्य सीखने वालों पर कोई असर नहीं पड़ेगा। निर्यात की गई फ़ाइलें और डेटा स्थानांतरण के समय बनाए गए बैकअप अलग प्रतियों के रूप में बने रहेंगे।",
    "saved": "इस डिवाइस पर सहेजा गया",
    "saving": "इस डिवाइस पर सहेजा जा रहा है…",
    "failed": "बदलाव सहेजे नहीं गए हैं। यह विंडो खुली रखें और एक बैकअप निर्यात करें।",
    "conflict": "दूसरी विंडो में इस प्रोफ़ाइल में बदलाव किया गया है। मौजूदा प्रगति को बदला नहीं गया। अपने बदलाव निर्यात करें या उन्हें नए सीखने वाले के रूप में सहेजें।",
    "recover": "मेरे बदलाव नए सीखने वाले के रूप में सहेजें",
    "cloud": "क्लाउड सिंक चालू नहीं है। आखिरी सिंक: कभी नहीं। प्रगति इसी डिवाइस पर रहती है।",
    "migration": "ब्राउज़र की पिछली प्रगति को कॉपी किया जाता है और बहाली के लिए एक बैकअप बनाया जाता है। पुरानी प्रगति स्थानांतरित करने के लिए पहले वाला ब्राउज़र और पता इस्तेमाल करें, या निर्यात की गई फ़ाइल आयात करें।",
    "previous": "पिछली प्रगति",
    "export": "सभी सीखने वालों और बहाली की प्रतियों को निर्यात करें",
    "import": "नए सीखने वालों के रूप में आयात करें",
    "importHint": "आयात से सीखने वालों की अलग पहचान बनती है और मौजूदा प्रगति सुरक्षित रहती है।",
    "fallback": "चुनी गई भाषा उपलब्ध न होने पर ये नियंत्रण अंग्रेज़ी में दिखाई देते हैं।",
    "browser": "डेटा केवल ब्राउज़र में सहेजा जाता है। सीखने वालों की फ़ाइलों को स्थायी रूप से सहेजने के लिए कंप्यूटर वाला ऐप इस्तेमाल करें।",
    "ready": "सीखने वालों की फ़ाइलें इस डिवाइस पर सहेजी गई हैं",
    "reload": "सहेजे गए सीखने वाले को फिर से लोड करें",
    "newConfirm": "क्या मौजूदा प्रगति सुरक्षित रखते हुए इस फ़ाइल को अलग सीखने वालों के रूप में आयात करना है?",
    "empty": "सीखने वाले की प्रगति का कोई मान्य डेटा नहीं मिला।"
  },
  "bn": {
    "title": "শিক্ষার্থীরা",
    "account": "আমার সেটিংস",
    "name": "ডাকনাম (ঐচ্ছিক)",
    "learner": "শিক্ষার্থী",
    "add": "শিক্ষার্থী যোগ করুন",
    "rename": "ডাকনাম সংরক্ষণ করুন",
    "remove": "এই শিক্ষার্থীকে মুছুন",
    "deleteConfirm": "এই ডিভাইস থেকে এই শিক্ষার্থীর অগ্রগতি মুছে ফেলবেন? অন্য শিক্ষার্থীদের তথ্য অপরিবর্তিত থাকবে। রপ্তানি করা ফাইল এবং স্থানান্তরের সময় তৈরি ব্যাকআপগুলো আলাদা কপি হিসেবে থেকে যাবে।",
    "saved": "এই ডিভাইসে সংরক্ষিত",
    "saving": "এই ডিভাইসে সংরক্ষণ করা হচ্ছে…",
    "failed": "পরিবর্তনগুলো সংরক্ষিত হয়নি। এই উইন্ডো খোলা রাখুন এবং একটি ব্যাকআপ রপ্তানি করুন।",
    "conflict": "অন্য একটি উইন্ডোতে এই প্রোফাইলে পরিবর্তন করা হয়েছে। আগের অগ্রগতি প্রতিস্থাপন করা হয়নি। আপনার পরিবর্তনগুলো রপ্তানি করুন অথবা নতুন শিক্ষার্থী হিসেবে সংরক্ষণ করুন।",
    "recover": "আমার পরিবর্তনগুলো নতুন শিক্ষার্থী হিসেবে সংরক্ষণ করুন",
    "cloud": "ক্লাউড সিঙ্ক চালু নেই। শেষ সিঙ্ক: কখনো হয়নি। অগ্রগতি এই ডিভাইসেই থাকে।",
    "migration": "ব্রাউজারের আগের অগ্রগতি একটি পুনরুদ্ধার ব্যাকআপসহ কপি করা হয়। পুরোনো অগ্রগতি স্থানান্তর করতে আগের ব্রাউজার ও ঠিকানা ব্যবহার করুন, অথবা রপ্তানি করা ফাইল আমদানি করুন।",
    "previous": "আগের অগ্রগতি",
    "export": "সব শিক্ষার্থী এবং পুনরুদ্ধারের কপি রপ্তানি করুন",
    "import": "নতুন শিক্ষার্থী হিসেবে আমদানি করুন",
    "importHint": "আমদানি করলে শিক্ষার্থীদের জন্য আলাদা পরিচিতি তৈরি হয় এবং আগের অগ্রগতি অক্ষুণ্ণ থাকে।",
    "fallback": "নির্বাচিত ভাষা উপলভ্য না থাকলে এই নিয়ন্ত্রণগুলো ইংরেজিতে দেখানো হয়।",
    "browser": "তথ্য শুধু ব্রাউজারে সংরক্ষিত হয়। শিক্ষার্থীদের ফাইল স্থায়ীভাবে সংরক্ষণ করতে কম্পিউটারের অ্যাপ ব্যবহার করুন।",
    "ready": "শিক্ষার্থীদের ফাইল এই ডিভাইসে সংরক্ষিত",
    "reload": "সংরক্ষিত শিক্ষার্থী আবার লোড করুন",
    "newConfirm": "আগের অগ্রগতি অক্ষুণ্ণ রেখে এই ফাইলটি আলাদা শিক্ষার্থী হিসেবে আমদানি করবেন?",
    "empty": "শিক্ষার্থীর অগ্রগতির কোনো বৈধ তথ্য পাওয়া যায়নি।"
  },
  "id": {
    "title": "Pelajar",
    "account": "Pengaturan saya",
    "name": "Nama panggilan (opsional)",
    "learner": "Pelajar",
    "add": "Tambah pelajar",
    "rename": "Simpan nama panggilan",
    "remove": "Hapus pelajar ini",
    "deleteConfirm": "Hapus kemajuan pelajar ini dari perangkat ini? Pelajar lain tidak terpengaruh. File yang diekspor dan cadangan migrasi tetap menjadi salinan terpisah.",
    "saved": "Tersimpan di perangkat ini",
    "saving": "Menyimpan di perangkat ini…",
    "failed": "Perubahan belum tersimpan. Biarkan jendela ini terbuka dan ekspor cadangan.",
    "conflict": "Profil ini telah diubah di jendela lain. Kemajuan yang ada tidak ditimpa. Ekspor perubahan Anda atau simpan sebagai pelajar baru.",
    "recover": "Simpan perubahan saya sebagai pelajar baru",
    "cloud": "Sinkronisasi cloud belum diaktifkan. Sinkronisasi terakhir: belum pernah. Kemajuan tetap tersimpan di perangkat ini.",
    "migration": "Kemajuan sebelumnya dari browser disalin beserta cadangan pemulihan. Untuk memindahkan kemajuan lama, gunakan browser dan alamat yang sama seperti sebelumnya, atau impor file yang telah diekspor.",
    "previous": "Kemajuan sebelumnya",
    "export": "Ekspor semua pelajar dan salinan pemulihan",
    "import": "Impor sebagai pelajar baru",
    "importHint": "Impor membuat ID pelajar yang terpisah dan mempertahankan kemajuan yang ada.",
    "fallback": "Kontrol ini ditampilkan dalam bahasa Inggris jika bahasa yang dipilih tidak tersedia.",
    "browser": "Penyimpanan hanya di browser; gunakan aplikasi desktop agar file pelajar tersimpan secara permanen.",
    "ready": "File pelajar tersimpan di perangkat ini",
    "reload": "Muat ulang pelajar yang tersimpan",
    "newConfirm": "Impor file ini sebagai pelajar terpisah dengan tetap mempertahankan kemajuan yang ada?",
    "empty": "Tidak ditemukan data kemajuan pelajar yang valid."
  },
  "ms": {
    "title": "Pelajar",
    "account": "Tetapan saya",
    "name": "Nama panggilan (pilihan)",
    "learner": "Pelajar",
    "add": "Tambah pelajar",
    "rename": "Simpan nama panggilan",
    "remove": "Padam pelajar ini",
    "deleteConfirm": "Padam kemajuan pelajar ini daripada peranti ini? Pelajar lain tidak terjejas. Fail yang dieksport dan sandaran pemindahan kekal sebagai salinan berasingan.",
    "saved": "Disimpan pada peranti ini",
    "saving": "Sedang menyimpan pada peranti ini…",
    "failed": "Perubahan belum disimpan. Biarkan tetingkap ini terbuka dan eksport sandaran.",
    "conflict": "Profil ini telah diubah dalam tetingkap lain. Kemajuan sedia ada tidak ditulis ganti. Eksport perubahan anda atau simpan sebagai pelajar baharu.",
    "recover": "Simpan perubahan saya sebagai pelajar baharu",
    "cloud": "Penyegerakan awan tidak diaktifkan. Penyegerakan terakhir: belum pernah. Kemajuan kekal pada peranti ini.",
    "migration": "Kemajuan terdahulu daripada pelayar disalin bersama sandaran pemulihan. Untuk memindahkan kemajuan lama, gunakan pelayar dan alamat yang sama seperti dahulu, atau import fail yang telah dieksport.",
    "previous": "Kemajuan terdahulu",
    "export": "Eksport semua pelajar dan salinan pemulihan",
    "import": "Import sebagai pelajar baharu",
    "importHint": "Import mencipta ID pelajar yang berasingan dan mengekalkan kemajuan sedia ada.",
    "fallback": "Kawalan ini dipaparkan dalam bahasa Inggeris jika bahasa yang dipilih tidak tersedia.",
    "browser": "Data disimpan dalam pelayar sahaja; gunakan aplikasi desktop untuk menyimpan fail pelajar secara kekal.",
    "ready": "Fail pelajar disimpan pada peranti ini",
    "reload": "Muat semula pelajar yang disimpan",
    "newConfirm": "Import fail ini sebagai pelajar berasingan sambil mengekalkan kemajuan sedia ada?",
    "empty": "Tiada data kemajuan pelajar yang sah ditemukan."
  },
  "zh": {
    "title": "学习者",
    "account": "我的设置",
    "name": "昵称（可选）",
    "learner": "学习者",
    "add": "添加学习者",
    "rename": "保存昵称",
    "remove": "删除此学习者",
    "deleteConfirm": "要从此设备删除这位学习者的学习进度吗？其他学习者不会受到影响。已导出的文件和迁移备份仍会作为独立副本保留。",
    "saved": "已保存在此设备上",
    "saving": "正在保存到此设备…",
    "failed": "更改尚未保存。请保持此窗口打开，并导出一份备份。",
    "conflict": "另一个窗口更改了此学习者资料。已有进度未被覆盖。请导出您的更改，或将其另存为新的学习者资料。",
    "recover": "将我的更改另存为新的学习者资料",
    "cloud": "云端同步尚未启用。上次同步：从未同步。学习进度保留在此设备上。",
    "migration": "系统会复制浏览器中原有的学习进度，并创建恢复备份。要迁移之前的进度，请使用与之前相同的浏览器和地址，或导入已导出的文件。",
    "previous": "之前的学习进度",
    "export": "导出所有学习者资料及恢复副本",
    "import": "导入为新的学习者资料",
    "importHint": "导入时会创建独立的学习者标识，并保留已有进度。",
    "fallback": "所选语言不可用时，这些控件以英语显示。",
    "browser": "数据仅保存在浏览器中；请使用桌面阅读器，以便长期保存学习者文件。",
    "ready": "学习者文件已保存在此设备上",
    "reload": "重新加载已保存的学习者资料",
    "newConfirm": "要将此文件导入为独立的学习者资料，同时保留已有进度吗？",
    "empty": "未找到有效的学习进度数据。"
  },
  "ja": {
    "title": "学習者",
    "account": "自分の設定",
    "name": "ニックネーム（任意）",
    "learner": "学習者",
    "add": "学習者を追加",
    "rename": "ニックネームを保存",
    "remove": "この学習者を削除",
    "deleteConfirm": "この学習者の進捗をこの端末から削除しますか？ほかの学習者には影響しません。書き出したファイルと移行時のバックアップは、別のコピーとして残ります。",
    "saved": "この端末に保存済み",
    "saving": "この端末に保存中…",
    "failed": "変更は保存されていません。このウィンドウを開いたままにして、バックアップを書き出してください。",
    "conflict": "別のウィンドウでこの学習者のデータが変更されました。既存の進捗は上書きされていません。変更を書き出すか、新しい学習者として保存してください。",
    "recover": "自分の変更を新しい学習者として保存",
    "cloud": "クラウド同期は有効になっていません。最終同期：未実施。進捗はこの端末に保存されます。",
    "migration": "ブラウザーにある以前の進捗は、復元用バックアップを作成したうえでコピーされます。以前の進捗を移行するには、以前と同じブラウザーとアドレスを使うか、書き出したファイルを読み込んでください。",
    "previous": "以前の進捗",
    "export": "すべての学習者と復元用コピーを書き出す",
    "import": "新しい学習者として読み込む",
    "importHint": "読み込み時に別の学習者IDを作成し、既存の進捗は保持します。",
    "fallback": "選択した言語が利用できない場合、これらの操作項目は英語で表示されます。",
    "browser": "保存先はブラウザーのみです。学習者ファイルを継続して保存するには、デスクトップ版のリーダーをご利用ください。",
    "ready": "学習者ファイルはこの端末に保存されています",
    "reload": "保存済みの学習者を再読み込み",
    "newConfirm": "既存の進捗を保持したまま、このファイルを別の学習者として読み込みますか？",
    "empty": "有効な学習者の進捗データが見つかりません。"
  }
};
const lt=k=>LEARNER_UI[locale]?.[k]??LEARNER_UI.en[k]??k;
let learnerSaving=0,learnerStarted=false;
function learnerSettings(){return {locale,meaningLocale,typography:{schemaVersion:1,...typography}}}
function learnerStatus(){if(!learnerStorage.enabled)return lt('browser');return learnerStorage.blocked?lt('conflict'):savingError?lt('failed'):learnerSaving?lt('saving'):lt('saved')}
function learnerStatusUpdate(){const el=$('#saved-label');if(el)el.textContent=learnerStatus();const status=$('#learner-save-status');if(status)status.textContent=learnerStatus()}
function setLearner(profile){if(!profile||!valid(profile.progress))throw Error('invalid_learner_progress');state=structuredClone(profile.progress);locale=state.locale;const settings=profile.settings||{};meaningLocale=['ar','en','tr','fr','es'].includes(settings.meaningLocale)?settings.meaningLocale:(['ar','en','tr','fr','es'].includes(locale)?locale:'en');typography=validTypographyPrefs(settings.typography)?{font:settings.typography.font,size:settings.typography.size}:{...TYPOGRAPHY_DEFAULT};savingError=false;applyTypography();render();learnerToolbar()}
function learnerToolbar(){if(!learnerStorage.enabled)return;let el=$('#learner-toolbar');if(!el){el=document.createElement('section');el.id='learner-toolbar';el.className='learner-toolbar';$('#typography-toolbar').insertAdjacentElement('afterend',el)}el.innerHTML=`<label for="learner-select">${esc(lt('title'))}</label><select id="learner-select">${learnerStorage.profiles.map((p,i)=>`<option value="${esc(p.id)}" ${p.id===learnerStorage.current?.id?'selected':''}>${esc(p.nickname||lt('learner')+' '+(i+1))}</option>`).join('')}</select><button id="learner-manage" class="secondary">${esc(lt('account'))}</button><span id="learner-save-status" role="status">${esc(learnerStatus())}</span>`;$('#learner-manage').onclick=openSettingsWithTypography;$('#learner-select').onchange=async e=>{try{await learnerStorage.flush();setLearner(await learnerStorage.select(e.target.value))}catch{notice(learnerStatus());learnerToolbar()}};learnerStatusUpdate()}
async function learnerSave(){state.locale=locale;state.updatedAt=new Date().toISOString();learnerSaving++;learnerStatusUpdate();try{await learnerStorage.save(state,learnerSettings());savingError=false}catch(e){savingError=true;notice(e.status===409?lt('conflict'):lt('failed'))}finally{learnerSaving--;learnerStatusUpdate()} }
async function learnerInit(candidates){if(IS_DEMO)return;const unique=[];const seen=new Set();for(const s of candidates.filter(valid).sort((a,b)=>(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0))){const raw=JSON.stringify(s);if(!seen.has(raw)){seen.add(raw);unique.push({nickname:lt('previous')+(unique.length?' '+(unique.length+1):''),progress:s,settings:learnerSettings()})}}let p=await learnerStorage.start(unique);if(!learnerStorage.enabled)return;if(!p)p=await learnerStorage.create('',state,learnerSettings());learnerStarted=true;setLearner(p)}
function learnerSettingsPanel(){if(!learnerStorage.enabled)return;$('#settings-title').textContent=lt('account');const p=learnerStorage.current;$('#settings-content').insertAdjacentHTML('afterbegin',`<section class="setting-section learner-settings"><h3>${esc(lt('title'))}</h3><p>${esc(lt('cloud'))}</p>${!LEARNER_UI[locale]?`<p lang="en" dir="ltr">${esc(LEARNER_UI.en.fallback)}</p>`:''}<label for="learner-name">${esc(lt('name'))}</label><input id="learner-name" maxlength="80" value="${esc(p?.nickname||'')}"><div class="learner-actions"><button id="learner-rename" class="secondary">${esc(lt('rename'))}</button><button id="learner-add" class="primary">${esc(lt('add'))}</button><button id="learner-delete" class="text-button">${esc(lt('remove'))}</button></div><p>${esc(lt('migration'))}</p><p>${esc(lt('importHint'))}</p>${learnerStorage.blocked?`<p role="alert">${esc(lt('conflict'))}</p><button id="learner-recover" class="primary">${esc(lt('recover'))}</button>`:''}</section>`);
 $('#learner-rename').onclick=async()=>{try{await learnerStorage.save(state,learnerSettings(),$('#learner-name').value);learnerToolbar();notice(lt('saved'))}catch{notice(lt('failed'))}};
 $('#learner-add').onclick=async()=>{try{await learnerStorage.flush();const p=await learnerStorage.create('',fresh(),{locale,meaningLocale:['ar','en','tr','fr','es'].includes(locale)?locale:'en',typography:{schemaVersion:1,...TYPOGRAPHY_DEFAULT}});setLearner(p);$('#settings').close()}catch{notice(learnerStatus())}};
 $('#learner-delete').onclick=()=>confirmAction(lt('deleteConfirm'),async()=>{try{await learnerStorage.flush();let p=await learnerStorage.remove();if(!p)p=await learnerStorage.create('',fresh(),{locale,typography:{schemaVersion:1,...TYPOGRAPHY_DEFAULT}});else p=await learnerStorage.select(p.id);setLearner(p);$('#settings').close()}catch{notice(lt('failed'))}});
 if($('#learner-recover'))$('#learner-recover').onclick=async()=>{try{setLearner(await learnerStorage.recoverAsNew());$('#settings').close()}catch{notice(lt('failed'))}};
 $('#export-progress').textContent=lt('export');$('#export-progress').onclick=async()=>{try{download(JSON.stringify(await learnerStorage.exportAll(),null,2),'HORIZONS-learners-backup.json','application/json')}catch{download(JSON.stringify({profiles:[{id:learnerStorage.current?.id,nickname:learnerStorage.current?.nickname||'',progress:state,settings:learnerSettings()}]},null,2),'HORIZONS-unsaved-learner.json','application/json');notice(lt('failed'))}};
 $('#restore-progress').textContent=lt('import');
}
async function learnerImport(raw){let source;if(valid(raw))source=[{nickname:lt('previous'),progress:raw,settings:learnerSettings()}];else source=[...(raw.profiles||[]).filter(p=>!p.deleted_at),...(raw.conflicts||[]).map(c=>({nickname:lt('previous'),progress:c.progress,settings:c.settings})),...(raw.unsaved_profiles||[])];if(!Array.isArray(source)||!source.length||source.length>100||source.some(p=>!valid(p.progress)))throw Error('invalid_progress');const incoming=source.map(p=>({id:p.id||'',nickname:typeof p.nickname==='string'?p.nickname:'',settings:p.settings&&typeof p.settings==='object'?p.settings:{},progress:p.progress}));confirmAction(lt('newConfirm'),async()=>{try{await learnerStorage.flush();setLearner(await learnerStorage.importAll(incoming));$('#settings').close()}catch{notice(lt('failed'))}})}
// Entitlement expiry must stop access without discarding an in-flight save.
window.HORIZONS_FLUSH_PROGRESS=async()=>{if(learnerStorage.enabled){await learnerSave();await learnerStorage.flush()}};
addEventListener('horizons-access-ended',()=>{window.HORIZONS_FLUSH_PROGRESS().catch(()=>notice(lt('failed')))});

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
const BUILD_LABEL='1.4.5';
const LOCAL_SERVER_MODE=!(navigator.serviceWorker&&location.pathname.startsWith('/learn/app/'))&& (location.protocol==='file:'||/(?:^|[?&])local=1(?:&|$)/.test(location.search??'')||location.hostname==='127.0.0.1');
const AUTHOR_CREDIT=()=>hznCreatorCreditMarkup(locale);
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
function loadTypographyPrefs(fallback=TYPOGRAPHY_DEFAULT){if(learnerStorage.enabled&&learnerStorage.current)return {font:fallback.font,size:fallback.size};if(!typographyStorageReadable)return {font:fallback.font,size:fallback.size};try{const value=JSON.parse(localStorage.getItem(TYPOGRAPHY_KEY));if(validTypographyPrefs(value))return {font:value.font,size:value.size}}catch{typographyStorageReadable=false}return {font:fallback.font,size:fallback.size}}
let typography=loadTypographyPrefs();
function typographyFont(){return TYPOGRAPHY_FONTS.find(font=>font.id===typography.font)??TYPOGRAPHY_FONTS[0]}
function typographyAccessibleFontName(font=typographyFont()){return locale==='ar'?font.arLabel:font.label}
function typographySizeLabel(size=TYPOGRAPHY_SIZES[typography.size]){if(locale==='ar')return String(size).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d])+'٪';if(locale==='tr')return '%'+size;if(locale==='fr'||locale==='es')return size+' %';return size+'%'}
function persistTypographyPrefs(){if(learnerStorage.enabled&&learnerStorage.current){save();return;}try{localStorage.setItem(TYPOGRAPHY_KEY,JSON.stringify({schemaVersion:1,font:typography.font,size:typography.size}));typographyStorageReadable=true}catch{typographyStorageReadable=false;notice(t('saveError'))}}
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
 toolbar.innerHTML=`<details class="reading-options"><summary id="typography-toolbar-title" class="typography-toolbar-title"></summary><div class="reading-options-panel"><div class="typography-control"><label id="typography-font-label" for="typography-font"></label><select id="typography-font" data-typography-font dir="ltr">${TYPOGRAPHY_FONTS.map(font=>`<option value="${font.id}" lang="en" dir="ltr">${esc(font.label)}</option>`).join('')}</select></div><button id="typography-reset" class="typography-reset" data-typography-action="reset" type="button"><span aria-hidden="true">↺</span><span id="typography-reset-label"></span></button></div></details><div id="typography-size-controls" class="typography-size-controls" role="group"><button id="typography-decrease" data-typography-action="decrease" type="button">A−</button><span id="typography-size" data-typography-size></span><button id="typography-increase" data-typography-action="increase" type="button">A+</button></div><span id="typography-live" class="sr-only" role="status" aria-live="polite"></span>`;
 const credit=document.querySelector('body>.author-credit');(credit??document.querySelector('.topbar')).insertAdjacentElement('afterend',toolbar);bindTypographyControls(toolbar);updateTypographyUi();
}
function typographySettingsSection(){return `<section class="setting-section typography-settings"><h3>${esc(t('typographyTitle'))}</h3><p class="typography-hint">${esc(t('typographyHint'))}</p><div class="font-choice-grid" role="group" aria-label="${esc(t('fontLabel'))}">${TYPOGRAPHY_FONTS.map(font=>`<button type="button" class="font-choice" data-font-choice="${font.id}" style="--choice-font:${esc(font.family)}"><span lang="en" dir="ltr">${esc(font.label)}</span><b class="arabic" lang="ar">أَبْجَدْ</b></button>`).join('')}</div><div class="setting-row"><span>${esc(t('textSize'))}</span><div class="typography-size-controls" role="group" aria-label="${esc(t('textSize'))}"><button type="button" data-typography-action="decrease">A−</button><span data-typography-size></span><button type="button" data-typography-action="increase">A+</button></div></div><p class="typography-preview arabic" lang="ar" dir="rtl">بَابٌ · ظِلٌّ · يَدٌ</p><button type="button" class="secondary" data-typography-action="reset">${esc(t('resetTypography'))}</button><p id="typography-settings-status" class="typography-settings-status" role="status" aria-live="polite"></p></section>`}
function openSettingsWithTypography(){settings();$('#settings-content').insertAdjacentHTML('afterbegin',`<section class="setting-section"><h3>${esc(t('meaningLanguage'))}</h3><p>${esc(t('meaningHelp'))}</p><select id="meaning-language" aria-label="${esc(t('meaningLanguage'))}">${[['ar','العربية'],['en','English'],['tr','Türkçe'],['fr','Français'],['es','Español']].map(([code,label])=>`<option value="${code}" ${code===meaningLocale?'selected':''}>${label}</option>`).join('')}</select></section>`);$('#meaning-language').onchange=()=>{meaningLocale=$('#meaning-language').value;if(!learnerStorage.enabled)try{localStorage.setItem('horizons-meaning-language',meaningLocale)}catch{}render();save()};$('#settings-content').insertAdjacentHTML('afterbegin',typographySettingsSection());bindTypographyControls($('#settings-content'));updateTypographyUi();learnerSettingsPanel()}
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
async function save(){if(learnerStorage.enabled)return learnerSave();state.locale=locale;state.updatedAt=new Date().toISOString();const snapshot=structuredClone(state);let checkpointSaved=false;try{localStorage.setItem(DBKEY,JSON.stringify(snapshot));checkpointSaved=true}catch{}try{await put('progress',DBKEY,snapshot);savingError=false}catch{savingError=!checkpointSaved}$('#saved-label').textContent=learnerStatus()}
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
function updateProgress(){const playableLetters=state.course==='alphabet'?alphabet.letters.filter(l=>!audioRejected(audioRecord(l.id))):[];const total=state.course==='alphabet'?playableLetters.length:state.course==='catalog'?course.chapters.length*20:20;const pool=state.course==='catalog'?Object.values(chapters).flatMap(c=>c.words):data.words;const count=state.course==='alphabet'?playableLetters.filter(l=>state.heard[l.id]).length:pool.filter(w=>state.heard['word.'+w.id]&&state.heard['sentence.'+w.id]).length;$('#progress-label').textContent=t('heardCount',{count,total});$('#progress-bar').style.width=100*count/total+'%';$('#saved-label').textContent=learnerStatus();}
/** Keep the learning area together without changing lesson data or learner state.
 * All supplementary material remains available in native, keyboard-operable disclosures.
 * No viewport-sized clipping: large text and small windows retain normal page scrolling.
 */
function compactActivityLayout(){
 document.body.dataset.course=state.course;
 document.body.dataset.activity=state.course==='alphabet'?state.alphabetMode:state.tab;
 let controls=$('#reader-controls');
 if(!controls){controls=document.createElement('div');controls.id='reader-controls';controls.className='reader-controls';$('.topbar').insertAdjacentElement('afterend',controls);}
 const typographyToolbar=$('#typography-toolbar'),learnerToolbarElement=$('#learner-toolbar');
 if(typographyToolbar&&typographyToolbar.parentElement!==controls)controls.append(typographyToolbar);
 if(learnerToolbarElement&&learnerToolbarElement.parentElement!==controls)controls.append(learnerToolbarElement);
 const credit=document.querySelector('body>.author-credit');if(credit)$('main').append(credit);
 let navigation=$('#activity-navigation');
 if(!navigation){navigation=document.createElement('div');navigation.id='activity-navigation';navigation.className='activity-navigation';$('#course-nav').before(navigation);navigation.append($('#course-nav'),$('#stages'));}
 if(state.course==='lesson'&&state.tab==='words'){
  const panel=$('.vocab-panel'),word=document.createElement('div');word.className='word-reading';
  while(panel.firstElementChild&&!panel.firstElementChild.classList.contains('sentence-block'))word.append(panel.firstElementChild);
  panel.prepend(word);
  const overview=document.createElement('details');overview.className='word-overview';
  const summary=document.createElement('summary');summary.textContent=t('words')+' · '+data.words.length;overview.append(summary);
  for(const selector of ['.group-nav','.vocab-strip','.section-bottom']){const el=$('#activity '+selector);if(el)overview.append(el);}
  $('#activity').append(overview);
 }
 if(state.course==='lesson'&&state.tab==='write'){
  const workspace=document.createElement('div');workspace.className='writing-workspace';
  const reference=document.createElement('aside');reference.className='writing-reference';reference.setAttribute('aria-label',t('letterForms'));
  const surface=document.createElement('div');surface.className='writing-surface';
  reference.append($('#activity .form-tabs'));
  const writingHelp=document.createElement('details');writingHelp.className='trace-help';
  const writingHelpSummary=document.createElement('summary');writingHelpSummary.innerHTML=esc(t('letterForms'))+' <span class="arabic" lang="ar" dir="rtl">'+lessonText(traces.forms[state.form].example)+'</span>';
  writingHelp.append(writingHelpSummary,$('#activity .trace-example'));reference.append(writingHelp);
  for(const selector of ['.trace-wrap','.pen-demo-tools','.trace-tools'])surface.append($('#activity '+selector));
  workspace.append(reference,surface);$('#activity .activity-header').after(workspace);
  const extra=document.createElement('details');extra.className='writing-notes';const summary=document.createElement('summary');summary.textContent=t('shortVowels')+' · '+t('longVowels');extra.append(summary,$('#activity .vowel-cards'),$('#activity .trace-note'));$('#activity').append(extra);
 }
}
function render(){if(!learnerStorage.enabled)try{localStorage.setItem('horizons-interface-language',locale)}catch{}stopPenDemo();stop();observer?.disconnect();activePointer=undefined;data=chapters[state.chapter];traces=guideBank[state.chapter];state.ink[inkKey()]??=[];document.documentElement.lang=locale;document.documentElement.dir=['ar','he','fa','ur'].includes(locale)?'rtl':'ltr';$('#locale').value=locale;$('#stages').setAttribute('aria-label',t('activities'));$('#course-nav').setAttribute('aria-label',t('chapters'));$('#language-label').textContent=t('language');$('#locale').setAttribute('aria-label',t('language'));$('#settings-button').setAttribute('aria-label',t('adultHelp'));$('#course-nav').setAttribute('aria-label',t('chapters'));$('#stages').setAttribute('aria-label',t('exploreLetter'));$('.skip').textContent=t('skip');$('#eyebrow').textContent='HORIZONS · ARABIC LEVEL 1 · '+(IS_DEMO?'DEMO · ':'')+BUILD_LABEL;$('#lesson-title').textContent=state.course==='alphabet'?t('alphabet'):state.course==='catalog'?t('courseTitle'):t('letterLesson',{letter:data.letter});$('#lesson-subtitle').textContent=t(state.course==='alphabet'?'alphabetIntro':state.course==='catalog'?'catalogIntro':'chapterIntro');$('#preview-note').textContent=t('releaseNotice');$('#course-nav').innerHTML=`<button data-course="alphabet" aria-pressed="${state.course==='alphabet'}"><span>01</span>${esc(t('alphabet'))}</button><button data-course="catalog" aria-pressed="${state.course!=='alphabet'}"><span>02</span>${esc(t('chapters'))}<small>${course.chapters.length}</small></button>`;$$('#course-nav [data-course]').forEach(b=>b.onclick=()=>nav({course:b.dataset.course}));const tabs=state.course==='alphabet'?[['explore','exploreLetter'],['quiz','chooseHeard'],['match','matching']]:[['words','words'],['quiz','chooseHeard'],['stories','stories'],['write','write']];$('#stages').hidden=state.course==='catalog';$('#stages').classList.toggle('four',state.course==='lesson');$('#stages').innerHTML=tabs.map(([k,label])=>`<button class="stage ${k===(state.course==='alphabet'?state.alphabetMode:state.tab)?'active':''}" data-tab="${k}" aria-pressed="${k===(state.course==='alphabet'?state.alphabetMode:state.tab)}">${esc(t(label))}</button>`).join('');$$('[data-tab]').forEach(b=>b.onclick=()=>nav(state.course==='alphabet'?{alphabetMode:b.dataset.tab}:{tab:b.dataset.tab}));updateProgress();if(state.course==='alphabet')renderAlphabet();else if(state.course==='catalog')renderCatalog();else if(state.tab==='words')renderWords();else if(state.tab==='quiz')renderQuiz();else if(state.tab==='stories')renderStory();else renderTrace();$('.lesson-footer').hidden=state.course==='catalog';$('#previous').textContent=t('previous');$('#next').textContent=t('next');$('#previous').disabled=state.course==='alphabet'&&state.letter===0;$('#previous').onclick=()=>move(-1);$('#next').onclick=()=>move(1);$('#page-label').textContent=state.course==='alphabet'?`${state.letter+1} / ${alphabet.letters.length}`:state.tab==='words'||state.tab==='quiz'?t('wordOf',{current:(state.tab==='words'?state.word:state.quiz)+1,total:20}):state.tab==='stories'?`${state.story+1} / 2 · ${state.frame+1} / 4`:`${FORMS.indexOf(state.form)+1} / 4`;learnerToolbar();compactActivityLayout();}
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
function settings(){stopPenDemo();stop();$('#settings-title').textContent=t('adultHelp');$('#close-settings').setAttribute('aria-label',t('close'));$('#settings-content').innerHTML=`<section class="setting-section"><h3>${esc(learnerStorage.enabled?lt('saved'):t('localOnly'))}</h3><p>${esc(learnerStorage.enabled?lt('cloud'):t('storageNote'))}</p><button id="export-progress" class="secondary">${esc(t('exportProgress'))}</button><button id="restore-progress" class="secondary">${esc(t('importProgress'))}</button><button id="reset-progress" class="text-button">${esc(t('resetProgress'))}</button></section><section class="setting-section"><h3>${esc(t('offlineTitle'))}</h3><p>${esc(t(LOCAL_SERVER_MODE?'localServerReady':'offlineNote'))}</p>${LOCAL_SERVER_MODE?'':`<button id="cache-all" class="primary">${esc(t('downloadAll'))}</button>`}<p id="offline-progress" role="status"></p></section><section class="setting-section"><h3>${esc(t('printSheet'))}</h3><p>${esc(t('currentPrintNotice'))}</p><div class="print-actions"><button id="print-all-writing" class="secondary">${esc(t('printAllWriting'))}</button><button id="print-all-alphabet" class="secondary">${esc(t('printAlphabet'))}</button></div></section><section class="setting-section"><h3>${esc(t('aboutWorkbook'))}</h3><p>${esc(t('scopeNote'))}</p><p>${esc(t('releaseScope'))}</p><p>${esc(t('voiceUpdate'))}</p><p>${esc(t('privacyBrief'))}</p><p><a href="guides/${locale}.html" target="_blank">${esc(t('releaseHelp'))}</a> · <a href="guides/${locale}.html#privacy" target="_blank">${esc(t('releasePolicy'))}</a></p><p>${esc(t('readTogether'))}</p><p>${esc(t('joiningHelp'))}</p><p><a href="course/CREDITS.txt" target="_blank">${esc(t('credits'))}</a></p></section><p class="author-credit dialog-author">${AUTHOR_CREDIT()}</p>`;$('#settings').showModal();$('#print-all-writing').onclick=()=>printAllWriting();$('#print-all-alphabet').onclick=()=>printAlphabet();if($('#cache-all'))$('#cache-all').onclick=()=>downloadOffline('all',$('#cache-all'));$('#export-progress').onclick=()=>download(JSON.stringify(state,null,2),IS_DEMO?'HORIZONS-Demo-progress.json':'HORIZONS-Level1-progress.json','application/json');$('#restore-progress').onclick=()=>$('#progress-input').click();$('#reset-progress').onclick=()=>confirmAction(t('resetConfirm'),()=>{state=fresh();render();save();$('#settings').close()});}
async function downloadOffline(group,button){if(LOCAL_SERVER_MODE){notice(t('localServerReady'));return}if(button)button.disabled=true;const status=$('#offline-progress');try{await prepareOffline(group,({done,total})=>{const msg=t('offlineProgress',{done,total});if(status)status.textContent=msg;if(button)button.textContent=msg});notice(t(group==='all'?'offlineAllReady':'offlineReady'));if(status)status.textContent=t('offlineAllReady')}catch(e){const key=e.code==='LOCAL_SERVER'?'localServerReady':e.code==='UNSUPPORTED'?'offlineUnsupported':e.code==='UPDATE_REQUIRED'?'offlineUpdateRequired':'offlineFailed';notice(t(key));if(status)status.textContent=t(key)}finally{if(button){button.disabled=false;button.textContent=t(group==='all'?'downloadAll':'chapterDownload')}}}
function sheetHead(title){return `<header class="worksheet-head"><div class="worksheet-brand"><b>HORIZONS</b><p class="print-author">${AUTHOR_CREDIT()}</p></div><h1>${esc(title)}</h1></header>`}
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
$('#locale').onchange=e=>{locale=e.target.value;render();save()};$('#settings-button').onclick=settings;$('#close-settings').onclick=()=>$('#settings').close();$('#progress-input').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>32*1024*1024)throw Error();const s=JSON.parse(await f.text());if(learnerStorage.enabled){await learnerImport(s);return;}if(!valid(s))throw Error();confirmAction(t('restoreConfirm'),()=>{state=s;migrateAudioRevision(state);locale=s.locale;render();save();$('#settings').close()})}catch{notice(t('invalidProgress'))}};
$('#settings-button').onclick=openSettingsWithTypography;
function formNote(f){if(data?.id==='alif'&&f==='initial')return t('alifNote');return t(data.joiningType==='right_only'?'nonJoiningNote':'generalFormNote');}
function vowels(){const c=data.letter;return {short:c==='ا'?'أَ · إِ · أُ':c+'َ · '+c+'ِ · '+c+'ُ',long:c==='ا'?'بَا · مَا · لَا':c==='و'?'نُورٌ · سُورٌ · حُوتٌ':c==='ي'?'فِي · دِيكٌ · فِيلٌ':c+'َا · '+c+'ِي · '+c+'ُو'};}
async function loadJson(path){if(window.HORIZONS_DATA?.[path])return structuredClone(window.HORIZONS_DATA[path]);const r=await fetch(path);if(!r.ok)throw Error(path);return r.json();}
async function init(){try{[course,dict,audioIndex,guideBank,sceneIndex]=await Promise.all(['course/course.json','course/locales/ui.json','course/audio-index.json','course/tracing.json','course/scene-index.json'].map(loadJson));alphabet=course.alphabet;sceneIndex=sceneIndex.scenes??sceneIndex;const list=await Promise.all(course.chapters.map(c=>loadJson(c.path)));chapters=Object.fromEntries(list.map(c=>[c.id,c]));for(const lang of LANGS){dict[lang].word??={};dict[lang].story??={};for(const c of list){Object.assign(dict[lang].word,c.locales?.[lang]?.word??{});Object.assign(dict[lang].story,c.locales?.[lang]?.story??{});}}const requestedCode=(new URL(location.href).searchParams.get('lang')||'').toLowerCase().replaceAll('_','-').split('-')[0],requestedLocale=({nb:'no',nn:'no',iw:'he'})[requestedCode]||requestedCode;let chosenLocale;try{chosenLocale=localStorage.getItem('horizons-interface-language')}catch{}locale=[requestedLocale,chosenLocale,...(navigator.languages||[navigator.language]).map(x=>x.toLowerCase().split('-')[0]).map(x=>['nb','nn'].includes(x)?'no':x)].find(x=>LANGS.includes(x))||'en';const databaseSaved=await get('progress',DBKEY).catch(()=>null);let checkpoint=null;try{checkpoint=JSON.parse(localStorage.getItem(DBKEY))}catch{}const migrationCandidates=[databaseSaved,checkpoint];const saved=[databaseSaved,checkpoint].filter(valid).sort((a,b)=>(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0))[0];state=saved??fresh();if(!saved){let localOld;try{localOld=JSON.parse(localStorage.getItem('horizons-expanded|0.2.0|local-1'))}catch{}const dbOld=await get('progress','horizons-expanded|0.2.0|local-1').catch(()=>null);const old=[localOld,dbOld].filter(x=>x?.bookId==='horizons-expanded-baa').sort((a,b)=>(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0))[0];if(old){const candidate={...fresh(),updatedAt:old.updatedAt||'1970-01-01T00:00:00.000Z',locale:old.locale,heard:old.heard??{},attempts:old.attempts??{},ink:Object.fromEntries(FORMS.map(f=>['baa:'+f,old.ink?.[f]??[]])),written:Object.fromEntries(FORMS.map(f=>['baa:'+f,!!old.written?.[f]]))};if(valid(candidate)){state=candidate;migrationCandidates.push(candidate);}}}const audioRevisionMigrated=migrateAudioRevision(state);locale=state.locale;try{meaningLocale=localStorage.getItem('horizons-meaning-language')||(['ar','en','tr','fr','es'].includes(locale)?locale:'en')}catch{meaningLocale='en'};if(!['ar','en','tr','fr','es'].includes(meaningLocale))meaningLocale='en';await learnerInit(migrationCandidates);if(LANGS.includes(requestedLocale))locale=requestedLocale;render();if(window.HORIZONS_BOOT)window.HORIZONS_BOOT.ready=true;if(!saved||audioRevisionMigrated)save();if(!LOCAL_SERVER_MODE&&'serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register(new URL('sw.js',document.baseURI),{updateViaCache:'none'}).catch(()=>{});document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPenDemo();stop()}});}catch(e){if(window.HORIZONS_BOOT)window.HORIZONS_BOOT.errors.push(String(e?.message??e));$('#activity').innerHTML='<h2>تعذّر فتح الكراسة / Unable to open workbook</h2>'+(IS_DEMO?'<p>فكّ ضغط الحزمة كاملة ثم افتح index.html. أبقِ الملفات والمجلدات معًا.</p><p>Extract the complete package, then open index.html. Keep all files and folders together.</p>':'<p>شغّل Horizons-Arabic-Level-1.exe بعد استخراج الحزمة كاملة.</p><p>Extract the complete package and run Horizons-Arabic-Level-1.exe.</p>')+'<pre>'+esc(String(e?.message??e))+'</pre>';console.error(e)}}
if(typeof matchMedia==='function'){
 ensureTypographyToolbar();applyTypography();
 const typographyBreakpoint=matchMedia('(max-width:760px)');
 if(typographyBreakpoint.addEventListener)typographyBreakpoint.addEventListener('change',()=>applyTypography());else typographyBreakpoint.addListener(()=>applyTypography());
 if(typeof MutationObserver==='function')new MutationObserver(()=>updateTypographyUi()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
}
if(typeof addEventListener==='function')addEventListener('storage',event=>{if(!learnerStorage.enabled&&(event.key===TYPOGRAPHY_KEY||event.key===null)){typographyStorageReadable=true;typography=loadTypographyPrefs(typography);applyTypography()}});
addEventListener('beforeunload',event=>{if(learnerStorage.enabled&&(learnerSaving||learnerStorage.pending)){event.preventDefault();event.returnValue=''}});
/*CREATOR_CREDIT_BEGIN*/
/* Generic creator attribution shared by the demo, licensed workbook and entry page.
 * Replace the single locale placeholder with creator-credit-locales.json at build time.
 * No curriculum, licensing state or learner records are read or modified. */
(function(){
 'use strict';
 const DATA={"schema_version":1,"names":{"ar":"إسماعيل الخطيب","tr":"İsmail Alhatip"},"labels":{"en":"Concept, design, development and project management:","ar":"الفكرة والتصميم والتطوير وإدارة المشروع:","tr":"Fikir, tasarım, geliştirme ve proje yönetimi:","fr":"Idée, conception, développement et gestion de projet :","es":"Idea, diseño, desarrollo y gestión del proyecto:","de":"Idee, Gestaltung, Entwicklung und Projektleitung:","it":"Idea, progettazione, sviluppo e gestione del progetto:","pt":"Ideia, design, desenvolvimento e gestão do projeto:","nl":"Idee, ontwerp, ontwikkeling en projectleiding:","ru":"Идея, дизайн, разработка и управление проектом:","uk":"Ідея, дизайн, розробка та управління проєктом:","pl":"Pomysł, projektowanie, rozwój i zarządzanie projektem:","cs":"Nápad, návrh, vývoj a řízení projektu:","ro":"Idee, design, dezvoltare și management de proiect:","hu":"Ötlet, tervezés, fejlesztés és projektvezetés:","el":"Ιδέα, σχεδιασμός, ανάπτυξη και διαχείριση έργου:","sv":"Idé, design, utveckling och projektledning:","da":"Idé, design, udvikling og projektledelse:","no":"Idé, design, utvikling og prosjektledelse:","fi":"Idea, suunnittelu, kehitys ja projektin johtaminen:","bg":"Идея, дизайн, разработка и управление на проекта:","sr":"Идеја, дизајн, развој и управљање пројектом:","hr":"Ideja, dizajn, razvoj i upravljanje projektom:","he":"רעיון, עיצוב, פיתוח וניהול הפרויקט:","fa":"ایده، طراحی، توسعه و مدیریت پروژه:","ur":"تصور، ڈیزائن، ڈویلپمنٹ اور منصوبے کا انتظام:","hi":"अवधारणा, डिज़ाइन, विकास और परियोजना प्रबंधन:","bn":"ধারণা, নকশা, উন্নয়ন ও প্রকল্প ব্যবস্থাপনা:","id":"Ide, desain, pengembangan, dan pengelolaan proyek:","ms":"Idea, reka bentuk, pembangunan dan pengurusan projek:","zh":"构思、设计、开发与项目管理：","ja":"構想・設計・開発・プロジェクト管理："}};
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


init();

})();
