/*BLENDING4_EXTENSION_BEGIN*/
const BLENDING4_RELEASE="blending4-20261004-r1";
const B4_TITLES={"en": "Four-letter blending", "ar": "الدمج الرباعي", "tr": "Dört harfi birleştirme", "fr": "Fusion de quatre lettres", "es": "Unir cuatro letras", "de": "Vier Buchstaben verbinden", "it": "Unire quattro lettere", "pt": "Unir quatro letras", "nl": "Vier letters samenvoegen", "ru": "Слияние четырёх букв", "uk": "Злиття чотирьох літер", "pl": "Łączenie czterech liter", "cs": "Spojování čtyř písmen", "ro": "Îmbinarea a patru litere", "hu": "Négy betű összeolvasása", "el": "Σύνθεση τεσσάρων γραμμάτων", "sv": "Sammanljudning av fyra bokstäver", "da": "Sammenlæsning af fire bogstaver", "no": "Sammenlesing av fire bokstaver", "fi": "Neljän kirjaimen yhdistäminen", "bg": "Сливане на четири букви", "sr": "Спајање четири слова", "hr": "Spajanje četiriju slova", "he": "חיבור ארבע אותיות", "fa": "ترکیب چهار حرف", "ur": "چار حرفوں کو ملا کر پڑھنا", "hi": "चार अक्षरों को जोड़कर पढ़ना", "bn": "চারটি অক্ষর মিলিয়ে পড়া", "id": "Menggabungkan empat huruf", "ms": "Menggabungkan empat huruf", "zh": "四字母拼读", "ja": "4文字の音をつなぐ"};
const B4_CSS=":host{--ink:#163047;--fatha:#cc503c;--damma:#2767ae;--kasra:#16826e;--sukun:#6b657d;--shadda:#934393;--madd:#ba8018;--line:#d9e4e7;--muted:#55707d;display:block;min-width:0;color:var(--ink);font-family:system-ui,Arial,sans-serif;font-size:16px;line-height:1.65;background:#f7faf9;border-radius:24px;--word-size:1}\n*{box-sizing:border-box}[hidden]{display:none!important}button,input,select{font:inherit}button,select,input{border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);min-height:44px}button{cursor:pointer;padding:9px 15px;white-space:normal;overflow-wrap:anywhere}button:hover{background:#edf7f5}button:disabled{cursor:default;opacity:.65}button[aria-pressed=true],button[aria-selected=true]{background:#e1f3ef;border-color:#278777}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #258d84;outline-offset:3px}.b4{padding:22px;max-width:1250px;margin:auto;min-width:0}.b4-header{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px}.b4-header h1{margin:0;font-size:clamp(22px,3vw,32px)}.b4-header p{margin:4px 0}.eyebrow{font-size:12px;letter-spacing:2px;color:var(--muted)}.review-count{min-width:140px;background:#e9f3ef;border-radius:16px;padding:10px 16px;text-align:center;font-size:13px}.review-count b{display:block;font-size:22px}.controls{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:18px;align-items:end}.controls label,.lessons label{font-size:13px;font-weight:650;min-width:0}.controls select,.controls input,.lessons select{display:block;width:100%;max-width:100%;padding:8px;margin-top:5px}.controls input{padding:0;accent-color:#247d73}.lesson-layout{display:grid;grid-template-columns:minmax(300px,.75fr) minmax(0,2fr);gap:18px;align-items:start}.lessons{background:#fff;border:1px solid var(--line);border-radius:18px;padding:15px;min-width:0}.skill-note{font-size:13px;color:var(--muted);margin:12px 0}.word-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:16px}.word-chip{font-family:var(--reader-font);font-size:calc(27px * var(--word-size));line-height:1.85;padding:5px 8px;overflow:visible;white-space:nowrap}#review{width:100%;font-size:13px}.reader{background:#fff;border:1px solid var(--line);border-radius:20px;min-width:0;overflow:hidden}.modes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:8px;background:#f0f6f4;border-bottom:1px solid var(--line)}.modes button{font-size:14px;padding:8px 4px;border-color:transparent;line-height:1.45}#reader-inner{padding:18px;min-width:0;outline:none}.reading-instruction{text-align:center;margin:0;color:var(--muted);font-size:14px}.target-visual{display:flex;justify-content:center;align-items:center;min-height:130px}.target-glyph{display:block;width:min(100%,calc(350px * var(--word-size)));height:auto;max-height:230px;overflow:visible}.inactive-segment{opacity:.2}.word-tools{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin:12px 0}.primary{background:#176c67;color:#fff;border-color:#176c67}.primary:hover{background:#125650;color:#fff}.segments{display:flex;flex-wrap:wrap;justify-content:center;gap:7px;margin:14px 0}.segment-button{padding:0;width:clamp(70px,20%,112px);line-height:0}.segment-glyph{width:100%;height:72px;overflow:visible}.semantic{margin-top:16px;background:#fffaf0;border:1px solid #eadebf;border-radius:15px;padding:16px;min-width:0}.semantic-layout{display:flex;gap:18px;align-items:center;min-width:0}.semantic-layout>div{min-width:0;flex:1}.semantic-image{width:140px;height:140px;object-fit:contain;border-radius:13px}.semantic h2{font-size:13px;color:var(--muted);margin:0}.meaning-value{font-size:21px;line-height:1.6;margin:3px 0;font-weight:650;overflow-wrap:anywhere}.semantic p[data-word-type]{font-size:13px;margin:8px 0}.grammar-tags{display:flex;flex-wrap:wrap;gap:5px}.grammar-tags span{background:#e5eeeb;border:1px solid #d5e4de;border-radius:99px;padding:3px 9px;font-size:12px;overflow-wrap:anywhere}.usage-label{font-size:12px;margin:12px 0 0;color:var(--muted)}.example{font-family:var(--reader-font);font-size:24px;line-height:2.0;margin:0;overflow-wrap:anywhere}.grammar-note,.reading-convention{font-size:12px;color:var(--muted);margin:10px 0 0}.meaning-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px}.meaning-options button{font-size:17px;min-height:65px;line-height:1.5}.meaning-options.arabic-options button{font-family:var(--reader-font);font-size:28px;line-height:1.9}.meaning-options .correct{background:#d7f1df;border-color:#2e8153}.meaning-options .wrong{background:#fee7e0;border-color:#b0543e}.feedback{text-align:center;font-weight:650}.read-rating{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;margin-top:12px}.read-rating p{width:100%;margin:0;font-size:12px;text-align:center;color:var(--muted)}.read-rating button{font-size:13px}.pager{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 18px;border-top:1px solid var(--line)}.pager button{min-width:75px}.pager span{font-size:14px}.all-words{margin-top:20px;padding:14px;border:1px solid var(--line);border-radius:16px;background:#fff}.all-words summary{cursor:pointer;font-weight:650}.all-words label{display:block;font-size:13px;margin-top:12px}.all-words input{width:100%;padding:7px 12px;margin:7px 0 14px}.all-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}.all-grid button{font:26px/1.9 var(--reader-font);white-space:nowrap;overflow:visible}.empty{text-align:center;padding:35px 10px}footer{text-align:center;font-size:12px;color:var(--muted);padding-top:15px}svg{pointer-events:none}\n@media(max-width:1000px){.b4{padding:14px}.b4-header{align-items:flex-start}.review-count{min-width:105px;padding:7px 10px}.controls{grid-template-columns:1fr 1fr}.controls label:last-child{grid-column:1/-1}.lesson-layout{grid-template-columns:1fr}.lessons{padding:12px}.word-grid{grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:10px}.word-chip{font-size:calc(25px * var(--word-size));padding:4px}.semantic-image{width:115px;height:115px}.modes button{font-size:13px}#reader-inner{padding:14px}.target-glyph{max-height:180px}.semantic{padding:12px}}\n@media(max-width:420px){.b4{padding:10px}.b4-header{display:block}.review-count{display:flex;justify-content:space-between;align-items:center;margin-top:10px}.review-count b{font-size:17px}.controls{gap:8px}.modes{grid-template-columns:1fr 1fr}.semantic-layout{flex-direction:column;align-items:stretch;gap:10px}.semantic-image{align-self:center;width:135px;height:135px}.meaning-options{grid-template-columns:1fr}.word-grid{grid-template-columns:1fr 1fr}.pager{padding:10px}.example{font-size:23px}}\n@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}@media print{.controls,.modes,.pager,.word-tools,.lessons,.all-words,.read-rating{display:none}.lesson-layout{display:block}.reader{border:none}.b4{padding:0}}\n\n.settings-panel{margin-bottom:14px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px 14px}.settings-panel summary,.lessons summary{cursor:pointer;font-size:13px;font-weight:650;min-height:28px}.settings-panel .controls{margin:12px 0 0}.lessons summary{margin-bottom:0}.lessons[open] summary{margin-bottom:10px}\n";
/* Section 05 generic reader. Paid words, glyphs and media are loaded separately. */
function mountBlending4Component(root, DATA, config) {
 'use strict';
 const entries=DATA.bank.entries, byId=new Map(entries.map(e=>[e.id,e])), lessons=DATA.bank.lessons;
 const locales=Object.keys(DATA.ui.locales), fonts=DATA.outlines.font_ids;
 const fontFamilies={'noto-naskh':'"HZN Noto Naskh Arabic",serif','amiri':'"HZN Amiri",serif','scheherazade':'"HZN Scheherazade",serif','noto-sans':'"HZN Noto Sans Arabic",sans-serif','noto-kufi':'"HZN Noto Kufi Arabic",sans-serif'};
 const s=Object.assign({locale:config.locale,font:config.font,size:1,lesson:1,index:0,mode:'learn',meaning:false,segments:false,activeSegment:null,answer:false,choice:null,review:false,search:'',seed:17,settings:false,lessonExpanded:matchMedia('(min-width:1001px)').matches},config.snapshot||{});
 s.locale=locales.includes(config.locale)?config.locale:'ar';s.font=fonts.includes(s.font)?s.font:fonts[0];
 if(!lessons.some(l=>l.number===s.lesson))s.lesson=1;
 if(!['learn','readCheck','meaningCheck','quiz'].includes(s.mode))s.mode='learn';
 s.size=Math.max(.8,Math.min(1.5,Number(s.size)||1));
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
 function saveSnapshot(){config.onSnapshot?.({...s,ratings:{...ratings}});}
 function render(){
  if(disposed)return;stop();const oldFocus=root.activeElement,focusId=oldFocus?.id,focusAction=oldFocus?.dataset?.action;
  root.host.dir=rtl()?'rtl':'ltr';root.host.lang=s.locale;root.host.style.setProperty('--reader-font',fontFamilies[s.font]);root.host.style.setProperty('--word-size',s.size);
  const p=pool();s.index=Math.max(0,Math.min(s.index,p.length-1));const e=current(),lesson=lessons.find(l=>l.number===s.lesson);
  root.innerHTML=`<style>${config.css}</style><main class="b4"><header class="b4-header"><div><p class="eyebrow">HORIZONS · 05</p><h1>${esc(t('title'))}</h1><p>${esc(t('intro'))}</p></div><span class="review-count">${esc(t('wordsLearned'))}<b dir="ltr">${num(reviewed.size)} / ${num(entries.length)}</b></span></header><details class="settings-panel" id="settings" ${s.settings?'open':''}><summary>${esc(t('font'))} · ${esc(t('textSize'))} · ${esc(t('language'))}</summary><section class="controls"><label>${esc(t('language'))}<select id="locale">${locales.map(l=>`<option value="${l}" ${l===s.locale?'selected':''}>${esc(DATA.ui.names[l])}</option>`).join('')}</select></label><label>${esc(t('font'))}<select id="font">${fonts.map(f=>`<option value="${f}" ${f===s.font?'selected':''}>${esc(DATA.font_names[f])}</option>`).join('')}</select></label><label>${esc(t('textSize'))}<input id="size" type="range" min="0.8" max="1.5" step="0.1" value="${s.size}"></label></section></details><div class="lesson-layout"><details class="lessons" id="lesson-panel" ${s.lessonExpanded?'open':''}><summary>${esc(t('lessons'))} · ${esc(t('lessonsWord'))} ${num(s.lesson)}</summary><label for="lesson">${esc(t('lessons'))}</label><select id="lesson" ${s.review?'disabled':''}>${lessons.map(l=>`<option value="${l.number}" ${s.lesson===l.number?'selected':''}>${esc(t('lessonsWord'))} ${num(l.number)} · ${esc(t(l.skill_ui_key))}</option>`).join('')}</select><p class="skill-note">${esc(t('newSkill'))}: ${esc(t(lesson.skill_ui_key))}</p><div class="word-grid" dir="rtl" ${s.mode==='quiz'&&s.choice!==e?.id?'hidden':''}>${p.map((x,i)=>`<button type="button" class="word-chip" data-index="${i}" aria-pressed="${i===s.index}" lang="ar">${esc(x.text)}</button>`).join('')}</div><button type="button" id="review" data-action="review" aria-pressed="${s.review}">${esc(s.review?t('allWords'):t('tryAgain'))} · ${num(entries.filter(x=>ratings[x.id]==='retry').length)}</button></details><section class="reader" aria-label="${esc(t('activity'))}"><div class="modes" role="tablist">${['learn','readCheck','meaningCheck','quiz'].map(m=>`<button type="button" role="tab" id="mode-${m}" data-mode="${m}" aria-controls="reader-inner" aria-selected="${s.mode===m}" tabindex="${s.mode===m?0:-1}">${esc(t(m))}</button>`).join('')}</div><div id="reader-inner" role="tabpanel" aria-labelledby="mode-${s.mode}" tabindex="-1">${e?card(e):`<p class="empty" role="status">${esc(t('empty'))}</p>`}</div><nav class="pager"><button type="button" id="prev" data-action="prev" ${s.index===0||!e?'disabled':''}>${esc(t('previous'))}</button><span dir="ltr">${num(e?s.index+1:0)} / ${num(p.length)}</span><button type="button" id="next" data-action="next" ${s.index===p.length-1||!e?'disabled':''}>${esc(t('next'))}</button></nav></section></div><details class="all-words" id="all-words"><summary>${esc(t('allWords'))} · ${num(entries.length)}</summary><label for="word-search">${esc(t('chooseTarget'))}</label><input type="search" id="word-search" value="${esc(s.search)}"><div id="all-grid" class="all-grid"></div></details><footer>${esc(t('footer'))}</footer></main>`;
  const restored=focusId?root.getElementById(focusId):null;if(restored&&!restored.disabled)restored.focus({preventScroll:true});
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
  if(b.dataset.index!==undefined){s.index=Number(b.dataset.index);reset();render();return;}
  if(b.dataset.segment!==undefined){const n=Number(b.dataset.segment);s.activeSegment=s.activeSegment===n?null:n;render();return;}
  if(b.dataset.word){const x=byId.get(b.dataset.word);s.review=false;s.lesson=x.lesson;s.index=pool().findIndex(a=>a.id===x.id);reset();render();root.getElementById('reader-inner').focus({preventScroll:true});return;}
  if(b.dataset.choice&&e){s.choice=b.dataset.choice;const correct=s.choice===e.id;config.onProgress({kind:s.mode==='quiz'?'listen':'meaning',id:e.id,correct});if(correct)reviewed.add(e.id);render();return;}
  if(b.dataset.rating&&e){ratings[e.id]=b.dataset.rating;const correct=b.dataset.rating==='correct';if(correct)reviewed.add(e.id);config.onProgress({kind:'read',id:e.id,correct});if(s.review&&correct){reset();}render();return;}
  const action=b.dataset.action;
  if(action==='prev')move(-1);else if(action==='next')move(1);else if(action==='review'){s.review=!s.review;s.index=0;reset();render();}
  else if(action==='segments'){s.segments=!s.segments;s.activeSegment=null;render();}
  else if(action==='answer'){s.answer=!s.answer;render();}
  else if(action==='meaning'&&e){s.meaning=!s.meaning;if(s.meaning){reviewed.add(e.id);config.onProgress({kind:'reviewed',id:e.id,correct:true});}render();}
 }
 function onChange(event){const v=event.target.value;switch(event.target.id){case 'locale':config.onLocale(v);break;case 'font':if(fonts.includes(v)){s.font=v;render();}break;case 'lesson':s.lesson=Number(v);s.index=0;reset();render();break;}}
 function onInput(event){if(event.target.id==='size'){s.size=Number(event.target.value);root.host.style.setProperty('--word-size',s.size);saveSnapshot();}if(event.target.id==='word-search'){s.search=event.target.value;allWords();}}
 function onToggle(event){if(event.target.id==='all-words'&&event.target.open)allWords();if(event.target.id==='settings')s.settings=event.target.open;if(event.target.id==='lesson-panel')s.lessonExpanded=event.target.open;}
 function onKey(event){const target=event.target;if(target.matches('[data-mode]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){const tabs=[...root.querySelectorAll('[data-mode]')],at=tabs.indexOf(target),delta=(event.key==='ArrowRight'?1:-1)*(rtl()?-1:1),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(at+delta+tabs.length)%tabs.length;event.preventDefault();tabs[next].click();root.getElementById(tabs[next].id)?.focus();}}
 root.addEventListener('click',onClick);root.addEventListener('change',onChange);root.addEventListener('input',onInput);root.addEventListener('toggle',onToggle,true);root.addEventListener('keydown',onKey);render();
 return {stop,dispose(){disposed=true;stop();root.removeEventListener('click',onClick);root.removeEventListener('change',onChange);root.removeEventListener('input',onInput);root.removeEventListener('toggle',onToggle,true);root.removeEventListener('keydown',onKey);},snapshot:()=>({...s,ratings:{...ratings}}),setFont(id){if(fonts.includes(id)){s.font=id;render();}}};
}

let blending4Open=false,b4Component=null,b4Snapshot=null,b4Owner=null,b4Data=null,b4Promise=null,b4Generation=0;
const b4Key=(kind,id)=>(kind==='audio'||kind==='reviewed'?'alphabet.blend4_'+kind+'_':'alpha-blend4-'+kind+'-')+id.replace(/[^a-z0-9_-]/g,'_');
const b4Original={render,stop,nav,setLearner,applyTypography,mountBlending2Nav};
stop=function(){b4Component?.stop();return b4Original.stop();};
nav=function(changes){blending4Open=false;b4Generation++;b4Snapshot=null;return b4Original.nav(changes);};
setLearner=function(profile){stop();blending4Open=false;b4Generation++;b4Snapshot=null;b4Owner=null;return b4Original.setLearner(profile);};
applyTypography=function(options={}){b4Original.applyTypography(options);b4Component?.setFont(typographyFont().id);};
mountBlending2Nav=function(){
 b4Original.mountBlending2Nav();const host=$('#course-nav');if(!host)return;
 const button=host.querySelector('[data-b3-course="blending4"]');if(!button)return;
 button.disabled=false;button.removeAttribute('aria-disabled');button.dataset.b4Course='blending4';button.setAttribute('aria-pressed',String(blending4Open));
 button.onclick=()=>{stop();if(state.course==='lesson')state.bookmarks[state.chapter]=bookmark();blending4Open=true;blending3Open=false;blending2Open=false;phonicsOpen=false;render();};
 host.querySelectorAll('button').forEach(b=>{if(b===button)return;const action=b.onclick;b.onclick=function(e){blending4Open=false;b4Generation++;b4Snapshot=null;return action?.call(this,e);};});
 if(blending4Open)host.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
};
render=function(){
 if(b4Component){b4Snapshot=b4Component.snapshot();b4Component.dispose();b4Component=null;}
 if(b4Owner!==state){b4Owner=state;b4Snapshot=null;}
 b4Original.render();if(blending4Open)b4Render();
};
async function b4Load(){
 if(b4Data)return b4Data;
 if(!b4Promise){
  const epoch=b4Generation;
  b4Promise=(async()=>{
   const response=await fetch(await resolveAudioPath('course/blending4/data.json'),{cache:'no-store',credentials:'same-origin'});
   if(!response.ok)throw Error('BLENDING4_LOAD_FAILED');const raw=await response.text();
   if(raw.length>16000000)throw Error('BLENDING4_DATA_INVALID');const data=JSON.parse(raw);
   if(data.bank?.revision!==BLENDING4_RELEASE||data.bank.entries?.length!==159||data.bank.lessons?.length!==27||Object.keys(data.ui?.locales||{}).length!==32||Object.keys(data.audio?.records||{}).length!==159)throw Error('BLENDING4_DATA_INVALID');
   for(let i=0;i<159;i++){const e=data.bank.entries[i],id='blending4_r1_'+String(i+1).padStart(3,'0');if(e.id!==id||data.audio.records[id]?.path!=='course/audio/blending4/'+id+'.wav')throw Error('BLENDING4_DATA_INVALID');}
   if(epoch!==b4Generation)throw Error('BLENDING4_LOAD_CANCELLED');b4Data=data;return data;
  })().finally(()=>{b4Promise=null;});
 }
 return b4Promise;
}
function b4Progress(){
 if(!blending4Open||!b4Data)return;
 const count=b4Data.bank.entries.filter(e=>state.heard[b4Key('reviewed',e.id)]||['read','meaning','listen'].some(k=>state.attempts[b4Key(k,e.id)]?.completed)).length;
 $('#progress-label').textContent=b4Data.ui.locales[locale].wordsLearned+': '+new Intl.NumberFormat(locale).format(count)+' / '+new Intl.NumberFormat(locale).format(159);
 $('#progress-bar').style.width=count/159*100+'%';$('#saved-label').textContent=learnerStatus();
}
function b4Render(){
 const owner=state,epoch=b4Generation;document.body.dataset.course='blending4';document.body.dataset.activity=b4Snapshot?.mode||'learn';
 $('#lesson-title').textContent=B4_TITLES[locale];$('#lesson-subtitle').textContent='';$('#preview-note').textContent='';$('#stages').hidden=true;$('.lesson-footer').hidden=true;
 $('#activity').innerHTML='<div id="hzn-blending4-host" aria-busy="true"><div style="padding:36px;text-align:center" role="status">'+esc(B4_TITLES[locale])+' …</div></div>';
 const active=()=>state===owner&&blending4Open&&epoch===b4Generation;
 const mount=data=>{
  if(!active())return;const host=$('#hzn-blending4-host');if(!host)return;host.removeAttribute('aria-busy');host.innerHTML='';const shadow=host.attachShadow({mode:'open'});
  const reviewed=data.bank.entries.filter(e=>owner.heard[b4Key('reviewed',e.id)]||['read','meaning','listen'].some(k=>owner.attempts[b4Key(k,e.id)]?.completed)).map(e=>e.id);
  const ratings=Object.fromEntries(data.bank.entries.filter(e=>owner.attempts[b4Key('read',e.id)]).map(e=>[e.id,owner.attempts[b4Key('read',e.id)].completed?'correct':'retry']));
  b4Component=mountBlending4Component(shadow,data,{locale,font:typographyFont().id,css:B4_CSS,snapshot:b4Snapshot,reviewed,ratings,resolveAudio:resolveAudioPath,
   onAudioError:msg=>{if(active())notice(msg);},
   onLocale:next=>{if(active()&&data.ui.locales[next]){locale=next;meaningLocale=next;render();save();}},
   onProgress:({kind,id,correct})=>{
    if(!active()||!data.audio.records[id]||!['audio','reviewed','read','meaning','listen'].includes(kind))return;
    const key=b4Key(kind,id);
    if(kind==='audio'||kind==='reviewed')owner.heard[key]=true;
    else{const before=owner.attempts[key]||{count:0,completed:false};owner.attempts[key]={count:Math.min(before.count+1,99999),completed:kind==='read'?!!correct:before.completed||!!correct};if(correct)owner.heard[b4Key('reviewed',id)]=true;}
    save();b4Progress();
   }
  });b4Progress();
 };
 if(b4Data){mount(b4Data);return;}
 b4Load().then(mount).catch(error=>{
  if(!active())return;const host=$('#hzn-blending4-host');if(!host)return;host.removeAttribute('aria-busy');
  const msg=(typeof BLENDING3_DATA!=='undefined'?BLENDING3_DATA.ui.locales[locale].audioError:B4_TITLES[locale]);
  host.innerHTML='<p role="alert">'+esc(msg)+'</p><button type="button" id="b4-retry">↻ '+esc(B4_TITLES[locale])+'</button>';
  host.querySelector('button').onclick=()=>{b4Promise=null;render();};
 });
}
addEventListener('horizons-access-ended',()=>{stop();b4Component?.dispose();b4Component=null;blending4Open=false;b4Generation++;b4Snapshot=null;b4Owner=null;b4Data=null;});
/*BLENDING4_EXTENSION_END*/
