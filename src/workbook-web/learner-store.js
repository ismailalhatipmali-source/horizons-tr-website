// Local browser learner data. This module is served publicly and is independent
// of activation: people can always export their own progress after access ends.
// Every write reads, checks the revision and commits within one IndexedDB
// transaction, including writes from other tabs or service-worker generations.
import { PRODUCT } from './web-config.js';
import {currentSyncAccount,scopeLearnerState,visibleProfile,bindNewProfile,markProfileDirty,syncStatus,changeSyncSettings,syncLearnerProgress,validateSyncData} from './progress-sync-client.js';

const DATABASE = 'horizons-web-learners-v1';
const LIMIT = 32 * 1024 * 1024;
const MAX_PROFILES = 1000;
const encoder = new TextEncoder();
const INPUT_FIELDS = new Set(['id','nickname','revision','settings','progress','source_id']);
let databasePromise;

function reply(status, body, extraHeaders = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {status, headers:{
    'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store, private',
    'X-Content-Type-Options':'nosniff', ...extraHeaders
  }});
}
function error(status, code) { return {status, body:{ok:false,error:code}}; }
function failure(code, status = 500) { return Object.assign(Error(code),{status}); }
function bytes(value) { return encoder.encode(JSON.stringify(value)).byteLength; }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function safe(value, depth = 0) {
  if (depth > 24) return false;
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).every(([key,child]) => !['__proto__','constructor','prototype'].includes(key) && safe(child,depth+1));
  }
  return true;
}
function validObject(value, max) { return object(value) && safe(value) && bytes(value) <= max; }
function validInput(value) {
  return object(value) && Object.keys(value).every(k => INPUT_FIELDS.has(k)) &&
    (value.id === undefined || typeof value.id === 'string') &&
    (value.source_id === undefined || typeof value.source_id === 'string') &&
    (value.revision === undefined || (Number.isSafeInteger(value.revision) && value.revision >= 0)) &&
    (value.nickname === undefined || (typeof value.nickname === 'string' && [...value.nickname].length <= 80 && !/[\0\r\n]/.test(value.nickname)));
}
function validProfile(value) {
  return validInput(value) && validObject(value.settings,64*1024) && validObject(value.progress,4*1024*1024) &&
    value.progress.schemaVersion === '3.0' && value.progress.bookId === 'horizons-arabic-complete';
}
function emptyStore() {
  return {schema:1,product:PRODUCT,revision:0,profiles:[],conflicts:[],migrations:{}};
}
function validateStore(value) {
  if (!object(value) || value.schema !== 1 || value.product !== PRODUCT || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      !Array.isArray(value.profiles) || !Array.isArray(value.conflicts) || !object(value.migrations) ||
      value.profiles.length > MAX_PROFILES || value.conflicts.length > 1000 || bytes(value) > LIMIT) throw failure('learner_store_unreadable');
  const seen = new Set();
  for (const p of value.profiles) {
    if (!object(p) || !/^[a-f0-9]{32}$/.test(p.id) || seen.has(p.id) || !Number.isSafeInteger(p.revision) || p.revision < 1 ||
        typeof p.created_at !== 'string' || typeof p.updated_at !== 'string' ||
        (p.deleted_at !== undefined && typeof p.deleted_at !== 'string') ||
        (!p.deleted_at && !validProfile({nickname:p.nickname,settings:p.settings,progress:p.progress}))) throw failure('learner_store_unreadable');
    seen.add(p.id);
  }
  for (const c of value.conflicts) {
    if (!object(c) || !/^[a-f0-9]{32}$/.test(c.id) || !seen.has(c.profile_id) || !Number.isSafeInteger(c.base_revision) || c.base_revision < 0 ||
        !validObject(c.settings,64*1024) || !validObject(c.progress,4*1024*1024)) throw failure('learner_store_unreadable');
  }
  if (!Object.entries(value.migrations).every(([key,done]) => /^[a-f0-9]{64}$/.test(key) && done === true)) throw failure('learner_store_unreadable');
  validateSyncData(value);
  return value;
}
function newID() { return [...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join(''); }
function newProfile(input) {
  const now = new Date().toISOString();
  const profile = {id:newID(),nickname:(input.nickname || '').trim(),revision:1,created_at:now,updated_at:now,settings:input.settings,progress:input.progress};
  if (input.source_id) profile.source_id = input.source_id;
  return profile;
}
function database() {
  if (!databasePromise) databasePromise = new Promise((resolve,reject) => {
    let settled = false;
    const timer = setTimeout(()=>done(failure('learner_store_unreadable')),5000);
    function done(reason,db) {
      if (settled) { if (db) db.close(); return; }
      settled = true; clearTimeout(timer);
      if (reason) reject(reason); else resolve(db);
    }
    try {
      const request = indexedDB.open(DATABASE,1);
      request.onupgradeneeded = () => {
        for (const name of ['state','migration_backups']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); databasePromise = null; };
        db.onclose = () => { databasePromise = null; };
        done(null,db);
      };
      request.onerror = () => done(failure('learner_store_unreadable'));
      request.onblocked = () => done(failure('learner_store_unreadable'));
    } catch { done(failure('learner_store_unreadable')); }
  }).catch(reason => { databasePromise = null; throw reason; });
  return databasePromise;
}

