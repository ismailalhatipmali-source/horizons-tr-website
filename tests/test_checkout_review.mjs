import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire('/tmp/horizons-demo-tools/package.json');
const {JSDOM}=require('jsdom');
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const catalog=JSON.parse(read('src/commerce/products.json'));
const locales=JSON.parse(read('src/commerce/checkout-locales.json'));
for(const lang of Object.keys(locales)){
 const html=read(`dist/${lang}/checkout.html`),dom=new JSDOM(html,{url:`https://horizons-tr.com/${lang}/checkout.html?product=horizons-arabic-level1`,runScripts:'outside-only'}),w=dom.window;
 const requests=[];
 w.fetch=async(url,opts={})=>{
   if(String(url).includes('countries.json'))return {ok:true,json:async()=>[{code:'TR',name:'Türkiye'},{code:'DE',name:'Germany'}]};
   if(String(url).endsWith('TR.json'))return {ok:true,json:async()=>[['İstanbul','إسطنبول']]};
   if(url==='/checkout-api/'&&!opts.method)return {ok:true,json:async()=>({ok:true,csrf:'test-token',mode:'bank_review',collection_enabled:false})};
   if(url==='/checkout-api/'&&opts.method==='POST'){requests.push(JSON.parse(opts.body));return {ok:true,json:async()=>({ok:true,reference:'HZN-R-20261002-1234567890ABCDEF1234',mode:'bank_review',payment_status:'unpaid',collection_enabled:false,amount_minor:999,currency:'USD'})};}
   throw new Error('Unexpected request: '+url);
 };
 w.print=()=>{};w.eval(read('src/commerce/site-commerce.js'));w.eval(read('src/commerce/checkout.js'));await new Promise(r=>setTimeout(r,0));
 const d=w.document,f=d.querySelector('form[data-buyer-form]');
 assert.equal(f.elements.offer.options.length,7,lang);assert.equal(d.documentElement.dir,['ar','he','fa','ur'].includes(lang)?'rtl':'ltr');
 for(const id of ['company_name','tax_id','tax_office'])assert.equal(f.elements[id].disabled,true);
 f.elements.billing.value='company';f.elements.billing.dispatchEvent(new w.Event('change',{bubbles:true}));for(const id of ['company_name','tax_id','tax_office'])assert.equal(f.elements[id].required,true);
 f.elements.billing.value='individual';f.elements.billing.dispatchEvent(new w.Event('change',{bubbles:true}));
 f.elements.country_code.value='TR';f.elements.country_code.dispatchEvent(new w.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,0));
 for(const [k,v]of Object.entries({first_name:'Test',last_name:'Buyer',email:'buyer@example.test',email_confirm:'buyer@example.test',phone:'+905550000000',city:'İstanbul',address:'Test billing address'}))f.elements[k].value=v;
 for(const k of ['consent','privacy','permanent'])f.elements[k].checked=true;
 const submit=()=>f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 f.elements.method.value='card';submit();assert.equal(d.querySelector('[data-final-submit]').disabled,true);assert.equal(requests.length,0);d.querySelector('[data-edit]').click();
 f.elements.method.value='transfer';submit();assert.equal(d.querySelector('[data-final-submit]').disabled,false);d.querySelector('[data-final-submit]').click();await new Promise(r=>setTimeout(r,0));
 assert.equal(requests.length,1,lang);assert.equal(requests[0].buyer.email,'buyer@example.test');assert.equal(requests[0].offer,'individual-monthly');assert.equal(d.querySelector('[data-reference]').textContent,'HZN-R-20261002-1234567890ABCDEF1234');
 assert.equal(d.querySelector('[data-receipt]').hidden,false);assert(!JSON.stringify({...w.localStorage}).includes('buyer@example.test'));
 assert(!d.querySelector('input[name=card_number],input[name=cvv]'));
 const card=JSON.parse(w.localStorage.getItem('horizons-commerce-basket-v2'));assert.equal(card.schema,3);assert.equal(card.product,'horizons-arabic-level1');
 dom.window.close();
}
console.log('PASS: 32 complete locale forms, RTL/LTR, company fields, card disabled, server reference result, no buyer browser persistence.');
