// Only authenticated ciphertext is written to Cache Storage. Decrypted data is
// a small, short-lived RAM cache, partitioned by the current activation key.
export const MEDIA_LIMITS = Object.freeze({recentBytes:64*1024*1024,recentFiles:192,plainBytes:12*1024*1024,plainFiles:12,plainTTL:60000,transfers:2,queue:24,maxAssetBytes:32*1024*1024,timeout:45000});
const abortError=()=>new DOMException('The request was cancelled.','AbortError');
function check(signal){if(signal?.aborted)throw abortError();}
const hex=bytes=>[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');

/** Deduplicate subscribers without letting one cancelled player cancel another.
 * When nobody is waiting, queued/running work is cancelled immediately. */
export class TransferPool {
  constructor(concurrency=2,maxQueue=24){this.concurrency=concurrency;this.maxQueue=maxQueue;this.active=0;this.jobs=new Map();this.queue=[];}
  run(key,work,signal){
    if(signal?.aborted)return Promise.reject(abortError());
    let job=this.jobs.get(key);
    if(!job){
      if(this.jobs.size>=this.concurrency+this.maxQueue)return Promise.reject(Error('CONTENT_BUSY'));
      job={key,work,controller:new AbortController(),subscribers:new Set(),started:false};this.jobs.set(key,job);this.queue.push(job);
    }
    const promise=new Promise((resolve,reject)=>{
      const subscriber={resolve,reject,signal};
      subscriber.abort=()=>{
        job.subscribers.delete(subscriber);signal?.removeEventListener('abort',subscriber.abort);reject(abortError());
        if(!job.subscribers.size){job.controller.abort();if(this.jobs.get(key)===job)this.jobs.delete(key);if(!job.started)this.queue=this.queue.filter(x=>x!==job);}
      };
      job.subscribers.add(subscriber);signal?.addEventListener('abort',subscriber.abort,{once:true});
    });
    this.drain();return promise;
  }
  drain(){
    while(this.active<this.concurrency&&this.queue.length){
      const job=this.queue.shift();if(job.controller.signal.aborted)continue;
      job.started=true;this.active++;
      Promise.resolve().then(()=>job.work(job.controller.signal)).then(value=>this.finish(job,null,value),error=>this.finish(job,error));
    }
  }
  finish(job,error,value){
    this.active--;if(this.jobs.get(job.key)===job)this.jobs.delete(job.key);
    for(const subscriber of job.subscribers){subscriber.signal?.removeEventListener('abort',subscriber.abort);if(error)subscriber.reject(error);else subscriber.resolve(value);}
    job.subscribers.clear();this.drain();
  }
  cancel(){for(const job of [...this.jobs.values()])for(const subscriber of [...job.subscribers])subscriber.abort();}
}

/** Read with an exact upper bound, including servers that omit Content-Length.
 * HTML error pages, partial ciphertext and redirects cannot become cached media. */
export async function verifiedCipher(response,item,signal){
  check(signal);
  const reject=async code=>{await response?.body?.cancel().catch(()=>{});throw Error(code);};
  if(!response||response.status!==200||response.redirected)return reject('CONTENT_UNAVAILABLE');
  const length=response.headers.get('Content-Length'), encoding=response.headers.get('Content-Encoding');
  if(length!==null&&(!/^\d+$/.test(length)||(!encoding&&Number(length)!==item.bytes)))return reject('CONTENT_DAMAGED');
  const mime=(response.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
  if(mime&&['text/html','application/xhtml+xml','application/json'].includes(mime))return reject('CONTENT_DAMAGED');
  if(!Number.isSafeInteger(item.bytes)||item.bytes<28||item.bytes>MEDIA_LIMITS.maxAssetBytes||!/^[a-f0-9]{64}$/.test(item.sha256))return reject('CONTENT_INVALID');
  const data=new Uint8Array(item.bytes);let offset=0;
  if(!response.body)throw Error('CONTENT_DAMAGED');
  const reader=response.body.getReader();
  const abort=()=>reader.cancel(abortError()).catch(()=>{});signal?.addEventListener('abort',abort,{once:true});
  try {
    while(true){check(signal);const {done,value}=await reader.read();check(signal);if(done)break;if(offset+value.byteLength>data.byteLength)throw Error('CONTENT_DAMAGED');data.set(value,offset);offset+=value.byteLength;}
    if(offset!==data.byteLength||hex(await crypto.subtle.digest('SHA-256',data))!==item.sha256)throw Error('CONTENT_DAMAGED');
    check(signal);return data.buffer;
  } finally {signal?.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}

export class RecentCipherCache {
  constructor(storage,name,limits=MEDIA_LIMITS){this.storage=storage;this.name=name;this.limits=limits;this.index=null;this.serial=Promise.resolve();}
  mutation(fn){const pending=this.serial.then(fn,fn);this.serial=pending.catch(()=>{});return pending;}
  async ready(){
    const cache=await this.storage.open(this.name);
    if(!this.index){
      this.index=new Map();
      for(const key of await cache.keys()){
        const response=await cache.match(key),bytes=Number(response?.headers.get('Content-Length')),time=Number(response?.headers.get('X-HZN-Touched'));
        if(!Number.isSafeInteger(bytes)||bytes<28||bytes>this.limits.recentBytes||!Number.isFinite(time)){await cache.delete(key);continue;}
        this.index.set(key.url,{bytes,time});
      }
      await this.trim(cache);
    }
    return cache;
  }
  async trim(cache,extra=0){
    let total=[...this.index.values()].reduce((n,item)=>n+item.bytes,0);
    while(this.index.size&&(this.index.size+extra>this.limits.recentFiles||total>this.limits.recentBytes)){
      let oldest;for(const entry of this.index)if(!oldest||entry[1].time<oldest[1].time)oldest=entry;
      await cache.delete(oldest[0]);this.index.delete(oldest[0]);total-=oldest[1].bytes;
    }
  }
  match(url){return this.mutation(async()=>{const cache=await this.ready(),response=await cache.match(url);if(response&&this.index.has(url))this.index.get(url).time=Date.now();else this.index.delete(url);return response;});}
  remove(url){return this.mutation(async()=>{const cache=await this.ready();this.index.delete(url);await cache.delete(url);});}
  put(url,bytes){return this.mutation(async()=>{
    if(bytes.byteLength>this.limits.recentBytes)return false;
    const cache=await this.ready(),time=Date.now();this.index.set(url,{bytes:bytes.byteLength,time});await this.trim(cache);
    if(!this.index.has(url))return false;
    try{await cache.put(url,new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(bytes.byteLength),'X-HZN-Touched':String(time)}}));return true;}
    catch{this.index.delete(url);await cache.delete(url);return false;} // Quota restrictions must not stop online playback.
  });}
  clear(){return this.mutation(async()=>{await this.storage.delete(this.name);this.index=null;});}
}

