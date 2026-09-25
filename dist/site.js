'use strict';
document.body.classList.add('js-enabled');
const menu=document.querySelector('.menu'),links=document.querySelector('.links');
function closeMenu(){if(!links||!menu)return;links.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='☰';}
if(menu&&links){
 menu.addEventListener('click',()=>{const opened=links.classList.toggle('open');menu.setAttribute('aria-expanded',String(opened));menu.textContent=opened?'×':'☰';});
 links.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&links.classList.contains('open')){closeMenu();menu.focus();}});
 document.addEventListener('click',e=>{if(!e.target.closest('.nav'))closeMenu();});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const d of document.querySelectorAll('details[open]')){d.open=false;d.querySelector('summary')?.focus();}});
document.addEventListener('click',e=>{for(const d of document.querySelectorAll('details[open]'))if(!d.contains(e.target))d.open=false;});
// Preserve the one-line introduction when it fits without shrinking body text.
function fitLocalizedSummary(){
 const el=document.querySelector('.hero-summary');if(!el)return;
 el.style.whiteSpace=window.innerWidth>=1100?'nowrap':'normal';
 if(el.scrollWidth>el.clientWidth+1)el.style.whiteSpace='normal';
}
(document.fonts?document.fonts.ready:Promise.resolve()).then(fitLocalizedSummary);
window.addEventListener('resize',fitLocalizedSummary);
const productStrip=document.querySelector('.product-strip');
if(productStrip){
 const buttons=[...document.querySelectorAll('[data-slide]')],rtl=getComputedStyle(productStrip).direction==='rtl';
 function updateStripButtons(){
  const bounds=productStrip.getBoundingClientRect(),tiles=productStrip.querySelectorAll('.product-tile');
  if(!tiles.length)return;
  const first=tiles[0].getBoundingClientRect(),last=tiles[tiles.length-1].getBoundingClientRect();
  const atStart=rtl?first.right<=bounds.right+3:first.left>=bounds.left-3;
  const atEnd=rtl?last.left>=bounds.left-3:last.right<=bounds.right+3;
  buttons.forEach(b=>b.disabled=Number(b.dataset.slide)<0?atStart:atEnd);
 }
 buttons.forEach(b=>b.addEventListener('click',()=>{
  const tile=productStrip.querySelector('.product-tile'),step=tile.getBoundingClientRect().width+(parseFloat(getComputedStyle(productStrip).gap)||16);
  productStrip.scrollBy({left:Number(b.dataset.slide)*(rtl?-1:1)*step,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 }));
 productStrip.addEventListener('scroll',updateStripButtons,{passive:true});
 window.addEventListener('resize',updateStripButtons);updateStripButtons();
}
const video=document.querySelector('.hero-video');
if(video){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 if(!reduced.matches&&!navigator.connection?.saveData){video.autoplay=true;video.muted=true;video.play().catch(()=>{});}
 reduced.addEventListener?.('change',e=>{if(e.matches)video.pause();});
}
