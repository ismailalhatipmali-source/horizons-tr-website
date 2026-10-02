// Review by default; live transfers require both public and private feature flags.
(() => {
  'use strict';
  const root=document.querySelector('[data-commerce-page]');if(!root)return;
  const cfg=JSON.parse(document.getElementById('commerce-catalog').textContent);
  const live=cfg.mode==='transfer'&&cfg.charges_enabled===true;
  if(!live&&(cfg.mode!=='review'||cfg.charges_enabled!==false))throw Error('CHECKOUT_NOT_READY');
  const basket=window.HorizonsBasket;if(!basket)throw Error('BASKET_UNAVAILABLE');
  const form=root.querySelector('[data-buyer-form]'),review=root.querySelector('[data-order-review]');
  const query=new URL(location.href).searchParams,account=query.get('account')||'individual',plan=query.get('plan');
  const requested={schema:2,product:cfg.product,quantity:1,account,plan};
  if(plan && basket.valid(requested))basket.set(requested);
  else if(plan)basket.set(null);
  const money=(a,p)=>new Intl.NumberFormat(document.documentElement.lang,{style:'currency',currency:cfg.currency}).format(cfg.accounts[a].plans[p].proposed_minor/100);
  let previous='',orderRequest='',orderBusy=false,ordered=false;
  const transferWords=({ar:{create:'تأكيد الطلب وعرض بيانات الحوالة',wait:'جارٍ تسجيل الطلب…',error:'تعذّر تسجيل الطلب. تحقق من البيانات والاتصال وحاول مجددًا.',ready:'تم تسجيل طلبك. حوّل المبلغ بالدولار إلى الحساب التالي واكتب رقم الطلب في وصف الحوالة. يصلك رمز التفعيل بعد تأكيد وصول المبلغ.',reference:'رقم الطلب',amount:'المبلغ',email:'سيصل التفعيل إلى'},tr:{create:'Siparişi onayla ve havale bilgilerini göster',wait:'Sipariş kaydediliyor…',error:'Sipariş kaydedilemedi. Bilgileri ve bağlantınızı kontrol edin.',ready:'Sipariş kaydedildi. USD hesabına havale yapın ve açıklamaya sipariş numarasını yazın. Ödeme hesaba geçtikten sonra etkinleştirme kodu gönderilir.',reference:'Sipariş numarası',amount:'Tutar',email:'Etkinleştirme adresi'}})[document.documentElement.lang]||{create:'Confirm order and show transfer details',wait:'Recording your order…',error:'Unable to record the order. Check the details and connection.',ready:'Order recorded. Transfer the USD amount and include the order number in the transfer description. Activation follows confirmation of the credited payment.',reference:'Order number',amount:'Amount',email:'Activation email'};
  const pay=root.querySelector('[data-payment-submit]');if(live&&pay){pay.textContent=transferWords.create;pay.disabled=true;}

  function render() {
    if(orderBusy||ordered)return;
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
      if(previous!==current) {form.elements.permanent.checked=false;form.hidden=false;review.hidden=true;previous=current;orderRequest='';ordered=false;if(live&&pay)pay.disabled=true;}
    }
    const u=new URL(location.href);history.replaceState(null,'',u.pathname+(selected?'?account='+encodeURIComponent(selected.account)+'&plan='+encodeURIComponent(selected.plan):'')+u.hash);
  }
  root.addEventListener('click',event=>{
    if(orderBusy||ordered)return;
    const add=event.target.closest('[data-plan]');
    if(add)basket.set({schema:2,product:cfg.product,quantity:1,account:add.dataset.account,plan:add.dataset.plan});
    else if(event.target.closest('[data-remove]'))basket.set(null);
  });
  document.addEventListener('horizons-basket-change',render);
  if(form) {
    const emailCheck=()=>form.elements.email_confirm.setCustomValidity(form.elements.email.value.trim().toLowerCase()===form.elements.email_confirm.value.trim().toLowerCase()?'':form.elements.email_confirm.dataset.mismatch);
    form.elements.email.addEventListener('input',emailCheck);form.elements.email_confirm.addEventListener('input',emailCheck);
    form.addEventListener('submit',event=>{
      event.preventDefault();if(orderBusy||ordered)return;emailCheck();if(!basket.get()||!form.reportValidity())return;
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
      form.hidden=true;review.hidden=false;review.focus();if(live&&pay&&!ordered)pay.disabled=false;
    });
    root.querySelector('[data-edit-buyer]').addEventListener('click',()=>{if(orderBusy||ordered)return;orderRequest='';review.hidden=true;form.hidden=false;form.elements.name.focus();if(live&&pay)pay.disabled=true;});
    form.elements.billing.addEventListener('change',()=>{
      const corporate=form.elements.billing.value==='company';root.querySelector('[data-company-fields]').hidden=!corporate;
      form.elements.company_name.required=corporate;form.elements.company_name.disabled=!corporate;form.elements.tax_id.disabled=!corporate;
    });
  }
  if(live&&pay&&form)pay.addEventListener('click',async()=>{
    if(orderBusy||ordered||review.hidden||!basket.get()||!form.reportValidity())return;
    orderBusy=true;pay.disabled=true;pay.textContent=transferWords.wait;const selected=basket.get();
    orderRequest ||= Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
    const buyer={};for(const key of ['name','email','email_confirm','billing','country','city','address','postal','company_name','tax_id'])buyer[key]=form.elements.namedItem(key).value.trim();
    try{
      const response=await fetch('/activation/v1/transfer/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:orderRequest,account_type:selected.account,plan:selected.plan,buyer,terms_accepted:form.elements.consent.checked,permanent_acknowledged:form.elements.permanent.checked}),credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
      const result=await response.json();if(!response.ok||result.ok!==true||result.currency!=='USD'||!/^HZN-[a-f0-9]{24}$/.test(result.order_id)||result.amount_minor!==cfg.accounts[selected.account].plans[selected.plan].proposed_minor)throw Error('ORDER_FAILED');
      ordered=true;const panel=document.createElement('section');panel.className='commerce-panel';panel.setAttribute('role','status');const p=document.createElement('p');p.textContent=transferWords.ready;panel.append(p);
      for(const [label,value]of [[transferWords.reference,result.order_id],[transferWords.amount,money(selected.account,selected.plan)],[transferWords.email,buyer.email],['VakıfBank USD IBAN',cfg.bank_transfer.accounts.USD],[cfg.bank_transfer.beneficiary,'']]){const row=document.createElement('p');row.textContent=label+(value?': '+value:'');panel.append(row);}
      review.replaceChildren(panel);pay.hidden=true;panel.scrollIntoView?.({block:'center',behavior:'smooth'});
    }catch{pay.textContent=transferWords.error;pay.disabled=false;}finally{orderBusy=false;if(!ordered)render();}
  });
  root.addEventListener('change',event=>{if(event.target.name==='review-payment-method')for(const e of root.querySelectorAll('[data-method-note]'))e.hidden=e.dataset.methodNote!==event.target.value;});
  render();
  if(form){root.querySelector('[data-buyer-fields]').disabled=false;form.elements.company_name.disabled=true;form.elements.tax_id.disabled=true;}
})();