export class MediaStore {
  constructor({storage=globalThis.caches,fetcher=(...args)=>globalThis.fetch(...args),limits=MEDIA_LIMITS}={}){
    this.storage=storage;this.fetcher=fetcher;this.limits=limits;this.pool=new TransferPool(limits.transfers,limits.queue);
    this.recent=new RecentCipherCache(storage,'hzn-web-recent-content-v1',limits);this.plain=new Map();this.plainSize=0;this.partition=null;this.generation=0;
    this.tokens=new WeakMap();this.nextToken=0;
  }
  usePartition(key){if(this.partition!==key){this.clearPlain();this.partition=key;}if(!this.tokens.has(key))this.tokens.set(key,++this.nextToken);return this.tokens.get(key);}
  clearPlain(){clearTimeout(this.expiryTimer);this.expiryTimer=null;this.plain.clear();this.plainSize=0;this.partition=null;}
  expire(){
    clearTimeout(this.expiryTimer);const now=Date.now();let next=Infinity;
    for(const [id,item]of this.plain){if(item.until<=now){this.plain.delete(id);this.plainSize-=item.bytes.byteLength;}else next=Math.min(next,item.until);}
    if(Number.isFinite(next)){this.expiryTimer=setTimeout(()=>this.expire(),Math.max(1,next-now));this.expiryTimer?.unref?.();}
  }
  remember(id,plain,key){
    if(this.partition!==key||plain.byteLength>this.limits.plainBytes)return;
    const now=Date.now();for(const [name,item]of this.plain)if(item.until<=now||name===id){this.plain.delete(name);this.plainSize-=item.bytes.byteLength;}
    while(this.plain.size&&(this.plain.size>=this.limits.plainFiles||this.plainSize+plain.byteLength>this.limits.plainBytes)){const name=this.plain.keys().next().value;this.plainSize-=this.plain.get(name).bytes.byteLength;this.plain.delete(name);}
    this.plain.set(id,{bytes:plain,until:now+this.limits.plainTTL});this.plainSize+=plain.byteLength;this.expire();
  }
  async get(path,item,{key,decrypt,signal,pin=false}){
    check(signal);const token=this.usePartition(key),id=item.url+'|'+item.sha256,jobID=token+'|'+id;
    const ready=this.plain.get(id);
    if(!pin&&ready&&ready.until>Date.now()){this.plain.delete(id);this.plain.set(id,ready);return ready.bytes;}
    const generation=this.generation;
    const result=await this.pool.run(jobID,async jobSignal=>{
      const pinned=await this.storage.open(item.cacheName).catch(()=>null);let bytes;
      const pinnedResponse=await pinned?.match(item.url).catch(()=>null);
      const recentResponse=await this.recent.match(item.url).catch(()=>null);
      for(const [response,remove]of [[pinnedResponse,()=>pinned?.delete(item.url)],[recentResponse,()=>this.recent.remove(item.url)]]){
        if(!response)continue;
        try{bytes=await verifiedCipher(response,item,jobSignal);break;}catch(error){if(error.name==='AbortError')throw error;await Promise.resolve(remove()).catch(()=>{});}
      }
      if(!bytes){
        const timeout=new AbortController(),abort=()=>timeout.abort();jobSignal.addEventListener('abort',abort,{once:true});
        const timer=setTimeout(abort,this.limits.timeout);
        try{check(jobSignal);const response=await this.fetcher(item.url,{cache:'no-store',credentials:'same-origin',redirect:'error',signal:timeout.signal});bytes=await verifiedCipher(response,item,timeout.signal);}
        catch(error){if(timeout.signal.aborted&&!jobSignal.aborted)throw Error('CONTENT_TIMEOUT');throw error;}
        finally{clearTimeout(timer);jobSignal.removeEventListener('abort',abort);}
        check(jobSignal);if(!pin&&generation===this.generation)await this.recent.put(item.url,bytes).catch(()=>false);
      }
      check(jobSignal);const plain=await decrypt(path,bytes);check(jobSignal);
      if(generation===this.generation)this.remember(id,plain,key);
      return {plain,bytes};
    },signal);
    check(signal);
    if(pin&&generation===this.generation){
      const cache=await this.storage.open(item.cacheName);
      await cache.put(item.url,new Response(result.bytes,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(result.bytes.byteLength)}}));
      await this.recent.remove(item.url);
    }
    return result.plain;
  }
  async clear(){this.generation++;this.pool.cancel();this.clearPlain();await this.recent.clear();}
}

