/* Actual staged demo interaction QA; no production account or fabricated curriculum.
 * HZN_DEMO_ROOT: folder containing try/index.html (or the try/ folder itself).
 * HZN_CHROMIUM_EXECUTABLE: installed Chromium binary. HZN_QA_OUTPUT: scratch output folder.
 * Requires Playwright available to Node. Starts its own HTTP server in this process.
 */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const location=process.env.HZN_DEMO_ROOT,executablePath=process.env.HZN_CHROMIUM_EXECUTABLE;
if(!location||!executablePath)throw new Error('Set HZN_DEMO_ROOT and HZN_CHROMIUM_EXECUTABLE to the staged demo and installed Chromium.');
const folder=path.resolve(location.endsWith('/try')?path.dirname(location):location);
assert.ok(fs.existsSync(path.join(folder,'try/index.html')),'HZN_DEMO_ROOT must contain try/index.html');
const output=path.resolve(process.env.HZN_QA_OUTPUT||'focus-demo-browser-results');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(folder,'.'+pathname);if(!file.startsWith(folder+path.sep)){res.statusCode=403;return res.end();}try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.wav':'audio/wav','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json'}[path.extname(file)]||'application/octet-stream'));res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end('Missing');}});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath,headless:true,args:['--single-process','--no-zygote']});
 const page=await browser.newPage({viewport:{width:390,height:700}}),results=[],errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const test=async(name,fn)=>{try{const detail=await fn();results.push({name,status:'pass',detail});console.log(name+': PASS');}catch(error){results.push({name,status:'fail',error:error.message});console.log(name+': FAIL '+error.message);await closed();await page.screenshot({path:path.join(output,name.replace(/\W+/g,'-')+'-failure.png'),fullPage:true});}};
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('horizons-arabic-level1|demo|1')));
 const closed=()=>page.evaluate(()=>{for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();});
 const chapter=async()=>{await closed();await page.locator('#hzn-back-lessons').click();await page.locator('[data-demo-section="catalog"]').click();await page.locator('[data-chapter="baa"]').click();};
 const inkState=async()=>{const s=await saved();return Object.values(s.ink||{}).filter(strokes=>strokes.length);};
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/try/?lang=ar');await page.waitForFunction(()=>window.HORIZONS_BOOT?.ready);await page.evaluate(()=>document.fonts.ready);
  await page.locator('[data-demo-section="catalog"]').click();await page.locator('[data-chapter="baa"]').click();
  await test('settings-keyboard-modal',async()=>{
   const original=await saved();await page.locator('#settings-button').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#settings').evaluate(x=>x.open),true);
   // Native dialog may yield to browser chrome (body); background app controls must stay unfocusable.
   for(let i=0;i<20;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('#settings').contains(document.activeElement)||document.activeElement===document.body),'focus entered background control');}
   const hit=await page.evaluate(()=>{const button=document.querySelector('#next'),b=button.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('#settings')!==null;});assert.ok(hit,'background navigation accepts pointer through modal');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#settings').evaluate(x=>x.open),false);assert.ok(await page.locator('#settings-button').evaluate(x=>x===document.activeElement));
   const after=await saved();assert.equal(after.word,original.word);assert.deepEqual(after.attempts,original.attempts);return{tabCycles:20,focusRestored:true};
  });
  await test('locale-font-retains-card',async()=>{
   await page.locator('#next').click();await page.locator('#next').click();const before=await saved();const word=await page.locator('.vocab-word').innerText();
   await page.locator('#settings-button').click();await page.locator('#locale').selectOption('tr');await page.locator('#typography-font').selectOption('amiri');await page.locator('#close-settings').click();
   const after=await saved();assert.equal(after.word,before.word);assert.equal(after.chapter,before.chapter);assert.equal(await page.locator('.vocab-word').innerText(),word);assert.equal(await page.locator('html').getAttribute('lang'),'tr');return{wordIndex:after.word,font:'amiri',locale:'tr'};
  });
  await test('lesson-panel-keyboard',async()=>{
   await page.locator('#hzn-lessons-button').focus();await page.keyboard.press('Enter');assert.ok(await page.locator('#hzn-lessons-dialog').evaluate(x=>x.open));
   for(let i=0;i<10;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('#hzn-lessons-dialog').contains(document.activeElement)||document.activeElement===document.body));}
   await page.keyboard.press('Escape');assert.ok(await page.locator('#hzn-lessons-button').evaluate(x=>x===document.activeElement));return{focusRestored:true};
  });
  await test('locked-paid-sections',async()=>{
   const before=await saved();for(const section of ['phonics','blending2','blending3','blending4']){
    await page.locator('#hzn-lessons-button').click();await page.locator(`[data-demo-section="${section}"]`).click();
    assert.equal(await page.locator('.demo-locked-preview').count(),1);assert.equal(await page.locator('#activity [data-demo-return]').count(),1);assert.equal(await page.locator('#activity .vocab-word').count(),0);
    assert.ok(await page.locator('#activity .demo-buy-link').getAttribute('href'));await page.locator('#activity [data-demo-return]').click();
   }const after=await saved();assert.equal(after.word,before.word);assert.equal(after.chapter,before.chapter);return{sections:4,freePositionPreserved:true};
  });
  await test('drawing-undo-clear-resize',async()=>{
   await chapter();await page.locator('[data-tab="write"]').click();await page.locator('#ink').scrollIntoViewIfNeeded();
   const draw=async dy=>{const box=await page.locator('#ink').boundingBox();await page.mouse.move(box.x+box.width*.25,box.y+box.height*.35+dy);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.55+dy,{steps:8});await page.mouse.up();};
   await draw(0);await draw(12);const original=await inkState();assert.equal(original.length,1);assert.equal(original[0].length,2);
   await page.setViewportSize({width:700,height:390});await page.locator('#ink').scrollIntoViewIfNeeded();assert.deepEqual(await inkState(),original,'normalized ink changed on rotation');
   const pixels=await page.locator('#ink').evaluate(canvas=>Array.from(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data).filter((n,i)=>i%4===3&&n>0).length);assert.ok(pixels>0,'ink disappeared after resize');
   await page.locator('#undo').click();assert.equal((await inkState())[0].length,1);
   await page.locator('#clear').click();assert.ok(await page.locator('#confirm-dialog').evaluate(x=>x.open));await page.locator('#confirm-yes').click();assert.equal((await inkState()).length,0);
   await page.setViewportSize({width:390,height:700});await page.screenshot({path:path.join(output,'demo-writing-after-clear.png'),fullPage:true});return{strokesDrawn:2,resizeRetained:true,undoRemaining:1,clearRemaining:0};
  });
  await test('stories-complete-content',async()=>{
   await chapter();await page.locator('[data-tab="stories"]').click();const source=JSON.parse(fs.readFileSync(path.join(folder,'try/course/chapters/baa.json'),'utf8'));
   let checked=0;for(let story=0;story<source.microstories.length;story++){
    const chooser=page.locator(`[data-story="${story}"]`);const details=chooser.locator('xpath=ancestor::details[1]');if(await details.count())await details.evaluate(x=>x.open=true);await chooser.click();
    for(let frame=0;frame<4;frame++){await page.locator(`[data-frame="${frame}"]`).click();assert.equal((await page.locator('.story-sentence').innerText()).trim(),source.microstories[story].sentences[frame]);const display=await page.locator('.story-sentence').evaluate(x=>({overflow:getComputedStyle(x).overflow,client:x.clientHeight,scroll:x.scrollHeight}));assert.ok(!['hidden','clip'].includes(display.overflow));assert.ok(display.scroll<=display.client+2);checked++;}
    assert.equal(await page.locator('[data-story-answer]').count(),source.microstories[story].comprehensionTask.options.length);
   }await page.screenshot({path:path.join(output,'demo-story-final-frame.png'),fullPage:true});return{sentencesCompared:checked,questionsPresent:2};
  });
  await test('session-resume-and-browser-history',async()=>{
   await chapter();await page.locator('[data-tab="words"]').click();await page.locator('#next').click();const before=await saved();
   await page.locator('#hzn-back-lessons').click();assert.equal(await page.locator('body').getAttribute('data-focus-view'),'home');await page.locator('#hzn-resume').click();assert.equal(await page.locator('body').getAttribute('data-focus-view'),'lesson');
   await page.goBack();assert.equal(await page.locator('body').getAttribute('data-focus-view'),'home');await page.goForward();assert.equal(await page.locator('body').getAttribute('data-focus-view'),'lesson');
   await page.reload();await page.waitForFunction(()=>window.HORIZONS_BOOT?.ready);assert.equal(await page.locator('body').getAttribute('data-focus-view'),'home');await page.locator('#hzn-resume').click();
   const after=await saved();assert.equal(after.word,before.word);assert.equal(after.chapter,before.chapter);assert.equal(after.tab,before.tab);return{wordIndex:after.word,reloadResumed:true,historyRestored:true};
  });
 }finally{
  fs.writeFileSync(path.join(output,'demo-behavior-results.json'),JSON.stringify({scope:'Actual staged demo; Chromium emulated viewport; no licensed accounts',results,errors},null,2));
  console.log(JSON.stringify({results,errors}));await browser.close();await new Promise(resolve=>server.close(resolve));
 }
 if(results.some(r=>r.status==='fail')||errors.length)process.exitCode=1;
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
