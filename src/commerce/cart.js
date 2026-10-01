// Non-collecting preview. Buyer details exist only in this page's memory.
(() => {
  'use strict';
  const root=document.querySelector('[data-commerce-page]');if(!root)return;
  const cfg=JSON.parse(document.getElementById('commerce-catalog').textContent);
  if(cfg.mode!=='review'||cfg.charges_enabled!==false)throw Error('CHECKOUT_NOT_READY');
  const basket=window.HorizonsBasket;if(!basket)throw Error('BASKET_UNAVAILABLE');
  const form=root.querySelector('[data-buyer-form]'),review=root.querySelector('[data-order-review]');
  const query=new URL(location.href).searchParams,account=query.get('account')||'individual',plan=query.get('plan');
  const requested={schema:2,product:cfg.product,quantity:1,account,plan};
  if(plan && basket.valid(requested))basket.set(requested);
  else if(plan)basket.set(null);
  const money=(a,p)=>new Intl.NumberFormat(document.documentElement.lang,{style:'currency',currency:cfg.currency}).format(cfg.accounts[a].plans[p].proposed_minor/100);
  let previous='';
  function render() {
    const selected=basket.get();
    root.querySelector('[data-empty]').hidden=!!selected;root.querySelector('[data-basket]').hidden=!selected;
    for(const e of root.querySelectorAll('[data-selected-plan]'))e.hidden=e.dataset.selectedPlan!==selected?.plan;
    for(const e of root.querySelectorAll('[data-selected-account]'))e.hidden=e.dataset.selectedAccount!==selected?.account;
    for(const e of root.querySelectorAll('[data-money]'))e.textContent=selected?money(selected.account,selected.plan):'';
    for(const e of root.querySelectorAll('[data-proposed-price]'))e.textContent=money(e.dataset.account,e.dataset.proposedPrice);
    for(const e of root.querySelectorAll('[data-plan]'))e.setAttribute('aria-pressed',String(e.dataset.account===selected?.account&&e.dataset.plan===selected?.plan));
    for(const a of document.querySelectorAll('[data-commerce-link]'))a.href=basket.link(a.dataset.commerceLink);
    for(const e of root.querySelectorAll('[data-permanent-warning]'))e.hidden=selected?.account==='institution';
    if(form) {
      const required=!!selected&&selected.account!=='institution';
      form.elements.permanent.required=required;form.elements.permanent.disabled=!required;
      form.elements.permanent.closest('label').hidden=!required;
      const current=selected?selected.account+'/'+selected.plan:'';
      if(previous!==current) {form.elements.permanent.checked=false;form.hidden=false;review.hidden=true;previous=current;}
    }
    const u=new URL(location.href);history.replaceState(null,'',u.pathname+(selected?'?account='+encodeURIComponent(selected.account)+'&plan='+encodeURIComponent(selected.plan):'')+u.hash);
  }
  root.addEventListener('click',event=>{
    const add=event.target.closest('[data-plan]');
    if(add)basket.set({schema:2,product:cfg.product,quantity:1,account:add.dataset.account,plan:add.dataset.plan});
    else if(event.target.closest('[data-remove]'))basket.set(null);
  });
  document.addEventListener('horizons-basket-change',render);
  if(form) {
    const emailCheck=()=>form.elements.email_confirm.setCustomValidity(form.elements.email.value.trim().toLowerCase()===form.elements.email_confirm.value.trim().toLowerCase()?'':form.elements.email_confirm.dataset.mismatch);
    form.elements.email.addEventListener('input',emailCheck);form.elements.email_confirm.addEventListener('input',emailCheck);
    form.addEventListener('submit',event=>{
      event.preventDefault();emailCheck();if(!basket.get()||!form.reportValidity())return;
      const summary=root.querySelector('[data-buyer-summary]');summary.replaceChildren();
      const corporate=form.elements.billing.value==='company';
      for(const key of ['name','email','billing','country','city','address','postal','company_name','tax_id']) {
        if(!corporate&&['company_name','tax_id'].includes(key))continue;
        const input=form.elements.namedItem(key),value=input.value.trim();if(!value)continue;
        const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=input.closest('label').childNodes[0].textContent.trim();
        dd.textContent=key==='billing'?input.selectedOptions[0].textContent:value;summary.append(dt,dd);
      }
      const method=form.querySelector('input[name="review-payment-method"]:checked');
      root.querySelector('[data-payment-summary]').textContent=method.closest('label').textContent.trim();
      root.querySelector('[data-review-transfer]').hidden=method.value!=='transfer';
      form.hidden=true;review.hidden=false;review.focus();
    });
    root.querySelector('[data-edit-buyer]').addEventListener('click',()=>{review.hidden=true;form.hidden=false;form.elements.name.focus();});
    form.elements.billing.addEventListener('change',()=>{
      const corporate=form.elements.billing.value==='company';root.querySelector('[data-company-fields]').hidden=!corporate;
      form.elements.company_name.required=corporate;form.elements.company_name.disabled=!corporate;form.elements.tax_id.disabled=!corporate;
    });
  }
  root.addEventListener('change',event=>{if(event.target.name==='review-payment-method')for(const e of root.querySelectorAll('[data-method-note]'))e.hidden=e.dataset.methodNote!==event.target.value;});
  render();
  if(form){root.querySelector('[data-buyer-fields]').disabled=false;form.elements.company_name.disabled=true;form.elements.tax_id.disabled=true;}
})();