export function mediaResponse(request,plain,mime='application/octet-stream'){
  const size=plain.byteLength,headers={'Content-Type':mime,'Content-Length':String(size),'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
  if(/^(audio|video)\//.test(mime))headers['Accept-Ranges']='bytes';
  const range=request.headers.get('range');
  // RFC 9110: Range is defined for GET; HEAD returns full representation headers.
  if(request.method==='GET'&&range&&/^(audio|video)\//.test(mime)){
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);
    let start=0,end=size-1,valid=!!match&&(match[1]!==''||match[2]!=='');
    if(valid){
      const first=match[1]===''?null:Number(match[1]),last=match[2]===''?null:Number(match[2]);
      valid=(first===null||Number.isSafeInteger(first))&&(last===null||Number.isSafeInteger(last));
      if(first===null){valid=valid&&last>0;start=Math.max(0,size-last);}else{start=first;end=last===null?size-1:Math.min(last,size-1);}
      valid=valid&&size>0&&start<=end&&start<size;
    }
    if(!valid)return new Response(null,{status:416,headers:{...headers,'Content-Length':'0','Content-Range':'bytes */'+size}});
    return new Response(plain.slice(start,end+1),{status:206,headers:{...headers,'Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${size}`}});
  }
  return new Response(request.method==='HEAD'?null:plain,{headers});
}
