import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MediaStore,MEDIA_LIMITS,TransferPool,RecentCipherCache,verifiedCipher,mediaResponse} from '../src/workbook-web/media-store.js';

class Cache {
  constructor(){this.records=new Map();}
  async match(key){return this.records.get(typeof key==='string'?key:key.url)?.clone();}
  async put(key,value){this.records.set(typeof key==='string'?key:key.url,value.clone());}
  async delete(key){return this.records.delete(typeof key==='string'?key:key.url);}
  async keys(){return [...this.records.keys()].map(url=>new Request(url));}
}
class Storage {
  constructor(){this.records=new Map();}
  async open(name){if(!this.records.has(name))this.records.set(name,new Cache());return this.records.get(name);}
  async delete(name){return this.records.delete(name);}
}
function fixture(id,size=128){
  const data=Uint8Array.from({length:size},(_,i)=>(i+Number(id))%256);
  return {data,item:{url:'https://example.test/learn/content/1.4.0/'+id+'.hzn',cacheName:'hzn-web-content-1.4.0',bytes:size,sha256:createHash('sha256').update(data).digest('hex')}};
}
function response(data){return new Response(data,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(data.byteLength)}});}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const limits={...MEDIA_LIMITS,recentBytes:256,recentFiles:2,plainBytes:256,plainFiles:2,plainTTL:60000,transfers:2,queue:2,timeout:100};

test('concurrent Android range probes fetch/decrypt once; replay uses RAM then encrypted cache',async()=>{
  const storage=new Storage(),{data,item}=fixture(1);let requests=0,decryptions=0;
  const store=new MediaStore({storage,limits,fetcher:async()=>{requests++;await delay(10);return response(data);}}),key={};
  const options={key,decrypt:async(_,bytes)=>{decryptions++;return bytes.slice(28);}};
  const replies=await Promise.all(['bytes=0-1','bytes=2-','bytes=-3'].map(async range=>mediaResponse(new Request('https://example.test/app/audio.mp3',{headers:{range}}),await store.get('a',item,options),'audio/mpeg')));
  assert.deepEqual(replies.map(x=>x.status),[206,206,206]);assert.equal(requests,1);assert.equal(decryptions,1);
  assert.equal(replies[0].headers.get('content-range'),'bytes 0-1/100');assert.equal((await replies[0].arrayBuffer()).byteLength,2);
  await store.get('a',item,options);assert.equal(requests,1);assert.equal(decryptions,1);
  store.clearPlain();await store.get('a',item,options);assert.equal(requests,1);assert.equal(decryptions,2);
  assert.equal((await storage.open('hzn-web-recent-content-v1')).records.size,1);
});

test('range and HEAD response lengths, suffix/oversize/zero/malformed range handling',async()=>{
  const data=new Uint8Array(100).buffer;
  const make=(range,method='GET')=>mediaResponse(new Request('https://example.test/a',{method,headers:{range}}),data,'audio/mpeg');
  assert.equal(make('bytes=3-999').headers.get('content-length'),'97');
  assert.equal(make('bytes=-999').headers.get('content-range'),'bytes 0-99/100');
  for(const value of ['bytes=100-','bytes=-0','bytes=4-3','bytes=-','bytes=1-2,3-4','bytes=999999999999999999999-']){
    const result=make(value);assert.equal(result.status,416,value);assert.equal(result.headers.get('content-range'),'bytes */100');assert.equal(result.headers.get('content-length'),'0');
  }
  const head=make('bytes=0-1','HEAD');assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'100');assert.equal((await head.arrayBuffer()).byteLength,0);
});

