'use strict';
document.body.classList.add('js-enabled');
const menu = document.querySelector('.menu');
const links = document.querySelector('.nav .links');
function closeMenu() {
  if (!menu || !links) return;
  links.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.textContent = '☰';
}
if (menu && links) {
  menu.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
    menu.textContent = open ? '×' : '☰';
  });
  links.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('click', event => { if (!event.target.closest('.nav')) closeMenu(); });
}
// Dismiss only the language popover; content disclosures stay open while reading.
document.addEventListener('click', event => {
  for (const popup of document.querySelectorAll('.language-switch[open]')) {
    if (!popup.contains(event.target)) popup.open = false;
  }
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (links?.classList.contains('open')) { closeMenu(); menu.focus(); }
  for (const popup of document.querySelectorAll('.language-switch[open]')) {
    popup.open = false;
    popup.querySelector('summary')?.focus();
  }
});
// Existing product bookmarks still work when their project is inside Coming soon.
function revealHashTarget() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  let ancestor = target.parentElement;
  let revealed = false;
  while (ancestor) {
    if (ancestor.tagName === 'DETAILS' && !ancestor.open) { ancestor.open = true; revealed = true; }
    ancestor = ancestor.parentElement;
  }
  if (revealed) requestAnimationFrame(() => target.scrollIntoView({block:'start', behavior:'instant'}));
}
revealHashTarget();
window.addEventListener('hashchange', revealHashTarget);
const video = document.querySelector('.hero-video');
if (video) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function syncVideo() {
    video.controls = false;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    const shouldPlay = !reducedMotion.matches && !navigator.connection?.saveData;
    video.autoplay = shouldPlay;
    if (shouldPlay) video.play().catch(() => { /* The poster stays visible if autoplay is blocked. */ });
    else { video.pause(); video.currentTime = 0; }
  }
  syncVideo();
  reducedMotion.addEventListener?.('change', syncVideo);
}
