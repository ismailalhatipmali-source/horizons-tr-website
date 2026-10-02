import {PRODUCT, ISSUER_PUBLIC_KEY, ACTIVATION_URL} from './web-config.js';
import {decodeContent} from './asset-decoder.js';

// Shared by the portal and service worker. The server remains the sole issuer
// of entitlements and device slots. Local learner records use a separate DB.
const DB_NAME = 'horizons-web-license-v1';
const STORE = 'kv';
const TOLERANCE = 5 * 60 * 1000;
const ENCODER = new TextEncoder();
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/;
const HEX_RE = /^[a-f0-9]{64}$/;
let dbPromise, accessCache, memberSession=null, memberAuthentication=null;

function failure(code) { return new Error(code); }
function to64(bytes) { let out=''; for (const n of new Uint8Array(bytes)) out+=String.fromCharCode(n); return btoa(out); }
function from64(value, length=0) {
  if (typeof value!=='string' || value.length>24000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw failure('LICENSE_INVALID');
  let bytes; try { bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0)); } catch { throw failure('LICENSE_INVALID'); }
  if (to64(bytes)!==value || (length && bytes.length!==length)) throw failure('LICENSE_INVALID');
  return bytes;
}
function hex(bytes) { return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join(''); }
function object(value) { return value && typeof value==='object' && !Array.isArray(value); }
function date(value) {
  if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) throw failure('LICENSE_INVALID');
  const t=Date.parse(value);
  if (!Number.isFinite(t) || new Date(t).toISOString()!==value.replace('Z','.000Z')) throw failure('LICENSE_INVALID');
  return t;
}
function calendarMonths(start, months) {
  const d=new Date(start), first=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+months,1,d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()));
  const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  first.setUTCDate(Math.min(d.getUTCDate(),last)); return first.getTime();
}
function monotonic() { return globalThis.performance?.now?.() ?? Date.now(); }
function requireCrypto() {
  if (!globalThis.crypto?.subtle) throw failure('BROWSER_UNSUPPORTED');
}
function database() {
  if (!globalThis.indexedDB) return Promise.reject(failure('STORAGE_UNAVAILABLE'));
  if (!dbPromise) dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();dbPromise=null};resolve(db)};
    request.onerror=()=>{dbPromise=null;reject(failure('STORAGE_UNAVAILABLE'))};
    request.onblocked=()=>reject(failure('STORAGE_UNAVAILABLE'));
  });
  return dbPromise;
}
async function read(key) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly'), req=tx.objectStore(STORE).get(key);
    req.onsuccess=()=>resolve(req.result ?? null);
    req.onerror=()=>reject(failure('STORAGE_UNAVAILABLE'));
    tx.onabort=()=>reject(failure('STORAGE_UNAVAILABLE'));
  });
}
async function change(callback) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite'); let result;
    tx.oncomplete=()=>resolve(result);
    tx.onerror=tx.onabort=()=>reject(failure('STORAGE_UNAVAILABLE'));
    callback(tx.objectStore(STORE),value=>{result=value});
  });
}
export async function getIdentity() {
  const id=await read('identity');
  if (id && (!HEX_RE.test(id.device_id) || typeof id.public_key!=='string' || !id.privateKey || id.privateKey.type!=='private' || id.privateKey.extractable!==false)) throw failure('IDENTITY_UNAVAILABLE');
  return id;
}
export async function createIdentity() {
  requireCrypto();
  const existing=await getIdentity(); if (existing) return existing;
  let pair;
  try {pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},false,['encrypt','decrypt'])}
  catch {throw failure('BROWSER_UNSUPPORTED')}
  const spki=await crypto.subtle.exportKey('spki',pair.publicKey);
  const identity={device_id:hex(crypto.getRandomValues(new Uint8Array(32))),public_key:to64(spki),privateKey:pair.privateKey,key_hash:hex(await crypto.subtle.digest('SHA-256',spki)),created_at:new Date().toISOString()};
  // Resolve simultaneous first activation tabs without overwriting a key that
  // another tab has already submitted to the server.
  return change((store,done)=>{
    const req=store.get('identity');req.onsuccess=()=>{
      if(req.result)done(req.result);else {store.put(identity,'identity');done(identity)}
    };
  });
}

