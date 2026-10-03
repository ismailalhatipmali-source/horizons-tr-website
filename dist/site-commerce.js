// Public basket metadata only. No buyer email, credentials or progress is stored.
(async () => {
  'use strict';
  const configNode = document.getElementById('commerce-ui');
  if (!configNode) return;
  const ui = JSON.parse(configNode.textContent), cfg = ui.catalog;
  const KEY = 'horizons-commerce-basket-v2', OLD = 'horizons-commerce-review-v1';
  let catalog;
  const checkout=document.getElementById('checkout-config');
  if(checkout)catalog=JSON.parse(checkout.textContent).catalog;
  else {
    try {const r=await fetch('/products.json?v=institution-20261003',{credentials:'omit',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();catalog=await r.json();}
    catch {catalog={products:{[cfg.product]:{available:true,offers:Object.entries(cfg.accounts).flatMap(([account,row])=>Object.keys(row.plans).map(plan=>({id:account+'-'+plan})))}}};}
  }
  const normalize=v=>v?.schema===2?{schema:3,product:v.product,quantity:v.quantity,offer:v.account+'-'+v.plan}:v;
  const valid = raw => {const v=normalize(raw);return v?.schema===3&&v.quantity===1&&catalog.products[v.product]?.available===true&&catalog.products[v.product].offers.some(o=>o.id===v.offer);};
  let selection = null;
  try {
    const stored=normalize(JSON.parse(localStorage.getItem(KEY)));
    if(valid(stored))selection=stored;
    if(!selection){const legacy=JSON.parse(sessionStorage.getItem(OLD));const v={schema:3,product:legacy?.product,quantity:1,offer:'individual-'+legacy?.plan};if(valid(v))selection=v;}
    if(selection)localStorage.setItem(KEY,JSON.stringify(selection));
    sessionStorage.removeItem(OLD);
  }catch{}
  const link = (href, value=selection) => {
    const u = new URL(href, location.href);
    u.searchParams.delete('account');u.searchParams.delete('plan');
    if(value){u.searchParams.set('product',value.product);u.searchParams.set('offer',value.offer);}
    else{u.searchParams.delete('product');u.searchParams.delete('offer');}
    return u.pathname + u.search + u.hash;
  };
  const cart = document.createElement('a');
  cart.className='commerce-floating-cart'; cart.href='checkout.html';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS(svg.namespaceURI,'path');
  path.setAttribute('d','M2 3h3l3 12h11l3-9H6M9 20h.01M18 20h.01');svg.append(path);
  const badge=document.createElement('span');badge.className='commerce-cart-badge';
  const label=document.createElement('span');label.className='commerce-cart-label';
  const live=document.createElement('span');live.className='commerce-sr-only';live.setAttribute('role','status');live.setAttribute('aria-live','polite');
  cart.append(svg,badge,label);document.body.append(cart,live);
  function notify() {
    badge.textContent=selection?'1':'0';badge.hidden=!selection;
    label.textContent=selection?ui.checkout:ui.cart;
    cart.href=link('checkout.html');cart.setAttribute('aria-label',ui.cart+' · '+(selection?'1':'0'));
    live.textContent=selection?ui.checkout+' · '+ui.cart+' 1':ui.empty;
    document.dispatchEvent(new CustomEvent('horizons-basket-change'));
  }
  window.HorizonsBasket={get:()=>selection?{...selection}:null,valid,link,set(value){
    if(value!==null&&!valid(value))throw Error('INVALID_BASKET');
    selection=value?{...normalize(value)}:null;
    try {if(selection)localStorage.setItem(KEY,JSON.stringify(selection));else localStorage.removeItem(KEY);} catch {}
    notify();
  }};
  window.addEventListener('storage',event=>{
    if(event.key!==KEY&&event.key!==null)return;
    try {const v=JSON.parse(event.key===null?localStorage.getItem(KEY):event.newValue);selection=valid(v)?normalize(v):null;}catch{selection=null;}
    notify();
  });
  notify();
  document.dispatchEvent(new CustomEvent('horizons-basket-ready'));
  const dialog=document.querySelector('[data-start-dialog]');
  if(dialog && typeof dialog.showModal==='function') {
    let opener=null;
    for(const a of document.querySelectorAll('[data-horizons-action="open"]'))a.addEventListener('click',event=>{
      event.preventDefault();opener=a;dialog.showModal();dialog.querySelector('a').focus();
    });
    dialog.addEventListener('close',()=>opener?.focus());
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  }
})();
