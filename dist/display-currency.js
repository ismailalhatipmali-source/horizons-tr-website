// Converts published product prices for display only. Never sets settlement currency.
(() => {
  'use strict';
  const node=document.getElementById('display-currency-config');if(!node)return;
  const {words:t,catalog}=JSON.parse(node.textContent),lang=document.documentElement.lang;
  const widget=document.querySelector('[data-display-widget]'),currency=widget.querySelector('[data-display-currency]');
  const checkout=document.querySelector('[data-checkout]'),country=checkout?.querySelector('[name=country_code]')||widget.querySelector('[data-display-country]');
  const offerPicker=widget.querySelector('[data-display-offer]'),targets=[...document.querySelectorAll('[data-display-total]')];
  let metadata=null,selection=null,serial=0,controller=null,pending=false;
  const option=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
  const clear=text=>{for(const target of targets)target.textContent=text;};
  const preference=value=>{try{localStorage.setItem('horizons-display-currency-v1',value);}catch{}};
  function paint(value){
    const formatted=new Intl.NumberFormat(lang,{style:'currency',currency:value.currency,minimumFractionDigits:value.digits,maximumFractionDigits:value.digits}).format(value.amount_minor/(10**value.digits));
    for(const target of targets){
      target.replaceChildren();const title=document.createElement('span'),sum=document.createElement('strong');title.textContent=t.display_estimate;sum.textContent='≈ '+formatted+' · '+value.currency;sum.dir='ltr';target.append(title,sum);
      if(value.rate_updated_at){const detail=document.createElement('small');detail.textContent=t.display_details.replace('{date}',new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value.rate_updated_at*1000)));target.append(detail);}
    }
  }
  async function refresh(){
    const ticket=++serial;controller?.abort();controller=null;
    if(!metadata||!selection||pending){clear(pending?t.working:'');return;}
    const wanted=currency.value,chosen={...selection};clear(t.working);
    try{
      const requestController=new AbortController();controller=requestController;const timer=setTimeout(()=>requestController.abort(),15000);
      let response,data;
      try{const q=new URLSearchParams({action:'display_price',product:chosen.product,offer:chosen.offer,currency:wanted});if(chosen.quote)q.set('quote_token',chosen.quote.token);
        response=await fetch('/checkout-api/?'+q,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:requestController.signal});data=await response.json();
      }finally{clearTimeout(timer);}
      if(ticket!==serial)return;const d=data.display;
      if(!response.ok||data.ok!==true||d?.indicative!==true||d?.settlement_allowed!==false||d.product!==chosen.product||d.offer!==chosen.offer||d.currency!==wanted||d.base_minor!==chosen.base_minor||d.based_on_currency!==(chosen.quote?.currency||'USD')||d.based_on_minor!==(chosen.quote?.amount_minor??chosen.base_minor)||!Number.isSafeInteger(d.amount_minor)||d.amount_minor<0||d.digits!==metadata.currencies[wanted]?.digits||(d.rate_updated_at!==null&&(!Number.isSafeInteger(d.rate_updated_at)||d.rate_updated_at*1000>Date.now()+300000||Date.now()-d.rate_updated_at*1000>72*3600000)))throw Error();
      paint(d);
    }catch{if(ticket===serial)clear(t.display_unavailable);}
  }
  function chooseCountry(){
    if(!metadata)return;
    const local=metadata.countries[country.value]?.[0];
    if(local&&metadata.currencies[local]){currency.value=local;preference(local);refresh();}
    // Territories with no official currency keep the explicit currency selection.
  }
  currency.addEventListener('change',()=>{preference(currency.value);refresh();});
  country.addEventListener('change',chooseCountry);
  document.addEventListener('horizons-price-selection',event=>{selection=event.detail;pending=Boolean(selection?.pending);refresh();});
  document.addEventListener('horizons-price-unavailable',()=>{selection=null;pending=false;++serial;controller?.abort();clear(t.display_unavailable);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  async function start(){
    try{
      const r=await fetch('../display-currencies.json?v=global-fx-1',{credentials:'omit'});if(!r.ok)throw Error();metadata=await r.json();
      if(metadata.schema!==1||!metadata.currencies?.USD||!metadata.countries?.TR)throw Error();
      let names;try{names=new Intl.DisplayNames([lang],{type:'currency'});}catch{}
      currency.replaceChildren();for(const code of Object.keys(metadata.currencies).sort())currency.append(option(code,code+' — '+(names?.of(code)||code)));
      let saved;try{saved=localStorage.getItem('horizons-display-currency-v1');}catch{}
      let region;for(const locale of navigator.languages||[navigator.language]){try{region=new Intl.Locale(locale).region;if(region)break;}catch{}}
      const initial=metadata.currencies[saved]?saved:metadata.countries[region]?.[0]||'USD';currency.value=metadata.currencies[initial]?initial:'USD';currency.disabled=false;
      if(checkout){if(country.value)chooseCountry();else refresh();return;}
      const rows=await fetch('../assets/commerce-geo/countries.json',{credentials:'omit'}).then(r=>{if(!r.ok)throw Error();return r.json();});
      let regions;try{regions=new Intl.DisplayNames([lang],{type:'region'});}catch{}
      for(const row of rows.map(row=>({code:row.code,name:regions?.of(row.code)||row.name})).sort((a,b)=>a.name.localeCompare(b.name,lang)))country.append(option(row.code,row.name));
      const p=Object.values(catalog.products).find(p=>p.available);if(!p)throw Error();
      for(const o of p.offers)offerPicker.append(option(o.id,[t['account_'+o.account_type]||o.label||o.id,t[o.term]||o.term,new Intl.NumberFormat(lang,{style:'currency',currency:'USD'}).format(o.price_minor/100)].join(' · ')));
      const requested=new URL(location.href).searchParams.get('offer');if(p.offers.some(o=>o.id===requested))offerPicker.value=requested;
      const selectOffer=()=>{const o=p.offers.find(o=>o.id===offerPicker.value);selection={product:p.id,offer:o.id,base_minor:o.price_minor};widget.querySelector('[data-display-base]').textContent=new Intl.NumberFormat(lang,{style:'currency',currency:'USD'}).format(o.price_minor/100);for(const a of document.querySelectorAll('[data-checkout-buy],[data-display-buy]'))a.href='checkout.html?'+new URLSearchParams({product:p.id,offer:o.id});refresh();};
      offerPicker.addEventListener('change',selectOffer);selectOffer();
    }catch{clear(t.display_unavailable);}
  }
  start();
})();
