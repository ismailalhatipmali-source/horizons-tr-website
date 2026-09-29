// Run with node --experimental-vm-modules --test tests/test_media_worker.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';

class Cache {
  constructor(){this.values=new Map();}
  async match(key){return this.values.get(typeof key==='string'?key:key.url)?.clone();}
  async put(key,value){this.values.set(typeof key==='string'?key:key.url,value.clone());}
  async delete(key){return this.values.delete(typeof key==='string'?key:key.url);}
  async keys(){return [...this.values.keys()].map(url=>new Request(url));}
}
async function worker({mutateManifest=()=>{},pauseDownload=false}={}){
  const root='https://example.test/learn/',bytes=new Uint8Array(128),key={},listeners={},stores=new Map();
  const license={valid:true,key},counts={network:0,decrypt:0,access:0};let release;
  const item={url:'content/1.4.0/audio.mp3.hzn',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),mime:'audio/mpeg'};
  const manifest={version:'1.4.2',product:'horizons-arabic-level1',content_versions:['1.4.0','1.4.1'],files:{'audio.mp3':item},groups:{one:['audio.mp3']}};mutateManifest(manifest);
  const storage={open:async name=>{if(!stores.has(name))stores.set(name,new Cache());return stores.get(name);},keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name)};
  const fetcher=async url=>{
    if(url===root+'asset-manifest.json')return new Response(JSON.stringify(manifest));
    counts.network++;if(pauseDownload)await new Promise(resolve=>{release=resolve;});
    return new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Length':'128'}});
  };
  const context=vm.createContext({URL,Request,Response,Headers,AbortController,DOMException,Uint8Array,TextEncoder,TextDecoder,Date,Math,Map,WeakMap,Set,Promise,Object,Array,Number,String,Error,JSON,RegExp,setTimeout,clearTimeout,crypto:webcrypto,caches:storage,fetch:fetcher,self:{location:{href:root+'sw.js'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>{listeners[name]=fn;}}});
  const modules={};
  async function synthetic(name,values){const module=new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context,identifier:name});modules[name]=module;return module;}
  await synthetic('./web-config.js',{VERSION:'1.4.2',PRODUCT:'horizons-arabic-level1'});
  await synthetic('./license-core.js',{getAccess:async()=>{counts.access++;if(!license.valid)throw Error('ACTIVATION_REQUIRED');return {key:license.key,license:{}};},getState:async()=>({activated:license.valid}),decryptAsset:async(_,data)=>{counts.decrypt++;if(!license.valid)throw Error('ACTIVATION_REQUIRED');return data.slice(28);}});
  await synthetic('./learner-store.js',{handleLearnerRequest:async()=>new Response('{}')});
  modules['./media-store.js']=new vm.SourceTextModule(await readFile(new URL('../src/workbook-web/media-store.js',import.meta.url),'utf8'),{context,identifier:'media-store.js'});
  const sw=new vm.SourceTextModule(await readFile(new URL('../src/workbook-web/sw.js',import.meta.url),'utf8'),{context,identifier:'sw.js'});
  await sw.link(name=>modules[name]);await sw.evaluate();
  return {license,counts,manifest,release:()=>release?.(),request:async(options={})=>{let result;listeners.fetch({request:new Request(root+'app/audio.mp3',options),respondWith:value=>{result=value;}});return result;}};
}

test('worker authorizes every RAM/cache hit and denies access after sign-out',async()=>{
  const w=await worker();assert.equal((await w.request({headers:{range:'bytes=0-1'}})).status,206);assert.equal(w.counts.network,1);assert.equal(w.counts.decrypt,1);
  assert.equal((await w.request()).status,200);assert.equal(w.counts.network,1);assert.equal(w.counts.decrypt,1);assert.equal(w.counts.access,4);
  w.license.valid=false;const denied=await w.request();assert.equal(denied.status,403);assert.equal((await denied.json()).error,'ACTIVATION_REQUIRED');assert.equal(w.counts.network,1);
});

test('worker cannot return a request loaded under a different activation key',async()=>{
  const w=await worker({pauseDownload:true});const pending=w.request();
  while(!w.counts.network)await new Promise(resolve=>setTimeout(resolve,0));
  w.license.key={};w.release();const result=await pending;assert.equal(result.status,403);assert.equal((await result.json()).error,'ACTIVATION_REQUIRED');
});

test('worker rejects external/traversal/oversize manifest assets before media network access',async()=>{
  const mutations=[m=>{m.files['audio.mp3'].url='https://other.test/content/1.4.0/audio.mp3.hzn';},m=>{m.files['audio.mp3'].url='content/1.4.0/../audio.mp3.hzn';},m=>{m.files['audio.mp3'].bytes=64*1024*1024;},m=>{m.content_versions=['1.2.0'];},m=>{m.files['audio.mp3'].url='content/1.4.0/audio.mp3.hzn?bypass=1';}];
  for(const mutateManifest of mutations){const w=await worker({mutateManifest});assert.equal((await w.request()).status,403);assert.equal(w.counts.network,0);}
});

test('worker supports new patch content version while preserving accurate HEAD headers',async()=>{
  const w=await worker({mutateManifest:m=>{m.files['audio.mp3'].url='content/1.4.1/audio.mp3.hzn';}});
  const result=await w.request({method:'HEAD',headers:{range:'bytes=0-1'}});assert.equal(result.status,200);assert.equal(result.headers.get('content-length'),'100');assert.equal((await result.arrayBuffer()).byteLength,0);
});
