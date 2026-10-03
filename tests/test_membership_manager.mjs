import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
const {JSDOM}=createRequire('/tmp/horizons-demo-tools/package.json')('jsdom');
const source=(await readFile('src/commerce/membership-manager.js','utf8')).replace('export function','function');
const labels={title:'Learners',email:'Email',email_confirm:'Confirm email',add:'Invite',remove:'Remove',cancel:'Cancel',permanent_warning:'Email cannot be replaced',permanent_consent:'I understand',remove_warning:'Revoke learner access?',removed:'Removed',invited:'Invitation queued',error:'Unavailable'};
for(const type of ['individual','family','institution']) {
 const dom=new JSDOM('<div id="host"></div>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window,d=w.document;w.eval(source+';window.mount=mountMembershipManager');
 const learners=[{id:'owner',email:'owner@example.test'}],calls=[];
 const api={async list(){return {account_type:type,max_learners:{individual:1,family:5,institution:500}[type],can_manage:true,learners:[...learners]};},async invite(v){calls.push(v);learners.push({id:'new',email:v.email});},async remove(id){calls.push(id);learners.splice(learners.findIndex(x=>x.id===id),1);}};
 const component=w.mount(d.getElementById('host'),api,labels);await component.refresh();const form=d.querySelector('form'),[email,confirm]=form.querySelectorAll('input[type=email]');
 if(type==='individual'){assert.equal(form.hidden,true);assert.equal(d.querySelector('li button'),null);}
 else {
  const submit=()=>form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  email.value='learner@example.test';confirm.value='wrong@example.test';submit();assert.equal(calls.length,0);
  confirm.value=email.value;confirm.dispatchEvent(new w.Event('input'));submit();
  if(type==='family'){assert.equal(calls.length,0);assert.equal(d.querySelector('li button'),null);form.querySelector('input[type=checkbox]').checked=true;submit();}
  await new Promise(r=>setTimeout(r,0));assert.equal(calls.length,1);assert.equal(calls[0].email,'learner@example.test');
  assert.equal(email.value,'');assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);
  if(type==='institution'){
   const remove=d.querySelector('li button');remove.click();assert.equal(calls.length,1);const controls=d.querySelectorAll('li:first-child button');controls[2].click();assert.equal(calls.length,1);remove.click();controls[1].click();await new Promise(r=>setTimeout(r,0));assert.equal(calls[1],'owner');
  }
 }
 component.destroy();dom.window.close();
}
console.log('PASS: independent integration UI: individual hides invites; family needs permanent-email consent and has no remove button; institution requires explicit removal confirmation; no email storage.');
