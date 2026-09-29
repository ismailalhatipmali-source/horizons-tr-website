import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loginPassword,verifyCode} from '../src/workbook-web/license-core.js';

const html=await readFile(new URL('../src/workbook-web/index.html',import.meta.url),'utf8');
const locales=JSON.parse(await readFile(new URL('../src/workbook-web/web-locales.json',import.meta.url),'utf8'));
const manifest=JSON.parse(await readFile(new URL('../release-assets/1.4.2/files/learn/asset-manifest.json',import.meta.url),'utf8'));
const base=fileURLToPath(new URL('../release-assets/1.4.2/files/learn/',import.meta.url));

test('the visible flows offer password sign-in and email-code recovery without storing passwords',()=>{
  for(const id of ['password-form','login-email','login-password','password-submit','code-option','email-form','code-form','new-password','confirm-password'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/autocomplete="current-password"/);
  assert.match(html,/autocomplete="one-time-code"/);
  assert.match(html,/autocomplete="new-password"/);
  assert.equal(html.includes('value="correct horse'),false);
  for(const lang of ['ar','en','tr'])for(const key of ['password','signIn','codeOption','newPassword','confirmPassword','passwordInvalid','passwordMismatch','deviceConflict'])assert.ok(locales[lang][key],`${lang}.${key}`);
});

test('invalid password and email are rejected before device identity or a network request',async()=>{
  await assert.rejects(loginPassword({email:'not an email',password:'correct horse 2026'}),/INVALID_EMAIL/);
  await assert.rejects(loginPassword({email:'adult@example.test',password:'short'}),/PASSWORD_WEAK/);
  await assert.rejects(loginPassword({email:'adult@example.test',password:'🙂'.repeat(80)}),/PASSWORD_WEAK/);
  await assert.rejects(verifyCode({challenge_id:'x',code:'12',new_password:'correct horse 2026'}),/OTP_INVALID/);
});

test('web 1.4.2 reuses the signed-content archive versions without changing paid lessons',async()=>{
  assert.equal(manifest.version,'1.4.2');
  assert.deepEqual(manifest.content_versions,['1.4.0','1.4.1']);
  const {createHash}=await import('node:crypto');
  let count=0;
  for(const item of Object.values(manifest.files)){
    if(!item.url.startsWith('content/1.4.1/'))continue;
    const raw=await readFile(base+item.url);
    assert.equal(raw.length,item.bytes);
    assert.equal(createHash('sha256').update(raw).digest('hex'),item.sha256);
    count++;
  }
  assert.ok(count>0);
});
