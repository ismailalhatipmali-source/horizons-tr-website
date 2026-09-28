import { VERSION } from './web-config.js';
import { getAccess, getState, decryptAsset } from './license-core.js';
import { handleLearnerRequest } from './learner-store.js';

const ROOT = new URL('./', self.location.href);
const SHELL = 'hzn-web-shell-' + VERSION;
const CONTENT = 'hzn-web-content-' + VERSION;
const SHELL_FILES = ['','index.html','shell.css','shell.js','web-ui.js','pwa-client.js','license-core.js','learner-store.js','web-config.js','portal-locales.json','web-locales.json','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','asset-manifest.json'];
let manifestPromise;
let downloadRunning = false;
let cancelDownload = false;

function address(path) { return new URL(path, ROOT).href; }
async function manifest() {
  if (!manifestPromise) manifestPromise = (async () => {
    const cache = await caches.open(SHELL);
    let response = await cache.match(address('asset-manifest.json'));
    if (!response) response = await fetch(address('asset-manifest.json'), {cache:'no-store'});
    if (!response.ok) throw Error('MANIFEST_UNAVAILABLE');
    const data = await response.json();
    if (data.version !== VERSION || !data.files || !data.groups) throw Error('VERSION_MISMATCH');
    return data;
  })().catch(error => {manifestPromise = null; throw error;});
  return manifestPromise;
}
function hex(bytes) { return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2,'0')).join(''); }
async function validCipher(response, item) {
  if (!response?.ok) throw Error('CONTENT_UNAVAILABLE');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== item.bytes || hex(await crypto.subtle.digest('SHA-256',bytes)) !== item.sha256) throw Error('CONTENT_DAMAGED');
  return bytes;
}
async function cipherFor(path, save = false) {
  const m = await manifest(), item = m.files[path];
  if (!item) throw Error('NOT_FOUND');
  const url = new URL(item.url, ROOT);
  if (url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname+'content/'+VERSION+'/')) throw Error('INVALID_CONTENT_URL');
  const cache = await caches.open(CONTENT);
  let response = await cache.match(url.href), bytes;
  if (response) {
    try { bytes = await validCipher(response, item); }
    catch { await cache.delete(url.href); }
  }
  if (!bytes) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),45000);
    try {
      response = await fetch(url.href,{cache:'no-store',signal:controller.signal});
      bytes = await validCipher(response,item);
      // Only encrypted responses enter Cache Storage. Plaintext never does.
      if (save) await cache.put(url.href,new Response(bytes,{headers:{'Content-Type':'application/octet-stream'}}));
    } finally { clearTimeout(timer); }
  }
  return {bytes,item};
}
async function protectedResponse(event, path) {
  try {
    await getAccess();
    const {bytes,item} = await cipherFor(path);
    const plain = await decryptAsset(path,bytes);
    const headers = {'Content-Type':item.mime || 'application/octet-stream','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
    // Media elements may issue range requests even when the whole encrypted file is local.
    const range = event.request.headers.get('range');
    if (range && /^(audio|video)\//.test(headers['Content-Type'])) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null,{status:416});
      const start = match[1] ? Number(match[1]) : Math.max(0,plain.byteLength-Number(match[2]));
      const end = match[1] ? Math.min(match[2]?Number(match[2]):plain.byteLength-1,plain.byteLength-1) : plain.byteLength-1;
      if (start > end || start >= plain.byteLength) return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+plain.byteLength}});
      headers['Content-Range']=`bytes ${start}-${end}/${plain.byteLength}`;headers['Accept-Ranges']='bytes';
      return new Response(plain.slice(start,end+1),{status:206,headers});
    }
    return new Response(event.request.method==='HEAD'?null:plain,{headers});
  } catch (error) {
    if (event.request.mode === 'navigate') return Response.redirect(address('index.html?reason='+encodeURIComponent(error.code||error.message)),302);
    return new Response(JSON.stringify({ok:false,error:error.code||error.message}),{status:error.message==='NOT_FOUND'?404:403,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }
}
self.addEventListener('install', event => event.waitUntil((async()=>{
  const cache = await caches.open(SHELL);
  await cache.addAll(SHELL_FILES.map(address));
  const installedManifest=await (await cache.match(address('asset-manifest.json'))).json();
  if(installedManifest.version!==VERSION || !installedManifest.files || !installedManifest.groups)throw Error('VERSION_MISMATCH');
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
  const m=await manifest(), cache=await caches.open(CONTENT), keys=new Set((await cache.keys()).map(x=>x.url));
  const groups={};let savedBytes=0,totalBytes=0,savedFiles=0;
  for(const [path,item] of Object.entries(m.files)){totalBytes+=item.bytes;if(keys.has(address(item.url))){savedBytes+=item.bytes;savedFiles++;}}
  for(const [name,paths] of Object.entries(m.groups)) groups[name]={saved:paths.filter(p=>keys.has(address(m.files[p].url))).length,total:paths.length};
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
          const m=await manifest(),cache=await caches.open(CONTENT),entries=Object.entries(m.files);
          let done=0,damaged=0;
          for(const [path,item]of entries){const url=address(item.url),response=await cache.match(url);if(response){try{await validCipher(response,item)}catch{await cache.delete(url);damaged++}};done++;answer({done,total:entries.length});}
          return answer({...await offlineState(),damaged,verified:true});
        }finally{downloadRunning=false;}
      }
      if(message.type==='cancel-download'){cancelDownload=true;return answer({ok:true});}
      if(message.type==='clear-downloads'){
        if(downloadRunning)throw Error('DOWNLOAD_BUSY');
        for(const key of await caches.keys())if(key.startsWith('hzn-web-content-'))await caches.delete(key);
        return answer(await offlineState());
      }
      if(message.type!=='cache-group')throw Error('INVALID_REQUEST');
      if(message.version!==VERSION)throw Error('UPDATE_REQUIRED');
      if(downloadRunning)throw Error('DOWNLOAD_BUSY');
      await getAccess(); const m=await manifest(),paths=m.groups[message.group];
      if(!Array.isArray(paths))throw Error('INVALID_GROUP');
      downloadRunning=true;cancelDownload=false;
      try {
        let done=0;
        for(const path of paths){
          if(cancelDownload)throw Error('DOWNLOAD_CANCELLED');
          await getAccess(); await cipherFor(path,true); done++;
          answer({done,total:paths.length});
        }
        answer({ok:true,done,total:paths.length,group:message.group});
      } finally {downloadRunning=false;}
    } catch(error){answer({ok:false,error:error.code||error.message||'OFFLINE_FAILED'});}
  })());
});
