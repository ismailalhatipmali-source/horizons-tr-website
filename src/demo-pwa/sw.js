/* Public five-letter demo only. No activation or paid-content access is implemented here. */
'use strict';
const VERSION='1.4.0';
const EXPECTED=['baa','dhaa_emphatic','daad','yaa','dhaal'];
const ROOT=new URL('./',self.location.href);
const CACHE='hzn-public-demo-'+VERSION;
const MANIFEST='demo-asset-manifest.json';
let manifestPromise,downloading=false,cancelled=false,downloadController=null;
const address=path=>new URL(path,ROOT).href;
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
function safePath(path){
  if(typeof path!=='string'||!path||path.startsWith('/')||path.includes('\\')||path.includes('?')||path.includes('#')||path.includes('%')||path.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('INVALID_MANIFEST');
  const url=new URL(path,ROOT);
  if(url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))throw Error('INVALID_MANIFEST');
  return path;
}
function validate(data){
  if(data.version!==VERSION||data.edition!=='demo'||!Array.isArray(data.chapterIds)||data.chapterIds.length!==5||!EXPECTED.every(x=>data.chapterIds.includes(x))||!data.files||typeof data.files!=='object'||!Array.isArray(data.shell))throw Error('INVALID_MANIFEST');
  for(const [path,item] of Object.entries(data.files)){
    safePath(path);
    if(!Number.isSafeInteger(item.bytes)||item.bytes<0||!/^[a-f0-9]{64}$/.test(item.sha256))throw Error('INVALID_MANIFEST');
    if(path.startsWith('course/chapters/')&&!EXPECTED.some(id=>path==='course/chapters/'+id+'.json'))throw Error('NON_DEMO_CONTENT');
    if(path.startsWith('course/tracing/')&&!EXPECTED.some(id=>path==='course/tracing/'+id+'.json'))throw Error('NON_DEMO_CONTENT');
    if(path.startsWith('course/audio/')&&!EXPECTED.some(id=>path.endsWith('/alphabet.'+id+'.mp3')||path.includes('/word.'+id+'-')||path.includes('/sentence.'+id+'-')||path.includes('/story.'+id+'-')))throw Error('NON_DEMO_CONTENT');
  }
  for(const path of data.shell)if(!data.files[safePath(path)])throw Error('INVALID_MANIFEST');
  return data;
}
async function manifest(){
  if(!manifestPromise)manifestPromise=(async()=>{
    const cache=await caches.open(CACHE);
    let response=await cache.match(address(MANIFEST));
    if(!response)response=await fetch(address(MANIFEST),{cache:'no-store'});
    if(!response.ok)throw Error('MANIFEST_UNAVAILABLE');
    return validate(await response.json());
  })().catch(error=>{manifestPromise=null;throw error;});
  return manifestPromise;
}
async function checked(response,item){
  if(!response?.ok||response.type==='opaque')throw Error('FILE_UNAVAILABLE');
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==item.bytes||hex(await crypto.subtle.digest('SHA-256',bytes))!==item.sha256)throw Error('FILE_DAMAGED');
  return new Response(bytes,{headers:{'Content-Type':item.mime||'application/octet-stream','Content-Length':String(bytes.byteLength),'X-Content-Type-Options':'nosniff'}});
}
async function download(path,item,cache,signal){
  let response=await cache.match(address(path));
  if(response){try{await checked(response.clone(),item);return;}catch{await cache.delete(address(path));}}
  const controller=new AbortController();
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,45000);
  try{
    if(signal?.aborted)throw Error('DOWNLOAD_CANCELLED');
    response=await fetch(address(path),{cache:'no-store',signal:controller.signal});
    const verified=await checked(response,item);
    if(signal?.aborted)throw Error('DOWNLOAD_CANCELLED');
    await cache.put(address(path),verified);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  // Only app shell is automatic. Audio and images are saved on explicit request.
  const response=await fetch(address(MANIFEST),{cache:'no-store'});
  if(!response.ok)throw Error('MANIFEST_UNAVAILABLE');
  const data=validate(await response.clone().json());
  const cache=await caches.open(CACHE);
  for(const path of data.shell)await download(path,data.files[path],cache);
  await cache.put(address(MANIFEST),response);
  manifestPromise=Promise.resolve(data);
  // Wait for existing tabs to close before activating a newer release.
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
function offlineResponse(request){
  if(request.mode==='navigate')return new Response('<!doctype html><meta charset="utf-8"><title>HORIZONS</title><p lang="ar" dir="rtl">هذا الملف غير محفوظ. اتصل بالإنترنت ثم احفظ النسخة التجريبية للاستخدام دون اتصال.</p><p>This file is not saved. Connect to the internet, then save the demo for offline use.</p>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  return new Response('Offline: file not saved',{status:503,headers:{'Cache-Control':'no-store'}});
}
async function rangeResponse(response,request){
  if(request.method==='HEAD')return new Response(null,{status:response.status,headers:response.headers});
  const range=request.headers.get('range');
  if(!range||!/^audio\//.test(response.headers.get('content-type')||''))return response;
  const bytes=await response.arrayBuffer(),match=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+bytes.byteLength}});
  const start=match[1]?Number(match[1]):Math.max(0,bytes.byteLength-Number(match[2]));
  const end=match[1]?Math.min(match[2]?Number(match[2]):bytes.byteLength-1,bytes.byteLength-1):bytes.byteLength-1;
  if(start>end||start>=bytes.byteLength)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+bytes.byteLength}});
  const headers=new Headers(response.headers);headers.set('Content-Range',`bytes ${start}-${end}/${bytes.byteLength}`);headers.set('Accept-Ranges','bytes');headers.set('Content-Length',String(end-start+1));
  return new Response(bytes.slice(start,end+1),{status:206,headers});
}
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(!['GET','HEAD'].includes(request.method)||url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
  let path=url.pathname.slice(ROOT.pathname.length)||'index.html';
  try{safePath(path);}catch{return;}
  event.respondWith((async()=>{
    try{
      const data=await manifest();
      if(path!==MANIFEST&&!data.files[path])return fetch(request);
      const cache=await caches.open(CACHE),saved=await cache.match(address(path));
      if(saved)return rangeResponse(saved,request);
      // Merely visiting a lesson never claims that it has been saved offline.
      return await fetch(request);
    }catch{return offlineResponse(request);}
  })());
});
async function state(){
  const data=await manifest(),cache=await caches.open(CACHE);
  let saved=0,savedBytes=0,totalBytes=0,damaged=0;
  for(const [path,item] of Object.entries(data.files)){
    totalBytes+=item.bytes;const response=await cache.match(address(path));
    if(response){
      try{await checked(response,item);saved++;savedBytes+=item.bytes;}
      catch{damaged++;await cache.delete(address(path));}
    }
  }
  return {ok:true,version:VERSION,saved,total:Object.keys(data.files).length,savedBytes,totalBytes,damaged,running:downloading};
}
async function groupFiles(data,group,cache){
  if(group==='all')return Object.entries(data.files);
  if(!EXPECTED.includes(group))throw Error('INVALID_GROUP');
  const selected=new Set(data.shell);
  for(const path of Object.keys(data.files)){
    if(path==='course/chapters/'+group+'.json'||path==='course/tracing/'+group+'.json'||path.endsWith('/alphabet.'+group+'.mp3')||path.includes('/word.'+group+'-')||path.includes('/sentence.'+group+'-')||path.includes('/story.'+group+'-'))selected.add(path);
  }
  const scenePath='course/scene-index.json';
  if(!data.files[scenePath])throw Error('INVALID_MANIFEST');
  await download(scenePath,data.files[scenePath],cache);
  const scenes=(await (await cache.match(address(scenePath))).json()).scenes;
  for(const [id,scene] of Object.entries(scenes||{})){
    if(id.startsWith(group+'-')||id.startsWith('sentence.'+group+'-')){
      if(!data.files[scene.path])throw Error('INVALID_MANIFEST');
      selected.add(scene.path);
    }
  }
  return [...selected].map(path=>[path,data.files[path]]);
}
self.addEventListener('message',event=>{
  const port=event.ports?.[0];if(!port)return;
  const answer=data=>port.postMessage(data),message=event.data||{};
  event.waitUntil((async()=>{
    try{
      if(message.type==='demo-state')return answer(await state());
      if(message.type==='demo-cancel'){cancelled=true;downloadController?.abort();return answer({ok:true});}
      if(message.type==='demo-clear'){
        if(downloading)throw Error('DOWNLOAD_BUSY');
        const data=await manifest(),shell=new Set(data.shell);
        // Remove only explicitly downloaded demo media; retain the launch shell.
        for(const name of await caches.keys()){
          if(!name.startsWith('hzn-public-demo-'))continue;
          if(name!==CACHE){await caches.delete(name);continue;}
          const cache=await caches.open(name);
          for(const key of await cache.keys()){
            const path=new URL(key.url).pathname.slice(ROOT.pathname.length);
            if(path!==MANIFEST&&!shell.has(path))await cache.delete(key);
          }
        }
        return answer(await state());
      }
      if(message.type!=='demo-save')throw Error('INVALID_REQUEST');
      if(downloading)throw Error('DOWNLOAD_BUSY');
      downloading=true;cancelled=false;downloadController=new AbortController();
      try{
        const data=await manifest(),cache=await caches.open(CACHE);
        const group=message.group||'all';
        const files=await groupFiles(data,group,cache);
        let done=0;
        for(const [path,item] of files){
          if(cancelled)throw Error('DOWNLOAD_CANCELLED');
          await download(path,item,cache,downloadController.signal);done++;
          answer({done,total:files.length});
        }
        const finalState=await state();
        const savedKeys=new Set((await cache.keys()).map(x=>x.url));
        if(!files.every(([path])=>savedKeys.has(address(path))))throw Error('SAVE_INCOMPLETE');
        answer({...finalState,running:false,complete:true,group,done:files.length,groupTotal:files.length});
      }finally{downloading=false;downloadController=null;}
    }catch(error){answer({ok:false,error:cancelled?'DOWNLOAD_CANCELLED':error.message||'SAVE_FAILED'});}
  })());
});
