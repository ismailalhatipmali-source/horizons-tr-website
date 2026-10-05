/* Focus-layout successor of the pinned Section 05 renderer. Private curriculum and glyphs stay runtime-only. */
function mountBlending4Component(root, DATA, config) {
 'use strict';
 const entries=DATA.bank.entries, byId=new Map(entries.map(e=>[e.id,e])), lessons=DATA.bank.lessons;
 const locales=Object.keys(DATA.ui.locales), fonts=DATA.outlines.font_ids;
 const fontFamilies={'noto-naskh':'"HZN Noto Naskh Arabic",serif','amiri':'"HZN Amiri",serif','scheherazade':'"HZN Scheherazade",serif','noto-sans':'"HZN Noto Sans Arabic",sans-serif','noto-kufi':'"HZN Noto Kufi Arabic",sans-serif'};
 const s=Object.assign({locale:config.locale,font:config.font,size:1,lesson:1,index:0,mode:'learn',meaning:false,segments:false,activeSegment:null,answer:false,choice:null,review:false,search:'',seed:17,settings:false,lessonExpanded:false},config.snapshot||{});
 s.locale=locales.includes(config.locale)?config.locale:'ar';s.font=fonts.includes(s.font)?s.font:fonts[0];
 if(!lessons.some(l=>l.number===s.lesson))s.lesson=1;
 if(!['learn','readCheck','meaningCheck','quiz'].includes(s.mode))s.mode='learn';
 s.size=Math.max(.8,Math.min(2,Number(s.size)||1));
 // A resumed activity starts focused; opening a directory is transient UI state.
 s.lessonExpanded=false;s.settings=false;
 const reviewed=new Set((config.reviewed||[]).filter(id=>byId.has(id))),ratings={...config.ratings,...config.snapshot?.ratings};
 let audio=null,sequence=0,disposed=false;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const t=k=>DATA.ui.locales[s.locale][k]||'';
 const rtl=()=>DATA.ui.rtl.includes(s.locale), num=n=>new Intl.NumberFormat(s.locale).format(n);
 const tr=e=>DATA.translations[e.id][s.locale];
 const normal=x=>x.normalize('NFD').replace(/[\u064b-\u065f\u0670\u0640]/g,'').toLowerCase();
 const pool=()=>s.review?entries.filter(e=>ratings[e.id]==='retry'):lessons.find(l=>l.number===s.lesson).entry_ids.map(id=>byId.get(id));
 const current=()=>pool()[Math.min(s.index,Math.max(0,pool().length-1))];
 function stop(){sequence++;if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio.removeAttribute('src');audio.load();audio=null;}}
 async function play(id){
  if(disposed)return false;const e=byId.get(id),record=DATA.audio.records[id];if(!e||!record)return false;
  stop();const request=sequence;
  try{
   const src=await config.resolveAudio(record.path);if(disposed||request!==sequence)return false;
   const player=new Audio(src);audio=player;player.preload='auto';player.playbackRate=1;player.preservesPitch=true;
   player.onended=()=>{if(!disposed&&request===sequence)config.onProgress({kind:'audio',id,correct:true});};
   player.onerror=()=>{if(!disposed&&request===sequence)config.onAudioError(t('audioError'));};
   await player.play();return true;
  }catch(error){if(!disposed&&request===sequence)config.onAudioError(t('audioError'));return false;}
 }
 function shape(id,label,small=false){
  const g=DATA.outlines.glyphs[id]?.[s.font];if(!g)throw Error('BLENDING4_GLYPH_MISSING');
  return `<svg class="${small?'segment-glyph':'target-glyph'}" viewBox="${esc(DATA.outlines.view_box)}" role="img" aria-label="${esc(label)}" lang="ar" dir="rtl"><g transform="${esc(g.transform)}">${g.paths.map(p=>`<path d="${esc(p.d)}" fill="var(--${esc(p.color)})" ${s.activeSegment!==null&&!small&&!(p.syllableIndices||[]).includes(s.activeSegment)?'class="inactive-segment"':''}/>`).join('')}</g>${(g.underline_madd||[]).map(p=>`<line x1="${p.x1}" x2="${p.x2}" y1="${p.y}" y2="${p.y}" stroke="var(--madd)" stroke-width="${p.strokeWidth}" stroke-linecap="round"/>`).join('')}</svg>`;
 }
 const type=e=>e.role_key==='question'?t('questionWord'):DATA.ui.classes[s.locale][e.class];
 function semantic(e){
  const image=DATA.images[e.text],g=DATA.grammar[s.locale];
  return `<section class="semantic" data-meaning-panel><div class="semantic-layout">${image?`<img src="${image.data_url}" alt="" width="160" height="160" class="semantic-image">`:''}<div><h2>${esc(t('meaning'))}</h2><p class="meaning-value" data-word-meaning>${esc(tr(e))}</p><p data-word-type>${esc(t('type'))}: <strong>${esc(type(e))}</strong></p><div class="grammar-tags">${e.grammar.map(k=>`<span data-grammar="${esc(k)}">${esc(g[k])}</span>`).join('')}</div>${e.example_ar?`<p class="usage-label">${esc(t('usage'))}</p><p lang="ar" dir="rtl" class="example" data-example>${esc(e.example_ar)}</p>`:''}</div></div>${e.class==='verb'?`<p class="grammar-note">${esc(g.grammarNote)}</p>`:''}</section>`;
 }
 function segments(e){return `<div class="segments" dir="rtl" aria-label="${esc(t('syllables'))}">${e.syllables.map((part,i)=>`<button type="button" class="segment-button" data-segment="${i}" aria-pressed="${s.activeSegment===i}" aria-label="${esc(part)}">${shape('unit:'+part,part,true)}</button>`).join('')}</div>`;}
 function options(e,meaning){
  const available=entries.filter(x=>x.id!==e.id&&(!meaning||x.semantic_key!==e.semantic_key));
  let rotation=(e.recording_order*17+s.seed)%available.length;
  const arranged=available.slice(rotation).concat(available.slice(0,rotation));
  arranged.sort((a,b)=>(a.class===e.class?0:1)-(b.class===e.class?0:1));
  const result=[e],seen=new Set([meaning?tr(e):e.text]);
  for(const x of arranged){const v=meaning?tr(x):x.text;if(!seen.has(v)){result.push(x);seen.add(v);}if(result.length===4)break;}
  const at=(e.recording_order+s.seed)%result.length;return result.slice(at).concat(result.slice(0,at));
 }
 function reset(){s.meaning=false;s.segments=false;s.activeSegment=null;s.answer=false;s.choice=null;stop();}
 function move(delta){const p=pool();if(s.index+delta<0||s.index+delta>=p.length)return;s.index+=delta;reset();render();}
 function snapshot(){
  // Explicit fields keep the display-state contract separate from curriculum data.
  return {locale:s.locale,font:s.font,size:s.size,lesson:s.lesson,index:s.index,mode:s.mode,
   meaning:s.meaning,segments:s.segments,activeSegment:s.activeSegment,answer:s.answer,
   choice:s.choice,review:s.review,search:s.search,seed:s.seed,settings:s.settings,
   lessonExpanded:s.lessonExpanded,ratings:{...ratings}};
 }
 function saveSnapshot(){config.onSnapshot?.(snapshot());}
 function preferences(){return {locale:s.locale,font:s.font,size:s.size,minSize:.8,maxSize:2,step:.1,
  fontChoices:fonts.map(id=>({id,label:DATA.font_names[id]})),locales:locales.map(id=>({id,label:DATA.ui.names[id]}))};}
 function setPreferences(value={}){
  let changed=false;
  if(locales.includes(value.locale)&&value.locale!==s.locale){s.locale=value.locale;changed=true;}
  if(fonts.includes(value.font)&&value.font!==s.font){s.font=value.font;changed=true;}
  if(Number.isFinite(Number(value.size))){const size=Math.max(.8,Math.min(2,Number(value.size)));if(size!==s.size){s.size=size;changed=true;}}
  if(changed)render({preserveAudio:true});
  return preferences();
 }
 function applyScaleAccessibility(){
  root.host.setAttribute('data-word-zoomed',String(s.size>1));
  for(const visual of root.querySelectorAll('.target-visual')){
   if(s.size>1){visual.tabIndex=0;visual.setAttribute('aria-label',t('textSize')+' '+num(Math.round(s.size*100))+'%');}
   else{visual.removeAttribute('tabindex');visual.removeAttribute('aria-label');}
  }
 }
 function focusActivity(){root.getElementById('reader-inner')?.focus({preventScroll:true});}
 function toggleLessons(force){
  const panel=root.getElementById('lesson-panel');if(!panel)return;
  panel.open=typeof force==='boolean'?force:!panel.open;
  s.lessonExpanded=panel.open;saveSnapshot();
  if(!panel.open)root.getElementById('lesson-summary')?.focus({preventScroll:true});
 }
 function render({preserveAudio=false}={}){
  if(disposed)return;if(!preserveAudio)stop();
  const oldFocus=root.activeElement,focusId=oldFocus?.id;
  const focusAttribute=['data-index','data-segment','data-choice','data-rating','data-word','data-play'].find(k=>oldFocus?.hasAttribute(k));
  const focusValue=focusAttribute?oldFocus.getAttribute(focusAttribute):null;
  root.host.dir=rtl()?'rtl':'ltr';root.host.lang=s.locale;root.host.style.setProperty('--reader-font',fontFamilies[s.font]);root.host.style.setProperty('--word-size',s.size);
  const p=pool();s.index=Math.max(0,Math.min(s.index,p.length-1));const e=current(),lesson=lessons.find(l=>l.number===s.lesson);
  // Lesson titles do not contain the target word: the listening reveal gate stays intact.
  const heading=`${esc(t('lessonsWord'))} ${num(s.lesson)} · ${esc(t(lesson.skill_ui_key))}`;
  const settings=config.externalSettings?'':`<details class="settings-panel" id="settings" ${s.settings?'open':''}><summary>${esc(t('font'))} · ${esc(t('textSize'))} · ${esc(t('language'))}</summary><section class="controls"><label>${esc(t('language'))}<select id="locale">${locales.map(l=>`<option value="${l}" ${l===s.locale?'selected':''}>${esc(DATA.ui.names[l])}</option>`).join('')}</select></label><label>${esc(t('font'))}<select id="font">${fonts.map(f=>`<option value="${f}" ${f===s.font?'selected':''}>${esc(DATA.font_names[f])}</option>`).join('')}</select></label><label>${esc(t('textSize'))}<input id="size" type="range" min="0.8" max="2" step="0.1" value="${s.size}"></label></section></details>`;
  root.innerHTML=`<style>${config.css}</style><main class="b4" aria-label="${esc(t('title'))}">
   <header class="b4-header"><h2>${heading}</h2><span class="review-count">${esc(t('wordsLearned'))} <b dir="ltr">${num(reviewed.size)} / ${num(entries.length)}</b></span></header>
   ${settings}
   <div class="lesson-layout"><details class="lessons" id="lesson-panel" ${s.lessonExpanded?'open':''}>
    <summary id="lesson-summary">${esc(t('lessons'))} · ${num(lessons.length)}</summary>
    <div class="lesson-directory"><label for="lesson">${esc(t('lessons'))}</label><select id="lesson" ${s.review?'disabled':''}>${lessons.map(l=>`<option value="${l.number}" ${s.lesson===l.number?'selected':''}>${esc(t('lessonsWord'))} ${num(l.number)} · ${esc(t(l.skill_ui_key))}</option>`).join('')}</select>
     <p class="skill-note">${esc(t('newSkill'))}: ${esc(t(lesson.skill_ui_key))}</p>
     <div class="word-grid" dir="rtl" ${s.mode==='quiz'&&s.choice!==e?.id?'hidden':''}>${p.map((x,i)=>`<button type="button" class="word-chip" data-index="${i}" aria-pressed="${i===s.index}" lang="ar">${esc(x.text)}</button>`).join('')}</div>
     <button type="button" id="review" data-action="review" aria-pressed="${s.review}">${esc(s.review?t('allWords'):t('tryAgain'))} · ${num(entries.filter(x=>ratings[x.id]==='retry').length)}</button>
     <details class="all-words" id="all-words"><summary>${esc(t('allWords'))} · ${num(entries.length)}</summary><label for="word-search">${esc(t('chooseTarget'))}</label><input type="search" id="word-search" value="${esc(s.search)}"><div id="all-grid" class="all-grid"></div></details>
     <p class="directory-help">${esc(t('intro'))}. ${esc(t('footer'))}</p>
    </div>
   </details>
   <section class="reader" aria-label="${esc(t('activity'))}"><div class="modes" role="tablist" aria-label="${esc(t('activity'))}">${['learn','readCheck','meaningCheck','quiz'].map(m=>`<button type="button" role="tab" id="mode-${m}" data-mode="${m}" aria-controls="reader-inner" aria-selected="${s.mode===m}" tabindex="${s.mode===m?0:-1}">${esc(t(m))}</button>`).join('')}</div><div id="reader-inner" role="tabpanel" aria-labelledby="mode-${s.mode}" tabindex="-1">${e?card(e):`<p class="empty" role="status">${esc(t('empty'))}</p>`}</div><nav class="pager" aria-label="${esc(t('lessons'))}"><button type="button" id="prev" data-action="prev" ${s.index===0||!e?'disabled':''}>${esc(t('previous'))}</button><span dir="ltr">${num(e?s.index+1:0)} / ${num(p.length)}</span><button type="button" id="next" data-action="next" ${s.index===p.length-1||!e?'disabled':''}>${esc(t('next'))}</button></nav></section></div></main>`;
  applyScaleAccessibility();
  const restored=focusId?root.getElementById(focusId):focusAttribute?[...root.querySelectorAll(`[${focusAttribute}]`)].find(x=>x.getAttribute(focusAttribute)===focusValue):null;
  if(restored&&!restored.disabled)restored.focus({preventScroll:true});else if(oldFocus)focusActivity();
  saveSnapshot();
 }
 function card(e){
  const isRead=s.mode==='readCheck',isQuiz=s.mode==='quiz',isMeaning=s.mode==='meaningCheck';
  let html=`<p class="reading-instruction">${esc(t(isRead?'readHint':isQuiz?'listenFirst':isMeaning?'meaningHint':'readFirst'))}</p>`;
  if(!isQuiz||s.choice===e.id)html+=`<div class="target-visual" data-target="${esc(e.id)}">${shape(e.id,e.text)}</div>`;
  if(isQuiz){
   html+=`<div class="word-tools"><button type="button" class="primary" data-play="${esc(e.id)}">▶ ${esc(t('listen'))}</button></div>`;
  }
  if(isMeaning)html+=`<div class="word-tools"><button type="button" data-play="${esc(e.id)}">▶ ${esc(t('listen'))}</button></div>`;
  if(isQuiz||isMeaning){
   html+=`<div class="meaning-options ${isQuiz?'arabic-options':''}">${options(e,isMeaning).map(o=>`<button type="button" data-choice="${esc(o.id)}" ${isQuiz?'lang="ar" dir="rtl"':''} class="${s.choice===o.id?(o.id===e.id?'correct':'wrong'):''}" ${s.choice===e.id?'disabled':''}>${esc(isMeaning?tr(o):o.text)}</button>`).join('')}</div>`;
   if(s.choice)html+=`<p role="status" class="feedback">${esc(t(s.choice===e.id?'correct':'incorrect'))}</p>`;
   if(s.choice===e.id)html+=semantic(e);
  }else if(isRead){
   html+=`<div class="word-tools"><button type="button" id="answer" class="primary" data-action="answer" aria-expanded="${s.answer}">${esc(t(s.answer?'readFirst':'revealAnswer'))}</button></div>`;
   if(s.answer)html+=`<div class="word-tools"><button type="button" data-play="${esc(e.id)}">▶ ${esc(t('listen'))}</button></div>`+segments(e)+semantic(e)+`<div class="read-rating"><p>${esc(t('ratingNotice'))}</p><button type="button" data-rating="correct" aria-pressed="${ratings[e.id]==='correct'}">${esc(t('selfCorrect'))}</button><button type="button" data-rating="retry" aria-pressed="${ratings[e.id]==='retry'}">${esc(t('tryAgain'))}</button></div>`;
  }else{
   html+=`<div class="word-tools"><button type="button" id="segments" data-action="segments" aria-expanded="${s.segments}">${esc(t(s.segments?'join':'segment'))}</button><button type="button" id="meaning" class="primary" data-action="meaning" aria-expanded="${s.meaning}">${esc(t(s.meaning?'hideMeaning':'showMeaning'))}</button><button type="button" data-play="${esc(e.id)}">▶ ${esc(t('listen'))}</button></div>`;
   if(s.segments)html+=segments(e);if(s.meaning)html+=semantic(e);
  }
  const note=e.mode==='marked_verb'?DATA.notes.locales[s.locale].skillVerbEnd:e.mode==='isolated_pause'?DATA.notes.locales[s.locale].skillPause:'';
  if(s.mode==='learn'&&note)html+=`<p class="reading-convention">${esc(note)}</p>`;
  return html;
 }
 function allWords(){const el=root.getElementById('all-grid');if(!el)return;const q=normal(s.search);el.innerHTML=entries.filter(e=>normal(e.text+' '+tr(e)).includes(q)).map(e=>`<button type="button" data-word="${esc(e.id)}" lang="ar" dir="rtl">${esc(e.text)}</button>`).join('');}
 function onClick(event){
  const b=event.target.closest('button');if(!b||b.disabled||!root.contains(b))return;const e=current();
  if(b.dataset.play){play(b.dataset.play);return;}
  if(b.dataset.mode){s.mode=b.dataset.mode;reset();render();return;}
  if(b.dataset.index!==undefined){s.index=Number(b.dataset.index);s.lessonExpanded=false;reset();render();focusActivity();return;}
  if(b.dataset.segment!==undefined){const n=Number(b.dataset.segment);s.activeSegment=s.activeSegment===n?null:n;render();return;}
  if(b.dataset.word){const x=byId.get(b.dataset.word);s.review=false;s.lesson=x.lesson;s.index=pool().findIndex(a=>a.id===x.id);s.lessonExpanded=false;reset();render();root.getElementById('reader-inner').focus({preventScroll:true});return;}
  if(b.dataset.choice&&e){s.choice=b.dataset.choice;const correct=s.choice===e.id;config.onProgress({kind:s.mode==='quiz'?'listen':'meaning',id:e.id,correct});if(correct)reviewed.add(e.id);render();return;}
  if(b.dataset.rating&&e){ratings[e.id]=b.dataset.rating;const correct=b.dataset.rating==='correct';if(correct)reviewed.add(e.id);config.onProgress({kind:'read',id:e.id,correct});if(s.review&&correct){reset();}render();return;}
  const action=b.dataset.action;
  if(action==='prev')move(-1);else if(action==='next')move(1);else if(action==='review'){s.review=!s.review;s.index=0;s.lessonExpanded=false;reset();render();focusActivity();}
  else if(action==='segments'){s.segments=!s.segments;s.activeSegment=null;render();}
  else if(action==='answer'){s.answer=!s.answer;render();}
  else if(action==='meaning'&&e){s.meaning=!s.meaning;if(s.meaning){reviewed.add(e.id);config.onProgress({kind:'reviewed',id:e.id,correct:true});}render();}
 }
 function onChange(event){const v=event.target.value;switch(event.target.id){case 'locale':config.onLocale(v);break;case 'font':setPreferences({font:v});break;case 'lesson':s.lesson=Number(v);s.index=0;s.lessonExpanded=false;reset();render();focusActivity();break;}}
 function onInput(event){if(event.target.id==='size'){s.size=Math.max(.8,Math.min(2,Number(event.target.value)||1));root.host.style.setProperty('--word-size',s.size);applyScaleAccessibility();saveSnapshot();}if(event.target.id==='word-search'){s.search=event.target.value;allWords();}}
 function onToggle(event){if(event.target.id==='all-words'&&event.target.open)allWords();if(event.target.id==='settings')s.settings=event.target.open;if(event.target.id==='lesson-panel')s.lessonExpanded=event.target.open;saveSnapshot();}
 function onKey(event){const target=event.target;if(event.key==='Escape'&&root.getElementById('lesson-panel')?.open&&target.closest('#lesson-panel')){event.preventDefault();toggleLessons(false);return;}if(event.key==='Escape'&&root.getElementById('settings')?.open&&target.closest('#settings')){event.preventDefault();root.getElementById('settings').open=false;root.querySelector('#settings summary').focus({preventScroll:true});return;}if(target.matches('[data-mode]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){const tabs=[...root.querySelectorAll('[data-mode]')],at=tabs.indexOf(target),delta=(event.key==='ArrowRight'?1:-1)*(rtl()?-1:1),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(at+delta+tabs.length)%tabs.length;event.preventDefault();tabs[next].click();root.getElementById(tabs[next].id)?.focus();}}
 root.addEventListener('click',onClick);root.addEventListener('change',onChange);root.addEventListener('input',onInput);root.addEventListener('toggle',onToggle,true);root.addEventListener('keydown',onKey);render();
 return {stop,dispose(){disposed=true;stop();root.removeEventListener('click',onClick);root.removeEventListener('change',onChange);root.removeEventListener('input',onInput);root.removeEventListener('toggle',onToggle,true);root.removeEventListener('keydown',onKey);},snapshot,getPreferences:preferences,setPreferences,focusActivity,toggleLessons,setFont(id){return setPreferences({font:id});}};
}
