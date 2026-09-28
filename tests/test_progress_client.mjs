// Real IndexedDB in two isolated browsers; only the authenticated HTTP transport
// is mocked here. The PHP API/authentication has separate integration tests.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=fileURLToPath(new URL('../src/workbook-web/',import.meta.url));
const accounts=new Map(),operations=new Map(),calls=[];
let loseAck=false,holdPut=null,releasePut=null;
const server=http.createServer(async(req,res)=>{
  try{
    if(req.url==='/license-core.js'){
      res.setHeader('Content-Type','text/javascript');res.end(`export async function getSyncAccount(){return globalThis.__account||null} export async function requestProgress(account,action,payload){const r=await fetch('/test-progress',{method:'POST',body:JSON.stringify({account,action,payload})});const v=await r.json();if(!r.ok)throw Object.assign(Error(v.error),{status:r.status,...v});return v}`);return;
    }
    if(req.url==='/test-progress'){
      let raw='';for await(const chunk of req)raw+=chunk;
      const {account,action,payload}=JSON.parse(raw);calls.push({account,action,payload});
      if(!accounts.has(account))accounts.set(account,new Map());
      const profiles=accounts.get(account);let result,status=200;
      if(action==='list'){const page=[...profiles.values()].filter(p=>p.id>(payload.cursor||'')).sort((a,b)=>a.id.localeCompare(b.id));result={profiles:page.slice(0,1).map(p=>({id:p.id,revision:p.revision})),cursor:page.length>1?page[0].id:null};}
      else if(action==='get')result={profile:profiles.get(payload.id)};
      else {
        const opkey=account+':'+payload.operation_id;
        if(operations.has(opkey))result={profile:profiles.get(operations.get(opkey).id),replayed:true,acknowledged_revision:operations.get(opkey).revision};
        else{
          const old=profiles.get(payload.id);
          if((old?.revision||0)!==payload.base_revision){status=409;result={error:'REVISION_CONFLICT',profile:old};}
          else{
            const stamp=new Date().toISOString();
            const profile={id:payload.id,revision:payload.base_revision+1,created_at:old?.created_at||stamp,updated_at:stamp};
            if(action==='delete')profile.deleted_at=stamp;
            else Object.assign(profile,{nickname:payload.nickname,settings:payload.settings,progress:payload.progress});
            profiles.set(profile.id,profile);operations.set(opkey,profile);result={profile};
            if(holdPut){holdPut();await new Promise(resolve=>releasePut=resolve);holdPut=null;}
            if(loseAck){loseAck=false;status=503;result={error:'NETWORK_LOST'};}
          }
        }
      }
      res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:status===200,account_id:account,...result}));return;
    }
    if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<title>Progress fixture</title>');return;}
    const name=req.url.slice(1);if(!/^[a-z-]+\.js$/.test(name)){res.writeHead(404).end();return;}
    res.setHeader('Content-Type','text/javascript');res.end(await readFile(root+name));
  }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=`http://127.0.0.1:${server.address().port}`;
