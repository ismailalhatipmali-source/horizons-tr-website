import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{createRequire}from'node:module';
const{JSDOM}=createRequire(import.meta.url)('jsdom');
const source=await readFile('src/commerce/location-picker.js','utf8'),countries=JSON.parse(await readFile('dist/assets/commerce-geo/countries.json','utf8'));
assert.equal(countries.length,250);assert.equal(new Set(countries.map(x=>x.code)).size,250);
const tick=()=>new Promise(r=>setTimeout(r,0));
const settled=async city=>{for(let i=0;city.hasAttribute('aria-busy')&&i<200;i++)await new Promise(r=>setTimeout(r,10));assert.equal(city.hasAttribute('aria-busy'),false);};
for(const lang of ['ar','en','tr']){
 const dom=new JSDOM(await readFile(`dist/${lang}/checkout.html`,'utf8'),{url:`https://example.test/${lang}/checkout.html`,runScripts:'outside-only'}),w=dom.window,d=w.document;
 const requests=[];w.fetch=async url=>{const path=new URL(url).pathname;requests.push(path);return{ok:true,json:async()=>JSON.parse(await readFile('dist'+path,'utf8'))};};
 w.AbortController=AbortController;await w.eval(source);
 const form=d.querySelector('form'),country=form.elements.country,city=form.elements.city;d.querySelector('[data-buyer-fields]').disabled=false;
 assert.equal(d.querySelectorAll('#commerce-countries option').length,250);
 const display=new Intl.DisplayNames([lang],{type:'region'});country.value=display.of('TR');country.dispatchEvent(new w.Event('input'));await settled(city);
 assert.ok(d.querySelectorAll('#commerce-cities option').length>0);assert.ok(requests.includes('/assets/commerce-geo/TR.json'));
 city.value='Manual town';country.value=display.of('SY');country.dispatchEvent(new w.Event('input'));assert.equal(city.value,'');await settled(city);assert.ok(requests.includes('/assets/commerce-geo/SY.json'));
 country.value='not a country';country.dispatchEvent(new w.Event('input'));assert.notEqual(country.validationMessage,'');
 assert.ok(requests.every(x=>x.startsWith('/assets/commerce-geo/')));dom.window.close();
}
// Late city fetch responses must not leak previous country choices into a new list.
const dom=new JSDOM(await readFile('dist/en/checkout.html','utf8'),{url:'https://example.test/en/checkout.html',runScripts:'outside-only'}),w=dom.window,d=w.document;w.AbortController=AbortController;
let resolveTR;w.fetch=async url=>{const path=new URL(url).pathname;if(path.endsWith('countries.json'))return{ok:true,json:async()=>countries};if(path.endsWith('TR.json'))return{ok:true,json:()=>new Promise(r=>resolveTR=r)};return{ok:true,json:async()=>[['Damascus']]};};
await w.eval(source);const country=d.querySelector('[name=country]');country.value='Türkiye';country.dispatchEvent(new w.Event('input'));await tick();country.value='Syria';country.dispatchEvent(new w.Event('input'));await tick();resolveTR([['Istanbul']]);await tick();assert.equal(d.querySelector('#commerce-cities').textContent,'');assert.equal(d.querySelector('#commerce-cities option').value,'Damascus');dom.window.close();
console.log('PASS: 250 country/territory labels, local city data, search/manual fallback, dependent-city reset and stale-response protection; no third-party requests.');
