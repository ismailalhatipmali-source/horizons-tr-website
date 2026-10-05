import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const source=await readFile('src/commerce/checkout.js','utf8');
const countries=JSON.parse(await readFile('dist/assets/commerce-geo/countries.json','utf8'));
const cityData={TR:JSON.parse(await readFile('dist/assets/commerce-geo/TR.json','utf8')),SY:JSON.parse(await readFile('dist/assets/commerce-geo/SY.json','utf8'))};
assert.equal(countries.length,250);assert.equal(new Set(countries.map(x=>x.code)).size,250);
const tick=()=>new Promise(r=>setTimeout(r,0));
async function boot(lang,cityResponse){
 const dom=new JSDOM(await readFile(`dist/${lang}/checkout.html`,'utf8'),{url:`https://example.test/${lang}/checkout.html`,runScripts:'outside-only'}),w=dom.window;
 const requests=[];
 w.fetch=async url=>{
  const path=new URL(url,w.location.href).pathname;requests.push(path);
  if(path.startsWith('/checkout-api/'))return {ok:false,json:async()=>({ok:false})}; // No real API calls or orders.
  assert.ok(path.startsWith('/assets/commerce-geo/'));
  if(path.endsWith('countries.json'))return {ok:true,json:async()=>countries};
  const code=path.split('/').pop().slice(0,-5);assert.ok(cityData[code]);
  return {ok:true,json:async()=>cityResponse?cityResponse(path):cityData[code]};
 };
 w.eval(source);await tick();return {dom,w,d:w.document,requests};
}
for(const lang of ['ar','en','tr']){
 const {dom,w,d,requests}=await boot(lang),form=d.querySelector('[data-buyer-form]'),country=form.elements.country_code,city=form.elements.city;
 assert.equal(country.querySelectorAll('option[value]:not([value=""])').length,250);
 country.value='TR';country.dispatchEvent(new w.Event('change'));await tick();
 assert.ok(d.querySelectorAll('#commerce-cities option').length>0);assert.ok(requests.includes('/assets/commerce-geo/TR.json'));
 city.value='Manual town';country.value='SY';country.dispatchEvent(new w.Event('change'));
 assert.equal(city.value,'');await tick();assert.ok(requests.includes('/assets/commerce-geo/SY.json'));
 city.value='Manual fallback town';city.dispatchEvent(new w.Event('input'));assert.equal(city.value,'Manual fallback town');
 country.value='';country.dispatchEvent(new w.Event('change'));assert.equal(city.value,'');assert.equal(d.querySelector('#commerce-cities').childElementCount,0);
 assert.ok(requests.every(x=>x.startsWith('/assets/commerce-geo/')||x==='/checkout-api/'));dom.window.close();
}
// Responses from a previous selection must never overwrite a newer country.
let resolveTR;
const {dom,w,d}=await boot('en',path=>path.endsWith('TR.json')?new Promise(r=>resolveTR=r):[['Damascus']]);
const country=d.querySelector('[name=country_code]');
country.value='TR';country.dispatchEvent(new w.Event('change'));await tick();
country.value='SY';country.dispatchEvent(new w.Event('change'));await tick();
assert.equal(typeof resolveTR,'function');resolveTR([['Istanbul']]);await tick();
assert.deepEqual(Array.from(d.querySelectorAll('#commerce-cities option'),x=>x.value),['Damascus']);dom.window.close();
console.log('PASS: current checkout geography, 250 country/territory choices, local city data, manual fallback, country reset and stale-response protection; mocked API only.');
