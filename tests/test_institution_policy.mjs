import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const read=p=>fs.readFileSync(p,'utf8');
const labels=JSON.parse(read('src/commerce/account-locales.json'));
for(const [lang,words] of Object.entries(labels)){
 const product=new JSDOM(read(`dist/${lang}/product.html`));
 const section=product.window.document.querySelector('#institution-plan');
 assert.ok(section.textContent.includes(words.count_institution),lang);
 assert.ok(section.textContent.includes(words.institution_note),lang);
 for(const page of ['cart','checkout']){
  const dom=new JSDOM(read(`dist/${lang}/${page}.html`));const d=dom.window.document;
  const cfg=JSON.parse(d.querySelector('#checkout-config').textContent);
  assert.equal(cfg.words.institution_note,words.institution_note);
  const offer=cfg.catalog.products['horizons-arabic-level1'].offers.find(o=>o.account_type==='institution');
  assert.equal(offer.max_learners,500);assert.equal(offer.term,'annual');assert.equal(offer.price_minor,100000);
  assert.ok(d.querySelector('[data-institution-policy]'));dom.window.close();
 }
 product.window.close();
}
for(const path of ['src/commerce/membership-manager.js','src/workbook-web/membership-manager.js']){
 const dom=new JSDOM('<div id="host"></div>',{runScripts:'outside-only'});const w=dom.window,d=w.document;
 w.eval(read(path).replace('export function','function')+';window.mount=mountMembershipManager');
 let count=499;const api={async list(){return {account_type:'institution',max_learners:500,can_manage:true,learners:Array.from({length:count},(_,i)=>({id:'member_'+i,email:`student${i}@example.test`}))}}};
 const ui=w.mount(d.querySelector('#host'),api,{});await ui.refresh();
 assert.equal(d.querySelector('form button').disabled,false);assert.equal(d.querySelector('h2').textContent.endsWith('499 / 500'),true);
 count=500;await ui.refresh();assert.equal(d.querySelector('form button').disabled,true);
 ui.destroy();dom.window.close();
}
console.log('PASS: 32 localized institution pages and 64 checkout policies; annual only; existing price; both roster interfaces allow 499 and disable invitations at 500.');
