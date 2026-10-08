import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {JSDOM} from './node_modules/jsdom/lib/api.js';
const template=readFileSync(new URL('../src/theory-reference/paid-reader-loader.html',import.meta.url),'utf8');
const script=template.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/import .*?;\n/,'');
const sample=new TextEncoder().encode('<html><head></head><body>Only synthetic licensed test</body></html>');
const bytes=new Uint8Array([1,2,3,4]);
const sha=[...new Uint8Array(await webcrypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
const meta={url:'/reference/synthetic.html.hzn',bytes:4,sha256:sha,decoded_bytes:sample.length};
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
async function run({expired=false,damaged=false,changed=false}={}){
 const dom=new JSDOM('<body><p id="pending">waiting</p></body>',{url:'https://example.test/reference/paid.html'});
 const redirects=[],timers=[],events=[];let accesses=0,decryptions=0;const key={};
 const location={search:'?lang=tr&chapter=pronouns',origin:'https://example.test',replace:x=>redirects.push(x)};
 const fn=new AsyncFunction('getAccess','decryptAsset','crypto','fetch','location','document','addEventListener','setInterval','URL','URLSearchParams','TextDecoder',script.replace('__HZN_REFERENCE_METADATA__',JSON.stringify(meta)));
 await fn(async()=>{accesses++;if(expired)throw Error('EXPIRED');return {key:changed&&accesses>1?{}:key}},async(path,encrypted,m)=>{decryptions++;assert.equal(path,'theory-reference.html');assert.equal(m.encoding,'gzip');assert.equal(m.decoded_bytes,sample.length);return sample.buffer},webcrypto,async(url,opts)=>{assert.equal(url,meta.url);assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');return {ok:true,arrayBuffer:async()=>damaged?new Uint8Array([4,3,2,1]).buffer:bytes.buffer}},location,dom.window.document,(name,callback)=>events.push({name,callback}),(callback,time)=>timers.push({callback,time}),URL,URLSearchParams,TextDecoder);
 return {dom,redirects,timers,accesses,decryptions};
}
const good=await run();const frame=good.dom.window.document.querySelector('iframe');assert.ok(frame);assert.equal(frame.getAttribute('sandbox').includes('allow-same-origin'),false);assert.ok(frame.srcdoc.includes('window.HZN_REFERENCE_QUERY="lang=tr&chapter=pronouns"'));assert.equal(good.redirects.length,0);assert.equal(good.timers[0].time,15000);assert.equal(good.dom.window.localStorage.length,0);
for(const settings of [{expired:true},{damaged:true},{changed:true}]){const result=await run(settings);assert.equal(result.dom.window.document.querySelector('iframe'),null);assert.equal(result.redirects.length,1);assert.ok(result.redirects[0].includes('ACTIVATION_REQUIRED'));if(settings.expired||settings.damaged)assert.equal(result.decryptions,0);}
console.log('PASS: licensed reader success, opaque sandbox, no plaintext storage, expired access, damaged ciphertext and account change');