test('a cancelled subscriber does not interrupt another; final cancellation aborts transfer',async()=>{
  const pool=new TransferPool(1,2);let calls=0,aborted=0,release;
  const task=signal=>{calls++;return new Promise((resolve,reject)=>{release=resolve;signal.addEventListener('abort',()=>{aborted++;reject(new DOMException('Cancelled','AbortError'));});});};
  const a=new AbortController(),b=new AbortController();
  const p1=pool.run('one',task,a.signal),p2=pool.run('one',task,b.signal);await delay(0);a.abort();await assert.rejects(p1,{name:'AbortError'});assert.equal(aborted,0);release('done');assert.equal(await p2,'done');assert.equal(calls,1);
  const c=new AbortController(),p3=pool.run('two',task,c.signal);await delay(0);c.abort();await assert.rejects(p3,{name:'AbortError'});await delay(0);assert.equal(aborted,1);assert.equal(pool.jobs.size,0);assert.equal(pool.active,0);
});

test('concurrency and queue are bounded; cancelling queued work never starts it',async()=>{
  const pool=new TransferPool(1,1);let started=0,release;
  const first=pool.run('first',()=>new Promise(resolve=>{started++;release=resolve;}));
  const cancel=new AbortController();const queued=pool.run('queued',()=>{started++;},cancel.signal);
  await assert.rejects(pool.run('overflow',()=>{}),/CONTENT_BUSY/);
  await delay(0);assert.equal(started,1);cancel.abort();await assert.rejects(queued,{name:'AbortError'});release();await first;await delay(0);assert.equal(started,1);assert.equal(pool.jobs.size,0);
});

test('automatic ciphertext cache stays bounded and never evicts pinned offline lessons',async()=>{
  const storage=new Storage(),assets=[fixture(1),fixture(2),fixture(3),fixture(4)],key={};let requests=0;
  const store=new MediaStore({storage,limits,fetcher:async url=>{requests++;return response(assets.find(x=>x.item.url===url).data);}});
  const options={key,decrypt:async(_,bytes)=>bytes.slice(28)};
  await store.get('1',assets[0].item,{...options,pin:true});
  for(const asset of assets.slice(1)){await store.get('x',asset.item,options);await delay(2);}
  const recent=await storage.open('hzn-web-recent-content-v1'),pinned=await storage.open('hzn-web-content-1.4.0');
  assert.equal(recent.records.size,2);assert.equal(pinned.records.size,1);assert.ok(await pinned.match(assets[0].item.url));
  assert.equal(await recent.match(assets[1].item.url),undefined);
  store.clearPlain();await store.get('1',assets[0].item,options);assert.equal(requests,4);
  assert.ok(store.plain.size<=2);assert.ok(store.plainSize<=256);
});

test('existing offline 1.4.0 cache works without network after updating worker',async()=>{
  const storage=new Storage(),{data,item}=fixture(8),key={};
  await (await storage.open(item.cacheName)).put(item.url,response(data));
  const store=new MediaStore({storage,limits,fetcher:async()=>{throw Error('No network');}});
  assert.equal((await store.get('8',item,{key,decrypt:async(_,bytes)=>bytes.slice(28)})).byteLength,100);
});

test('reject invalid lengths, HTML, oversized streams, short streams, and hash mismatch; next try recovers',async()=>{
  const {data,item}=fixture(9);
  const variants=[new Response(data,{headers:{'Content-Length':'7'}}),new Response(data,{headers:{'Content-Type':'text/html'}}),new Response(new Uint8Array(129)),new Response(new Uint8Array(127)),new Response(new Uint8Array(128))];
  for(const value of variants)await assert.rejects(verifiedCipher(value,item),/CONTENT_DAMAGED/);
  let calls=0;const store=new MediaStore({storage:new Storage(),limits,fetcher:async()=>++calls===1?new Response('error',{headers:{'Content-Type':'text/html'}}):response(data)}),options={key:{},decrypt:async(_,bytes)=>bytes.slice(28)};
  await assert.rejects(store.get('9',item,options),/CONTENT_DAMAGED/);
  assert.equal((await store.get('9',item,options)).byteLength,100);assert.equal(calls,2);
});

