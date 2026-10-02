import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire('/tmp/horizons-demo-tools/package.json')('jsdom');
const html=await readFile('src/workbook-web/index.html','utf8');
const source=(await readFile('src/workbook-web/membership-ui.js','utf8')).replace(/^import .*;\n/gm,'').replaceAll('export async function','async function').replaceAll('export function','function');
const web=JSON.parse(await readFile('src/workbook-web/web-locales.json','utf8')),portal=JSON.parse(await readFile('src/workbook-web/portal-locales.json','utf8'));
for(const language of Object.keys(web)){
 const dom=new JSDOM(html,{url:'https://example.test/learn/',runScripts:'outside-only'}),w=dom.window,d=w.document,calls=[];
 w.setInterval=()=>0;w.mountMembershipManager=()=>({destroy(){}});w.refreshMembership=async()=>null;w.requestMembership=async()=>({});w.signOut=async()=>{};
 w.checkMembershipCode=async input=>{calls.push(['check',input]);return {setup_token:'a'.repeat(64)}};w.setupMembershipPassword=async input=>{calls.push(['setup',input]);};w.resendMembershipCode=async email=>calls.push(['resend',email]);
 w.web=web;w.portal=portal;w.eval(source+';configureMembershipLocales(portal,web);window.initMembership=initializeMembershipUI;window.renderMembership=updateMembershipUI;');await w.initMembership(async()=>{},()=>language);w.renderMembership({activated:false},language);
 for(const label of d.querySelectorAll('[data-m]')){assert.ok(label.textContent.trim(),language+': '+label.dataset.m);assert.equal(label.lang,language);}
 d.getElementById('membership-email').value='member@example.test';d.getElementById('membership-code').value='12345678';const code=d.getElementById('membership-code-form'),password=d.getElementById('membership-password-form');
 assert.equal(password.hidden,true);code.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(calls[0][0],'check');assert.equal(code.hidden,true);assert.equal(password.hidden,false);
 d.getElementById('membership-password').value='Strong password 2026';d.getElementById('membership-confirm').value='Mismatch password';password.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(calls.length,1);
 d.getElementById('membership-confirm').value='Strong password 2026';password.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(calls[1][0],'setup');assert.equal(d.getElementById('membership-password').value,'');assert.equal(d.getElementById('membership-confirm').value,'');assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);dom.window.close();
}
console.log('PASS: All 32 languages: code-before-password flow, matching passwords, cleared secrets, no browser credential storage.');