async function transact(writable, action, withBackups = false) {
  const db = await database();
  return new Promise((resolve,reject) => {
    let result, reason;
    const tx = db.transaction(['state','migration_backups'],writable?'readwrite':'readonly');
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(reason || failure(writable?'save_failed':'learner_store_unreadable',writable?507:500));
    tx.onerror = () => { /* onabort reports failed commits, including quota errors. */ };
    const stateStore = tx.objectStore('state'), backups = tx.objectStore('migration_backups');
    const get = stateStore.get('main');
    get.onsuccess = () => {
      try {
        // An absent record is a new install. Invalid existing data is never
        // silently replaced by an empty store.
        const state = get.result === undefined ? emptyStore() : validateStore(get.result);
        result = action(state,backups);
        if (result.changed) {
          state.revision++;
          if (!Number.isSafeInteger(state.revision) || bytes(state) > LIMIT) throw failure('save_failed',507);
          stateStore.put(state,'main');
        }
        if (withBackups) {
          const recovery = backups.getAll();
          recovery.onsuccess = () => { result.body = {...result.body,migration_backups:recovery.result}; };
        }
      } catch (e) { reason = e; tx.abort(); }
    };
  });
}

async function migrationKey(profile) {
  const data = {settings:profile.settings,progress:profile.progress};
  const digest = await crypto.subtle.digest('SHA-256',encoder.encode(JSON.stringify(data)));
  return {key:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join(''),...data};
}

// routeSuffix is '', '/export', '/create', '/save', '/delete', '/import' or
// '/migrate'. The service worker dispatches these before its paid-content gate.
export async function syncLearners() {
  return syncLearnerProgress(transact,await currentSyncAccount());
}

