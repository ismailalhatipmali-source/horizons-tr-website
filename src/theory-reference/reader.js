/* Independent theory reader. No workbook storage, entitlement or audio access. */
(function(){
 'use strict';
 const data=window.HZN_REFERENCE_DATA,params=new URLSearchParams(location.search);
 const q=s=>document.querySelector(s),create=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const rtl=new Set(['ar','he','fa','ur']);
 let lang=data.languages.includes(params.get('lang'))?params.get('lang'):'ar';
 let fontId='noto-naskh';
 let dark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
 let chapter=params.get('chapter')||'thaa',index=0,all=false;
 const currentUI=()=>data.ui[lang];
 function bidiText(parent,value){
  // Arabic examples keep their own direction in all interface languages.
  for(const part of value.split(/([\u0600-\u06ff\u0640]+(?:[ —]+[\u0600-\u06ff\u0640]+)*)/u)){
   if(/[\u0600-\u06ff]/u.test(part)&&lang!=='ar'){const b=create('bdi',part);b.lang='ar';b.dir='rtl';parent.append(b);}else parent.append(document.createTextNode(part));
  }
 }
 function footer(number,total){
  const f=create('footer',undefined,'signature');f.append(create('div',data.credit[lang]));
  const names=create('div',undefined,'names');names.dir='ltr';
  const arabic=create('bdi',data.owner.name_ar);arabic.lang='ar';arabic.dir='rtl';
  const latin=create('bdi',data.owner.name_latin);latin.lang='tr';latin.dir='ltr';
  names.append(arabic,document.createTextNode(' — '),latin);f.append(names);
  const email=create('a',data.owner.contact_email);email.href='mailto:'+data.owner.contact_email;f.append(email);
  const page=create('div',number+' / '+total);page.dir='ltr';f.append(page);return f;
 }
 function references(ids){
  const r=create('div',undefined,'source-links');r.append(create('strong',currentUI().sources));
  for(const source of data.sources.filter(s=>ids.includes(s.id))){const p=create('p'),a=create('a',source.title);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';p.append(a);r.append(p);}return r;
 }
 function painted(text,target){
  const out=create('bdi',undefined,'marked-arabic');out.lang='ar';out.dir='rtl';
  const clusters=text.match(/[^\u064b-\u0652][\u064b-\u0652]*/gu)||[text];
  for(const cluster of clusters){const letter=cluster[0],unit=create('span',undefined,'letter-unit');
   unit.append(create('span',letter,letter===target?'target-letter':'base-letter'));
   for(const mark of [...cluster.slice(1)])unit.append(create('span',mark,["ْ","ّ"].includes(mark)?'structure-mark':'vowel-mark'));
   out.append(unit);
  }
  return out;
 }
 function symbolGuide(){
  const aside=create('aside',undefined,'symbol-guide');aside.append(create('h2',lang==='ar'?'مفتاح النطق على الهامش':'IPA · '+data.language_names[lang]));
  const dl=create('dl');
  for(const [symbol,sound] of [['b','ب'],['t','ت'],['s','س'],['ð','ذ'],['θ','ث'],['ʕ','ع'],['dʒ','ج'],['ħ','ح'],['a','بَ'],['u','بُ'],['i','بِ'],['aː','بَا'],['uː','بُو'],['iː','بِي']]){const dt=create('dt','/'+symbol+'/');dt.dir='ltr';const dd=create('dd');dd.append(painted(sound,''));dl.append(dt,dd);}
  aside.append(dl,create('p',data.symbol_notes[lang]));
  if(lang==='ar')aside.append(create('p','الرمز بين / / يمثل صوتًا، وː يطيل الحركة السابقة. بَ وبُ وبِ أمثلة للحركات؛ b ليس جزءًا من الرمز a أو u أو i. ج هنا /dʒ/ في النموذج الفصيح المختار، وقد تسمع نطقًا آخر في بعض البلدان.'));
  const help=create('details',undefined,'native-sound-help');help.append(create('summary',data.bridges[lang].title),create('p',data.bridges[lang].text));aside.append(help);
  return aside;
 }
 function examplesPage(){
  const p=create('article',undefined,'reference-page example-page');p.append(create('h1',lang==='ar'?'معرض الكلمات: الحرف والصوت والمعنى':'👁 · / / · '+data.language_names[lang]));
  const grid=create('div',undefined,'example-grid');
  const selected=data.examples.filter(e=>chapter==='thaa'?e.target==='ث':chapter==='baa'?e.target==='ب':true);
  for(const e of selected){const card=create('section',undefined,'example-card');card.append(painted(e.word,e.target));
   const sound=create('div','/'+e.ipa+'/','ipa');sound.dir='ltr';card.append(sound,create('p',e.gloss[lang],'meaning'));grid.append(card);}
  const layout=create('div',undefined,'word-guide-layout');layout.append(grid,symbolGuide());p.append(layout);
  if(lang==='ar')p.append(create('p','الكلمات معروضة بقراءة الوقف دون نهايات الإعراب. الرمز / / تمثيل صوتي مساعد، وː يدل على طول الحركة. الكلمة الملونة تحتفظ بحروفها وتشكيلها؛ المعنى مكتوب أسفلها. الترجمات المعروضة مسودات للمراجعة.'));
  return p;
 }
 function applyFont(){const f=data.fonts.find(f=>f.id===fontId);document.documentElement.style.setProperty('--arabic-font','"HZN '+f.name+'",serif');}
 function applyTheme(){document.documentElement.dataset.theme=dark?'dark':'light';q('#theme').textContent=dark?'☀':'☾';q('#theme').setAttribute('aria-pressed',String(dark));q('#theme').setAttribute('aria-label',data.theme_labels[lang]);q('#theme').title=data.theme_labels[lang];}
 function pronounPage(){
  const row=data.pronoun_equivalents[lang];
  return {title:'أَنَا · '+row.terms[0],paragraphs:[row.note],equivalents:row.terms,source_ids:[]};
 }
 function available(){
  if(lang==='ar')return data.chapters.map(c=>c.id==='pronouns'?{...c,pages:[pronounPage(),...c.pages]}:c);
  const items=[{id:'pronouns',title:'07 · '+data.pronoun_equivalents[lang].terms.join(' · '),pages:[pronounPage()]},{id:'thaa',title:data.bridges[lang].title,pages:[{title:data.bridges[lang].title,paragraphs:[data.bridges[lang].text],source_ids:['ipa','basrah','unicode'],demo:'ث — ثـ — ـثـ — ـث\nثَ — ثُ — ثِ\nثَا — ثُو — ثِي'}]}];
  if(chapter!=='thaa'&&chapter!=='pronouns'&&data.chapters.some(c=>c.id===chapter))items.unshift({id:chapter,title:data.unavailable[lang],pages:[{title:data.unavailable[lang],paragraphs:[],source_ids:[]}]});
  return items;
 }
 function quizPage(){
  const p=create('article',undefined,'reference-page');p.dataset.page='quiz';p.append(create('h1',currentUI().question));
  const d=create('div','ث','arabic-demo');d.lang='ar';d.dir='rtl';p.append(d);
  const exercise=create('section',undefined,'exercise'),choices=create('div',undefined,'choices');
  for(const count of [1,2,3]){const b=create('button',String(count));b.type='button';b.setAttribute('aria-pressed','false');b.onclick=()=>{choices.querySelectorAll('button').forEach(n=>{n.dataset.selected='false';n.setAttribute('aria-pressed','false');});b.dataset.selected='true';b.setAttribute('aria-pressed','true');q('#feedback').textContent=(count===3?'✓ ':'↺ ')+currentUI().answer;};choices.append(b);}
  const feedback=create('div');feedback.id='feedback';feedback.setAttribute('role','status');exercise.append(choices,feedback,create('p',currentUI().answer,'print-answer'));p.append(exercise);return p;
 }
 function render(){
  applyTheme();applyFont();const ui=currentUI();document.documentElement.lang=lang;document.documentElement.dir=rtl.has(lang)?'rtl':'ltr';
  q('#language-label').textContent=ui.language;q('#chapter-label').textContent=ui.chapter;q('#print').textContent=ui.print;q('#previous').textContent=ui.previous;q('#next').textContent=ui.next;q('#all').textContent=ui.viewAll;
  q('#draft').hidden=true;
  const choices=available();if(!choices.some(c=>c.id===chapter))chapter='thaa';
  q('#chapter').replaceChildren(...choices.map(c=>{const o=create('option',c.title);o.value=c.id;return o;}));q('#chapter').value=chapter;
  const book=choices.find(c=>c.id===chapter),pages=[];
  for(const item of book.pages){
   const page=create('article',undefined,'reference-page');page.append(create('h1',item.title));
   const prose=create('div',undefined,'prose');
   for(const text of item.paragraphs||[]){const p=create('p');bidiText(p,text);prose.append(p);}
   if(item.equivalents){const table=create('table',undefined,'equivalents-table');
    const words=['أَنَا','أَنْتَ','أَنْتِ','نَحْنُ','هُوَ','هِيَ'];const sounds=['ʔanaː','ʔanta','ʔanti','naħnu','huwa','hija'];
    words.forEach((word,i)=>{const row=create('tr'),a=create('td'),b=create('td'),c=create('td');const arabic=create('bdi',word);arabic.lang='ar';arabic.dir='rtl';a.append(arabic);b.textContent=item.equivalents[i];b.lang=lang;c.textContent='/'+sounds[i]+'/';c.dir='ltr';row.append(a,b,c);table.append(row);});prose.append(table);}
   for(const itemProfile of item.profiles||[]){const part=create('section',undefined,'profile');part.append(create('h2',itemProfile.letter+' /'+itemProfile.ipa+'/'));part.append(create('p',itemProfile.note));const e=create('p',itemProfile.examples.join(' — '));e.lang='ar';e.dir='rtl';part.append(e);prose.append(part);}
   if((item.paragraphs||[]).some(text=>text.includes('/'))){const body=create('div',undefined,'word-guide-layout');body.append(prose,symbolGuide());page.append(body);}else page.append(prose);
   for(const box of item.callouts||[]){const aside=create('aside',undefined,'teaching-note');aside.append(create('strong',box.label),create('p',box.text));page.append(aside);}
   if(item.demo){const demo=create('div',item.demo,'arabic-demo');demo.lang='ar';demo.dir='rtl';demo.style.whiteSpace='pre-line';page.append(demo);}
   page.append(references(item.source_ids||['ipa','unicode']));pages.push(page);
  }
  if(['foundations','phonics','baa','thaa','blending2','profiles'].includes(chapter)&&(lang==='ar'||chapter==='thaa'))pages.push(examplesPage());
  if(chapter==='thaa')pages.push(quizPage());
  const sourcePage=create('article',undefined,'reference-page');sourcePage.append(create('h1',ui.sources));
  for(const source of data.sources.filter(s=>s.status!=='proposed_bibliography_only')){const item=create('div',undefined,'source-item'),a=create('a',source.title);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';item.append(a,create('p',source.url));sourcePage.append(item);}pages.push(sourcePage);
  pages.forEach((p,i)=>p.append(footer(i+1,pages.length)));q('#pages').replaceChildren(...pages);
  index=Math.min(index,pages.length-1);show();
 }
 function show(){const pages=[...q('#pages').children];pages.forEach((p,i)=>p.hidden=!all&&i!==index);q('#position').textContent=(index+1)+' / '+pages.length;q('#previous').disabled=index===0;q('#next').disabled=index===pages.length-1;q('#all').setAttribute('aria-pressed',String(all));}
 data.languages.forEach(code=>{const o=create('option',data.language_names[code]);o.value=code;q('#language').append(o);});q('#language').value=lang;
 q('#language').onchange=()=>{lang=q('#language').value;index=0;render();};q('#chapter').onchange=()=>{chapter=q('#chapter').value;index=0;render();};
 q('#previous').onclick=()=>{index=Math.max(0,index-1);show();window.scrollTo(0,0);};q('#next').onclick=()=>{index++;show();window.scrollTo(0,0);};q('#all').onclick=()=>{all=!all;show();};q('#print').onclick=()=>window.print();
 function preparePrintBook(){
  q('.print-book')?.remove();
  const container=create('main',undefined,'print-book');
  const saved={chapter,index,all};
  for(const unit of available()){
   chapter=unit.id;index=0;all=true;render();
   container.append(create('h1',unit.title,'print-chapter-title'));
   for(const page of [...q('#pages').children]){
    const cloned=page.cloneNode(true);cloned.hidden=false;
    if(cloned.querySelector('.source-item'))continue;
    container.append(cloned);
   }
  }
  chapter=saved.chapter;index=saved.index;all=saved.all;render();
  const signature=create('div',undefined,'print-signature');
  signature.append(create('div',data.credit[lang]),create('div',data.owner.name_ar+' — '+data.owner.name_latin+' · '+data.owner.contact_email));
  container.append(signature);document.body.append(container);
 }
 window.addEventListener('beforeprint',preparePrintBook);
 window.addEventListener('afterprint',()=>q('.print-book')?.remove());
 data.fonts.forEach(f=>{const o=create('option',f.name);o.value=f.id;q('#arabic-font').append(o);});q('#arabic-font').value=fontId;q('#arabic-font').onchange=()=>{fontId=q('#arabic-font').value;applyFont();};
 q('#theme').onclick=()=>{dark=!dark;applyTheme();};
 render();
})();
