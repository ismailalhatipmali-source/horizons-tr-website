// Account-bound, local-first learning progress. No media is sent by this module.
// Durable operation snapshots make retries safe even after a worker restarts.
import {getSyncAccount, requestProgress} from './license-core.js';

const ID = /^[a-f0-9]{32}$/;
const ACCOUNT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/;
const MAX_PROFILES = 1000;
const PROGRESS_FIELDS = ['schemaVersion','bookId','contentVersion','audioRevision','locale','course','chapter','tab','word','quiz','quizMode','story','frame','form','alphabetMode','letter','meaning','guide','heard','attempts','written','bookmarks'];
const SETTINGS_FIELDS = ['locale','meaningLocale','typography'];
const encoder = new TextEncoder();
const copy = value => structuredClone(value);
const newID = () => Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
const fail = code => Object.assign(new Error(code),{status:400});
export function projectProgress(profile) {
  const select=(input,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(input||{},k)).map(k=>[k,copy(input[k])]));
  const settings=select(profile.settings,SETTINGS_FIELDS);
  if(settings.typography)settings.typography=select(settings.typography,['schemaVersion','font','size']);
  const result={nickname:profile.nickname,settings,progress:select(profile.progress,PROGRESS_FIELDS)};
  if(size(result)>250*1024)throw fail('sync_profile_too_large');
  return result;
}
function mergeRemoteProgress(local,remote) {
  return {...copy(local||{}),...copy(remote),ink:copy(local?.ink||{}),updatedAt:new Date().toISOString()};
}
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const size = x => encoder.encode(JSON.stringify(x)).byteLength;
let running;

