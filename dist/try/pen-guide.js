/** Pen guides use authored directional routes aligned to the original glyph ink.
 * They are not generated from the order of a font's outline contours.
 * Geometry is checked; an independent handwriting-teacher certification is pending.
 */
const NS='http://www.w3.org/2000/svg';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let serial=0,frame=0,active=null;
function geometry(d){const p=document.createElementNS(NS,'path');p.setAttribute('d',d);return p;}
function number(n,locale){return new Intl.NumberFormat(locale,{useGrouping:false}).format(n);}
export function buildPenSvg(form,{guide=true,locale='ar',title=''}={}){
 const id='pen-'+(++serial),strokes=form.penStrokes??[];
 let body=`<svg class="trace-guide pen-guide" viewBox="0 70 560 290" role="img" aria-labelledby="${id}"><title id="${id}">${escape(title)}</title><path d="M40 250H520 M40 150H520" class="pen-baselines"/>`;
 // Preserve the supplied letter shapes, positions, dots, and joining variants.
 if(guide)for(const s of form.strokes){
  if(s.kind==='dot'&&s.center)body+=`<circle class="pen-outline" cx="${s.center.x}" cy="${s.center.y}" r="${s.radius}"/>`;
  else body+=`<path d="${escape(s.path??s.d)}" class="${s.kind==='path'?'pen-outline-line':'pen-outline'}"/>`;
 }
 if(guide)strokes.forEach((s,i)=>{
  let start,arrows='';
  if(s.kind==='path'){
   const path=geometry(s.path),length=path.getTotalLength();start=path.getPointAtLength(0);
   const count=Math.max(1,Math.min(6,Math.ceil(length/95)));
   for(let j=0;j<count;j++){
    const at=length*(j+0.62)/(count+.25),a=path.getPointAtLength(Math.max(0,at-3)),b=path.getPointAtLength(Math.min(length,at+3)),p=path.getPointAtLength(at);
    const angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
    arrows+=`<path class="pen-arrow" d="M-5-3.2 L0 0 L-5 3.2" transform="translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${angle.toFixed(2)})"/>`;
   }
   body+=`<path class="pen-route" d="${escape(s.path)}"/><path class="pen-demo-stroke" data-pen-step="${i}" data-pen-length="${length}" d="${escape(s.path)}"/>${arrows}`;
  }else{
   start={x:s.x,y:s.y};body+=`<circle class="pen-dot-target" cx="${s.x}" cy="${s.y}" r="2"/><circle class="pen-demo-stroke pen-demo-dot" data-pen-step="${i}" cx="${s.x}" cy="${s.y}" r="${Math.min(6,s.radius??5)}"/>`;
  }
  // Small numbered start tags sit beside the ink; a leader identifies the exact start.
  const dy=i%2===0?-14:14,x=Math.max(12,Math.min(548,start.x)),y=Math.max(85,Math.min(341,start.y+dy));
  body+=`<g class="pen-start"><path d="M${x} ${y}L${start.x} ${start.y}"/><circle class="pen-start-point" cx="${start.x}" cy="${start.y}" r="2"/><circle cx="${x}" cy="${y}" r="6.5"/><text x="${x}" y="${y+.35}" dominant-baseline="central" text-anchor="middle" direction="ltr">${number(i+1,locale)}</text></g>`;
 });
 return body+'<circle class="pen-tip" r="4.5" hidden/></svg>';
}
export function stopPenDemo(){cancelAnimationFrame(frame);frame=0;if(active){active.onStop?.();active=null;}document.querySelectorAll('.pen-tip').forEach(p=>p.setAttribute('hidden',''));}
export function attachPenDemo({svg,playButton,stepButton,status,labels,onStroke,onReset,onUndo}){
 stopPenDemo();if(!svg||!playButton)return;
 const nodes=[...svg.querySelectorAll('[data-pen-step]')];let shown=0,playing=false,run=0;
 function hide(n){n.style.opacity=0;n.style.strokeDasharray='';n.style.strokeDashoffset='';}
 function writeStatus(n){if(status)status.textContent=n?labels.step.replace('{current}',n).replace('{total}',nodes.length):labels.ready;}
 function stopped(){run++;playing=false;playButton.textContent=labels.play;playButton.setAttribute('aria-pressed','false');}
 function stop(){stopPenDemo();stopped();}
 function reset(){nodes.forEach(hide);shown=0;writeStatus(0);onReset?.();}
 function reveal(index){
  const n=nodes[index];if(!n)return;
  n.style.opacity=1;
  // Count a stroke as soon as it is visible, so undo also removes a paused or
  // currently animating stroke rather than waiting for its animation to finish.
  if(index>=shown){shown=index+1;onStroke?.(index);}
  return n;
 }
 function clear(){stop();reset();}
 function undo(){
  stop();if(!shown)return false;
  const index=--shown;hide(nodes[index]);writeStatus(shown);onUndo?.(index);return true;
 }
 function showNext(){
  stop();if(shown>=nodes.length)reset();
  const n=reveal(shown);if(n){n.style.strokeDasharray='';n.style.strokeDashoffset=0;writeStatus(shown);}
 }
 playButton.onclick=()=>{
  if(playing){stop();return;}
  clear();playing=true;playButton.textContent=labels.stop;playButton.setAttribute('aria-pressed','true');
  const token=++run;active={onStop:stopped};
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
   nodes.forEach((n,index)=>{reveal(index);n.style.strokeDashoffset=0;});writeStatus(shown);stop();return;
  }
  const tip=svg.querySelector('.pen-tip');let index=0,start=null;
  function tick(time){
   if(!playing||token!==run)return;
   if(!svg.isConnected){stop();return;}
   const n=nodes[index];if(!n){stop();return;}
   if(start===null)start=time;
   const len=Number(n.dataset.penLength||0),duration=len?Math.max(600,Math.min(2600,len*5)):650,pct=Math.min(1,(time-start)/duration);
   reveal(index);
   if(len){n.style.strokeDasharray=String(len);n.style.strokeDashoffset=String(len*(1-pct));const p=n.getPointAtLength(len*pct);tip?.setAttribute('cx',p.x);tip?.setAttribute('cy',p.y);}
   else{tip?.setAttribute('cx',n.getAttribute('cx'));tip?.setAttribute('cy',n.getAttribute('cy'));}
   tip?.removeAttribute('hidden');writeStatus(index+1);
   if(pct===1&&time-start>duration+260){index++;start=null;if(index===nodes.length){stop();return;}}
   frame=requestAnimationFrame(tick);
  }
  frame=requestAnimationFrame(tick);
 };
 if(stepButton)stepButton.onclick=showNext;reset();
 return {hasInk:()=>shown>0,undo,clear,stop};
}
