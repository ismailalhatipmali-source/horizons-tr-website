import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{JSDOM}=require('jsdom');
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog=JSON.parse(read('src/commerce/products.json'));
const dom=new JSDOM(read('src/admin/index.html'),{url:'https://horizons-tr.com/admin/',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
let authed=true,order=null,calls=[];
w.fetch=async(url,opt={})=>{const input=opt.body?JSON.parse(opt.body):{},a=input.action||new URL(url,w.location.href).searchParams.get('action');calls.push(a);let result={ok:true};
 if(a==='state')result={...result,authenticated:authed,csrf:'mock-csrf',catalog,margin_bps:300};
 if(a==='orders')result.orders=order?[order]:[];
 if(a==='quote'){const offer=catalog.products[input.product].offers.find(o=>o.id===input.offer);result.quote={product:input.product,offer:input.offer,base_minor:offer.price_minor,currency:input.currency,amount_minor:offer.price_minor,source:'USD catalog',margin_bps:0,rate_date:'2026-10-02',expires_at:Math.floor(Date.now()/1000)+900,token:'fixture'};}
 if(a==='create_order'){order={id:'HZN-A-TEST',status:'awaiting_payment',data:{buyer:input,offer:catalog.products[input.product].offers.find(o=>o.id===input.offer),quote:{amount_minor:999,currency:'USD'}}};result.order=order;}
 if(a==='record_payment'){assert.equal(input.amount_minor,999);order.status='paid';result.order=order;}
 if(a==='record_invoice'){order.status='invoice_recorded';order.data.invoice=input.invoice;result.order=order;}
 if(a==='fulfil'){order.status='fulfilled';result.order=order;}
 if(a==='customers')result.customers=[];if(a==='audit')result.events=[];
 if(a==='logout')authed=false;
 return {ok:true,json:async()=>result};};
const tick=()=>new Promise(r=>setTimeout(r,0)),submit=f=>f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
w.eval(read('src/admin/admin.js'));await tick();assert.equal(d.getElementById('dashboard').hidden,false);
d.getElementById('new-top').click();await tick();const f=d.getElementById('new-form');assert.equal(f.elements.offer.options.length,7);assert.equal(f.elements.locale.options.length,32);
for(const [k,v]of Object.entries({name:'<img src=x onerror=alert(1)>',email:'synthetic@example.test',email_confirm:'synthetic@example.test',phone:'+905550000000',city:'Istanbul',address:'Example address'}))f.elements[k].value=v;f.elements.customer_confirmed.checked=true;submit(f);await tick();assert.equal(d.querySelector('#confirm-body img'),null,'Escaped customer content');assert.equal(calls.filter(x=>x==='create_order').length,0,'No side effect before explicit confirm');d.getElementById('confirm-yes').click();await tick();assert(d.getElementById('payment-form'));
const p=d.getElementById('payment-form');p.elements.bank_reference.value='BANK-TEST-001';p.elements.amount.value='9.99';p.elements.verified.checked=true;submit(p);await tick();d.getElementById('confirm-yes').click();await tick();
const inv=d.getElementById('invoice-form');assert(inv);inv.elements.invoice.value='INV-TEST-0001';inv.elements.issued.checked=true;submit(inv);await tick();d.getElementById('confirm-yes').click();await tick();
const fulfill=d.getElementById('fulfil-form');fulfill.elements.email.value='synthetic@example.test';fulfill.elements.confirmed.checked=true;submit(fulfill);await tick();d.getElementById('confirm-yes').click();await tick();assert(d.getElementById('resend'));
assert.deepEqual(calls.filter(x=>['create_order','record_payment','record_invoice','fulfil'].includes(x)),['create_order','record_payment','record_invoice','fulfil']);
d.getElementById('logout').click();await tick();assert.equal(d.getElementById('dashboard').hidden,true);assert.equal(d.getElementById('detail').textContent,'');assert.equal(f.elements.email.value,'');assert.equal(w.localStorage.length,0);
dom.window.close();console.log('PASS: admin four-step workflow, explicit confirmations, escaping, 32 mail locales, logout clears private UI; mock API only.');
