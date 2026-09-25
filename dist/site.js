'use strict';
document.body.classList.add('js-enabled');
const menu=document.querySelector('.menu');
const links=document.querySelector('.links');
function closeMenu(){links.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='☰';}
if(menu&&links){menu.addEventListener('click',()=>{const opened=links.classList.toggle('open');menu.setAttribute('aria-expanded',String(opened));menu.textContent=opened?'×':'☰';});links.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&links.classList.contains('open')){closeMenu();menu.focus();}});document.addEventListener('click',e=>{if(!e.target.closest('.nav')&&links.classList.contains('open'))closeMenu();});}
document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const d of document.querySelectorAll('details[open]')){d.open=false;d.querySelector('summary').focus();}});
document.addEventListener('click',e=>{for(const d of document.querySelectorAll('details[open]'))if(!d.contains(e.target))d.open=false;});
