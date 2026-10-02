// Bank review only. Buyer data stays in memory until the explicit save action.
(() => {
  'use strict';
  const node=document.getElementById('checkout-config'); if(!node)return;
  const {catalog,words:t}=JSON.parse(node.textContent),lang=document.documentElement.lang;
  const root=document.querySelector('[data-checkout]'),form=root.querySelector('form'),review=root.querySelector('[data-checkout-review]');
  const productSelect=form.elements.product,offerSelect=form.elements.offer,country=form.elements.country_code;
  const payment=root.querySelector('[data-final-submit]'),status=root.querySelector('[data-checkout-status]');
  const money=o=>new Intl.NumberFormat(lang,{style:'currency',currency:o.currency}).format(o.price_minor/100);
  let selected=null,requestId='',busy=false,recorded=false,csrf='',cityRequest=0,cities=[],quote=null,quoteTicket=0;
  const quoteMarkup=target=>{target.replaceChildren();if(!quote)return;const title=document.createElement('p'),sum=document.createElement('strong'),details=document.createElement('p');title.textContent=t.fx_total;sum.textContent=new Intl.NumberFormat(lang,{style:'currency',currency:quote.currency}).format(quote.amount_minor/100);sum.dir='ltr';details.className='commerce-small';const values={source:quote.source,date:quote.rate_date,margin:quote.margin_bps/100,until:new Intl.DateTimeFormat(lang,{hour:'2-digit',minute:'2-digit'}).format(new Date(quote.expires_at*1000))};details.textContent=t.fx_details.replace(/\{(\w+)\}/g,(_,k)=>values[k]??'');target.append(title,sum,details);};
  async function refreshQuote(){if(busy||recorded||!selected)return;const ticket=++quoteTicket;quote=null;requestId='';document.dispatchEvent(new CustomEvent('horizons-price-selection',{detail:{product:selected.product.id,offer:selected.offer.id,base_minor:selected.offer.price_minor,pending:true}}));form.querySelector('button[type="submit"]').disabled=true;root.querySelector('[data-fx-quote]').textContent=t.working;root.querySelector('[data-summary-quote]').replaceChildren();
    try{const q=new URLSearchParams({action:'quote',product:selected.product.id,offer:selected.offer.id,currency:form.elements.payment_currency.value});const response=await fetch('/checkout-api/?'+q,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});const data=await response.json();if(ticket!==quoteTicket)return;if(!response.ok||data.ok!==true||data.quote?.base_minor!==selected.offer.price_minor||data.quote?.product!==selected.product.id||data.quote?.offer!==selected.offer.id||data.quote?.currency!==form.elements.payment_currency.value||!Number.isSafeInteger(data.quote.amount_minor)||data.quote.amount_minor<1||data.quote.expires_at*1000<=Date.now())throw Error();quote=data.quote;document.dispatchEvent(new CustomEvent('horizons-price-selection',{detail:{product:selected.product.id,offer:selected.offer.id,base_minor:selected.offer.price_minor,quote}}));quoteMarkup(root.querySelector('[data-fx-quote]'));quoteMarkup(root.querySelector('[data-summary-quote]'));form.querySelector('button[type="submit"]').disabled=false;
    }catch{if(ticket===quoteTicket){root.querySelector('[data-fx-quote]').textContent=t.fx_error;document.dispatchEvent(new CustomEvent('horizons-price-unavailable'));}}
  }
  const option=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
  const label=o=>[t['account_'+o.account_type]||o.label||o.id,t[o.term]||o.term,money(o)].filter(Boolean).join(' · ');
  for(const p of Object.values(catalog.products))if(p.available)productSelect.append(option(p.id,p.name));
  const query=new URL(location.href).searchParams;
  let stored=null;try{stored=JSON.parse(localStorage.getItem('horizons-commerce-basket-v2'));}catch{}
  const requestedProduct=query.get('product')||stored?.product;
  if(catalog.products[requestedProduct]?.available)productSelect.value=requestedProduct;
  else if(query.has('product')){productSelect.value='';status.textContent=t.empty;}
  function selection(offerId) {
    const p=catalog.products[productSelect.value];offerSelect.replaceChildren();
    if(!p?.available){selected=null;document.dispatchEvent(new CustomEvent('horizons-price-unavailable'));form.querySelector('fieldset').disabled=true;return;}
    for(const o of p.offers)offerSelect.append(option(o.id,label(o)));
    if(p.offers.some(o=>o.id===offerId))offerSelect.value=offerId;
    render();
  }
  function render() {
    if(busy||recorded)return;
    const p=catalog.products[productSelect.value],o=p?.offers.find(x=>x.id===offerSelect.value);if(!o)return;
    selected={product:p,offer:o};
    root.querySelector('[data-product-name]').textContent=p.name;
    const img=root.querySelector('[data-product-image]');img.src=p.image;img.alt=p.name;
    root.querySelector('[data-offer-name]').textContent=label(o);
    root.querySelector('[data-total]').textContent=money(o);
    root.querySelector('[data-product-facts]').textContent=p.id==='horizons-arabic-level1'?'28 '+t.lessons+' · 560 '+t.cards+' · 56 '+t.stories:'';
    const permanent=['individual','family'].includes(o.account_type);
    form.elements.permanent.required=permanent;form.elements.permanent.disabled=!permanent;form.elements.permanent.checked=false;
    form.elements.permanent.closest('label').hidden=!permanent;
    root.querySelector('[data-email-warning]').hidden=!permanent;
    requestId='';form.hidden=false;review.hidden=true;
    const v={schema:3,product:p.id,offer:o.id,quantity:1};
    if(window.HorizonsBasket?.valid(v))window.HorizonsBasket.set(v);
    const u=new URL(location.href);u.searchParams.set('product',p.id);u.searchParams.set('offer',o.id);u.searchParams.delete('account');u.searchParams.delete('plan');history.replaceState(null,'',u.pathname+u.search+u.hash);
    for(const a of root.querySelectorAll('[data-policy]')){const dest=new URL(a.getAttribute('data-policy'),location.href);dest.searchParams.set('product',p.id);dest.searchParams.set('offer',o.id);a.href=dest.pathname+dest.search;}
    refreshQuote();
  }
  const firstOffer=query.get('offer')||(query.get('plan')?`${query.get('account')||'individual'}-${query.get('plan')}`:stored?.offer||(stored?.plan?`${stored.account||'individual'}-${stored.plan}`:''));
  selection(firstOffer);
  productSelect.addEventListener('change',()=>selection());offerSelect.addEventListener('change',render);
  form.elements.payment_currency.addEventListener('change',refreshQuote);root.querySelector('[data-fx-refresh]').addEventListener('click',refreshQuote);
  document.addEventListener('horizons-basket-ready',()=>{if(selected)window.HorizonsBasket.set({schema:3,product:selected.product.id,offer:selected.offer.id,quantity:1});},{once:true});
  const companyFields=['company_name','tax_id','tax_office'];
  function companyChanged(){const corporate=form.elements.billing.value==='company';root.querySelector('[data-company]').hidden=!corporate;for(const key of companyFields){form.elements[key].disabled=!corporate;form.elements[key].required=corporate;}}
  companyChanged();form.elements.billing.addEventListener('change',companyChanged);
  const emailCheck=()=>form.elements.email_confirm.setCustomValidity(form.elements.email.value.trim().toLowerCase()===form.elements.email_confirm.value.trim().toLowerCase()?'':t.email_confirm);
  form.elements.email.addEventListener('input',emailCheck);form.elements.email_confirm.addEventListener('input',emailCheck);
  function methodChanged(){const method=form.elements.method.value,currency=form.elements.payment_currency.value;root.querySelector('[data-transfer-title]').textContent=currency==='TRY'?'Havale / EFT / FAST':'Havale';root.querySelector('[data-transfer-currency]').textContent='Türkiye · '+currency;for(const account of root.querySelectorAll('[data-bank-currency]'))account.classList.toggle('checkout-selected-bank',account.dataset.bankCurrency===currency);root.querySelector('[data-card-panel]').hidden=method!=='card';root.querySelector('[data-transfer-panel]').hidden=method!=='transfer';root.querySelector('[data-country-note]').hidden=country.value==='TR';}
  form.addEventListener('change',methodChanged);methodChanged();
  const buyerKeys=['first_name','last_name','email','email_confirm','phone','country_code','city','address','postal','billing',...companyFields];
  function buyerData(){const data={};for(const key of buyerKeys)if(!form.elements[key].disabled)data[key]=form.elements[key].value.trim();data.country=country.selectedOptions[0]?.textContent||'';return data;}
  form.addEventListener('submit',event=>{
    event.preventDefault();if(busy||recorded||!selected)return;emailCheck();if(!form.reportValidity())return;if(!quote||quote.expires_at*1000<=Date.now()){status.textContent=t.fx_expired;refreshQuote();return;}
    const data=buyerData(),summary=root.querySelector('[data-review-fields]');summary.replaceChildren();
    for(const key of buyerKeys){if(['email_confirm','country_code'].includes(key)||!data[key])continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=(key==='tax_id'?t.tax_number:t[key])||key;dd.textContent=key==='billing'?t[data[key]]:data[key];if(['email','phone'].includes(key))dd.dir='ltr';summary.append(dt,dd);}
    const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=t.country;dd.textContent=data.country;summary.append(dt,dd);
    root.querySelector('[data-review-method]').textContent=form.elements.method.value==='card'?t.card_title+' · VakıfBank Sanal POS':(quote.currency==='TRY'?'Havale / EFT / FAST':'Havale')+' · Türkiye · '+quote.currency;
    quoteMarkup(root.querySelector('[data-review-quote]'));
    payment.disabled=form.elements.method.value!=='transfer'||country.value!=='TR';
    root.querySelector('[data-review-card]').hidden=form.elements.method.value!=='card';root.querySelector('[data-review-country]').hidden=country.value==='TR';
    form.hidden=true;review.hidden=false;review.focus();status.textContent='';
  });
  root.querySelector('[data-edit]').addEventListener('click',()=>{if(busy||recorded)return;review.hidden=true;form.hidden=false;requestId='';form.elements.first_name.focus();});
  const randomId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
  payment.addEventListener('click',async()=>{
    if(busy||recorded||!selected||form.elements.method.value!=='transfer'||country.value!=='TR')return;
    if(!form.checkValidity())return;if(!quote||quote.expires_at*1000<=Date.now()){review.hidden=true;form.hidden=false;status.textContent=t.fx_expired;refreshQuote();return;}busy=true;payment.disabled=true;status.textContent=t.working;
    requestId||=randomId();
    try {
      if(!csrf){const r=await fetch('/checkout-api/',{credentials:'same-origin',cache:'no-store',redirect:'error'});const j=await r.json();if(!r.ok||j.mode!=='bank_review'||j.collection_enabled!==false)throw Error();csrf=j.csrf;}
      const response=await fetch('/checkout-api/',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),body:JSON.stringify({request_id:requestId,product:selected.product.id,offer:selected.offer.id,method:'transfer',buyer:buyerData(),terms_accepted:form.elements.consent.checked,privacy_read:form.elements.privacy.checked,permanent_acknowledged:form.elements.permanent.checked,policy_version:catalog.policy_version,locale:lang,quote_token:quote.token})});
      const result=await response.json();
      if(!response.ok||result.ok!==true||result.payment_status!=='unpaid'||result.mode!=='bank_review'||result.collection_enabled!==false||!/^HZN-R-\d{8}-[A-F0-9]{20}$/.test(result.reference)||result.amount_minor!==selected.offer.price_minor||result.currency!==selected.offer.currency)throw Error();
      recorded=true;status.textContent=t.saved_note;
      const receipt=root.querySelector('[data-receipt]');receipt.hidden=false;root.querySelector('[data-reference]').textContent=result.reference;
      payment.hidden=true;root.querySelector('[data-edit]').hidden=true;
      productSelect.disabled=true;offerSelect.disabled=true;
      // Keep only the selected product in browser storage; never persist buyer data.
      receipt.focus();
    }catch{status.textContent=t.error;payment.disabled=false;}finally{busy=false;}
  });
  for(const button of root.querySelectorAll('[data-print]'))button.addEventListener('click',()=>window.print());
  async function countries(){
    try{const r=await fetch('../assets/commerce-geo/countries.json',{credentials:'omit'});if(!r.ok)throw Error();const rows=await r.json();let display;try{display=new Intl.DisplayNames([lang],{type:'region'});}catch{}
      const sorted=rows.filter(x=>/^[A-Z]{2}$/.test(x.code)).map(x=>({code:x.code,name:display?.of(x.code)||x.name})).sort((a,b)=>a.name.localeCompare(b.name,lang));
      for(const c of sorted)country.append(option(c.code,c.name));
    }catch{country.append(option('TR','Türkiye'));}
  }
  function citySuggestions(){const list=root.querySelector('#commerce-cities'),q=form.elements.city.value.toLocaleLowerCase(lang);list.replaceChildren();for(const name of cities.filter(n=>n.toLocaleLowerCase(lang).includes(q)).slice(0,100))list.append(option(name,name));}
  form.elements.city.addEventListener('input',citySuggestions);
  country.addEventListener('change',async()=>{const ticket=++cityRequest;cities=[];form.elements.city.value='';citySuggestions();if(!country.value)return;try{const r=await fetch('../assets/commerce-geo/'+country.value+'.json',{credentials:'omit'});if(!r.ok)return;const rows=await r.json();if(ticket!==cityRequest)return;cities=rows.map(row=>lang==='ar'&&row[1]?row[1]:row[0]);citySuggestions();}catch{}});
  countries();
})();
