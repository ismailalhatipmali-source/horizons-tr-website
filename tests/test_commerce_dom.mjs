import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire('/tmp/horizons-demo-tools/package.json');
const {JSDOM}=require('jsdom');
const script=await readFile('src/commerce/cart.js','utf8');
for(const lang of 'en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'.split(' ')) {
 for(const page of ['cart','checkout']) {
  const html=await readFile('dist/'+lang+'/'+page+'.html','utf8');
  const dom=new JSDOM(html,{url:'https://example.test/'+lang+'/'+page+'.html?plan=annual&success=true&email=forged',runScripts:'outside-only'});
  const w=dom.window,d=w.document;
  w.localStorage.setItem('learner-progress-sentinel','original');
  w.sessionStorage.setItem('unrelated-sentinel','original');
  w.eval(script);
  assert.equal(w.location.search,'?plan=annual');
  assert.equal(d.querySelector('[data-basket]').hidden,false);
  assert.ok(d.querySelector('[data-money]').textContent);
  assert.equal(d.querySelector('[data-selected-plan=annual]').hidden,false);
  if(page==='cart') {
   for(const plan of ['monthly','lifetime','annual']) {
    d.querySelector('[data-plan='+plan+']').click();
    assert.equal(JSON.parse(w.sessionStorage.getItem('horizons-commerce-review-v1')).plan,plan);
    assert.ok(d.querySelector('.commerce-grid a').href.endsWith('?plan='+plan));
   }
   d.querySelector('[data-remove]').click();
   assert.equal(d.querySelector('[data-basket]').hidden,true);
   assert.equal(d.querySelector('[data-empty]').hidden,false);
  } else {
   assert.equal(d.querySelector('input[type=email]').disabled,false);
   assert.equal(d.querySelector('[data-payment-submit]').disabled,true);
   const form=d.querySelector('[data-buyer-form]');
   assert.equal(form.reportValidity(),false);
   const submit=()=>form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
   submit();assert.equal(d.querySelector('[data-order-review]').hidden,true);
   for(const [key,value] of Object.entries({name:'Buyer <img src=x onerror=alert(1)>',email:'buyer@example.com',country:'Türkiye',city:'İstanbul',address:'Billing street 1'})) form.elements.namedItem(key).value=value;
   // Terms must be explicitly acknowledged; a filled form alone is insufficient.
   assert.equal(form.reportValidity(),false);
   form.elements.namedItem('consent').checked=true;
   assert.equal(form.reportValidity(),true);
   const billing=form.elements.namedItem('billing');billing.value='company';billing.dispatchEvent(new w.Event('change',{bubbles:true}));
   assert.equal(form.reportValidity(),false);
   form.elements.namedItem('company_name').value='Test Company';
   assert.equal(form.reportValidity(),true);
   const radio=d.querySelector('input[value=transfer]');radio.checked=true;
   radio.dispatchEvent(new w.Event('change',{bubbles:true}));
   assert.equal(d.querySelector('[data-method-note=transfer]').hidden,false);
   assert.equal(d.querySelector('[data-method-note=card]').hidden,true);
   submit();assert.equal(d.querySelector('[data-order-review]').hidden,false);
   assert.equal(form.hidden,true);
   assert.equal(d.querySelector('[data-buyer-summary] img'),null);
   assert.ok(d.querySelector('[data-buyer-summary]').textContent.includes('<img'));
   assert.equal(d.querySelector('[data-review-transfer]').hidden,false);
   assert.equal(d.querySelectorAll('[data-review-transfer] [data-account]').length,3);
   assert.equal(d.querySelector('[data-payment-submit]').disabled,true);
   for(const store of [w.localStorage,w.sessionStorage])for(let i=0;i<store.length;i++)assert.ok(!store.getItem(store.key(i)).includes('buyer@example.com'));
   assert.ok(!w.location.href.includes('buyer'));
   d.querySelector('[data-edit-buyer]').click();assert.equal(form.hidden,false);
   assert.equal(form.elements.namedItem('email').value,'buyer@example.com');
   billing.value='individual';billing.dispatchEvent(new w.Event('change',{bubbles:true}));
   submit();assert.ok(!d.querySelector('[data-buyer-summary]').textContent.includes('Test Company'));
  }
  assert.equal(w.localStorage.getItem('learner-progress-sentinel'),'original');
  assert.equal(w.sessionStorage.getItem('unrelated-sentinel'),'original');
  dom.window.close();
 }
}
console.log('PASS: 64 DOM pages, required fields/consent/company billing, safe order review/edit, matching account details, no payment or buyer persistence, ignored forged success, preserved learner storage. Visual browser verification remains separate.');