const browserArgs=process.env.CHROMIUM_ARGS_FILE?JSON.parse(await readFile(process.env.CHROMIUM_ARGS_FILE,'utf8')):['--no-sandbox'];
const browser=await chromium.launch({headless:true,args:browserArgs.filter(arg=>!['--single-process','--disable-web-security','--allow-running-insecure-content'].includes(arg)),...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const contexts=[];
async function device(account){const context=await browser.newContext();contexts.push(context);const page=await context.newPage();await page.goto(address);await page.evaluate(async account=>{globalThis.__account=account;globalThis.store=await import('/learner-store.js');},account);return page;}
async function api(page,route='',body){return page.evaluate(async({route,body})=>{const r=await store.handleLearnerRequest(new Request(location.origin+'/learn/app/api/learners'+route,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),route);return {status:r.status,...await r.json()};},{route,body});}
function snapshot(name='Learner') {return {nickname:name,settings:{locale:'en',meaningLocale:'en',typography:{schemaVersion:1,font:'noto',size:1},privateNote:'NEVER_UPLOAD'},progress:{schemaVersion:'3.0',bookId:'horizons-arabic-complete',contentVersion:'0.3.0',audioRevision:'test',locale:'en',course:'lesson',chapter:'baa',tab:'words',word:0,quiz:0,quizMode:'word',story:0,frame:0,form:'isolated',alphabetMode:'explore',letter:0,meaning:true,guide:true,heard:{},attempts:{},written:{},bookmarks:{},ink:{'baa:isolated':[[{x:5,y:90}]]},privateNote:'NEVER_UPLOAD'}};}
async function save(page,id,change){const state=await api(page),p=state.profiles.find(p=>p.id===id);assert.ok(p);change(p);const r=await api(page,'/save',{id,revision:p.revision,nickname:p.nickname,settings:p.settings,progress:p.progress});assert.equal(r.status,200,JSON.stringify(r));return r.profile;}
let passed=0;function pass(name){passed++;process.stdout.write(`PASS ${name}\n`);}
try {
  const first=await device(null),legacy=await api(first,'/create',snapshot('Legacy'));
  assert.equal(legacy.status,200);const id=legacy.profile.id;
  await first.evaluate(()=>globalThis.__account='account_A');
  assert.equal((await api(first,'/sync/enable',{})).status,200);
  assert.equal((await api(first,'/sync/run',{})).status,200);
  assert.equal(accounts.get('account_A').size,0);pass('legacy progress is not uploaded before explicit adoption');
  assert.equal((await api(first,'/sync/adopt',{ids:[id]})).status,200);
  assert.equal((await api(first,'/sync/run',{})).status,200);
  const uploaded=accounts.get('account_A').get(id);assert.ok(uploaded);assert.equal(uploaded.progress.ink,undefined);assert.equal(uploaded.progress.privateNote,undefined);assert.equal(uploaded.settings.privateNote,undefined);
  assert.equal((await api(first)).profiles[0].progress.ink['baa:isolated'][0][0].x,5);pass('minimal projection excludes ink and private local data');
  const second=await device('account_A');await api(second,'/sync/enable',{});assert.equal((await api(second,'/sync/run',{})).status,200);
  assert.equal((await api(second)).profiles[0].id,id);assert.deepEqual((await api(second)).profiles[0].progress.ink,{});pass('second device restores same learner with local ink default');
  await save(first,id,p=>{p.progress.heard['word.baa-01']=true});
  assert.equal((await api(first,'/sync/run',{})).status,200);await api(second,'/sync/run',{});
  assert.equal((await api(second)).profiles[0].progress.heard['word.baa-01'],true);pass('progress moves across devices');
  await save(first,id,p=>{p.progress.heard['word.baa-02']=true});
  await save(second,id,p=>{p.progress.heard['word.baa-03']=true});
  await api(first,'/sync/run',{});await api(second,'/sync/run',{});
  assert.equal((await api(second,'/sync/status')).sync.conflicts.length,1);
  assert.equal((await api(second)).profiles[0].progress.heard['word.baa-03'],true);
  await api(second,'/sync/resolve',{id,choice:'both'});await api(second,'/sync/run',{});
  const both=(await api(second)).profiles;assert.equal(both.length,2);assert.ok(both.some(p=>p.progress.heard['word.baa-02']));assert.ok(both.some(p=>p.progress.heard['word.baa-03']));pass('concurrent changes preserve both alternatives');
  await api(first,'/sync/run',{});await save(first,id,p=>{p.progress.word=4});loseAck=true;
  assert.notEqual((await api(first,'/sync/run',{})).status,200);
  const firstRetry=calls.filter(c=>c.action==='put'&&c.payload.id===id).at(-1).payload.operation_id;
  // Re-importing the module / page simulates a new service-worker generation.
  await first.reload();await first.evaluate(async()=>{globalThis.__account='account_A';globalThis.store=await import('/learner-store.js')});
  assert.equal((await api(first,'/sync/run',{})).status,200);
  const retry=calls.filter(c=>c.action==='put'&&c.payload.id===id).at(-1).payload.operation_id;assert.equal(firstRetry,retry);assert.equal((await api(first,'/sync/status')).sync.conflicts.length,0);pass('lost acknowledgement retries durable operation once after restart');
  await save(first,id,p=>{p.progress.word=5});let observed;const reached=new Promise(resolve=>observed=resolve);holdPut=observed;
  const syncing=api(first,'/sync/run',{});await reached;await save(first,id,p=>{p.progress.word=6});releasePut();assert.equal((await syncing).status,200);assert.equal(accounts.get('account_A').get(id).progress.word,6);pass('save during upload is sent in a later operation');
  await first.evaluate(()=>globalThis.__account='account_B');assert.equal((await api(first)).profiles.length,0);
  assert.equal((await api(first,'/delete',{id,revision:1})).status,404);assert.equal((await api(first,'/sync/adopt',{ids:[id]})).status,400);
  await api(first,'/sync/enable',{});await api(first,'/sync/run',{});assert.equal(accounts.get('account_B').size,0);pass('account switch isolates reads, writes, adoption and uploads');
  await first.evaluate(()=>globalThis.__account='account_A');await api(first,'/sync/disable',{});const before=calls.length;
  await api(first,'/sync/run',{});assert.equal(calls.length,before);assert.ok((await api(first,'/export')).profiles.find(p=>p.id===id));pass('disabled sync makes no requests and local export stays available');
  await api(first,'/sync/enable',{});const p=(await api(first)).profiles.find(p=>p.id===id);await api(first,'/delete',{id,revision:p.revision});await api(first,'/sync/run',{});await api(second,'/sync/run',{});
  assert.ok((await api(second)).profiles.find(p=>p.id===id).deleted_at);pass('revisioned deletion synchronizes without deleting other learner');
  const exported=await api(second,'/export');assert.equal(exported.profiles.filter(p=>!p.deleted_at).length,1);
  const migrated=await device('account_migration');
  await api(migrated,'/migrate',{profiles:[snapshot('Historical')]});await api(migrated,'/sync/enable',{});await api(migrated,'/sync/run',{});
  assert.equal(accounts.get('account_migration').size,0);assert.equal((await api(migrated,'/sync/status')).sync.local_profiles.length,1);pass('historical automatic migration still needs adoption');
  const a=await device('account_replay'),b=await device('account_replay');
  const r=(await api(a,'/create',snapshot('Replay'))).profile.id;await api(a,'/sync/enable',{});await api(a,'/sync/run',{});await api(b,'/sync/enable',{});await api(b,'/sync/run',{});
  await save(a,r,p=>{p.progress.word=1});loseAck=true;await api(a,'/sync/run',{});await api(b,'/sync/run',{});await save(b,r,p=>{p.progress.word=2});await api(b,'/sync/run',{});await api(a,'/sync/run',{});
  assert.equal((await api(a)).profiles.find(p=>p.id===r).progress.word,2);pass('operation replay applies later authoritative live progress');
  await save(a,r,p=>{p.progress.word=3});loseAck=true;await api(a,'/sync/run',{});await save(a,r,p=>{p.progress.word=4});await api(b,'/sync/run',{});await save(b,r,p=>{p.progress.word=5});await api(b,'/sync/run',{});await api(a,'/sync/run',{});
  assert.equal((await api(a,'/sync/status')).sync.conflicts.length,1);assert.equal((await api(a)).profiles.find(p=>p.id===r).progress.word,4);await api(a,'/sync/resolve',{id:r,choice:'both'});await api(a,'/sync/run',{});pass('operation replay preserves later unsent local changes as conflict');
  const tomb=(await api(a,'/create',snapshot('Delete replay'))).profile.id;await api(a,'/sync/run',{});await api(b,'/sync/run',{});
  await save(a,tomb,p=>{p.progress.word=1});loseAck=true;await api(a,'/sync/run',{});await api(b,'/sync/run',{});const deleting=(await api(b)).profiles.find(p=>p.id===tomb);await api(b,'/delete',{id:tomb,revision:deleting.revision});await api(b,'/sync/run',{});await api(a,'/sync/run',{});
  assert.ok((await api(a)).profiles.find(p=>p.id===tomb).deleted_at);pass('operation replay honors later remote deletion');
  const restore=(await api(a,'/create',snapshot('Restore new ID'))).profile.id;await api(a,'/sync/run',{});await api(b,'/sync/run',{});
  await save(a,restore,p=>{p.progress.word=1});loseAck=true;await api(a,'/sync/run',{});await save(a,restore,p=>{p.progress.word=2});await api(b,'/sync/run',{});const removing=(await api(b)).profiles.find(p=>p.id===restore);await api(b,'/delete',{id:restore,revision:removing.revision});await api(b,'/sync/run',{});await api(a,'/sync/run',{});
  assert.ok((await api(a,'/sync/status')).sync.conflicts.find(c=>c.id===restore));await api(a,'/sync/resolve',{id:restore,choice:'local'});await api(a,'/sync/run',{});
  const restored=(await api(a)).profiles;assert.ok(restored.find(p=>p.id===restore).deleted_at);assert.ok(restored.find(p=>p.id!==restore&&!p.deleted_at&&p.nickname.startsWith('Restore new ID')&&p.progress.word===2));assert.ok(accounts.get('account_replay').get(restore).deleted_at);pass('keep local after remote deletion restores a separate learner ID');
  const indexCalls=calls.filter(c=>c.account==='account_replay'&&c.action==='list');assert.ok(indexCalls.some(c=>c.payload.cursor));
  const last=await device('account_replay');await api(last,'/sync/enable',{});await api(last,'/sync/run',{});assert.equal((await api(last)).profiles.length,accounts.get('account_replay').size);pass('all pages including tombstones restore on fresh device');
  assert.equal(JSON.stringify(calls).includes('NEVER_UPLOAD'),false);assert.equal(calls.some(c=>c.payload?.progress&&Object.hasOwn(c.payload.progress,'ink')),false);
  console.log(`${passed} progress client integration checks passed`);
} finally {for(const context of contexts)await context.close().catch(()=>{});await browser.close().catch(()=>{});await new Promise(resolve=>server.close(resolve));}
