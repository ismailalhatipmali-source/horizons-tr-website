// node --experimental-vm-modules --test tests/test_interface_locales.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const web=JSON.parse(await read('src/workbook-web/web-locales.json'));
const portal=JSON.parse(await read('src/workbook-web/portal-locales.json'));
const site=JSON.parse(await read('src/commerce/account-locales.json'));
const source=await read('src/workbook-web/web-ui.js');
const ui=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

test('every displayed locale has complete keys, exact placeholders and the same account policy as the site',()=>{
 assert.deepEqual(Object.keys(web),Object.keys(site));assert.equal(Object.keys(web).length,32);
 for(const dict of [web,portal])for(const [lang,values]of Object.entries(dict)){
  assert.deepEqual(Object.keys(values).sort(),Object.keys(dict.en).sort(),lang);
  for(const [key,value]of Object.entries(values)){
   assert.ok(value.trim(),lang+':'+key);
   assert.deepEqual([...value.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort(),[...dict.en[key].matchAll(/\{\w+\}/g)].map(x=>x[0]).sort(),lang+':'+key);
   assert.ok(!/<\/?(?:script|img|iframe)\b/i.test(value));
  }
 }
 for(const lang of Object.keys(web)){
  assert.equal(web[lang].permanentWarning,site[lang].permanent_warning);
  assert.equal(web[lang].permanentConsent,site[lang].permanent_consent);
  assert.equal(ui.direction(lang),['ar','he','fa','ur'].includes(lang)?'rtl':'ltr');
 }
});

test('regional locales, browser aliases, direction, numbers and unknown language fallback',()=>{
 for(const [input,expected]of [['de-DE','de'],['PT_br','pt'],['zh-Hans-CN','zh'],['nb-NO','no'],['nn','no'],['iw-IL','he'],[' FA-ir ','fa'],['not-a-language',null],['constructor',null]])assert.equal(ui.normalizeLanguage(input),expected);
 assert.equal(ui.translate(web,'ja-JP','signIn'),web.ja.signIn);
 assert.equal(ui.translate(web,'bad','signIn'),web.en.signIn);
 assert.ok(ui.translate(web,'ar','saving',{done:1,total:2}).includes('\u2068'));
 assert.ok(!ui.translate(web,'he','savedStatus',{saved:2,total:5,size:'1 MB'}).includes('{'));
});

test('all 32 shell languages, activation labels, live error changes and accessible download labels',async()=>{
 const dom=new JSDOM(await read('src/workbook-web/index.html'),{url:'https://example.test/learn/?lang=en',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.setInterval=()=>0;w.matchMedia=()=>({matches:false});w.MessageChannel=MessageChannel;
 const context=dom.getInternalVMContext(),modules={};
 async function synthetic(name,values){modules[name]=new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v)},{context});}
 await synthetic('./license-core.js',{requestCode:async()=>({}),verifyCode:async()=>{},loginPassword:async()=>{throw Error('PASSWORD_INVALID')},getState:async()=>({activated:false,error:'ACTIVATION_REQUIRED'}),signOut:async()=>{},refreshMembership:async()=>{},resendMembershipCode:async()=>{},checkMembershipCode:async()=>({}),setupMembershipPassword:async()=>{},requestMembership:async()=>({})});
 await synthetic('./membership-manager.js',{mountMembershipManager:()=>({destroy(){}})});
 await synthetic('./web-config.js',{VERSION:'1.4.5'});
 await synthetic('./web-ui.js',{...ui,language:()=> 'en',dictionaries:async()=>[portal,web],registerWorker:async()=>({active:{},waiting:null}),workerMessage:async()=>({savedFiles:1,totalFiles:5,savedBytes:1048576}),installControl:()=>{}});
 Object.defineProperty(w.navigator,'serviceWorker',{value:{controller:{}}});
 modules['./membership-ui.js']=new vm.SourceTextModule(await read('src/workbook-web/membership-ui.js'),{context});
 const shell=new vm.SourceTextModule(await read('src/workbook-web/shell.js'),{context});
 await shell.link(id=>modules[id]);await shell.evaluate();
 const flush=()=>new Promise(r=>setTimeout(r,0));await flush();
 d.querySelector('#login-email').value='learner@example.test';d.querySelector('#login-password').value='test password only';
 await d.querySelector('#password-form').onsubmit({preventDefault(){}});
 assert.equal(d.querySelector('#status').textContent,web.en.passwordInvalid);
 for(const lang of Object.keys(web)){
  d.querySelector('#language').value=lang;d.querySelector('#language').dispatchEvent(new w.Event('change'));await flush();
  assert.equal(d.documentElement.lang,lang);assert.equal(d.documentElement.dir,ui.direction(lang));
  for(const el of d.querySelectorAll('[data-w]'))assert.equal(el.textContent,web[lang][el.dataset.w],lang+':'+el.dataset.w);
  for(const el of d.querySelectorAll('[data-t]'))assert.equal(el.textContent,portal[lang][el.dataset.t],lang+':'+el.dataset.t);
  for(const el of d.querySelectorAll('[data-m]'))assert.equal(el.lang,lang);
  assert.equal(d.querySelector('#status').textContent,web[lang].passwordInvalid);
  assert.equal(d.querySelector('#progress').getAttribute('aria-label'),web[lang].downloadProgress);
  assert.ok(d.querySelector('#demo').href.endsWith('?lang='+lang));
  assert.ok(d.querySelector('#open').href.endsWith('?lang='+lang));
 }
 assert.equal(d.querySelector('#login-password').value,'');
 assert.equal(w.localStorage.getItem('horizons-interface-language'),'ja');dom.window.close();
});

test('demo install panel follows all 32 languages, RTL and startup language changes without an English fallback',async()=>{
 const dom=new JSDOM(await read('src/demo-pwa/index.html'),{url:'https://example.test/try/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.eval(await read('release-assets/1.4.5/files/try/demo-locales.js'));
 w.eval(await read('src/demo-pwa/demo-pwa.js'));
 await new Promise(r=>setTimeout(r,0));
 for(const lang of Object.keys(web)){
  d.querySelector('#locale').value=lang;d.documentElement.lang=lang;
  await new Promise(r=>setTimeout(r,0));
  const dialog=d.querySelector('.hzn-demo-dialog');assert.ok(dialog,lang);assert.equal(dialog.dir,ui.direction(lang));assert.equal(dialog.lang,lang);
  assert.equal(d.querySelector('.hzn-demo-open').textContent,web[lang].demoButton);
  for(const label of d.querySelectorAll('[data-demo-label]'))assert.equal(label.textContent,w.HORIZONS_DEMO_LOCALES[lang][label.dataset.demoLabel]);
  assert.equal(dialog.querySelector('progress').getAttribute('aria-label'),web[lang].downloadProgress);
 }
 dom.window.close();
});