export async function currentSyncAccount() {
  try {
    const account = await getSyncAccount();
    const id = typeof account === 'string' ? account : account?.account_id;
    return typeof id === 'string' && ACCOUNT.test(id) ? id : null;
  } catch { return null; }
}
export function syncData(state) {
  if (!state.sync) state.sync = {schema:1,accounts:{},bindings:{}};
  if (state.sync.schema !== 1 || !object(state.sync.accounts) || !object(state.sync.bindings)) throw fail('sync_store_unreadable');
  return state.sync;
}
export function validateSyncData(state) {
  if(state.sync===undefined)return;
  const sync=syncData(state), profiles=new Map(state.profiles.map(p=>[p.id,p]));
  if(Object.entries(sync.accounts).some(([id,c])=>!ACCOUNT.test(id)||!object(c)||typeof c.enabled!=='boolean'||(c.last_synced_at!==null&&typeof c.last_synced_at!=='string')||(c.error!==null&&typeof c.error!=='string')))throw fail('sync_store_unreadable');
  for(const [id,b] of Object.entries(sync.bindings)) {
    if(!ID.test(id)||!profiles.has(id)||!object(b)||!ACCOUNT.test(b.account_id)||!Number.isSafeInteger(b.remote_revision)||b.remote_revision<0||typeof b.dirty!=='boolean')throw fail('sync_store_unreadable');
    if(b.conflict){validateRemote(b.conflict);if(b.conflict.id!==id)throw fail('sync_store_unreadable');}
    if(b.pending) {
      const p=b.pending, op=p.operation;
      if(!object(p)||!['put','delete'].includes(p.action)||!Number.isSafeInteger(p.local_revision)||p.local_revision<1||!object(op)||op.id!==id||!ID.test(op.operation_id)||!Number.isSafeInteger(op.base_revision)||op.base_revision<0||size(op)>256*1024)throw fail('sync_store_unreadable');
      if(p.action==='put' && (op.consent!==true||!object(op.settings)||!object(op.progress)||JSON.stringify(projectProgress(op))!==JSON.stringify({nickname:op.nickname,settings:op.settings,progress:op.progress})))throw fail('sync_store_unreadable');
    }
  }
}
function accountState(state, account) {
  const sync = syncData(state);
  if (!Object.hasOwn(sync.accounts,account)) sync.accounts[account] = {enabled:false,last_synced_at:null,error:null};
  return sync.accounts[account];
}
export function visibleProfile(state, profile, account) {
  const binding = state.sync?.bindings?.[profile.id];
  return !binding || binding.account_id === account;
}
export function bindNewProfile(state, profile, account) {
  if (!account) return;
  const sync = syncData(state);
  sync.bindings[profile.id] = {account_id:account,remote_revision:0,dirty:!profile.deleted_at,pending:null,conflict:null};
}
export function markProfileDirty(state, profile) {
  const binding = state.sync?.bindings?.[profile.id];
  if (binding) binding.dirty = true;
}
export function syncStatus(state, account) {
  const data = state.sync, config = account ? data?.accounts?.[account] : null;
  const bindings = Object.entries(data?.bindings || {}).filter(([,b])=>b.account_id === account);
  return {available:!!account,enabled:config?.enabled === true,last_synced_at:config?.last_synced_at || null,error:config?.error || null,
    pending:bindings.filter(([,b])=>b.dirty || b.pending).length,
    conflicts:bindings.filter(([,b])=>b.conflict).map(([id,b])=>({id,remote_revision:b.conflict.revision,deleted:!!b.conflict.deleted_at})),
    local_profiles:state.profiles.filter(p=>!p.deleted_at && !data?.bindings?.[p.id]).map(p=>({id:p.id,nickname:p.nickname}))};
}
export function scopeLearnerState(state, account) {
  const profiles = state.profiles.filter(p=>visibleProfile(state,p,account));
  const ids = new Set(profiles.map(p=>p.id));
  return {schema:state.schema,product:state.product,revision:state.revision,profiles,
    conflicts:state.conflicts.filter(c=>ids.has(c.profile_id)),migrations:{},sync:syncStatus(state,account)};
}
function validateRemote(profile) {
  if (!object(profile) || !ID.test(profile.id) || !Number.isSafeInteger(profile.revision) || profile.revision < 1 ||
      typeof profile.updated_at !== 'string' || (profile.deleted_at !== undefined && typeof profile.deleted_at !== 'string')) throw fail('sync_invalid_response');
  if (!profile.deleted_at && (typeof profile.nickname !== 'string' || [...profile.nickname].length > 80 || /[\0\r\n]/.test(profile.nickname) ||
      !object(profile.settings) || !object(profile.progress) || profile.progress.schemaVersion !== '3.0' || profile.progress.bookId !== 'horizons-arabic-complete' ||
      size(profile.settings)>64*1024 || size(profile.progress)>4*1024*1024)) throw fail('sync_invalid_response');
  function safe(x, depth=0) {
    if(depth>24)return false;
    return !x || typeof x!=='object' || Object.entries(x).every(([k,v])=>!['__proto__','constructor','prototype'].includes(k) && safe(v,depth+1));
  }
  if(!safe(profile))throw fail('sync_invalid_response');
  return profile;
}
function installRemote(state, account, remote) {
  const sync=syncData(state), old=state.profiles.find(p=>p.id===remote.id);
  if(old && !visibleProfile(state,old,account))throw fail('sync_profile_collision');
  if(old && !sync.bindings[old.id])throw fail('sync_profile_collision');
  if(!old && state.profiles.length>=MAX_PROFILES)throw fail('profile_limit');
  if(old && !Number.isSafeInteger(old.revision+1))throw fail('save_failed');
  const profile={id:remote.id,revision:(old?.revision||0)+1,nickname:remote.nickname||'',created_at:old?.created_at||remote.created_at||remote.updated_at,updated_at:remote.updated_at};
  if(remote.deleted_at)profile.deleted_at=remote.deleted_at;
  else {profile.settings={...copy(old?.settings||{}),...copy(remote.settings)};profile.progress=mergeRemoteProgress(old?.progress,remote.progress)}
  if(old)state.profiles[state.profiles.indexOf(old)]=profile;else state.profiles.push(profile);
  sync.bindings[remote.id]={account_id:account,remote_revision:remote.revision,dirty:false,pending:null,conflict:null};
  return profile;
}
export function changeSyncSettings(state, account, action, input) {
  if(!account)throw fail('sync_activation_required');
  const sync=syncData(state), config=accountState(state,account);
  if(action==='enable' || action==='disable') {
    if(Object.keys(input).length)throw fail('invalid_sync_request');
    config.enabled=action==='enable';config.error=null;
  } else if(action==='adopt') {
    if(Object.keys(input).some(k=>k!=='ids') || !Array.isArray(input.ids) || !input.ids.length || input.ids.length>100 || new Set(input.ids).size!==input.ids.length)throw fail('invalid_sync_request');
    const profiles=input.ids.map(id=>state.profiles.find(p=>p.id===id && !p.deleted_at));
    if(profiles.some(p=>!p || sync.bindings[p.id]))throw fail('invalid_sync_request');
    for(const p of profiles)bindNewProfile(state,p,account);
    config.enabled=true;config.error=null;
  } else if(action==='resolve') {
    if(Object.keys(input).some(k=>!['id','choice'].includes(k)) || !ID.test(input.id)||!['local','remote','both'].includes(input.choice))throw fail('invalid_sync_request');
    const binding=sync.bindings[input.id], local=state.profiles.find(p=>p.id===input.id);
    if(!binding || binding.account_id!==account || !binding.conflict || !local)throw fail('sync_conflict_missing');
    const remote=copy(binding.conflict);
    if(input.choice==='local' && !remote.deleted_at) {
      // Keep the remote alternative in the exportable conflict history before
      // explicitly replacing it. Never silently resolve by client timestamps.
      if(!remote.deleted_at) {
        if(state.conflicts.length>=1000)throw fail('conflict_limit');
        state.conflicts.push({id:newID(),profile_id:local.id,base_revision:local.revision,created_at:new Date().toISOString(),settings:copy(remote.settings),progress:mergeRemoteProgress(local.progress,remote.progress)});
      }
      binding.remote_revision=remote.revision;binding.pending=null;binding.conflict=null;binding.dirty=true;
    } else {
      if((input.choice==='both' || input.choice==='local') && !local.deleted_at) {
        if(state.profiles.length>=MAX_PROFILES)throw fail('profile_limit');
        const duplicate=copy(local);duplicate.id=newID();duplicate.revision=1;duplicate.created_at=new Date().toISOString();duplicate.updated_at=duplicate.created_at;
        duplicate.nickname=Array.from((duplicate.nickname||'Learner')+' (copy)').slice(0,80).join('');
        state.profiles.push(duplicate);bindNewProfile(state,duplicate,account);
      } else if(!local.deleted_at) {
        if(state.conflicts.length>=1000)throw fail('conflict_limit');
        state.conflicts.push({id:newID(),profile_id:local.id,base_revision:local.revision,created_at:new Date().toISOString(),settings:copy(local.settings),progress:copy(local.progress)});
      }
      installRemote(state,account,remote);
    }
  } else throw fail('invalid_sync_request');
  return {status:200,body:{ok:true,sync:syncStatus(state,account)},changed:true};
}
function operationFor(profile,binding) {
  const operation={operation_id:newID(),id:profile.id,base_revision:binding.remote_revision};
  if(!profile.deleted_at)Object.assign(operation,{consent:true,...projectProgress(profile)});
  return {operation,action:profile.deleted_at?'delete':'put',local_revision:profile.revision};
}
async function checkedRequest(account,action,payload) {
  if(await currentSyncAccount()!==account)throw fail('sync_account_changed');
  let result;
  try {result=await requestProgress(account,action,payload)}
  catch(error) {
    if(error.status===409 && error.message==='REVISION_CONFLICT' && error.profile)result={ok:false,error:'REVISION_CONFLICT',profile:error.profile,account_id:error.account_id||account};
    else throw error;
  }
  if(!object(result) || result.account_id!==account || await currentSyncAccount()!==account)throw fail('sync_account_changed');
  return result;
}
async function run(transact,account) {
  const config=await transact(false,state=>({body:syncStatus(state,account)}));
  if(!config.body.enabled)return config.body;
  try {
    // Metadata is small; unchanged settings/progress are never downloaded.
    const summaries=[], seen=new Set();let cursor=null;
    do {
      const index=await checkedRequest(account,'list',cursor?{cursor}:{});
      if(!Array.isArray(index.profiles)||summaries.length+index.profiles.length>MAX_PROFILES)throw fail('sync_invalid_response');
      for(const summary of index.profiles) {
        if(!object(summary)||!ID.test(summary.id)||seen.has(summary.id))throw fail('sync_invalid_response');
        seen.add(summary.id);summaries.push(summary);
      }
      const next=index.cursor??null;
      if(next!==null && (!ID.test(next)||(cursor!==null&&next<=cursor)||!index.profiles.length))throw fail('sync_invalid_response');
      cursor=next;
    }while(cursor);
    for(const summary of summaries) {
      if(!object(summary)||!ID.test(summary.id)||!Number.isSafeInteger(summary.revision)||summary.revision<1)throw fail('sync_invalid_response');
      const needed=await transact(false,state=>({body:!state.sync?.bindings?.[summary.id] || state.sync.bindings[summary.id].remote_revision<summary.revision}));
      if(!needed.body)continue;
      const response=summary.deleted_at?{profile:{...summary,updated_at:summary.deleted_at}}:await checkedRequest(account,'get',{id:summary.id}), remote=validateRemote(response.profile);
      if(remote.id!==summary.id)throw fail('sync_invalid_response');
      await transact(true,state=>{
        const binding=syncData(state).bindings[remote.id];
        if(binding && binding.account_id!==account)throw fail('sync_profile_collision');
        if(binding && remote.revision<=binding.remote_revision)return {changed:false};
        // Retry an ambiguous operation before deciding that the remote value
        // conflicts: the server may have accepted it before the link dropped.
        if(binding?.pending)return {changed:false};
        if(binding?.dirty){binding.conflict=copy(remote);return {changed:true};}
        installRemote(state,account,remote);return {changed:true};
      });
    }
    // A bounded pass avoids keeping a mobile worker alive indefinitely. The
    // next reconnect / periodic sync continues any remaining dirty profiles.
    for(let sent=0;sent<100;sent++) {
      const queued=await transact(true,state=>{
        if(!accountState(state,account).enabled)return {body:null};
        const entries=Object.entries(syncData(state).bindings);
        const entry=entries.find(([,b])=>b.account_id===account && !b.conflict && (b.pending||b.dirty));
        if(!entry)return {body:null};
        const [id,binding]=entry, profile=state.profiles.find(p=>p.id===id);
        if(!profile)throw fail('sync_store_unreadable');
        if(profile.deleted_at && binding.remote_revision===0 && !binding.pending){binding.dirty=false;return {body:{skip:true},changed:true};}
        if(!binding.pending)binding.pending=operationFor(profile,binding);
        return {body:copy(binding.pending),changed:true};
      });
      if(!queued.body)break;
      if(queued.body.skip)continue;
      const pending=queued.body, result=await checkedRequest(account,pending.action,pending.operation);
      const remote=validateRemote(result.profile);
      if(remote.id!==pending.operation.id)throw fail('sync_invalid_response');
      await transact(true,state=>{
        const binding=syncData(state).bindings[remote.id], profile=state.profiles.find(p=>p.id===remote.id);
        if(!binding || binding.account_id!==account || binding.pending?.operation.operation_id!==pending.operation.operation_id)return {changed:false};
        if(result.ok===false && result.error==='REVISION_CONFLICT') {
          binding.conflict=copy(remote);binding.pending=null;
        } else {
          if(result.ok!==true || remote.revision<pending.operation.base_revision+1)throw fail('sync_invalid_response');
          if(remote.revision>pending.operation.base_revision+1 || (remote.deleted_at && pending.action==='put')) {
            // Replays return the current authoritative profile, which can
            // include a later update/deletion made by another device.
            if(profile.revision!==pending.local_revision) {binding.conflict=copy(remote);binding.pending=null;}
            else installRemote(state,account,remote);
          } else {
            binding.remote_revision=remote.revision;binding.pending=null;binding.dirty=profile.revision!==pending.local_revision;
          }
        }
        return {changed:true};
      });
    }
    const completed=await transact(true,state=>{const cfg=accountState(state,account);cfg.last_synced_at=new Date().toISOString();cfg.error=null;return {body:syncStatus(state,account),changed:true};});
    return completed.body;
  } catch(error) {
    await transact(true,state=>{accountState(state,account).error=/^[A-Za-z_]{3,70}$/.test(error.message)?error.message:'sync_unavailable';return {changed:true};});
    throw error;
  }
}
export async function syncLearnerProgress(transact,account) {
  if(!account)return {available:false,enabled:false};
  if(running) {
    if(running.account===account)return running.operation;
    await running.operation.catch(()=>{});
    if(await currentSyncAccount()!==account)throw fail('sync_account_changed');
    return syncLearnerProgress(transact,account);
  }
  const operation=run(transact,account);running={account,operation};
  try{return await operation}finally{if(running?.operation===operation)running=null}
}