/** Validate the pinned signature and exact existing PHP/Go contract. No issuer
 * override is accepted from a URL, a license, storage, or an API response. */
export async function validateAndUnlock(envelope, identity) {
  requireCrypto();
  if (!identity || !object(envelope) || Object.keys(envelope).sort().join(',')!=='payload,signature') throw failure('LICENSE_INVALID');
  const raw=from64(envelope.payload), signature=from64(envelope.signature,64);
  let issuer;
  try {issuer=await crypto.subtle.importKey('raw',from64(ISSUER_PUBLIC_KEY,32),{name:'Ed25519'},false,['verify'])}
  catch {throw failure('BROWSER_UNSUPPORTED')}
  if (!await crypto.subtle.verify('Ed25519',issuer,signature,raw)) throw failure('LICENSE_INVALID');
  let l;try{l=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}catch{throw failure('LICENSE_INVALID')}
  const base=['schema','product','license_id','device_id','public_key_sha256','wrapped_key','max_devices','issued_at','purchase_email'];
  const extra=['account_id','plan','channel','starts_at','expires_at'];
  const memberExtra=['device_policy','account_type','lease_expires_at'];
  if (!object(l) || ![2,3,4].includes(l.schema) || Object.keys(l).sort().join(',')!==[...base,...(l.schema>=3?extra:[]),...(l.schema===4?memberExtra:[])].sort().join(',')) throw failure('LICENSE_INVALID');
  if (l.product!==PRODUCT || !ID_RE.test(l.license_id) || !HEX_RE.test(l.device_id) || !HEX_RE.test(l.public_key_sha256) || l.device_id!==identity.device_id) throw failure('LICENSE_INVALID');
  const spki=from64(identity.public_key);
  if (spki.length>2048 || hex(await crypto.subtle.digest('SHA-256',spki))!==l.public_key_sha256) throw failure('LICENSE_INVALID');
  if (typeof l.purchase_email!=='string' || l.purchase_email.length>254 || !/^[^\s@\x00]+@[^\s@\x00]+\.[^\s@\x00]+$/.test(l.purchase_email)) throw failure('LICENSE_INVALID');
  const issued=date(l.issued_at);
  if(l.schema===2) {
    if(l.max_devices!==3)throw failure('LICENSE_INVALID');
    l={...l,plan:'lifetime',channel:'direct',starts_at:l.issued_at,expires_at:null};
  } else {
    if (!ID_RE.test(l.account_id)) throw failure('LICENSE_INVALID');
    const paid=['monthly','annual','lifetime'].includes(l.plan) && l.channel==='direct' && l.max_devices===3;
    const owner=['trial_7d','evaluation_3m'].includes(l.plan) && l.channel==='owner' && l.max_devices===1;
    const member=l.schema===4&&l.channel==='membership'&&l.max_devices===0&&l.device_policy==='any_device'&&['individual','family','institution'].includes(l.account_type)&&['monthly','annual','lifetime'].includes(l.plan)&&(l.account_type!=='institution'||l.plan==='annual');
    if(l.schema===4?!member:(!paid&&!owner))throw failure('LICENSE_INVALID');
    if(member){const lease=date(l.lease_expires_at);if(lease<=issued||lease>issued+86400000||(l.expires_at!==null&&lease>date(l.expires_at)))throw failure('LICENSE_INVALID');}
    const start=date(l.starts_at); if(start>issued)throw failure('LICENSE_INVALID');
    if(l.plan==='lifetime'){if(l.expires_at!==null)throw failure('LICENSE_INVALID')}
    else {
      const end=date(l.expires_at);if(end<=issued || end<=start)throw failure('LICENSE_INVALID');
      if(l.plan==='trial_7d' && end!==start+7*86400000)throw failure('LICENSE_INVALID');
      if(l.plan==='evaluation_3m' && end!==calendarMonths(start,3))throw failure('LICENSE_INVALID');
    }
  }
  let rawKey;
  try {rawKey=new Uint8Array(await crypto.subtle.decrypt({name:'RSA-OAEP',label:ENCODER.encode(PRODUCT)},identity.privateKey,from64(l.wrapped_key)))}
  catch {throw failure('LICENSE_INVALID')}
  if(rawKey.byteLength!==32) {rawKey.fill(0);throw failure('LICENSE_INVALID')}
  try{return {key:await crypto.subtle.importKey('raw',rawKey,{name:'AES-GCM'},false,['decrypt']),license:Object.freeze(l)}}
  finally {rawKey.fill(0)}
}

