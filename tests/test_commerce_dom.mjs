import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const source=await readFile('src/commerce/site-commerce.js','utf8');
const catalog=JSON.parse(await readFile('src/commerce/products.json','utf8'));
const langs='en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja'.split(' ');
const key='horizons-commerce-basket-v2';
const tick=()=>new Promise(r=>setTimeout(r,0));
async function boot(html,url,saved=null){
 const dom=new JSDOM(html,{url,runScripts:'outside-only'}),w=dom.window;
 w.localStorage.setItem('learner-progress-sentinel','original');
 w.sessionStorage.setItem('unrelated','original');
 if(saved)w.localStorage.setItem(key,saved);
 w.fetch=async url=>{assert.equal(url,'/products.json?v=institution-20261003');return {ok:true,json:async()=>catalog};};
 w.eval(source);await tick();assert.ok(w.HorizonsBasket);return dom;
}
let selections=0;
for(const lang of langs)for(const page of ['index','product','about','privacy','terms','support','cart','checkout']){
 const html=await readFile(`dist/${lang}/${page}.html`,'utf8'),url=`https://example.test/${lang}/${page}.html`;
 const dom=await boot(html,url),w=dom.window,d=w.document;
 assert.equal(d.querySelectorAll('.commerce-floating-cart').length,1);
 const inline=d.getElementById('checkout-config');
 const pageCatalog=inline?JSON.parse(inline.textContent).catalog:catalog;
 for(const [product,p]of Object.entries(pageCatalog.products))if(p.available)for(const offer of p.offers){
  w.HorizonsBasket.set({schema:3,product,offer:offer.id,quantity:1});selections++;
  assert.deepEqual(JSON.parse(w.localStorage.getItem(key)),{schema:3,product,offer:offer.id,quantity:1});
  const link=new URL(d.querySelector('.commerce-floating-cart').href);
  assert.equal(link.searchParams.get('product'),product);assert.equal(link.searchParams.get('offer'),offer.id);
  assert.equal(d.querySelector('.commerce-cart-badge').hidden,false);
 }
 // Saved baskets from the old storefront must migrate without losing learner data.
 const old={schema:2,product:'horizons-arabic-level1',quantity:1,account:'family',plan:'lifetime'};
 w.HorizonsBasket.set(old);assert.equal(w.HorizonsBasket.get().offer,'family-lifetime');
 const second=await boot(html,url,JSON.stringify(old));
 assert.equal(second.window.HorizonsBasket.get().schema,3);
 assert.equal(second.window.HorizonsBasket.get().offer,'family-lifetime');second.window.close();
 const normalized=new URL(w.HorizonsBasket.link('checkout.html?account=family&plan=lifetime'),url);
 assert.equal(normalized.searchParams.has('account'),false);assert.equal(normalized.searchParams.has('plan'),false);
 assert.throws(()=>w.HorizonsBasket.set({schema:3,product:'horizons-arabic-level1',offer:'institution-lifetime',quantity:1}),/INVALID_BASKET/);
 assert.throws(()=>w.HorizonsBasket.set({schema:3,product:'forged',offer:'family-lifetime',quantity:1}),/INVALID_BASKET/);
 w.dispatchEvent(new w.StorageEvent('storage',{key,newValue:null}));assert.equal(d.querySelector('.commerce-cart-badge').hidden,true);
 w.HorizonsBasket.set(null);assert.equal(w.localStorage.getItem(key),null);
 assert.equal(w.localStorage.getItem('learner-progress-sentinel'),'original');assert.equal(w.sessionStorage.getItem('unrelated'),'original');
 dom.window.close();
}
console.log(`PASS: 256 current pages, ${selections} available product/offer selections, schema-2 migration, storage events, forged selections rejected and learner data preserved.`);
