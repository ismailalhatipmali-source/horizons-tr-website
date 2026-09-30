// Real Chromium regression against the verified five-letter demo, on loopback.
// No activation, adult account, owner key, or production site is used.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const base=process.env.HZN_DEMO_BASE_URL,root=resolve(process.env.HZN_DEMO_DOCROOT||'');
assert.match(base||'',/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
assert.match(root,/^\/tmp\/horizons-[^/]+\/public_html$/);
assert.ok(process.env.E2E_CHROMIUM);
const {chromium}=await import(pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs')).href);
const chapters=JSON.parse(await readFile(join(root,'try/course/course.json'),'utf8')).chapters;
assert.deepEqual(chapters.map(c=>c.id),['baa','dhaa_emphatic','daad','yaa','dhaal']);
const report={edition:'demo',version:'1.4.3',browser:'Chrome headless, Android viewport; no physical phone',results:[]};
const pass=(name,detail={})=>{report.results.push({name,passed:true,...detail});console.log('PASS '+name)};
const browser=await chromium.launch({executablePath:process.env.E2E_CHROMIUM,headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,locale:'ar',serviceWorkers:'allow'});
 await context.addInitScript(()=>{
  const Native=window.Audio;window.__demoTestAudio=[];
  window.Audio=function(...args){const audio=new Native(...args);audio.__plays=0;audio.__ends=0;audio.addEventListener('playing',()=>audio.__plays++);audio.addEventListener('ended',()=>audio.__ends++);window.__demoTestAudio.push(audio);return audio};
  window.Audio.prototype=Native.prototype;Object.setPrototypeOf(window.Audio,Native);
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/try/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.HORIZONS_BOOT?.ready===true);
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 assert.deepEqual(await page.evaluate(()=>window.HORIZONS_BOOT.errors),[]);
 assert.match(await page.locator('#eyebrow').innerText(),/1\.4\.3/);
 pass('demo opens with its updated worker and all five original chapters');

 const counts=()=>page.evaluate(()=>window.__demoTestAudio.reduce((n,a)=>n+a.__ends,0));
 async function sound(button){
  const before=await counts();await button.click();
  await page.waitForFunction(n=>window.__demoTestAudio.reduce((total,a)=>total+a.__ends,0)>n,before,{timeout:20000});
  assert.ok(await page.evaluate(()=>window.__demoTestAudio.some(a=>a.__plays>0&&a.duration>0)));
  assert.equal(await page.evaluate(()=>document.body.onclick),null,'page body must not trigger course navigation');
 }
 const texts=[];
 for(const chapter of chapters){
  await page.locator('#course-nav [data-course="catalog"]').click();
  await page.locator('[data-chapter="'+chapter.id+'"]').click();
  assert.equal(await page.evaluate(()=>document.body.onclick),null);
  const original=JSON.parse(await readFile(join(root,'try',chapter.path),'utf8'));
  assert.equal(await page.locator('.vocab-word').textContent(),original.words[0].word);
  await sound(page.locator('#activity [data-audio="word.'+original.words[0].id+'"]'));
  await sound(page.locator('#activity [data-audio="sentence.'+original.words[0].id+'"]'));
  await page.locator('#next').click();
  assert.equal(await page.locator('.vocab-word').textContent(),original.words[1].word);
  await sound(page.locator('#activity [data-audio="word.'+original.words[1].id+'"]'));
  await page.locator('#stages [data-tab="stories"]').click();
  await sound(page.locator('#activity [data-audio]').first());
  await page.locator('#stages [data-tab="write"]').click();
  await page.locator('#step-pen').click();await page.locator('#undo').click();await page.locator('#clear').click();
  await page.locator('#confirm-yes').click();
  assert.equal(await page.locator('body').getAttribute('data-activity'),'write');
  await page.locator('#stages [data-tab="words"]').click();
  assert.equal(await page.locator('.vocab-word').textContent(),original.words[1].word);
  texts.push(chapter.id);
  pass('word, sentence, next, story and writing controls keep working for '+chapter.id);
 }
 assert.deepEqual(texts,chapters.map(c=>c.id));
 pass('all five chapters work in one page session without reloads');

 await page.locator('#course-nav [data-course="alphabet"]').click();
 for(let i=0;i<chapters.length;i++){
  const before=await counts();await page.locator('#activity [data-letter="'+i+'"]').click();
  await page.waitForFunction(n=>window.__demoTestAudio.reduce((total,a)=>total+a.__ends,0)>n,before,{timeout:15000});
 }
 pass('alphabet auto-audio survives every letter change');
 await page.locator('#course-nav [data-course="catalog"]').click();await page.locator('[data-chapter="baa"]').click();
 const first=JSON.parse(await readFile(join(root,'try',chapters[0].path),'utf8'));
 assert.equal(await page.locator('.vocab-word').textContent(),first.words[1].word);
 await page.locator('#stages [data-tab="quiz"]').click();await sound(page.locator('#activity [data-audio]').first());
 await page.locator('[data-answer="0"]').click();
 assert.ok(await page.locator('[data-answer="0"]').evaluate(button=>button.classList.contains('correct')));
 assert.ok(await page.locator('#continue-quiz').isVisible());
 pass('quiz keeps its heard-answer state after clicks');
 const key='horizons-arabic-level1|demo|1';
 const prior=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 assert.ok(Object.keys(prior.heard).length>=25);
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.HORIZONS_BOOT?.ready===true);
 const restored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 assert.deepEqual(restored.heard,prior.heard);assert.deepEqual(restored.bookmarks,prior.bookmarks);
 pass('existing demo progress and chapter bookmarks survive reopening');

 // Seed one already-saved file in the previous release cache. An update must
 // still play it offline without downloading all chapters or rewriting progress.
 const audio='course/audio/female-final/alphabet.baa.mp3';
 await page.evaluate(async path=>{const cache=await caches.open('hzn-public-demo-1.4.0');await cache.put(new URL(path,document.baseURI).href,await fetch(path));},audio);
 const pinned=await page.evaluate(async()=>{const cache=await caches.open('hzn-public-demo-1.4.3');return (await cache.keys()).filter(x=>/\/course\/(audio|scenes)\//.test(x.url)&&!x.url.endsWith('pending.svg')).length});
 assert.equal(pinned,0,'online audio must not implicitly save all media');
 await context.setOffline(true);
 await page.locator('#course-nav [data-course="alphabet"]').click();
 const before=await counts();await page.locator('#activity [data-letter="0"]').click();
 await page.waitForFunction(n=>window.__demoTestAudio.reduce((total,a)=>total+a.__ends,0)>n,before,{timeout:15000});
 pass('unchanged previously saved demo audio is reused offline',{automaticallySavedMedia:pinned});
 assert.deepEqual(errors,[]);pass('no uncaught application errors');
 if(process.env.HZN_DEMO_REPORT)await writeFile(process.env.HZN_DEMO_REPORT,JSON.stringify(report,null,2)+'\n');
}finally{await browser.close()}