export async function handleLearnerRequest(request, routeSuffix = '') {
  const route = routeSuffix === '/' ? '' : routeSuffix;
  const read = route === '' || route === '/export' || route === '/sync/status';
  const syncAction=route.startsWith('/sync/') ? route.slice(6) : null;
  const origin = new URL(request.url).origin;
  // A same-origin fetch can reach the service worker before network-only
  // Origin headers are added. Reject a conflicting Origin when supplied;
  // mutations still require JSON, so cross-site form submissions cannot write.
  const callerOrigin = request.headers.get('Origin');
  if (origin !== globalThis.location.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site' ||
      (request.method === 'POST' && callerOrigin && callerOrigin !== origin)) return reply(403,{ok:false,error:'forbidden'});
  if (!read && !['/create','/save','/delete','/import','/migrate','/sync/enable','/sync/disable','/sync/adopt','/sync/resolve','/sync/run'].includes(route)) return reply(404,{ok:false,error:'not_found'});
  if ((read && !['GET','HEAD'].includes(request.method)) || (!read && request.method !== 'POST')) return reply(405,{ok:false,error:'method'},{Allow:read?'GET, HEAD':'POST'});
  try {
    const account=await currentSyncAccount();
    if (read) {
      const result = await transact(false,state=>({status:200,body:route==='/sync/status'?{ok:true,sync:syncStatus(state,account)}:scopeLearnerState(state,account)}),route === '/export');
      if(result.body.migration_backups)result.body.migration_backups=result.body.migration_backups.filter(p=>!p.account_id||p.account_id===account);
      return reply(200,request.method === 'HEAD'?null:result.body,route === '/export'?{'Content-Disposition':'attachment; filename="HORIZONS-learners-backup.json"'}:{});
    }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return reply(400,{ok:false,error:'invalid_profile'});
    if (Number(request.headers.get('Content-Length')) > LIMIT) return reply(413,{ok:false,error:'too_large'});
    const text = await request.text();
    if (encoder.encode(text).byteLength > LIMIT) return reply(413,{ok:false,error:'too_large'});
    let input;
    try { input = JSON.parse(text); } catch { return reply(400,{ok:false,error:'invalid_profile'}); }
    if(syncAction) {
      if(!object(input))return reply(400,{ok:false,error:'invalid_sync_request'});
      if(syncAction==='run') {
        if(Object.keys(input).length)return reply(400,{ok:false,error:'invalid_sync_request'});
        return reply(200,{ok:true,sync:await syncLearnerProgress(transact,account)});
      }
      const result=await transact(true,state=>changeSyncSettings(state,account,syncAction,input));
      return reply(result.status,result.body);
    }
    let migrationCopies;
    if (route === '/import' || route === '/migrate') {
      if (!object(input) || Object.keys(input).some(k=>k!=='profiles') || !Array.isArray(input.profiles) || !input.profiles.length || input.profiles.length > 100) return reply(400,{ok:false,error:'invalid_import'});
      if (!input.profiles.every(validProfile)) return reply(400,{ok:false,error:'invalid_profile'});
      // Hash before opening the transaction: awaiting WebCrypto inside an IDB
      // transaction could let it auto-commit before the profile is saved.
      if (route === '/migrate') migrationCopies = await Promise.all(input.profiles.map(migrationKey));
    } else if (!validInput(input) || (route !== '/delete' && !validProfile(input))) return reply(400,{ok:false,error:'invalid_profile'});

    const result = await transact(true,(state,backups) => {
      if (route === '/create') {
        if (state.profiles.length >= MAX_PROFILES) return error(507,'profile_limit');
        const profile = newProfile({...input,source_id:''});
        state.profiles.push(profile);bindNewProfile(state,profile,account);
        return {status:200,body:{ok:true,profile},changed:true};
      }
      if (route === '/import' || route === '/migrate') {
        const added = [];
        for (let i=0;i<input.profiles.length;i++) {
          const incoming = input.profiles[i], copy = migrationCopies?.[i];
          if (copy && state.migrations[copy.key]) continue;
          if (state.profiles.length >= MAX_PROFILES) throw failure('profile_limit',507);
          if (copy) {
            // The original browser database remains intact as well. Backup,
            // migration marker and new profile either all commit or all abort.
            backups.put(copy,copy.key);
            state.migrations[copy.key] = true;
          }
          const profile = newProfile({...incoming,source_id:incoming.id || ''});
          state.profiles.push(profile);if(route!=='/migrate')bindNewProfile(state,profile,account); added.push(profile);
        }
        return {status:200,body:{ok:true,profiles:added},changed:added.length>0};
      }
      const profile = state.profiles.find(p=>p.id===input.id);
      if (!profile || !visibleProfile(state,profile,account)) return error(404,'profile_missing');
      if (profile.deleted_at) return error(410,'profile_deleted');
      if (profile.revision !== (input.revision || 0)) {
        if (route === '/delete') return error(409,'revision_conflict');
        if (state.conflicts.length >= 1000) return error(507,'conflict_limit');
        const conflict = {id:newID(),profile_id:profile.id,base_revision:input.revision || 0,created_at:new Date().toISOString(),settings:input.settings,progress:input.progress};
        state.conflicts.push(conflict);
        return {status:409,body:{ok:false,error:'revision_conflict',conflict_id:conflict.id,profile},changed:true};
      }
      if (!Number.isSafeInteger(profile.revision+1)) throw failure('save_failed',507);
      profile.revision++; profile.updated_at = new Date().toISOString();
      if (route === '/delete') {
        profile.deleted_at = profile.updated_at; profile.nickname = '';
        delete profile.settings; delete profile.progress;
        state.conflicts = state.conflicts.filter(c=>c.profile_id!==profile.id);
      } else {
        profile.nickname = (input.nickname || '').trim(); profile.settings = input.settings; profile.progress = input.progress;
      }
      markProfileDirty(state,profile);
      return {status:200,body:{ok:true,profile},changed:true};
    });
    return reply(result.status,result.body);
  } catch (e) {
    return reply(e.status || 500,{ok:false,error:e.status?e.message:'learner_store_unreadable'});
  }
}
