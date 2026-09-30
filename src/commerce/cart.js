// Review-only basket. Buyer input stays in this page's memory: no network or
// browser-storage write contains it. Only product/plan/quantity is persisted.
(() => {
  'use strict';
  const KEY = 'horizons-commerce-review-v1';
  const root = document.querySelector('[data-commerce-page]');
  if (!root) return;
  const cfg = JSON.parse(document.getElementById('commerce-catalog').textContent);
  if (cfg.mode !== 'review' || cfg.charges_enabled !== false) {
    throw new Error('This review UI cannot process live orders.');
  }
  const planNames = Object.keys(cfg.plans);
  const allowed = p => typeof p === 'string' && planNames.includes(p);
  const form = root.querySelector('[data-buyer-form]');
  const orderReview = root.querySelector('[data-order-review]');
  if (form) {
    // Install a submit handler BEFORE enabling fields, so no-JS/failed-script
    // fallback cannot send names/addresses in a query string or create orders.
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!selected || !form.reportValidity()) return;
      const summary = root.querySelector('[data-buyer-summary]');
      summary.replaceChildren();
      const corporate = form.elements.billing.value === 'company';
      for (const key of ['name','email','billing','country','city','address','postal','company_name','tax_id']) {
        if (!corporate && ['company_name','tax_id'].includes(key)) continue;
        const input = form.elements.namedItem(key), value = input.value.trim();
        if (!value) continue;
        const label = input.closest('label').childNodes[0].textContent.trim();
        const dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = label;
        dd.textContent = key === 'billing' ? input.selectedOptions[0].textContent : value;
        summary.append(dt, dd);
      }
      const payment = form.querySelector('input[name="review-payment-method"]:checked');
      root.querySelector('[data-payment-summary]').textContent = payment.closest('label').textContent.trim();
      root.querySelector('[data-review-transfer]').hidden = payment.value !== 'transfer';
      form.hidden = true; orderReview.hidden = false; orderReview.focus();
    });
    root.querySelector('[data-edit-buyer]').addEventListener('click', () => {
      orderReview.hidden = true; form.hidden = false; form.elements.name.focus();
    });
    form.elements.billing.addEventListener('change', () => {
      const corporate = form.elements.billing.value === 'company';
      root.querySelector('[data-company-fields]').hidden = !corporate;
      form.elements.company_name.required = corporate;
      form.elements.company_name.disabled = !corporate;
      form.elements.tax_id.disabled = !corporate;
    });
  }
  const fromQuery = new URL(location.href).searchParams.get('plan');
  let selected = null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY));
    if (saved?.schema === 1 && saved.product === cfg.product && saved.quantity === 1 && allowed(saved.plan)) selected = saved.plan;
  } catch { /* Storage unavailable/corrupt: navigation still works via plan ID. */ }
  if (allowed(fromQuery)) selected = fromQuery;
  const money = p => new Intl.NumberFormat(document.documentElement.lang, {
    style: 'currency', currency: cfg.currency
  }).format(cfg.plans[p].proposed_minor / 100);
  const planLink = (href, plan) => {
    const u = new URL(href, location.href);
    if (plan) u.searchParams.set('plan', plan);
    else u.searchParams.delete('plan');
    return u.pathname + u.search;
  };
  function save() {
    try {
      if (selected) sessionStorage.setItem(KEY, JSON.stringify({schema: 1, product: cfg.product, plan: selected, quantity: 1}));
      else sessionStorage.removeItem(KEY);
    } catch { /* Do not clear or modify any other local data. */ }
  }
  function render() {
    root.querySelector('[data-empty]').hidden = !!selected;
    root.querySelector('[data-basket]').hidden = !selected;
    for (const e of root.querySelectorAll('[data-selected-plan]')) e.hidden = e.dataset.selectedPlan !== selected;
    for (const e of root.querySelectorAll('[data-money]')) e.textContent = selected ? money(selected) : '';
    for (const e of root.querySelectorAll('[data-proposed-price]')) e.textContent = money(e.dataset.proposedPrice);
    for (const e of root.querySelectorAll('[data-plan]')) e.setAttribute('aria-pressed', String(e.dataset.plan === selected));
    for (const a of document.querySelectorAll('[data-commerce-link]')) {
      a.href = planLink(a.getAttribute('data-commerce-link'), selected);
    }
    const url = new URL(location.href);
    if (selected) url.searchParams.set('plan', selected); else url.searchParams.delete('plan');
    // Discard arbitrary query data (especially success/payment/email assertions).
    const safeSearch = selected ? '?plan=' + encodeURIComponent(selected) : '';
    history.replaceState(null, '', url.pathname + safeSearch + url.hash);
  }
  root.addEventListener('click', event => {
    const add = event.target.closest('[data-plan]');
    const remove = event.target.closest('[data-remove]');
    if (add && allowed(add.dataset.plan)) { selected = add.dataset.plan; save(); render(); }
    else if (remove) { selected = null; save(); render(); }
  });
  root.addEventListener('change', event => {
    if (event.target.name === 'review-payment-method') {
      const method = event.target.value;
      for (const e of root.querySelectorAll('[data-method-note]')) e.hidden = e.dataset.methodNote !== method;
    }
  });
  save(); render();
  if (form) {
    root.querySelector('[data-buyer-fields]').disabled = false;
    form.elements.company_name.disabled = true;
    form.elements.tax_id.disabled = true;
  }
})();
