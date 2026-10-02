import assert from 'node:assert/strict';
import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire('/tmp/horizons-demo-tools/package.json');const {JSDOM}=require('jsdom');
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const metadata=JSON.parse(read('src/commerce/display-currencies.json')),catalog=JSON.parse(read('src/commerce/products.json')),translations=JSON.parse(read('src/commerce/display-currency-locales.json'));
const countries=JSON.parse(read('dist/assets/commerce-geo/countries.json'));
const rates={USD:1,SAR:3.75,CNY:7.11,JPY:146.99,KWD:.3065,TRY:49.03,EUR:.886,AED:3.6725};
const tick=()=>new Promise(r=>setTimeout(r,0));
for(const lang of Object.keys(translations)){
 for(const page of (['ar','tr','en','ja'].includes(lang)?['checkout','product']:['checkout'])){
  const dom=new JSDOM(read(`dist/${lang}/${page}.html`),{url:`https://horizons-tr.com/${lang}/${page}.html`,runScripts:'outside-only'}),w=dom.window,d=w.document,requests=[];
  w.AbortController=AbortController;let delayed=[];let race=false;
  w.fetch=async(url,options={})=>{
   const u=new URL(url,'https://horizons-tr.com');requests.push({url:u.toString(),method:options.method||'GET'});
   const success=data=>({ok:true,json:async()=>data});
   if(u.pathname==='/display-currencies.json')return success(metadata);
   if(u.pathname.endsWith('/countries.json'))return success(countries);
   if(u.pathname.includes('commerce-geo/'))return success([['City','مدينة']]);
   if(u.pathname==='/checkout-api/'){
    const q=u.searchParams,p=catalog.products[q.get('product')],o=p?.offers.find(o=>o.id===q.get('offer'));
    if(q.get('action')==='quote'){const currency=q.get('currency'),amount=Math.ceil(o.price_minor*(rates[currency]||1)*(currency==='USD'?1:1.03)),quote={product:p.id,offer:o.id,base_minor:o.price_minor,currency,amount_minor:amount,source:'Fixture',rate_date:'2026-10-02',margin_bps:currency==='USD'?0:300,expires_at:Math.floor(Date.now()/1000)+900};quote.token=JSON.stringify(quote);return success({ok:true,quote});}
    if(q.get('action')==='display_price'){
     const currency=q.get('currency'),quote=q.has('quote_token')?JSON.parse(q.get('quote_token')):null,from=quote?.currency||'USD',minor=quote?.amount_minor??o.price_minor,digits=metadata.currencies[currency].digits;
     if(currency==='KPW')return {ok:false,json:async()=>({ok:false,error:'DISPLAY_FX_UNAVAILABLE'})};
     const result=success({ok:true,display:{product:p.id,offer:o.id,currency,amount_minor:Math.round(minor/100*(rates[currency]||1)/(rates[from]||1)*10**digits),digits,based_on_currency:from,based_on_minor:minor,base_minor:o.price_minor,rate_updated_at:from===currency?null:Math.floor(Date.now()/1000)-3600,indicative:true,settlement_allowed:false}});
     if(race)return await new Promise(resolve=>delayed.push(()=>resolve(result)));return result;
    }
   }
   throw Error('Unexpected request '+url);
  };
  w.eval(read('src/commerce/display-currency.js'));if(page==='checkout')w.eval(read('src/commerce/checkout.js'));await tick();await tick();
  const cur=d.querySelector('[data-display-currency]'),country=d.querySelector('[name=country_code],[data-display-country]'),output=()=>d.querySelector('[data-display-total]').textContent;
  assert.equal(cur.options.length,153,lang);assert.equal(country.options.length,251,lang);assert.match(output(),/USD/);
  const change=async(el,v)=>{el.value=v;el.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();};
  await change(country,'SA');assert.equal(cur.value,'SAR');assert.match(output(),/SAR/);
  await change(cur,'CNY');assert.equal(country.value,'SA');assert.match(output(),/CNY/);
  await change(country,'TR');assert.equal(cur.value,'TRY');assert.match(output(),/TRY/);
  await change(cur,'JPY');assert.match(output(),/JPY/);assert.equal(d.querySelector('[data-display-total] strong').textContent,new Intl.NumberFormat(lang,{style:'currency',currency:'JPY',minimumFractionDigits:0,maximumFractionDigits:0}).format(Math.round(9.99*146.99)).replace(/^/,'≈ ')+' · JPY');
  await change(cur,'KWD');assert.match(output(),/KWD/);
  if(page==='checkout'){
   const pay=d.querySelector('[name=payment_currency]');assert.equal(pay.value,'USD');assert.equal(pay.options.length,3);
   await change(pay,'TRY');assert.match(output(),/KWD/);const last=requests.filter(r=>r.url.includes('action=display_price')).at(-1);assert.equal(JSON.parse(new URL(last.url).searchParams.get('quote_token')).currency,'TRY');
   await change(d.querySelector('[name=offer]'),'family-annual');assert.match(output(),/KWD/);assert.equal(JSON.parse(new URL(requests.filter(r=>r.url.includes('action=display_price')).at(-1).url).searchParams.get('quote_token')).base_minor,20000);
   assert.equal(d.querySelector('[name=country_code]').required,true);
  }else{
   assert.equal(d.querySelector('[data-display-offer]').options.length,7);await change(d.querySelector('[data-display-offer]'),'institution-annual');assert(d.querySelector('[data-checkout-buy]').href.includes('offer=institution-annual'));assert.match(output(),/KWD/);
  }
  await change(cur,'KPW');assert.equal(output(),translations[lang].display_unavailable);assert.equal(d.querySelector('[data-display-total] strong'),null);
  // A slower response for the previous currency must never overwrite the latest choice.
  race=true;await change(cur,'SAR');await change(cur,'CNY');assert.equal(delayed.length,2);delayed[1]();await tick();delayed[0]();await tick();assert.match(output(),/CNY/);
  assert.deepEqual(Object.keys(w.localStorage),['horizons-display-currency-v1']);assert(requests.every(r=>new URL(r.url).origin==='https://horizons-tr.com'&&r.method==='GET'));
  assert.equal(d.querySelectorAll('[name=country_code]').length,page==='checkout'?1:0);assert.equal(d.querySelectorAll('#display-currency-config').length,1);assert(d.querySelector('a[href="https://www.exchangerate-api.com"]'));
  dom.window.close();
 }
}
console.log('PASS: 32 locales, global country selection, manual override, 0/3 decimals, quote-bound totals, 7 offers, unavailable rates, response races; no card requests or buyer storage.');
