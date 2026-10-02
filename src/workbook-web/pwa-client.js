import {refreshMembership,signOut} from './license-core.js';
import {VERSION} from './web-config.js';
import {dictionaries,translate,workerMessage,installControl,normalizeLanguage} from './web-ui.js';
// This module is loaded only by the protected web edition, never by Windows.
const ROOT=new URL('./',import.meta.url);
const [portal,words]=await dictionaries();
const lang=()=>document.documentElement.lang||'en';
const w=(key,v)=>translate(words,lang(),key,v);
const t=key=>translate(portal,lang(),key);
const worker=()=>navigator.serviceWorker.controller;
window.HORIZONS_OFFLINE={prepare:async(group,progress)=>{await navigator.storage?.persist?.();return workerMessage(worker(),{type:'cache-group',group,version:VERSION},progress)}};
const toolbar=document.createElement('span');toolbar.className='hzn-account-links';
const account=document.createElement('a'),install=document.createElement('button');install.className='text-button';toolbar.append(account,install);
const help=document.createElement('p');help.className='preview-note';help.hidden=true;
document.querySelector('.top-actions').append(toolbar);document.querySelector('main').append(help);
function localize(){account.textContent=w('accountDownloads');account.href=new URL('index.html?lang='+lang(),ROOT);install.textContent=w('install');if(help.dataset.installHelp)help.textContent=w(help.dataset.installHelp);if(help.dataset.updateReady)help.textContent=w('updateReady');}
let requestedLanguage=normalizeLanguage(new URL(location.href).searchParams.get('lang'));
function followLanguage(){localize();const select=document.querySelector('#locale');if(requestedLanguage&&select&&typeof select.onchange==='function'&&document.querySelector('#lesson-title')?.textContent){const requested=requestedLanguage;requestedLanguage=null;if(select.value!==requested){select.value=requested;select.dispatchEvent(new Event('change',{bubbles:true}))}}}
followLanguage();installControl(install,help,w);new MutationObserver(followLanguage).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
let locked=false;
async function access(){try{const state=await workerMessage(worker(),{type:'access-state'});if(state.activated)return;if(locked)return;locked=true;window.dispatchEvent(new Event('horizons-access-ended'));document.querySelectorAll('main').forEach(x=>{x.hidden=true;x.inert=true});const box=document.createElement('section');box.className='hzn-web-access-ended';box.setAttribute('role','alert');box.style.cssText='max-width:800px;margin:24px auto;padding:24px;background:white;border:1px solid #ccd8d8;border-radius:16px';const p=document.createElement('p');p.textContent=t('expired');const back=document.createElement('a');back.href=new URL('index.html?lang='+lang(),ROOT);back.textContent=t('title');const exp=document.createElement('a');exp.href='api/learners/export';exp.download='HORIZONS-learners-backup.json';exp.textContent=t('export');exp.style.marginInlineStart='24px';box.append(p,back,exp);document.querySelector('.topbar').after(box);}catch{}}
setInterval(access,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)access()});access();
navigator.serviceWorker.getRegistration(ROOT.href).then(reg=>{reg?.update().catch(()=>{});if(reg?.waiting){help.dataset.updateReady='true';help.hidden=false;help.textContent=w('updateReady')}}).catch(()=>{});

async function renewMembership(){try{await refreshMembership()}catch(e){if(e.message==='ENTITLEMENT_EXPIRED')await signOut()}await access();}
setInterval(()=>renewMembership().catch(()=>{}),15*60000);addEventListener('online',()=>renewMembership().catch(()=>{}));renewMembership().catch(()=>{});
