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
export async function get(store,key){const db=await ready;return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function put(store,key,value){const db=await ready;return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
