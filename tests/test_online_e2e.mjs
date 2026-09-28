// Full Chromium + production PHP/crypto + encrypted workbook integration.
// Inputs point to an isolated fixture; this script never reads the private vault.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,access,rm} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const base=process.env.E2E_BASE_URL;
assert.ok(base&&/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base),'E2E_BASE_URL must be an explicit loopback origin');
const root=resolve(process.env.HZN_E2E_DOCROOT||'');
assert.ok(/^\/tmp\/horizons-[^/]+\/public_html$/.test(root),'Use an isolated /tmp/horizons-*/public_html fixture');
for(const name of ['HZN_E2E_VAULT','HZN_E2E_ACTIVATION_CORE','E2E_PHP','E2E_CHROMIUM'])assert.ok(process.env[name],name+' is required');
const output=process.env.E2E_OUTPUT||join(dirname(root),'browser-report');await mkdir(output,{recursive:true});
// A rerun may clear only a directory carrying the fixture's explicit marker.
const home=dirname(root),registry=join(home,'horizons-license');
try{await access(registry);await access(join(registry,'E2E-SYNTHETIC-ONLY'));await rm(registry,{recursive:true});await rm(join(home,'horizons-learning'),{recursive:true,force:true});}catch(error){if(error.code!=='ENOENT')throw error;}
const runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=runtime?await import(pathToFileURL(join(runtime,'playwright/index.mjs')).href):await import('playwright');
const configured=process.env.E2E_CHROMIUM_ARGS?JSON.parse(await readFile(process.env.E2E_CHROMIUM_ARGS,'utf8')):['--no-sandbox'];
const args=configured.filter(arg=>!['--single-process','--disable-web-security','--allow-running-insecure-content'].includes(arg)&&!arg.startsWith('--headless'));
const router=fileURLToPath(new URL('./learning-api/e2e-router.php',import.meta.url));
const server=spawn(process.env.E2E_PHP,['-S',new URL(base).host,'-t',root,router],{env:process.env,stdio:['ignore','ignore','pipe']});
let serverLog='';server.stderr.on('data',chunk=>{serverLog=(serverLog+String(chunk)).slice(-12000);});
let browser;const contexts=[],report={browser:'Chromium headless with Android viewport; no physical Android device',results:[]};
const log=(name,details={})=>{report.results.push({name,passed:true,...details});console.log('PASS '+name);};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const api=(page,route='',input)=>page.evaluate(async({route,input})=>{
  const response=await fetch('/learn/app/api/learners'+route,input===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  const body=await response.json();return {status:response.status,body};
},{route,input});
async function poll(test,message,timeout=20000){const end=Date.now()+timeout;let value;do{value=await test();if(value)return value;await pause(100);}while(Date.now()<end);throw Error(message);}
async function activated(page,account,schema=3){
  await page.goto(base+'/learn/?lang=en',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});
  const result=await page.evaluate(async({account,schema})=>{
    const core=await import('/learn/license-core.js'),identity=await core.createIdentity();
    const response=await fetch('/__fixture__/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account,schema,device_id:identity.device_id,public_key:identity.public_key})});
    const result=await response.json();if(!result.ok)throw Error(result.error||'fixture activation failed');
    await core.validateAndUnlock(result.license,identity);
    const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('horizons-web-license-v1',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    await new Promise((resolve,reject)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put({envelope:result.license,device_id:identity.device_id},'activation');tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);});db.close();
    return {activated:(await core.getState()).activated,account:await core.getSyncAccount()};
  },{account,schema});
  assert.equal(result.activated,true);assert.equal(result.account,'acct_fixture_'+account);
  return result;
}
async function openApp(page){
  await page.goto(base+'/learn/app/index.html?lang=en',{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).searchParams.has('reason'))throw Error('Workbook redirect: '+new URL(page.url()).searchParams.get('reason'));
  await page.waitForFunction(()=>window.HORIZONS_BOOT?.ready===true,null,{timeout:45000});
  assert.deepEqual(await page.evaluate(()=>window.HORIZONS_BOOT.errors),[]);
  await page.locator('#learner-select').waitFor();
}
async function newDevice(account,schema=3){
  const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,locale:'en-US',serviceWorkers:'allow'});contexts.push(context);
  await context.addInitScript(()=>{
    const Native=window.Audio;window.__e2eAudio=[];
    window.Audio=function(...args){const audio=new Native(...args);window.__e2eAudio.push(audio);audio.__e2e={playing:0,ended:0};audio.addEventListener('playing',()=>audio.__e2e.playing++);audio.addEventListener('ended',()=>audio.__e2e.ended++);return audio;};
    window.Audio.prototype=Native.prototype;Object.setPrototypeOf(window.Audio,Native);
  });
  const page=await context.newPage(),requests=[],errors=[];
  context.on('request',req=>{if(req.url().includes('/content/'))requests.push(req.url());});
  page.on('pageerror',error=>errors.push(error.message));
  await activated(page,account,schema);await openApp(page);return {context,page,requests,errors};
}
try{
  await poll(async()=>{try{return(await fetch(base+'/learn/web-config.js')).ok}catch{return false}},'PHP fixture did not start',10000);
  browser=await chromium.launch({executablePath:process.env.E2E_CHROMIUM,headless:true,args,env:{...process.env,LD_LIBRARY_PATH:join(dirname(process.env.E2E_CHROMIUM),'lib')+(process.env.LD_LIBRARY_PATH?':'+process.env.LD_LIBRARY_PATH:'') }});
  const one=await newDevice('A'),two=await newDevice('A');
  log('two separate devices activate and open the real protected workbook');
  await one.page.bringToFront();
  for(let i=0;i<2;i++){await one.page.locator('#course-nav [data-course="catalog"]').click();await one.page.locator('#course-nav [data-course="alphabet"]').click();}
  const sound=one.page.locator('#activity [data-audio]:not([disabled])').first();const soundKey=await sound.getAttribute('data-audio');
  await sound.click();
  await one.page.waitForFunction(()=>window.__e2eAudio.some(a=>a.currentTime>0.04||a.__e2e.ended>0),null,{timeout:30000});
  const actual=await one.page.evaluate(()=>{const a=window.__e2eAudio.find(a=>a.currentSrc);return {src:a.currentSrc,playing:a.__e2e.playing,time:a.currentTime,duration:a.duration};});
  assert.ok(actual.playing>0);
  await one.page.waitForFunction(()=>window.__e2eAudio.some(a=>a.__e2e.ended>=1),null,{timeout:30000});
  const ended=await one.page.evaluate(()=>window.__e2eAudio.reduce((n,a)=>n+a.__e2e.ended,0));
  await one.page.locator('#activity [data-audio="'+soundKey+'"]').click();
  await one.page.waitForFunction(previous=>window.__e2eAudio.reduce((n,a)=>n+a.__e2e.ended,0)>previous,ended,{timeout:30000});
  const relative=new URL(actual.src).pathname.slice('/learn/app/'.length),manifest=JSON.parse(await readFile(join(root,'learn/asset-manifest.json'),'utf8'));
  const cipher=new URL(manifest.files[relative].url,base+'/learn/').href;
  assert.ok(one.requests.filter(url=>url===cipher).length<=1,'repeated audio must not redownload ciphertext');
  const pinned=await one.page.evaluate(async()=>{let count=0;for(const name of await caches.keys())if(name.startsWith('hzn-web-content-'))count+=(await(await caches.open(name)).keys()).length;return count;});
  assert.equal(pinned,0);assert.ok(one.requests.length<100,'opening app and playing audio must not download the course');
  log('audio advances and ends after repeated renders; replay reuses media cache',{audioRequests:one.requests.filter(url=>url===cipher).length,pinnedFiles:pinned,requestedAssets:one.requests.length});

  // Delay a fresh sound at the server while measuring main-thread and navigation.
  await one.page.locator('#next').click();
  const nextKey=await one.page.locator('#activity [data-audio]:not([disabled])').first().getAttribute('data-audio');
  const nextEntry=Object.entries(manifest.files).find(([path])=>path.endsWith('/'+nextKey+'.mp3'));
  assert.ok(nextEntry,'fixture next alphabet audio exists');
  await one.context.addCookies([{name:'hzn_fixture_delay',value:nextEntry[0].split('/').at(-1)+'.hzn',domain:new URL(base).hostname,path:'/'}]);
  await one.page.evaluate(()=>{window.__e2eTicks=0;window.__e2eTimer=setInterval(()=>window.__e2eTicks++,20)});
  const delayedStart=Date.now();await one.page.locator('#activity [data-audio]:not([disabled])').first().click();
  await one.page.locator('#activity [data-audio][aria-busy="true"]').waitFor({timeout:2000});await pause(250);
  assert.ok(await one.page.evaluate(()=>window.__e2eTicks)>=5,'UI event loop should advance during a network wait');
  await one.page.locator('#course-nav [data-course="catalog"]').click();
  assert.equal(await one.page.locator('body').getAttribute('data-course'),'catalog');
  assert.ok(Date.now()-delayedStart<1400,'navigation should not wait for delayed media');
  await one.page.evaluate(()=>clearInterval(window.__e2eTimer));await one.context.clearCookies();
  log('UI remains responsive and cancels playback during delayed encrypted audio');

  await one.page.locator('#learner-online-status').click();await one.page.locator('#online-enable').click();
  await poll(async()=>{const x=await api(one.page,'/sync/status');return x.body.sync?.enabled&&x.body.sync.last_synced_at&&x.body.sync.pending===0},'first-device sync did not complete');
  await one.page.locator('#close-settings').click();
  const initial=(await api(one.page)).body.profiles.find(p=>!p.deleted_at);assert.ok(initial);
  await two.page.bringToFront();await two.page.locator('#learner-online-status').click();await two.page.locator('#online-enable').click();
  await poll(async()=>{const x=await api(two.page);return x.body.profiles.some(p=>p.id===initial.id)},'second device did not download learner');
  await two.page.locator('#close-settings').click();await two.page.locator('#learner-select').selectOption(initial.id);
  const second=(await api(two.page)).body.profiles.find(p=>p.id===initial.id);assert.equal(second.progress.heard[soundKey],true);assert.equal(second.progress.course,initial.progress.course);
  log('real UI consent and PHP authentication synchronize the actual learner across devices');

  // Simulate a large but valid adult/family history through the same client API.
  let current=(await api(one.page)).body.profiles.find(p=>p.id===initial.id);const large=structuredClone(current.progress);
  for(let i=0;i<2100;i++)large.heard['word.'+String(i).padStart(4,'0')+'_'+('x'.repeat(80))]=true;
  const largeSave=await api(one.page,'/save',{id:current.id,revision:current.revision,nickname:current.nickname,settings:current.settings,progress:large});assert.equal(largeSave.status,200);
  const syncLarge=await api(one.page,'/sync/run',{});assert.equal(syncLarge.status,200);assert.equal(syncLarge.body.sync.error,null);
  assert.equal((await api(two.page,'/sync/run',{})).status,200);
  const largeRemote=(await api(two.page)).body.profiles.find(p=>p.id===initial.id);assert.equal(Object.keys(largeRemote.progress.heard).length,Object.keys(large.heard).length);
  const wire=await two.page.evaluate(async id=>{const core=await import('/learn/license-core.js');return (await core.requestProgress('acct_fixture_A','get',{id})).profile;},initial.id);
  assert.equal(Object.hasOwn(wire.progress,'ink'),false);assert.equal(Object.hasOwn(wire.progress,'updatedAt'),false);
  log('large valid progress snapshot fits the 256 KiB wire contract',{progressBytes:Buffer.byteLength(JSON.stringify(large)),heardEntries:Object.keys(large.heard).length});

  // Queue a real local operation while offline, then use the production transport.
  await one.context.setOffline(true);current=(await api(one.page)).body.profiles.find(p=>p.id===initial.id);
  const offlineProgress=structuredClone(current.progress);offlineProgress.heard['word.e2e_offline']=true;
  assert.equal((await api(one.page,'/save',{id:current.id,revision:current.revision,nickname:current.nickname,settings:current.settings,progress:offlineProgress})).status,200);
  const failed=await api(one.page,'/sync/run',{});assert.ok(failed.status>=400||failed.body.sync?.error,'offline sync cannot report success');
  const pending=(await api(one.page,'/sync/status')).body.sync;assert.ok(pending.pending>0);
  await one.context.setOffline(false);assert.equal((await api(one.page,'/sync/run',{})).status,200);assert.equal((await api(two.page,'/sync/run',{})).status,200);
  assert.equal((await api(two.page)).body.profiles.find(p=>p.id===initial.id).progress.heard['word.e2e_offline'],true);
  log('offline local edits remain queued and reach the second device after reconnect');

  const other=await newDevice('B');const foreign=await other.page.evaluate(async id=>{
    const core=await import('/learn/license-core.js');try{await core.requestProgress('acct_fixture_B','get',{id});return 'exposed'}catch(error){return {status:error.status,error:error.message}}
  },initial.id);assert.equal(foreign.status,404);assert.ok(!(await api(other.page)).body.profiles.some(p=>p.id===initial.id));
  // Switch the original browser to B while retaining its A learner database.
  await one.page.evaluate(async()=>{await(await import('/learn/license-core.js')).signOut()});await activated(one.page,'B');
  assert.ok(!(await api(one.page)).body.profiles.some(p=>p.id===initial.id));
  log('another account cannot read the learner through local state or the real PHP API');

  const legacy=await newDevice('A',2);const known=await legacy.page.evaluate(async()=>{const core=await import('/learn/license-core.js'),account=await core.getSyncAccount(),list=await core.requestProgress(account,'list',{});return {account,count:list.profiles.length};});
  assert.equal(known.account,'acct_fixture_A');assert.ok(known.count>=1);
  log('legacy schema 2 activation discovers the real account and authenticates to PHP');
  assert.deepEqual([...one.errors,...two.errors,...other.errors,...legacy.errors],[]);
  await two.page.screenshot({path:join(output,'workbook-mobile.png'),fullPage:true});
  report.passed=true;await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:report.results.length,report:join(output,'report.json')}));
}catch(error){
  report.passed=false;report.failure=String(error.stack||error);await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  for(let i=0;i<contexts.length;i++){const page=contexts[i].pages()[0];if(page)await page.screenshot({path:join(output,'failure-'+i+'.png'),fullPage:true}).catch(()=>{});}
  console.error(error.stack||error);console.error('Recent fixture server log:\n'+serverLog.slice(-4000));process.exitCode=1;
}finally{await browser?.close();server.kill('SIGTERM');}
