// Public basket metadata only. No buyer email, credentials or progress is stored.
(() => {
  'use strict';
  const configNode = document.getElementById('commerce-ui');
  if (!configNode) return;
  const ui = JSON.parse(configNode.textContent), cfg = ui.catalog;
  const KEY = 'horizons-commerce-basket-v2', OLD = 'horizons-commerce-review-v1';
  const valid = v => v?.schema === 2 && v.product === cfg.product && v.quantity === 1 &&
    Object.hasOwn(cfg.accounts, v.account) && Object.hasOwn(cfg.accounts[v.account].plans, v.plan);
  let selection = null;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (valid(stored)) selection = stored;
    if (!selection) {
      const legacy = JSON.parse(sessionStorage.getItem(OLD));
      if (legacy?.schema === 1 && legacy.product === cfg.product && legacy.quantity === 1 && Object.hasOwn(cfg.accounts.individual.plans, legacy.plan)) {
        selection = {schema:2,product:cfg.product,quantity:1,account:'individual',plan:legacy.plan};
        localStorage.setItem(KEY, JSON.stringify(selection));
      }
    }
    sessionStorage.removeItem(OLD);
  } catch { /* The current page still works with unavailable storage. */ }
  const link = (href, value=selection) => {
    const u = new URL(href, location.href);
    if (value) { u.searchParams.set('account',value.account); u.searchParams.set('plan',value.plan); }
    else { u.searchParams.delete('account'); u.searchParams.delete('plan'); }
    return u.pathname + u.search + u.hash;
  };
  const cart = document.createElement('a');
  cart.className='commerce-floating-cart'; cart.href=ui.cart_path;
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
    cart.href=link(ui.cart_path);cart.setAttribute('aria-label',ui.cart+' · '+(selection?'1':'0'));
    live.textContent=selection?ui.checkout+' · '+ui.cart+' 1':ui.empty;
    document.dispatchEvent(new CustomEvent('horizons-basket-change'));
  }
  window.HorizonsBasket={get:()=>selection?{...selection}:null,valid,link,set(value){
    if(value!==null&&!valid(value))throw Error('INVALID_BASKET');
    selection=value?{...value}:null;
    try {if(selection)localStorage.setItem(KEY,JSON.stringify(selection));else localStorage.removeItem(KEY);} catch {}
    notify();
  }};
  window.addEventListener('storage',event=>{
    if(event.key!==KEY&&event.key!==null)return;
    try {const v=JSON.parse(event.key===null?localStorage.getItem(KEY):event.newValue);selection=valid(v)?v:null;}catch{selection=null;}
    notify();
  });
  notify();
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
