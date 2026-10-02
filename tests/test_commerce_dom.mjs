import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire('/tmp/horizons-demo-tools/package.json');const {JSDOM}=require('jsdom');
const globalScript=await readFile('src/commerce/site-commerce.js','utf8'),script=await readFile('src/commerce/cart.js','utf8');
const homeScript=await readFile('dist/home.js','utf8');
const langs='en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'.split(' ');
const amounts={individual:{monthly:999,annual:9900,lifetime:15000},family:{monthly:2000,annual:20000,lifetime:25000},institution:{annual:100000}};
function boot(html,url){const dom=new JSDOM(html,{url,runScripts:'outside-only'});dom.window.localStorage.setItem('learner-progress-sentinel','original');dom.window.sessionStorage.setItem('unrelated','original');dom.window.matchMedia=()=>({matches:true,addEventListener(){}});const video=dom.window.document.querySelector('video');if(video)video.pause=()=>{};dom.window.eval(homeScript);assert.equal(dom.window.document.getElementById('horizons-pilot-ui'),null,'legacy installer controls must not be reinserted');dom.window.eval(globalScript);if(dom.window.document.querySelector('[data-commerce-page]'))dom.window.eval(script);return dom;}
let plans=0;
for(const lang of langs)for(const page of ['cart','checkout']) {
 const html=await readFile('dist/'+lang+'/'+page+'.html','utf8');
 const dom=boot(html,'https://example.test/'+lang+'/'+page+'.html?account=family&plan=annual&success=true&email=forged'),w=dom.window,d=w.document;
 assert.equal(w.location.search,'?account=family&plan=annual');assert.equal(d.querySelector('[data-basket]').hidden,false);
 assert.equal(d.querySelector('[data-selected-account=family]').hidden,false);assert.equal(d.querySelector('.commerce-cart-badge').textContent,'1');
 assert.equal(d.querySelector('[data-payment-submit]')?.disabled??true,true);
 if(page==='cart') {
  assert.equal(d.querySelectorAll('[data-plan]').length,7);
  assert.equal(d.querySelector('[data-account=institution][data-plan=lifetime]'),null);
  const cfg=JSON.parse(d.getElementById('commerce-catalog').textContent);
  for(const [account,rows]of Object.entries(amounts))for(const [plan,amount]of Object.entries(rows)) {
   assert.equal(cfg.accounts[account].plans[plan].proposed_minor,amount);
   d.querySelector('[data-account='+account+'][data-plan='+plan+']').click();plans++;
   const selected=JSON.parse(w.localStorage.getItem('horizons-commerce-basket-v2'));
   assert.equal(selected.account,account);assert.equal(selected.plan,plan);
   assert.ok(d.querySelector('[data-commerce-link]').href.includes('account='+account+'&plan='+plan));
  }
  d.querySelector('[data-remove]').click();assert.equal(d.querySelector('[data-basket]').hidden,true);assert.equal(d.querySelector('.commerce-cart-badge').hidden,true);
 }else {
  const form=d.querySelector('[data-buyer-form]'),submit=()=>form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(form.reportValidity(),false);submit();assert.equal(d.querySelector('[data-order-review]').hidden,true);
  for(const [key,value]of Object.entries({name:'Buyer <img src=x onerror=alert(1)>',email:'buyer@example.com',email_confirm:'wrong@example.com',country:'Türkiye',city:'İstanbul',address:'Billing street 1'}))form.elements.namedItem(key).value=value;
  form.elements.consent.checked=true;form.elements.permanent.checked=true;submit();assert.equal(d.querySelector('[data-order-review]').hidden,true);
  form.elements.email_confirm.value='buyer@example.com';form.elements.email_confirm.dispatchEvent(new w.Event('input',{bubbles:true}));
  form.elements.permanent.checked=false;submit();assert.equal(d.querySelector('[data-order-review]').hidden,true);
  form.elements.permanent.checked=true;const billing=form.elements.billing;billing.value='company';billing.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(form.reportValidity(),false);
  form.elements.company_name.value='Synthetic Company';assert.equal(form.reportValidity(),true);submit();
  assert.equal(d.querySelector('[data-order-review]').hidden,false);assert.equal(d.querySelector('[data-buyer-summary] img'),null);assert.ok(d.querySelector('[data-buyer-summary]').textContent.includes('<img'));
  assert.equal(d.querySelectorAll('[data-review-transfer] [data-account]').length,3);assert.equal(d.querySelector('[data-review-transfer]').hidden,false);
  assert.equal(d.querySelector('input[value=card]').disabled,true);
  d.querySelector('[data-edit-buyer]').click();assert.equal(form.hidden,false);
  w.HorizonsBasket.set({schema:2,product:'horizons-arabic-level1',quantity:1,account:'institution',plan:'annual'});
  assert.equal(form.elements.permanent.required,false);assert.equal(form.elements.permanent.disabled,true);assert.equal(d.querySelector('[data-permanent-warning]').hidden,true);
  w.HorizonsBasket.set({schema:2,product:'horizons-arabic-level1',quantity:1,account:'family',plan:'annual'});assert.equal(form.elements.permanent.checked,false);assert.equal(form.elements.permanent.required,true);
  for(const storage of [w.localStorage,w.sessionStorage])for(let i=0;i<storage.length;i++)assert.ok(!storage.getItem(storage.key(i)).includes('buyer@example.com'));
 }
 assert.equal(w.localStorage.getItem('learner-progress-sentinel'),'original');assert.equal(w.sessionStorage.getItem('unrelated'),'original');dom.window.close();
}
// Persistence on every page and external-tab storage events.
for(const lang of langs)for(const page of ['index','product','about','privacy','terms','support']) {
 const html=await readFile(`dist/${lang}/${page}.html`,'utf8');const dom=boot(html,`https://example.test/${lang}/${page}.html`),w=dom.window,d=w.document;
 assert.equal(d.querySelectorAll('.commerce-floating-cart').length,1);
 w.HorizonsBasket.set({schema:2,product:'horizons-arabic-level1',quantity:1,account:'family',plan:'lifetime'});
 assert.equal(d.querySelector('.commerce-cart-badge').textContent,'1');
 const saved=w.localStorage.getItem('horizons-commerce-basket-v2');const second=new JSDOM(html,{url:`https://example.test/${lang}/${page}.html`,runScripts:'outside-only'});second.window.localStorage.setItem('horizons-commerce-basket-v2',saved);second.window.eval(globalScript);assert.equal(second.window.document.querySelector('.commerce-cart-badge').hidden,false);second.window.close();
 w.dispatchEvent(new w.StorageEvent('storage',{key:'horizons-commerce-basket-v2',newValue:null}));assert.equal(d.querySelector('.commerce-cart-badge').hidden,true);
 if(['index','product'].includes(page)){assert.equal(d.querySelector('[data-horizons-action=windows]'),null);assert.ok(d.querySelector('[data-start-dialog] a[href^="/try/"]'));assert.ok(d.querySelector('[data-start-dialog] a[href="cart.html#accounts"]'));}
 dom.window.close();
}
for(const account of ['institution','forged']) {
 const dom=boot(await readFile('dist/ar/cart.html','utf8'),`https://example.test/ar/cart.html?account=${account}&plan=lifetime&success=1`);assert.equal(dom.window.HorizonsBasket.get(),null);assert.equal(dom.window.location.search,'');dom.window.close();
}
console.log(`PASS: 64 cart/checkout pages; ${plans} account-price selections; 192 global page/persistence checks; email confirmation, explicit permanent-address consent, institution policy, card disabled, safe preview, preserved progress and forged plans rejected.`);
