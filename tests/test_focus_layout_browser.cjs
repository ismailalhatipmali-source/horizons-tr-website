// Real public-demo before/after layout QA. Supply authorized local demo directories; no assets are distributed by this test.
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(process.env.HZN_QA_OUTPUT||'focus-layout-output');
for(const name of ['HZN_DEMO_BEFORE_ROOT','HZN_DEMO_AFTER_ROOT','HZN_CHROMIUM_EXECUTABLE'])if(!process.env[name])throw Error('Set '+name);
fs.mkdirSync(root+'/screenshots',{recursive:true});
function server(folder,port){const s=http.createServer((req,res)=>{let p=path.join(folder,decodeURIComponent(new URL(req.url,'http://localhost').pathname));try{if(fs.statSync(p).isDirectory())p=path.join(p,'index.html');res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav','.webp':'image/webp','.webmanifest':'application/manifest+json'}[path.extname(p)]||'application/octet-stream'));res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end('Missing')}});return new Promise(r=>s.listen(port,'127.0.0.1',()=>r(s)))}
(async()=>{const servers=await Promise.all([server(path.dirname(process.env.HZN_DEMO_BEFORE_ROOT),0),server(path.dirname(process.env.HZN_DEMO_AFTER_ROOT),0)]);const b=await chromium.launch({executablePath:process.env.HZN_CHROMIUM_EXECUTABLE,args:['--single-process','--no-zygote'],headless:true});const page=await b.newPage({viewport:{width:1366,height:620}});const cdp=await page.context().newCDPSession(page);const errors=[],results=[],captures=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const settle=async()=>{await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.evaluate(()=>scrollTo(0,0));};
 const shot=async name=>{await settle();const file='screenshots/'+name+'.png';await page.screenshot({path:root+'/'+file});captures.push(file);};
 const metrics=()=>page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollX,scrollY,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,nextBottom:document.querySelector('#next')?.getBoundingClientRect().bottom,activityTop:document.querySelector('#activity')?.getBoundingClientRect().top}));
 async function cold(kind,width,height){const origin='http://127.0.0.1:'+servers[kind==='before'?0:1].address().port;await page.goto('about:blank');await cdp.send('Storage.clearDataForOrigin',{origin,storageTypes:'all'});await page.setViewportSize({width,height});await page.goto(origin+'/try/?lang=ar');await page.waitForFunction(()=>window.HORIZONS_BOOT?.ready);await settle();}
 for(const kind of ['before','after'])for(const [width,height,label]of [[1366,620,'desktop'],[768,1024,'tablet'],[390,700,'mobile']]){
  await cold(kind,width,height);await shot(kind+'-'+label+'-home');results.push({kind,screen:'home',...await metrics()});
  await page.locator('#course-nav [data-course="catalog"]').click();await page.locator('[data-chapter="baa"]').click();await settle();await shot(kind+'-'+width+'x'+height+'-lesson');await shot(kind+'-'+label+'-lesson');results.push({kind,screen:'lesson',...await metrics()});
  if(kind==='after'&&label!=='tablet'){
   await page.locator('#settings-button').click();await shot('after-'+label+'-settings');await page.locator('#close-settings').click();
   await page.locator('#hzn-lessons-button').click();await shot('after-'+label+'-lessons');await page.locator('#hzn-lessons-dialog-close').click();
  }
 }
 for(const [width,height]of [[1366,620],[1366,768],[1440,900],[1920,1080],[768,1024],[820,1180],[1024,768],[1180,820],[320,568],[360,640],[390,700],[390,844],[430,932],[844,390],[390,360]]){
  await page.setViewportSize({width,height});await settle();results.push({kind:'after-viewport',screen:'lesson',simulation:width===390&&height===360?'Reduced viewport simulating an open keyboard; no real device keyboard':undefined,...await metrics()});
 }
 const final={browser:'Chromium153 portable headless; CSS viewport emulation, no physical devices',locale:'ar',activity:'baa first word, learn/words',coldHome:true,scrollResetBeforeEveryCapture:true,errors,results,captures};
 fs.writeFileSync(root+'/demo-browser-final.json',JSON.stringify(final,null,2));console.log(JSON.stringify(final));
 if(errors.length||results.some(r=>r.scrollWidth>r.width))throw Error('Unexpected page overflow or JavaScript error');
 for(const [w,h]of [[1366,620],[390,700]]){const r=results.find(r=>r.kind==='after'&&r.screen==='lesson'&&r.width===w&&r.height===h);if(!r||r.nextBottom>h)throw Error('Target viewport navigation does not fit: '+w+'x'+h);}
}finally{await b.close();servers.forEach(s=>s.close());}})().catch(e=>{console.error(e);process.exit(1)});