function clockTime(access, record, online=false) {
  if(access.license.plan==='lifetime'&&access.license.schema!==4) return Date.now();
  const now=Date.now(), issued=date(access.license.issued_at), clock=record.clock;
  if(!clock || !Number.isFinite(clock.seen) || clock.issued!==issued || clock.seen<issued)throw failure('CLOCK_STORAGE_UNAVAILABLE');
  if(online && now>issued+TOLERANCE)throw failure('CLOCK_AHEAD');
  if(now<clock.seen-TOLERANCE)throw failure('CLOCK_ROLLBACK');
  // Monotonic elapsed time cannot be rewound by changing the wall clock while
  // the worker is alive. Browser storage is best-effort, not hardware DRM.
  if(access.anchorWall===undefined){access.anchorWall=now;access.anchorMono=monotonic();access.seen=clock.seen}
  const expected=access.anchorWall+Math.max(0,monotonic()-access.anchorMono);
  if(now<expected-TOLERANCE)throw failure('CLOCK_ROLLBACK');
  // A sleeping OS/browser may pause performance.now; never deny access solely
  // for this discrepancy. Forward wall time still advances expiry.
  const effective=Math.max(now,expected,clock.seen,access.seen,issued);
  access.seen=effective;
  if(effective<date(access.license.starts_at))throw failure('CLOCK_ROLLBACK');
  if(access.license.expires_at!==null&&effective>=date(access.license.expires_at))throw failure('ENTITLEMENT_EXPIRED');
  if(access.license.schema===4&&effective>=date(access.license.lease_expires_at))throw failure('MEMBERSHIP_CHECK_REQUIRED');
  return effective;
}
async function saveClock(record, effective) {
  if(record.clock && effective-record.clock.seen>=30000)await change((store,done)=>{
    const req=store.get('activation');req.onsuccess=()=>{
      const current=req.result;
      if(current && current.envelope.signature===record.envelope.signature && current.clock && effective>current.clock.seen) {
        current.clock.seen=effective;store.put(current,'activation');
      }
      done();
    };
  });
}
async function savedAccess() {
  const [identity,record]=await Promise.all([getIdentity(),read('activation')]);
  if(!identity || !record) {accessCache=null;throw failure('ACTIVATION_REQUIRED')}
  if(!object(record.envelope) || record.device_id!==identity.device_id)throw failure('LICENSE_INVALID');
  const marker=record.envelope.payload+'|'+record.envelope.signature+'|'+identity.device_id;
  if(!accessCache || accessCache.marker!==marker)accessCache={...await validateAndUnlock(record.envelope,identity),marker};
  return {identity,record,access:accessCache,marker};
}
export async function getAccess() {
  let {record,access}=await savedAccess();
  let effective;try{effective=clockTime(access,record)}catch(e){
    if(e.message!=='MEMBERSHIP_CHECK_REQUIRED'||globalThis.navigator?.onLine===false)throw e;
    await refreshMembership();({record,access}=await savedAccess());effective=clockTime(access,record);
  }
  await saveClock(record,effective);
  return {key:access.key,license:access.license};
}
// A verified account reference remains available for local export after expiry.
// It is never an authorization credential: the PHP service verifies entitlement
// and device possession independently on every authenticated session.
export async function getSyncAccount() {
  try {
    const {access,record,marker}=await savedAccess();
    const known=access.license.account_id || record.progress_account;
    if(known)return known;
    if(access.license.schema!==2 || globalThis.navigator?.onLine===false)return null;
    if(legacyDiscovery?.marker===marker && legacyDiscovery.retryAfter>Date.now())return null;
    try {return (await progressCredentials(null)).account_id;}
    catch {legacyDiscovery={marker,retryAfter:Date.now()+60000};return null;}
  } catch { return null; }
}

