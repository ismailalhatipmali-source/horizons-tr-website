// Review-only basket: no payment endpoint, buyer data, activation or learner DB.
(() => {
  'use strict';
  const KEY = 'horizons-commerce-review-v1';
  const root = document.querySelector('[data-commerce-page]');
  if (!root) return;
  const cfg = JSON.parse(document.getElementById('commerce-catalog').textContent);
  if (cfg.mode !== 'review' || cfg.charges_enabled !== false || cfg.price_approved !== false) {
    throw new Error('This review UI cannot process live orders.');
  }
  const planNames = Object.keys(cfg.plans);
  const allowed = p => typeof p === 'string' && planNames.includes(p);
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
})();
