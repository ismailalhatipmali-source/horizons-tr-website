import {resendMembershipCode,checkMembershipCode,setupMembershipPassword,refreshMembership,requestMembership,signOut} from './license-core.js';
import {mountMembershipManager} from './membership-manager.js';
let dictionaries={};
// Build all account labels from the same checked locale files as the shell.
export function configureMembershipLocales(portal,web){
 const shared={email:'email',verified:'emailVerified',password:'password',confirm_password:'confirmPassword',title:'membershipTitle',add:'addLearner',email_confirm:'emailConfirm',permanent_warning:'permanentWarning',permanent_consent:'permanentConsent',remove:'removeLearner',remove_warning:'removeWarning',cancel:'cancel',removed:'removed',invited:'invited',error:'actionError',mismatch:'passwordMismatch',working:'checking',back:'activationBack',continue:'confirm'};
 dictionaries=Object.fromEntries(Object.keys(web).map(lang=>[lang,{...Object.fromEntries(Object.entries(shared).map(([key,value])=>[key,web[lang][value]])),activate:portal[lang].title,code:portal[lang].code,done:portal[lang].activated,resend:portal[lang].resend,sent:portal[lang].sent}]));
}

const $=id=>document.getElementById(id);let setupToken='',manager=null,managerLanguage='',getLanguage=()=>document.documentElement.lang,busy=false;
const words=()=>dictionaries[getLanguage()]||dictionaries.en;
function status(key){const el=$('status');el.textContent=words()[key];el.dataset.membershipStatus=key;delete el.dataset.uiStatus;el.className=['error','mismatch'].includes(key)?'error':'';}
export function updateMembershipUI(state,lang){
 const labels=dictionaries[lang]||dictionaries.en;if(!labels)return;const statusKey=$('status')?.dataset.membershipStatus;if(statusKey)$('status').textContent=labels[statusKey];document.querySelectorAll('[data-m]').forEach(n=>{n.textContent=labels[n.dataset.m];n.lang=dictionaries[lang]?lang:'en';});
 const host=$('membership-manager');if(!host)return;host.hidden=!(state.activated&&state.license?.schema===4);
 if(host.hidden){manager?.destroy();manager=null;return;}
 if(!manager||managerLanguage!==lang){manager?.destroy();managerLanguage=lang;host.lang=dictionaries[lang]?lang:'en';manager=mountMembershipManager(host,{list:()=>requestMembership('list'),invite:x=>requestMembership('invite',x),remove:member_id=>requestMembership('remove',{member_id})},labels);}
}
export async function initializeMembershipUI(refresh,language){
 getLanguage=language;
 async function run(form,fn){if(busy)return;busy=true;const buttons=[...form.querySelectorAll('button')];buttons.forEach(x=>x.disabled=true);status('working');try{await fn();}catch{status('error');}finally{busy=false;buttons.forEach(x=>x.disabled=false);}}
 $('membership-resend').onclick=()=>{if(!$('membership-email').reportValidity())return;run($('membership-code-form'),async()=>{await resendMembershipCode($('membership-email').value.trim());status('sent');});};
 $('membership-back').onclick=()=>{if(busy)return;setupToken='';$('membership-password').value='';$('membership-confirm').value='';$('membership-password-form').hidden=true;$('membership-code-form').hidden=false;$('membership-code').focus();};
 $('membership-code-form').onsubmit=e=>{e.preventDefault();run(e.currentTarget,async()=>{const r=await checkMembershipCode({email:$('membership-email').value.trim(),code:$('membership-code').value.trim()});setupToken=r.setup_token;$('membership-code').value='';$('membership-code-form').hidden=true;$('membership-password-form').hidden=false;status('verified');$('membership-password').focus();});};
 $('membership-password-form').onsubmit=e=>{e.preventDefault();if($('membership-password').value!==$('membership-confirm').value)return status('mismatch');run(e.currentTarget,async()=>{try{await setupMembershipPassword({setup_token:setupToken,new_password:$('membership-password').value});setupToken='';$('membership-password-form').hidden=true;await refresh();status('done');$('open').focus();}finally{$('membership-password').value='';$('membership-confirm').value='';}});};
 async function renew(){try{await refreshMembership();}catch(e){if(e.message==='ENTITLEMENT_EXPIRED')await signOut();}await refresh();}
 addEventListener('online',()=>renew().catch(()=>{}));document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine)renew().catch(()=>{});});setInterval(()=>{if(navigator.onLine)renew().catch(()=>{});},15*60000);
 try{await refreshMembership();}catch(e){if(e.message==='ENTITLEMENT_EXPIRED')await signOut();}
}
