'use strict';
(async()=>{
const langs=["en","ar","tr","fr","es","de","it","pt","nl","ru","uk","pl","cs","ro","hu","el","sv","da","no","fi","bg","sr","hr","he","fa","ur","hi","bn","id","ms","zh","ja"],rtl=new Set(["ar","he","fa","ur"]);
const q=new URLSearchParams(location.search),nav=(navigator.languages||[navigator.language]).map(x=>x.toLowerCase().split('-')[0]).map(x=>["nb","nn"].includes(x)?"no":x);
const lang=(q.get('lang')&&langs.includes(q.get('lang'))?q.get('lang'):nav.find(x=>langs.includes(x)))||'en';
document.documentElement.lang=lang;document.documentElement.dir=rtl.has(lang)?'rtl':'ltr';
let all={};try{all=await fetch('manual-order-locales.json',{cache:'no-store'}).then(r=>r.json());}catch{}
const t=all[lang]||all.en||{};
for(const node of document.querySelectorAll('[data-k]')){const k=node.dataset.k;if(t[k])node.textContent=t[k];}
document.getElementById('title').textContent=t.product_title||'Travel Agent Templates & Client Kit';
document.getElementById('cover').src='assets/covers/'+lang+'/travel-kit.svg';document.getElementById('cover').alt=t.product_title||'Travel Agent Templates & Client Kit';
document.getElementById('back-link').href='travel-kit.html?lang='+encodeURIComponent(lang);if(t.back)document.getElementById('back-link').textContent=t.back;
document.getElementById('sales-link').href=lang+'/distance-sales.html';
document.getElementById('privacy-link').href=lang+'/checkout-privacy.html';
const note=document.getElementById('note');note.textContent=t.order_note||'Your order details are sent privately to HORIZONS. No payment is charged on this page. We will contact you by email to confirm payment, then send the download link manually after payment verification.';
const extra=document.getElementById('success-extra');extra.textContent=t.order_note||note.textContent;
const form=document.getElementById('manual-order-form'),company=form.querySelector('[data-company]'),status=document.getElementById('form-status'),submit=form.querySelector('button[type=submit]');
function syncCompany(){const on=form.elements.billing.value==='company';company.hidden=!on;for(const x of company.querySelectorAll('input')){x.required=on;x.disabled=!on;}}syncCompany();form.elements.billing.addEventListener('change',syncCompany);
let csrf='';try{const r=await fetch('/manual-order-api/',{credentials:'same-origin',cache:'no-store'}),j=await r.json();if(j.ok)csrf=j.csrf;}catch{}
const requestId=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
form.addEventListener('submit',async ev=>{
 ev.preventDefault();status.textContent='';if(!form.reportValidity())return;
 if(form.elements.email.value.trim().toLowerCase()!==form.elements.email_confirm.value.trim().toLowerCase()){status.textContent=t.error||'Please confirm the same email address.';return;}
 if(!csrf){status.textContent=t.error||'Service unavailable.';return;}
 submit.disabled=true;status.textContent=t.working||'Saving…';
 const fd=new FormData(form),buyer={first_name:fd.get('first_name').trim(),last_name:fd.get('last_name').trim(),email:fd.get('email').trim(),email_confirm:fd.get('email_confirm').trim(),phone:fd.get('phone').trim(),country:fd.get('country').trim(),city:fd.get('city').trim(),billing:fd.get('billing')};
 if(buyer.billing==='company'){buyer.company_name=fd.get('company_name').trim();buyer.tax_id=fd.get('tax_id').trim();buyer.tax_office=fd.get('tax_office').trim();}
 try{
  const r=await fetch('/manual-order-api/',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},credentials:'same-origin',cache:'no-store',body:JSON.stringify({request_id:requestId,product:'travel-agent-client-kit',offer:'single-business',buyer,terms_accepted:form.elements.terms.checked,privacy_read:form.elements.privacy.checked,locale:lang})});
  const j=await r.json();if(!r.ok||j.ok!==true||!/^HZN-M-/.test(j.reference))throw Error();
  form.hidden=true;const success=document.getElementById('success');document.getElementById('reference').textContent=j.reference;success.hidden=false;success.focus();
 }catch{status.textContent=t.error||'Unable to save. Please try again.';submit.disabled=false;}
});
})();