test('corrupt persisted ciphertext is removed and repaired by a verified network response',async()=>{
  const storage=new Storage(),{data,item}=fixture(7);let calls=0;
  await (await storage.open(item.cacheName)).put(item.url,response(new Uint8Array(128)));
  const store=new MediaStore({storage,limits,fetcher:async()=>{calls++;return response(data);}});
  await store.get('7',item,{key:{},decrypt:async(_,bytes)=>bytes.slice(28)});assert.equal(calls,1);
  assert.equal(await (await storage.open(item.cacheName)).match(item.url),undefined);
});

test('account key switch clears RAM and forces decryption with new access; denied decrypt cannot reuse previous plain',async()=>{
  const {data,item}=fixture(11);let calls=0,decodes=0;
  const store=new MediaStore({storage:new Storage(),limits,fetcher:async()=>{calls++;return response(data);}}),key1={},key2={};
  await store.get('11',item,{key:key1,decrypt:async(_,bytes)=>{decodes++;return bytes.slice(28);}});
  await assert.rejects(store.get('11',item,{key:key2,decrypt:async()=>{decodes++;throw Error('ACTIVATION_REQUIRED');}}),/ACTIVATION_REQUIRED/);
  assert.equal(store.plain.size,0);assert.equal(calls,1);assert.equal(decodes,2);
});

test('denied browser cache/quota still permits online media; explicit offline save reports storage failure',async()=>{
  const {data,item}=fixture(12),storage={open:async()=>{throw Error('storage denied');}};
  const store=new MediaStore({storage,limits,fetcher:async()=>response(data)}),options={key:{},decrypt:async(_,bytes)=>bytes.slice(28)};
  assert.equal((await store.get('12',item,options)).byteLength,100);
  await assert.rejects(store.get('12',item,{...options,pin:true}),/storage denied/);
});

test('network timeout frees the queue and a subsequent request can succeed',async()=>{
  const {data,item}=fixture(13);let calls=0;
  const store=new MediaStore({storage:new Storage(),limits:{...limits,timeout:10},fetcher:async(_,{signal})=>{
    if(++calls>1)return response(data);
    return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError'))));
  }}),options={key:{},decrypt:async(_,bytes)=>bytes.slice(28)};
  await assert.rejects(store.get('13',item,options),/CONTENT_TIMEOUT/);
  assert.equal((await store.get('13',item,options)).byteLength,100);assert.equal(store.pool.jobs.size,0);
});

test('restart trims excess automatic cache while pinned data lives in a separate cache',async()=>{
  const storage=new Storage(),cache=await storage.open('recent');
  for(let i=1;i<=5;i++)await cache.put('https://example.test/'+i,new Response(new Uint8Array(128),{headers:{'Content-Length':'128','X-HZN-Touched':String(i)}}));
  const recent=new RecentCipherCache(storage,'recent',limits);assert.ok(await recent.match('https://example.test/5'));assert.equal(cache.records.size,2);
});

test('plaintext expires from RAM without another media request',async()=>{
  const {data,item}=fixture(14),store=new MediaStore({storage:new Storage(),limits:{...limits,plainTTL:5},fetcher:async()=>response(data)});
  await store.get('14',item,{key:{},decrypt:async(_,bytes)=>bytes.slice(28)});assert.equal(store.plain.size,1);
  await delay(20);assert.equal(store.plain.size,0);assert.equal(store.plainSize,0);
});

test('default fetch keeps the browser global receiver required by native worker fetch',async()=>{
  const original=globalThis.fetch,{data,item}=fixture(15);
  globalThis.fetch=async function(){assert.equal(this,globalThis);return response(data);};
  try{
    const store=new MediaStore({storage:new Storage(),limits});
    assert.equal((await store.get('15',item,{key:{},decrypt:async(_,bytes)=>bytes.slice(28)})).byteLength,100);
  }finally{globalThis.fetch=original;}
});
