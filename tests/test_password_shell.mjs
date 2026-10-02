// Run with node --experimental-vm-modules --test tests/test_password_shell.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function shellFixture(){
  const calls=[],elements=new Map(),worker={};let activated=false;
  const element=id=>{
    if(!elements.has(id))elements.set(id,{id,value:'',textContent:'',className:'',hidden:id==='active'||id==='code-form',open:false,disabled:false,
      focus(){this.focused=true},append(){}});
    return elements.get(id);
  };
  const document={documentElement:{},getElementById:element,querySelectorAll:()=>[],createElement:()=>({}),addEventListener:()=>{}};
  const context=vm.createContext({document,navigator:{serviceWorker:{controller:worker},onLine:true},location:{href:'https://example.test/learn/'},
    localStorage:{setItem:()=>{}},URL,Intl,Date,Error,Promise,Map,Object,Array,String,Number,console,
    addEventListener:()=>{},confirm:()=>true});
  const modules={};
  async function synthetic(id,values){modules[id]=new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value)},{context,identifier:id});}
  await synthetic('./license-core.js',{
    requestCode:async input=>{calls.push(['request',input]);return {challenge_id:'c'.repeat(48)}},
    verifyCode:async input=>{calls.push(['verify',input]);activated=true},
    loginPassword:async input=>{calls.push(['password',input]);if(input.password==='wrong password 2026')throw Error('PASSWORD_INVALID');activated=true},
    getState:async()=>({activated,error:null,license:activated?{purchase_email:'adult@example.test',plan:'lifetime',expires_at:null}:null}),
    signOut:async()=>{activated=false},
  });
  await synthetic('./membership-ui.js',{initializeMembershipUI:async()=>{},updateMembershipUI:()=>{}});
  await synthetic('./web-config.js',{VERSION:'1.4.2'});
  await synthetic('./web-ui.js',{
    names:{en:'English'},language:()=> 'en',dictionaries:async()=>[{en:{}},{en:{}}],translate:(_d,_l,key)=>key,
    registerWorker:async()=>({active:worker,waiting:null}),workerMessage:async()=>({savedFiles:0,totalFiles:1,savedBytes:0}),installControl:()=>{},
  });
  const shell=new vm.SourceTextModule(await readFile(new URL('../src/workbook-web/shell.js',import.meta.url),'utf8'),{context,identifier:'shell.js'});
  await shell.link(id=>modules[id]);await shell.evaluate();
  for(let n=0;n<20;n++)await Promise.resolve();
  return {element,calls};
}

const submit=()=>({preventDefault(){}});

test('password form activates without an email code and clears the password field',async()=>{
  const {element,calls}=await shellFixture();
  element('login-email').value=' adult@example.test ';
  element('login-password').value='correct horse 2026';
  await element('password-form').onsubmit(submit());
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['password',{email:'adult@example.test',password:'correct horse 2026'}]]);
  assert.equal(element('login-password').value,'');
  assert.equal(element('active').hidden,false);
  assert.equal(element('activation').hidden,true);
  assert.equal(element('open').focused,true);
});

test('wrong password stays on sign-in and displays an explicit recovery hint',async()=>{
  const {element}=await shellFixture();
  element('login-email').value='adult@example.test';element('login-password').value='wrong password 2026';
  await element('password-form').onsubmit(submit());
  assert.equal(element('status').textContent,'passwordInvalid');
  assert.equal(element('activation').hidden,false);
  assert.equal(element('login-password').value,'');
});

test('email-code recovery confirms matching new password and never reuses a stale challenge',async()=>{
  const {element,calls}=await shellFixture();
  element('login-email').value='adult@example.test';element('code-option').open=true;element('code-option').ontoggle();
  assert.equal(element('email').value,'adult@example.test');
  await element('email-form').onsubmit(submit());
  assert.equal(element('code-form').hidden,false);
  element('code').value='12345678';element('new-password').value='new password 2026';element('confirm-password').value='wrong password';
  await element('code-form').onsubmit(submit());
  assert.equal(element('status').textContent,'passwordMismatch');
  assert.equal(calls.filter(c=>c[0]==='verify').length,0);
  element('confirm-password').value='new password 2026';await element('code-form').onsubmit(submit());
  assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))),['verify',{challenge_id:'c'.repeat(48),code:'12345678',new_password:'new password 2026'}]);
  assert.equal(element('new-password').value,'');assert.equal(element('confirm-password').value,'');
  assert.equal(element('active').hidden,false);
  element('email').oninput();assert.equal(element('code-form').hidden,true);
});
