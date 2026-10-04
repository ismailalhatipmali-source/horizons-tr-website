/* Generic Section 04 renderer. Curriculum, translations, glyphs and audio are supplied privately at runtime. */
function mountBlending3Component(root,DATA,config){
 const $=s=>root.querySelector(s);
 const supported=Object.keys(DATA.ui.locales);
 // Reuse document-level workbook faces: shadow @font-face support differs across browsers.
 const fontFamilies={
  'noto-naskh':'"HZN Noto Naskh Arabic",serif',
  'amiri':'"HZN Amiri",serif',
  'scheherazade':'"HZN Scheherazade",serif',
  'noto-sans':'"HZN Noto Sans Arabic",sans-serif',
  'noto-kufi':'"HZN Noto Kufi Arabic",sans-serif'
 };
 const deviceLanguage=config.locale;
 const state={locale:supported.includes(deviceLanguage)?deviceLanguage:'ar',font:config.font,size:1,lesson:1,index:0,mode:'learn',meaning:false,segments:false,activeSegment:null,answer:false,choice:null,practice:false,ratings:{},reviewed:new Set()};
 if(config.snapshot)Object.assign(state,config.snapshot,{locale:config.locale});
 state.reviewed=new Set(config.reviewed);state.ratings={...config.ratings,...config.snapshot?.ratings};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const t=key=>DATA.ui.locales[state.locale][key];
 const num=n=>new Intl.NumberFormat(state.locale).format(n);
 const isRtl=()=>DATA.ui.rtl.includes(state.locale);
 const pool=()=>state.practice?DATA.bank.extra_practice:DATA.bank.entries.filter(e=>e.lesson===state.lesson);
 const current=()=>pool()[state.index];
 let currentAudio=null;
 function stopAudio(){if(currentAudio){currentAudio.onended=null;currentAudio.onerror=null;currentAudio.pause();currentAudio.currentTime=0;currentAudio=null;}}
 function playCurrent(){
  const e=current(),record=DATA.audio?.records[e.id];
  if(state.practice||!record)return Promise.resolve(false);
  stopAudio();currentAudio=new Audio(config.resolveAudio(record.path));
  currentAudio.onended=()=>config.onProgress({kind:'audio',id:e.id,correct:true});
  currentAudio.onerror=()=>config.onAudioError(t('audioError'));
  return currentAudio.play().then(()=>true);
 }
 const shape=(id,label,small=false)=>{
  const g=DATA.outlines.glyphs[id]?.[state.font];
  if(!g)throw new Error('Missing glyph '+id+' / '+state.font);
  return `<svg class="${small?'segment-glyph':'target-glyph'}" viewBox="${esc(DATA.outlines.view_box)}" role="img" aria-label="${esc(label)}" lang="ar" dir="rtl" focusable="false"><g transform="${esc(g.transform)}">${g.paths.map(p=>`<path d="${esc(p.d)}" fill="var(--${p.color==='ink'?'ink':esc(p.color)})" ${state.activeSegment!==null&&!small&&!(p.syllableIndices||[p.syllableIndex]).includes(state.activeSegment)?'class="inactive-segment"':''} data-cluster="${p.clusterIndex}" data-syllable="${p.syllableIndex}"/>`).join('')}</g>${(g.underline_madd||[]).map(p=>`<line x1="${p.x1}" x2="${p.x2}" y1="${p.y}" y2="${p.y}" stroke="var(--madd)" stroke-width="${p.strokeWidth}" stroke-linecap="round"/>`).join('')}</svg>`;
 };
 const classLabel=e=>e.role_key==='question'?t('questionWord'):e.role_key==='answer'?t('response'):DATA.ui.classes[state.locale][e.class];
 function translation(e){const value=DATA.translations[e.id]?.[state.locale];if(typeof value!=='string'||!value.trim())throw new Error('Missing meaning '+e.id+' / '+state.locale);return value;}
 function options(e){
  const target=translation(e),seen=new Set([target]);
  let candidates=DATA.bank.entries.filter(x=>x.id!==e.id).map(x=>({id:x.id,label:translation(x),rank:x.class===e.class?0:1}));
  const seed=DATA.bank.entries.findIndex(x=>x.id===e.id)+1;
  candidates=candidates.slice((seed*13)%candidates.length).concat(candidates.slice(0,(seed*13)%candidates.length)).sort((a,b)=>a.rank-b.rank);
  const result=[{id:e.id,label:target}];
  for(const x of candidates){if(!seen.has(x.label)){seen.add(x.label);result.push(x);}if(result.length===4)break;}
  const offset=seed%result.length;
  return result.slice(offset).concat(result.slice(0,offset));
 }
 function resetTarget(){state.meaning=false;state.segments=false;state.activeSegment=null;state.answer=false;state.choice=null;}
 function selectTarget(id){const e=DATA.bank.entries.find(x=>x.id===id);if(!e)return;state.practice=false;state.lesson=e.lesson;state.index=pool().findIndex(x=>x.id===id);resetTarget();render();}
 function meaningPanel(e){
  const image=DATA.images[e.text];
  return `<div class="semantic" data-meaning-panel lang="${state.locale}" dir="${isRtl()?'rtl':'ltr'}"><div class="semantic-layout">${image?`<img class="semantic-image" src="${image.data_url}" alt="" width="150" height="150">`:''}<div><h2>${esc(t('meaning'))}</h2><p class="meaning-value" data-word-meaning>${esc(translation(e))}</p><p class="meaning-type" data-word-type>${esc(t('type'))}: ${esc(classLabel(e))}</p></div></div></div>`;
 }
 function segmentsPanel(e){return `<div class="segments" dir="rtl" aria-label="${esc(t('syllables'))}">${e.syllables.map((s,i)=>`<button type="button" class="segment-button" data-segment="${i}" aria-label="${esc(s)}" lang="ar" dir="rtl" aria-pressed="${state.activeSegment===i}">${shape('unit:'+s,s,true)}</button>`).join('')}</div>`;}
 function renderCard(){
  const e=current(),isPractice=state.practice;
  const instruction=state.mode==='readCheck'?t('readHint'):state.mode==='meaningCheck'?t('meaningHint'):t('readFirst');
  let body=`<p class="reading-instruction">${esc(instruction)}</p><div class="target-visual">${shape(e.id,e.text)}</div>`;
  if(state.mode==='meaningCheck'&&isPractice){
   body+=`<section class="semantic practice-explanation" data-practice-explanation lang="${state.locale}" dir="${isRtl()?'rtl':'ltr'}"><h2>${esc(t('practice'))}</h2><p data-practice-note>${esc(t('practiceNoMeaning'))}</p><div class="word-tools"><button type="button" class="tool-button primary" id="return-lessons">${esc(t('lessons'))}</button></div></section>`;
  }else if(state.mode==='meaningCheck'){
   body+=`<p class="reading-instruction">${esc(t('chooseMeaning'))}</p><div class="meaning-options" lang="${state.locale}" dir="${isRtl()?'rtl':'ltr'}">${options(e).map(o=>`<button type="button" class="meaning-option ${state.choice===o.id?(o.id===e.id?'correct':'wrong'):''}" data-choice="${esc(o.id)}" ${state.choice===e.id?'disabled':''}>${esc(o.label)}</button>`).join('')}</div>`;
   if(state.choice)body+=`<p class="feedback ${state.choice===e.id?'success':'retry'}" role="status">${esc(t(state.choice===e.id?'correct':'incorrect'))}</p>`;
   if(state.choice===e.id)body+=meaningPanel(e);
  }else if(state.mode==='readCheck'){
   body+=`<div class="word-tools"><button type="button" class="tool-button primary" id="answer-toggle" aria-expanded="${state.answer}">${esc(t(state.answer?'readFirst':'revealAnswer'))}</button></div>`;
   if(state.answer){body+=segmentsPanel(e);body+=isPractice?`<p class="reading-instruction" data-practice-note>${esc(t('practiceNoMeaning'))}</p>`:meaningPanel(e);body+=`<div class="read-rating"><p>${esc(t('ratingNotice'))}</p><div class="rating-buttons"><button type="button" class="tool-button" data-rating="correct" aria-pressed="${state.ratings[e.id]==='correct'}">${esc(t('selfCorrect'))}</button><button type="button" class="tool-button" data-rating="retry" aria-pressed="${state.ratings[e.id]==='retry'}">${esc(t('tryAgain'))}</button></div></div>`;}
  }else{
   body+=`<div class="word-tools"><button type="button" class="tool-button" id="segment-toggle" aria-expanded="${state.segments}">${esc(t(state.segments?'join':'segment'))}</button>${!isPractice?`<button type="button" class="tool-button primary" id="meaning-toggle" aria-expanded="${state.meaning}">${esc(t(state.meaning?'hideMeaning':'showMeaning'))}</button>`:''}</div>`;
   if(state.segments)body+=segmentsPanel(e);
   if(isPractice)body+=`<p class="reading-instruction" data-practice-note>${esc(t('practiceNoMeaning'))}</p>`;
   else if(state.meaning)body+=meaningPanel(e);
  }
  if(!isPractice&&(state.mode!=='readCheck'||state.answer)){
   const hasAudio=Boolean(DATA.audio?.records[e.id]);
   body+=`<div class="word-tools" style="margin-top:10px"><button type="button" class="tool-button" id="listen-word" ${hasAudio?'':'disabled aria-disabled="true"'} aria-describedby="notice">${esc(t(hasAudio?'listen':'soundPending'))}</button></div>`;
  }
  if(state.mode==='learn'&&!isPractice){const note=e.mode==='marked_verb'?DATA.notes.locales[state.locale].skillVerbEnd:e.mode==='isolated_pause'?DATA.notes.locales[state.locale].skillPause:'';if(note)body+=`<p class="reading-convention">${esc(note)}</p>`;}
  $('#reader-inner').innerHTML=body;
  $('#reader-inner').dataset.targetId=e.id;
  $('#reader-inner').tabIndex=-1;
  $('#listen-word')?.addEventListener('click',()=>{playCurrent().catch(()=>config.onAudioError(t('audioError')));});
  $('#segment-toggle')?.addEventListener('click',()=>{state.segments=!state.segments;state.activeSegment=null;render();});
  $('#meaning-toggle')?.addEventListener('click',()=>{state.meaning=!state.meaning;if(state.meaning){state.reviewed.add(e.id);config.onProgress({kind:'reviewed',id:e.id,correct:true});}render();});
  $('#return-lessons')?.addEventListener('click',()=>{state.practice=false;state.index=0;resetTarget();render();});
  $('#answer-toggle')?.addEventListener('click',()=>{state.answer=!state.answer;state.activeSegment=null;render();});
  root.querySelectorAll('[data-segment]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.segment);state.activeSegment=state.activeSegment===i?null:i;render();}));
  root.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>{state.choice=b.dataset.choice;config.onProgress({kind:'meaning',id:e.id,correct:state.choice===e.id});if(state.choice===e.id)state.reviewed.add(e.id);render();}));
  root.querySelectorAll('[data-rating]').forEach(b=>b.addEventListener('click',()=>{const correct=b.dataset.rating==='correct';state.ratings[e.id]=b.dataset.rating;if(correct&&!isPractice)state.reviewed.add(e.id);config.onProgress({kind:'read',id:e.id,correct});render();}));
 }
 function render(){
  const active=root.activeElement;
  const focusId=active?.id;
  const focusAttribute=['data-index','data-segment','data-choice','data-rating','data-word'].find(k=>active?.hasAttribute(k));
  const focusValue=focusAttribute?active.getAttribute(focusAttribute):null;
  stopAudio();
  root.host.lang=state.locale;root.host.dir=isRtl()?'rtl':'ltr';root.host.style.setProperty('--reader-font',fontFamilies[state.font]??fontFamilies['noto-naskh']);root.host.style.setProperty('--word-size',state.size);
  
  const textNodes={title:'title',intro:'intro','review-label':'reviewVersion',notice:'audioReviewNotice','language-label':'language','font-label':'font','font-summary':'font','size-label':'textSize','lesson-heading':'lessons','all-label':'allWords',footer:'sectionStatus'};
  for(const [id,key] of Object.entries(textNodes))$('#'+id).textContent=t(key);
  $('#locale').value=state.locale;$('#font').value=state.font;$('#size').value=state.size;
  for(const [id,key] of Object.entries({locale:'language',font:'font',size:'textSize',lesson:'lessonsWord'}))$('#'+id).setAttribute('aria-label',t(key));
  $('.modes').setAttribute('aria-label',t('activity'));
  $('#reader-inner').setAttribute('aria-labelledby',{learn:'mode-learn',readCheck:'mode-read',meaningCheck:'mode-meaning'}[state.mode]);
  $('#lesson').innerHTML=DATA.bank.lessons.map((l,i)=>`<option value="${l.number}">${esc(t('lessonsWord'))} ${num(i+1)} · ${esc(t(l.skill_ui_key))}</option>`).join('');$('#lesson').value=state.lesson;$('#lesson').disabled=state.practice;
  const lesson=DATA.bank.lessons.find(x=>x.number===state.lesson);
  $('#lesson-skill').innerHTML=`${esc(t('newSkill'))}: <span class="skill-badge">${esc(t(state.practice?'blendPractice':lesson.skill_ui_key))}</span>`;
  const entries=pool();state.index=Math.max(0,Math.min(state.index,entries.length-1));
  const e=entries[state.index],notes=DATA.notes.locales[state.locale];
  const skillKey={lessonMaddSukun:'skillMadd',lessonDiphthong:'skillDiphthong',lessonHamza:'skillHamza',lessonMaqsura:'skillMaqsura',lessonTaaMarbuta:'skillTaaMarbuta',lessonShadda:'skillShadda'}[lesson.skill_ui_key];
  const noteKey=state.practice?null:skillKey||(e.prerequisites.includes('pause_consonant_cluster')?'skillFinalCluster':e.prerequisites.includes('medial_sukun')?'skillInternalSukun':e.prerequisites.includes('long_vowels')?'skillMadd':'skillInternalSukun');
  $('#skill-note').textContent=noteKey?notes[noteKey]:'';$('#skill-note').hidden=!noteKey;
  $('#lesson-count').textContent=num(entries.length)+' · '+t('allWords');
  $('#word-grid').innerHTML=entries.map((e,i)=>`<button type="button" class="word-chip" data-index="${i}" lang="ar" dir="rtl" aria-pressed="${state.index===i}">${esc(e.text)}</button>`).join('');
  $('#practice').textContent=state.practice?t('lessons'):t('practice');$('#practice').setAttribute('aria-pressed',String(state.practice));
  $('#review-count').textContent=t('wordsLearned')+': '+num(DATA.bank.entries.filter(e=>state.reviewed.has(e.id)).length);
  root.querySelectorAll('[data-mode]').forEach(b=>{b.textContent=t(b.dataset.mode);b.setAttribute('aria-selected',String(state.mode===b.dataset.mode));b.disabled=false;b.tabIndex=state.mode===b.dataset.mode?0:-1;});
  $('#prev').textContent=t('previous');$('#next').textContent=t('next');$('#prev').disabled=state.index===0;$('#next').disabled=state.index===entries.length-1;
  $('#counter').textContent=num(state.index+1)+' / '+num(entries.length);
  if($('#all-words').open)renderAllWords();
  renderCard();
  root.querySelectorAll('[data-index]').forEach(b=>b.addEventListener('click',()=>{state.index=Number(b.dataset.index);resetTarget();render();}));
  const restored=focusId?root.getElementById(focusId):focusAttribute?Array.from(root.querySelectorAll(`[${focusAttribute}]`)).find(x=>x.getAttribute(focusAttribute)===focusValue):null;
  if(restored&&!restored.disabled)restored.focus({preventScroll:true});
  else if(focusId||focusAttribute)$('#reader-inner').focus({preventScroll:true});
 }
 function renderAllWords(){
  $('#all-grid').innerHTML=DATA.bank.entries.map(e=>`<button type="button" data-word="${esc(e.id)}" lang="ar" dir="rtl" aria-pressed="${current().id===e.id}">${esc(e.text)}</button>`).join('');
  root.querySelectorAll('[data-word]').forEach(b=>b.addEventListener('click',()=>{selectTarget(b.dataset.word);$('#all-words').open=false;$('#reader-inner').focus({preventScroll:true});$('#reader').scrollIntoView({behavior:'auto',block:'nearest'});}));
 }
 $('#locale').innerHTML=supported.map(c=>`<option value="${c}">${esc(DATA.ui.names[c])}</option>`).join('');
 $('#font').innerHTML=DATA.outlines.font_ids.map(id=>`<option value="${id}">${esc(DATA.font_names[id])}</option>`).join('');
 $('#locale').addEventListener('change',e=>{config.onLocale(e.target.value);});
 $('#font').addEventListener('change',e=>{state.font=e.target.value;render();});
 $('#size').addEventListener('input',e=>{state.size=Number(e.target.value);root.host.style.setProperty('--word-size',state.size);});
 $('#lesson').addEventListener('change',e=>{state.lesson=Number(e.target.value);state.index=0;resetTarget();render();});
 $('#practice').addEventListener('click',()=>{state.practice=!state.practice;state.index=0;resetTarget();render();});
 root.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;resetTarget();render();}));
 root.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  const tabs=Array.from(root.querySelectorAll('[data-mode]')).filter(x=>!x.disabled),index=tabs.indexOf(b);
  const delta=e.key==='ArrowRight'?(isRtl()?-1:1):(isRtl()?1:-1);
  const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+delta+tabs.length)%tabs.length;
  e.preventDefault();tabs[next].click();tabs[next].focus();
 }));
 function move(delta){const next=state.index+delta;if(next<0||next>=pool().length)return;state.index=next;resetTarget();render();}
 $('#prev').addEventListener('click',()=>move(-1));$('#next').addEventListener('click',()=>move(1));
 $('#all-words').addEventListener('toggle',()=>{if($('#all-words').open)renderAllWords();});
 root.addEventListener('keydown',e=>{if(e.target.closest('select,input,textarea,button'))return;if(e.key==='ArrowLeft'){e.preventDefault();move(isRtl()?1:-1);}if(e.key==='ArrowRight'){e.preventDefault();move(isRtl()?-1:1);}});
 let touchStart=null;
 $('#reader-inner').addEventListener('touchstart',e=>{
  if(e.target.closest('button,input,select,textarea,a,summary')||e.touches.length!==1){touchStart=null;return;}
  const touch=e.changedTouches[0];touchStart={x:touch.clientX,y:touch.clientY};
 },{passive:true});
 $('#reader-inner').addEventListener('touchend',e=>{
  if(touchStart===null)return;const touch=e.changedTouches[0],dx=touch.clientX-touchStart.x,dy=touch.clientY-touchStart.y;touchStart=null;
  if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5)move((dx<0?1:-1)*(isRtl()?-1:1));
 },{passive:true});
 $('#reader-inner').addEventListener('touchcancel',()=>{touchStart=null;},{passive:true});
 render();
 return {stop:stopAudio,snapshot:()=>({...state,reviewed:undefined,ratings:{...state.ratings}}),setFont:id=>{if(DATA.outlines.font_ids.includes(id)){state.font=id;render();}}};
}
