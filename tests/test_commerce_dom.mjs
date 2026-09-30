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
   assert.equal(d.querySelector('input[type=email]').disabled,true);
   assert.equal(d.querySelector('.commerce-grid button').disabled,true);
   const radio=d.querySelector('input[value=transfer]');radio.checked=true;
   radio.dispatchEvent(new w.Event('change',{bubbles:true}));
   assert.equal(d.querySelector('[data-method-note=transfer]').hidden,false);
   assert.equal(d.querySelector('[data-method-note=card]').hidden,true);
  }
  assert.equal(w.localStorage.getItem('learner-progress-sentinel'),'original');
  assert.equal(w.sessionStorage.getItem('unrelated-sentinel'),'original');
  dom.window.close();
 }
}
console.log('PASS: 64 DOM pages, plan selection/removal/navigation, payment options, no collection, ignored forged success, preserved unrelated storage. Visual browser verification remains separate.');
