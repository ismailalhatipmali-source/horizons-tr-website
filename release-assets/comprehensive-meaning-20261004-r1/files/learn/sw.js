import { VERSION, PRODUCT } from './web-config.js';
// Interface release 1.4.6; encrypted lessons and learner stores are unchanged.
import { getAccess, getState, decryptAsset } from './license-core.js';
import { handleLearnerRequest } from './learner-store.js';
import { MediaStore, MEDIA_LIMITS, verifiedCipher, mediaResponse } from './media-store.js';

const ROOT = new URL('./', self.location.href);
const SHELL = 'hzn-web-shell-' + VERSION + '-blending3-20261004-r2-responsive-20261004-r3-demo-experience-20261004-r1-comprehensive-meaning-20261004-r1';
const media = new MediaStore();
const SHELL_FILES = ['','index.html','shell.css','shell.js','web-ui.js','pwa-client.js','license-core.js','membership-ui.js','membership-manager.js','asset-decoder.js','learner-store.js','progress-sync-client.js','media-store.js','web-config.js','portal-locales.json','web-locales.json','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','asset-manifest.json'];
let manifestPromise;
let downloadRunning = false;
let cancelDownload = false;
let downloadController;

function address(path) { return new URL(path, ROOT).href; }
async function manifest() {
  if (!manifestPromise) manifestPromise = (async () => {
    const cache = await caches.open(SHELL);
    let response = await cache.match(address('asset-manifest.json'));
    if (!response) response = await fetch(address('asset-manifest.json'), {cache:'no-store'});
    if (!response.ok) throw Error('MANIFEST_UNAVAILABLE');
    const data = await response.json();
    validateManifest(data);
    return data;
  })().catch(error => {manifestPromise = null; throw error;});
  return manifestPromise;
}
function validateManifest(data) {
  if (data.version !== VERSION || data.product !== PRODUCT || !data.files || !data.groups) throw Error('VERSION_MISMATCH');
  const versions=data.content_versions || [data.version];
  // The shell-only release reuses 1.4.0/1.4.1 encrypted assets unchanged.
  // No new paid asset location or external origin is accepted.
  if(!Array.isArray(versions)||versions.length!==2||versions[0]!=='1.4.0'||versions[1]!=='1.4.1')throw Error('INVALID_CONTENT_URL');
  for(const [path,item]of Object.entries(data.files)){
    if(!path||path.startsWith('/')||path.split('/').some(p=>!p||p==='.'||p==='..')||/[\\\x00-\x1f?#]/.test(path))throw Error('CONTENT_INVALID');
    if(!item||typeof item.url!=='string'||!Number.isSafeInteger(item.bytes)||item.bytes<28||item.bytes>MEDIA_LIMITS.maxAssetBytes||!/^[a-f0-9]{64}$/.test(item.sha256)||typeof item.mime!=='string'||/[\r\n]/.test(item.mime))throw Error('CONTENT_INVALID');
    if(item.encoding!==undefined && (item.encoding!=='gzip' || !Number.isSafeInteger(item.decoded_bytes) || item.decoded_bytes<1 || item.decoded_bytes>32*1024*1024 || !/^(text\/|application\/(json|javascript)|image\/svg\+xml)/.test(item.mime)))throw Error('CONTENT_INVALID');
    const url=new URL(item.url,ROOT),version=versions.find(v=>url.pathname===ROOT.pathname+'content/'+v+'/'+path+'.hzn');
    if(url.origin!==ROOT.origin||url.username||url.password||url.search||url.hash||!version)throw Error('INVALID_CONTENT_URL');
    item.url=url.href;item.cacheName='hzn-web-content-'+version;
  }
  for(const paths of Object.values(data.groups))if(!Array.isArray(paths)||paths.some(path=>!Object.hasOwn(data.files,path)))throw Error('CONTENT_INVALID');
  return data;
}
async function cipherFor(path, save = false, signal) {
  const m=await manifest(),item=m.files[path];
  if(!Object.hasOwn(m.files,path)||!item)throw Error('NOT_FOUND');
  const before=await getAccess();
  const plain=await media.get(path,item,{key:before.key,decrypt:(p,b)=>decryptAsset(p,b,item),signal,pin:save});
  // Recheck after asynchronous loading as well as before RAM/cache hits. A tab
  // that signs out or switches accounts cannot receive an old pending result.
  const after=await getAccess();
  if(after.key!==before.key){media.clearPlain();throw Error('ACTIVATION_REQUIRED');}
  return {plain,item};
}
async function protectedResponse(event, path) {
  try {
    const {plain,item}=await cipherFor(path,false,event.request.signal);
    return mediaResponse(event.request,plain,item.mime);
  } catch (error) {
    if(!['CONTENT_UNAVAILABLE','CONTENT_DAMAGED','CONTENT_TIMEOUT','CONTENT_BUSY','NOT_FOUND'].includes(error.message))media.clearPlain();
    if (event.request.mode === 'navigate') return Response.redirect(address('index.html?reason='+encodeURIComponent(error.code||error.message)),302);
    const status=error.name==='AbortError'?499:error.message==='NOT_FOUND'?404:['CONTENT_BUSY','CONTENT_TIMEOUT','CONTENT_UNAVAILABLE','CONTENT_DAMAGED'].includes(error.message)?503:403;
    return new Response(JSON.stringify({ok:false,error:error.code||error.message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }
}
self.addEventListener('install', event => event.waitUntil((async()=>{
  const cache = await caches.open(SHELL);
  await cache.addAll(SHELL_FILES.map(address));
  const installedManifest=await (await cache.match(address('asset-manifest.json'))).json();
  validateManifest(installedManifest);
  // A new worker waits for all old workbook tabs to close, preventing mixed releases.
})()));
self.addEventListener('activate', event => event.waitUntil((async()=>{
  await self.clients.claim();
  // Keep earlier encrypted caches until an explicit user cleanup; an update must
  // not silently delete lessons the person saved for offline use.
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin!==ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  const rel = url.pathname.slice(ROOT.pathname.length);
  if(rel==='app/api/learners'||rel.startsWith('app/api/learners/')){event.respondWith(handleLearnerRequest(event.request,rel.slice('app/api/learners'.length)));return;}
  if (!['GET','HEAD'].includes(event.request.method)) return;
  if (rel.startsWith('app/')) {
    let path;
    try { path = decodeURIComponent(rel.slice(4)) || 'index.html'; } catch { path=''; }
    if (!path || path.includes('..') || path.includes('\\') || path.startsWith('/')) {event.respondWith(new Response('Invalid path',{status:400}));return;}
    event.respondWith(protectedResponse(event,path));
  } else if (SHELL_FILES.includes(rel) || rel==='') {
    event.respondWith((async()=>{
      const cache=await caches.open(SHELL);
      return (await cache.match(address(rel))) || fetch(event.request);
    })());
  }
});
async function offlineState() {
  const m=await manifest(),keys=new Set();
  for(const name of new Set(Object.values(m.files).map(item=>item.cacheName))){const cache=await caches.open(name);for(const key of await cache.keys())keys.add(key.url);}
  const groups={};let savedBytes=0,totalBytes=0,savedFiles=0;
  for(const [path,item] of Object.entries(m.files)){totalBytes+=item.bytes;if(keys.has(item.url)){savedBytes+=item.bytes;savedFiles++;}}
  for(const [name,paths] of Object.entries(m.groups)) groups[name]={saved:paths.filter(p=>keys.has(m.files[p].url)).length,total:paths.length};
  return {ok:true,version:VERSION,groups,savedBytes,totalBytes,savedFiles,totalFiles:Object.keys(m.files).length,running:downloadRunning};
}
self.addEventListener('message',event=>{
  const port=event.ports?.[0]; if(!port)return;
  const answer=value=>port.postMessage(value);
  const message=event.data||{};
  event.waitUntil((async()=>{
    try {
      if(message.type==='get-version')return answer({ok:true,version:VERSION});
      if(message.type==='access-state')return answer(await getState());
      if(message.type==='offline-state')return answer(await offlineState());
      if(message.type==='verify-downloads'){
        if(downloadRunning)throw Error('DOWNLOAD_BUSY');
        downloadRunning=true;
        try{
          const m=await manifest(),entries=Object.entries(m.files);
          let done=0,damaged=0;
          for(const [path,item]of entries){const cache=await caches.open(item.cacheName),url=item.url,response=await cache.match(url);if(response){try{await verifiedCipher(response,item)}catch{await cache.delete(url);damaged++}};done++;answer({done,total:entries.length});}
          return answer({...await offlineState(),damaged,verified:true});
        }finally{downloadRunning=false;}
      }
      if(message.type==='cancel-download'){cancelDownload=true;downloadController?.abort();return answer({ok:true});}
      if(message.type==='clear-downloads'){
        if(downloadRunning)throw Error('DOWNLOAD_BUSY');
        await media.clear();
        for(const key of await caches.keys())if(key.startsWith('hzn-web-content-'))await caches.delete(key);
        return answer(await offlineState());
      }
      if(message.type!=='cache-group')throw Error('INVALID_REQUEST');
      if(message.version!==VERSION)throw Error('UPDATE_REQUIRED');
      if(downloadRunning)throw Error('DOWNLOAD_BUSY');
      await getAccess(); const m=await manifest(),paths=m.groups[message.group];
      if(!Array.isArray(paths))throw Error('INVALID_GROUP');
      downloadRunning=true;cancelDownload=false;downloadController=new AbortController();
      try {
        let done=0;
        for(const path of paths){
          if(cancelDownload)throw Error('DOWNLOAD_CANCELLED');
          await cipherFor(path,true,downloadController.signal); done++;
          answer({done,total:paths.length});
        }
        answer({ok:true,done,total:paths.length,group:message.group});
      } finally {downloadRunning=false;downloadController=null;}
    } catch(error){answer({ok:false,error:error.name==='AbortError'&&cancelDownload?'DOWNLOAD_CANCELLED':error.code||error.message||'OFFLINE_FAILED'});}
  })());
});