let progressSession=null, progressAuthentication=null, legacyDiscovery=null;
const PROGRESS_URL='/learning-api/index.php';
async function progressPost(action,input={},token='') {
  let response;
  try {
    response=await fetch(PROGRESS_URL,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
      body:JSON.stringify({...input,action}),credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  } catch { throw failure('SYNC_UNAVAILABLE'); }
  let data;
  try { data=await response.json(); } catch { throw failure('SYNC_UNAVAILABLE'); }
  if(!response.ok || !object(data) || data.ok!==true) {
    const code=typeof data?.error==='string'&&/^[A-Z_]{3,64}$/.test(data.error)?data.error:'SYNC_UNAVAILABLE';
    throw Object.assign(failure(code),{status:response.status,...(object(data?.profile)?{profile:data.profile}:{}),...(typeof data?.account_id==='string'?{account_id:data.account_id}:{})});
  }
  return data;
}
async function progressCredentials(expectedAccount) {
  await getAccess();
  const current=await savedAccess();
  const account=current.access.license.account_id || current.record.progress_account;
  if(expectedAccount!==null && (!account || account!==expectedAccount))throw failure('ACCOUNT_CHANGED');
  if(expectedAccount===null && current.access.license.schema!==2)throw failure('ACCOUNT_CHANGED');
  if(progressSession?.marker===current.marker && progressSession.account_id===account && progressSession.expires>Date.now()+15000)return progressSession;
  if(progressAuthentication?.marker===current.marker)return progressAuthentication.promise;
  const pending={marker:current.marker};
  pending.promise=(async()=>{
    const challenge=await progressPost('auth-challenge',{license:current.record.envelope,public_key:current.identity.public_key});
    const serverAccount=challenge.account_id;
    if(!ID_RE.test(serverAccount||'') || (account && serverAccount!==account) || !/^[a-f0-9]{32}$/.test(challenge.challenge_id||''))throw failure('SYNC_INVALID_RESPONSE');
    let plain;
    try {plain=new Uint8Array(await crypto.subtle.decrypt({name:'RSA-OAEP',label:ENCODER.encode(PRODUCT+'/progress-auth')},current.identity.privateKey,from64(challenge.encrypted_nonce)))}
    catch {throw failure('SYNC_AUTH_FAILED')}
    if(plain.byteLength!==32){plain.fill(0);throw failure('SYNC_AUTH_FAILED')}
    let verified;
    try {verified=await progressPost('auth-verify',{challenge_id:challenge.challenge_id,nonce:to64(plain)});}
    finally {plain.fill(0)}
    const latest=await savedAccess();
    if(latest.marker!==current.marker || (latest.access.license.account_id && latest.access.license.account_id!==serverAccount))throw failure('ACCOUNT_CHANGED');
    const expires=Date.parse(verified.expires_at);
    if(verified.account_id!==serverAccount || !/^[a-f0-9]{64}$/.test(verified.token||'') || !Number.isFinite(expires) || expires<=Date.now() || expires>Date.now()+20*60000)throw failure('SYNC_INVALID_RESPONSE');
    if(!latest.access.license.account_id)await change((store,done)=>{
      const req=store.get('activation');req.onsuccess=()=>{
        const record=req.result;
        if(record?.envelope?.signature!==current.record.envelope.signature || record.device_id!==current.identity.device_id)return done();
        record.progress_account=serverAccount;store.put(record,'activation');done();
      };
    });
    if((await savedAccess()).marker!==current.marker)throw failure('ACCOUNT_CHANGED');
    progressSession={marker:current.marker,account_id:serverAccount,token:verified.token,expires};
    return progressSession;
  })();
  progressAuthentication=pending;
  try {return await pending.promise;} finally {if(progressAuthentication===pending)progressAuthentication=null;}
}
export async function requestProgress(account,action,payload={}) {
  if(!['list','get','put','delete'].includes(action) || !ID_RE.test(account||''))throw failure('INVALID_SYNC_REQUEST');
  for(let attempt=0;attempt<2;attempt++){
    const session=await progressCredentials(account);
    try {
      const result=await progressPost(action,payload,session.token);
      if(result.account_id!==account || await getSyncAccount()!==account)throw failure('ACCOUNT_CHANGED');
      return result;
    } catch(error) {
      if(attempt===0 && error.status===401){progressSession=null;continue;}
      throw error;
    }
  }
  throw failure('SYNC_AUTH_FAILED');
}
export async function decryptAsset(path, encrypted, metadata = {}) {
  if(typeof path!=='string' || !path || path.startsWith('/') || path.split('/').some(x=>!x || x==='.' || x==='..') || /[\\\x00-\x1f?#]/.test(path))throw failure('CONTENT_INVALID');
  const bytes=encrypted instanceof Uint8Array?encrypted:new Uint8Array(encrypted);
  if(bytes.byteLength<28)throw failure('CONTENT_INVALID');
  const {key}=await getAccess();
  try {const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(0,12),additionalData:ENCODER.encode(PRODUCT+'/'+path),tagLength:128},key,bytes.subarray(12));return await decodeContent(plain,metadata)}
  catch {throw failure('CONTENT_INVALID')}
}
async function post(route,input,token='') {
  let response;
  try {response=await fetch(ACTIVATION_URL+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(input),credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(35000)})}
  catch {throw failure('SERVICE_UNAVAILABLE')}
  let result;try{result=await response.json()}catch{throw failure('SERVICE_UNAVAILABLE')}
  if(!response.ok || result?.ok!==true){const code=result?.error;throw Object.assign(failure(typeof code==='string'&&/^[A-Z_]{3,50}$/.test(code)?code:'SERVICE_UNAVAILABLE'),{status:response.status})}
  return result;
}
export async function requestCode({email,locale='en',invitation_token=''}={}) {
  if(typeof email!=='string' || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw failure('INVALID_EMAIL');
  const identity=await createIdentity();
  const result=await post('/v1/auth/request',{device_id:identity.device_id,public_key:identity.public_key,email:email.trim(),locale,invitation_token});
  if(typeof result.challenge_id!=='string' || !/^[a-f0-9]{32,128}$/.test(result.challenge_id))throw failure('SERVICE_UNAVAILABLE');
  return result;
}
async function saveActivation(envelope,identity) {
  const access=await validateAndUnlock(envelope,identity), issued=date(access.license.issued_at);
  const record={envelope,device_id:identity.device_id,clock:{issued,seen:issued}};
  record.clock.seen=clockTime(access,record,true);
  await change((store,done)=>{store.put(record,'activation');done()});
  accessCache=null;progressSession=null;progressAuthentication=null;memberSession=null;
  return getState();
}
function checkPassword(password) {
  if(typeof password!=='string'||Array.from(password).length<12||ENCODER.encode(password).length>256||/[\x00-\x1f\x7f]/.test(password))throw failure('PASSWORD_WEAK');
  return password;
}
export async function verifyCode({challenge_id,code,new_password}={}) {
  if(typeof code!=='string' || !/^[0-9]{8}$/.test(code) || typeof challenge_id!=='string')throw failure('OTP_INVALID');
  const identity=await getIdentity();if(!identity)throw failure('ACTIVATION_REQUIRED');
  const result=await post('/v1/auth/verify',{device_id:identity.device_id,public_key:identity.public_key,challenge_id,code,...(new_password===undefined?{}:{new_password:checkPassword(new_password)})});
  return saveActivation(result.license,identity);
}
export async function loginPassword({email,password}={}) {
  if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw failure('INVALID_EMAIL');
  checkPassword(password);
  const identity=await createIdentity();
  const result=await post('/v1/auth/password',{email:email.trim(),password,device_id:identity.device_id,public_key:identity.public_key});
  return saveActivation(result.license,identity);
}
export async function getState() {
  let identity;try {identity=await getIdentity();const {license}=await getAccess();return {ok:true,activated:true,error:null,device_id:identity.device_id,license:{schema:license.schema,account_type:license.account_type,plan:license.plan,channel:license.channel,max_devices:license.max_devices,purchase_email:license.purchase_email,starts_at:license.starts_at,expires_at:license.expires_at,issued_at:license.issued_at}}}
  catch(error){return {ok:true,activated:false,error:error.message,device_id:identity?.device_id??null,license:null}}
}
export async function signOut() {
  await change((store,done)=>{store.delete('activation');done()});accessCache=null;progressSession=null;progressAuthentication=null;memberSession=null;
}
export const lock=signOut;

export async function resendMembershipCode(email){return post('/v1/member/resend',{email});}
export async function checkMembershipCode({email,code}) {
  if(typeof email!=='string'||email.length>254||typeof code!=='string'||!/^[0-9]{8}$/.test(code))throw failure('OTP_INVALID');
  const identity=await createIdentity();const result=await post('/v1/member/check-code',{email:email.trim(),code,device_id:identity.device_id,public_key:identity.public_key});
  if(!/^[a-f0-9]{64}$/.test(result.setup_token||''))throw failure('SERVICE_UNAVAILABLE');return result;
}
export async function setupMembershipPassword({setup_token,new_password}) {
  const identity=await getIdentity();if(!identity)throw failure('ACTIVATION_REQUIRED');
  const result=await post('/v1/member/setup',{setup_token,new_password:checkPassword(new_password),device_id:identity.device_id,public_key:identity.public_key});return saveActivation(result.license,identity);
}
export async function refreshMembership() {
  let current;try{current=await savedAccess()}catch(e){if(e.message==='ACTIVATION_REQUIRED')return null;throw e;}
  if(current.access.license.schema!==4)return null;
  if(memberSession?.marker===current.marker&&memberSession.expires>Date.now()+15000)return memberSession;
  if(memberAuthentication?.marker===current.marker)return memberAuthentication.promise;
  const pending={marker:current.marker};
  pending.promise=(async()=>{
    const challenge=await post('/v1/member/challenge',{license:current.record.envelope,public_key:current.identity.public_key});
    if(!/^[a-f0-9]{48}$/.test(challenge.challenge_id||''))throw failure('SERVICE_UNAVAILABLE');
    let plain;try{plain=new Uint8Array(await crypto.subtle.decrypt({name:'RSA-OAEP',label:ENCODER.encode(PRODUCT+'/membership-auth')},current.identity.privateKey,from64(challenge.encrypted_nonce)))}catch{throw failure('INVALID_AUTH')}
    if(plain.byteLength!==32){plain.fill(0);throw failure('INVALID_AUTH');}
    let result;try{result=await post('/v1/member/authenticate',{challenge_id:challenge.challenge_id,nonce:to64(plain)})}finally{plain.fill(0)}
    if((await savedAccess()).marker!==current.marker)throw failure('ACCOUNT_CHANGED');
    const expires=Date.parse(result.expires_at);
    if(result.account_id!==current.access.license.account_id||!/^[a-f0-9]{64}$/.test(result.token||'')||!Number.isFinite(expires)||expires<=Date.now()||expires>Date.now()+20*60000)throw failure('INVALID_AUTH');
    const verified=await validateAndUnlock(result.license,current.identity);if(verified.license.account_id!==current.access.license.account_id)throw failure('ACCOUNT_CHANGED');
    await saveActivation(result.license,current.identity);memberSession={marker:(await savedAccess()).marker,token:result.token,expires};return memberSession;
  })();memberAuthentication=pending;
  try{return await pending.promise}catch(e){if(e.message==='ENTITLEMENT_EXPIRED')await signOut();throw e}finally{if(memberAuthentication===pending)memberAuthentication=null}
}
export async function requestMembership(action,input={}) {
  if(!['list','invite','remove'].includes(action))throw failure('INVALID_REQUEST');
  const session=await refreshMembership();if(!session)throw failure('AUTH_REQUIRED');return post('/v1/member/'+action,input,session.token);
}
