/* Editorial reference: no learner storage, account, entitlement or workbook writes. */
(function(){
 'use strict';
 const d=window.HZN_ENRICHED_DATA,p=new URLSearchParams(window.HZN_REFERENCE_QUERY||location.search),q=s=>document.querySelector(s);
 const e=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const names=['English','العربية','Türkçe','Français','Español','Deutsch','Italiano','Português','Nederlands','Русский','Українська','Polski','Čeština','Română','Magyar','Ελληνικά','Svenska','Dansk','Norsk','Suomi','Български','Српски','Hrvatski','עברית','فارسی','اردو','हिन्दी','বাংলা','Bahasa Indonesia','Bahasa Melayu','中文','日本語'];
 let lang=d.languages.includes(p.get('lang'))?p.get('lang'):'ar',chapter=p.get('chapter')||'foundations';
 let dark=Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches),font=d.fonts[0];
 function arabic(text,cls='arabic-example'){const b=e('bdi',undefined,cls);b.lang='ar';b.dir='rtl';
  if(cls==='arabic-example'){
   b.setAttribute('aria-label',text);
   for(const cluster of text.match(/[^\u064b-\u0652][\u064b-\u0652]*/gu)||[text]){
    const unit=e('span',undefined,'letter-unit');unit.append(document.createTextNode(cluster[0]));
    for(const mark of [...cluster.slice(1)])unit.append(e('span',mark,['ْ','ّ'].includes(mark)?'structure-mark':'vowel-mark'));b.append(unit);
   }
  }else b.textContent=text;return b;
 }
 function prose(text){const para=e('p');
  // Preserve foreign prose direction, while each Arabic run retains its own shaping.
  for(const part of text.split(/([\u0600-\u06ff]+(?:[ \u0600-\u06ff]*[\u0600-\u06ff])?)/u)){
   if(!['ar','fa','ur'].includes(lang)&&/[\u0600-\u06ff]/u.test(part))para.append(arabic(part,'inline-arabic'));else para.append(document.createTextNode(part));
  }return para;
 }
 function signature(){const f=e('footer',undefined,'signature');f.append(e('div',d.credit[lang]));
  const identity=e('div',undefined,'identity');identity.append(arabic(d.owner.name_ar,'inline-arabic'),e('bdi',' — '+d.owner.name_latin));
  const mail=e('a',d.owner.contact_email);mail.href='mailto:'+d.owner.contact_email;mail.dir='ltr';f.append(identity,mail);return f;
 }
 function sourceList(ids){const out=e('aside',undefined,'source-links');out.append(e('strong',d.ui[lang].sources));
  for(const s of d.sources.filter(s=>ids.includes(s.id)&&s.status!=='proposed_bibliography_only')){
   const a=e('a',s.title);a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';out.append(a);
  }out.append(prose(d.labels[lang].original));return out;
 }
 function soundKey(){const out=e('details',undefined,'sound-key');out.append(e('summary',d.labels[lang].notes+' · IPA'));
  const dl=e('dl');const pairs=[['ʔ','ء'],['b','ب'],['t','ت'],['θ','ث'],['dʒ','ج'],['ħ','ح'],['x / χ','خ'],['d','د'],['ð','ذ'],['r','ر'],['z','ز'],['s','س'],['ʃ','ش'],['sˤ','ص'],['dˤ','ض'],['tˤ','ط'],['ðˤ','ظ'],['ʕ','ع'],['ɣ / ʁ','غ'],['f','ف'],['q','ق'],['k','ك'],['l','ل'],['m','م'],['n','ن'],['h','ه'],['w','و'],['j','ي'],['a','بَ'],['u','بُ'],['i','بِ'],['aː','بَا'],['uː','بُو'],['iː','بِي']];
  for(const [sym,letter]of pairs){const dt=e('dt','/'+sym+'/');dt.dir='ltr';const dd=e('dd');dd.append(arabic(letter));dl.append(dt,dd);}out.append(dl,prose(d.symbols[lang]));
  const notation={ar:'ː طول الحركة السابقة؛ ˤ تفخيم الصامت في هذا العرض؛ . حد بين المقاطع؛ ~ بديلان في النطاق الموصوف، لا صوتان يُقرآن معًا. / / تمثيل صوتي مساعد، وليس كتابة عربية. نماذج الكلمات المفردة هنا بقراءة الوقف، والجمل لا تُعطى نسخًا صوتية تخفي فرق الوصل والوقف.',en:'ː marks preceding vowel length; ˤ marks consonant emphasis in this display; . marks a syllable boundary; ~ separates alternatives in the described range, not two consecutive sounds. / / encloses a sound representation, not Arabic spelling. Isolated word examples use pause readings; sentence translations do not silently claim one pronunciation for both connection and pause.',tr:'ː önceki ünlünün uzunluğunu; ˤ bu gösterimde ünsüz kalınlaşmasını; . hece sınırını gösterir. ~ açıklanan aralıktaki alternatifleri ayırır; iki sesi art arda okutmaz. / / Arapça yazım değil ses gösterimidir. Tek kelime örnekleri durak okumasıdır; cümle çevirisi bağlantı ve durağı tek telaffuz saymaz.'};
  out.append(prose(d.notations[lang]||notation[lang]),prose(d.bridges[lang].text));return out;
 }
 function examples(rows){const grid=e('div',undefined,'examples-grid');
  for(const row of rows){const card=e('section',undefined,'word-card');card.append(arabic(row.ar));
   if(row.ipa){const ipa=e('p','/'+row.ipa+'/','ipa');ipa.dir='ltr';card.append(ipa);}
   const meaning=row.meanings[lang]|| (lang==='ar'?row.note_ar:undefined);
   if(meaning)card.append(prose(meaning));grid.append(card);
  }return grid;
 }
 function letterCards(){const wrap=e('div',undefined,'letter-directory');for(const p of d.letters){
  const card=e('section',undefined,'letter-card');const title=e('h3');title.append(arabic(p.letter,'letter-heading'));const ipa=e('span',' /'+p.ipa+'/','ipa');ipa.dir='ltr';title.append(ipa);card.append(title);
  card.append(e('h4',d.labels[lang].forms),arabic(p.forms,'forms'),prose(p.notes[lang]),e('h4',d.labels[lang].words),examples(p.examples));wrap.append(card);
 }return wrap;}
 function chapterArticle(c,forPrint=false){const out=e('article',undefined,'chapter');out.dataset.chapter=c.id;
  out.append(e('p',c.number+' · HORIZONS','eyebrow'),e('h2',c.titles[lang]));
  for(const section of c.sections){const part=e('section',undefined,'teaching-section');part.id=section.id;part.append(e('h3',section.titles[lang]));for(const text of section.prose[lang])part.append(prose(text));out.append(part);}
  out.append(e('h3',d.labels[lang].examples),examples(c.examples),soundKey());
  if(c.id==='profiles')out.append(letterCards());
  const practice=e('section',undefined,'practice');practice.append(e('h3',d.labels[lang].practice),prose(c.exercise.questions[lang]));
  if(!forPrint){const answer=e('details',undefined,'answer');answer.append(e('summary',d.labels[lang].answer),prose(c.exercise.answers[lang]));practice.append(answer);}
  out.append(practice,sourceList(c.source_ids),signature());return out;
 }
 function applyTheme(){document.documentElement.dataset.theme=dark?'dark':'light';q('#theme').textContent=dark?'☀':'☾';q('#theme').setAttribute('aria-pressed',String(dark));
  const label=d.labels[lang]?.theme||{ar:'تبديل الوضع الفاتح والداكن',en:'Switch light and dark mode',tr:'Açık ve koyu görünümü değiştir'}[lang]||d.ui[lang].language;q('#theme').setAttribute('aria-label',label);q('#theme').title=label;
 }
 function render(){const supported=d.ready_locales.includes(lang),ui=d.ui[lang];document.documentElement.lang=lang;document.documentElement.dir=['ar','he','fa','ur'].includes(lang)?'rtl':'ltr';
  q('#language-label').textContent=ui.language;q('#chapter-label').textContent=ui.chapter;q('#font-label').textContent=d.labels[lang]?.font||'الخط العربي · Arabic font';q('#print').textContent=supported?d.labels[lang].all:ui.print;q('#print').disabled=!supported;
  q('#book-title').textContent=supported?d.labels[lang].intro:d.unavailable[lang];q('#edition-note').textContent=supported?(d.mode==='demo'?d.demo_copy[lang].demoLabel+' · '+d.demo_copy[lang].lockedText:d.labels[lang].warning):d.unavailable[lang];
  q('#pages').replaceChildren();q('#contents').replaceChildren();q('#chapter').replaceChildren();q('#unavailable').hidden=supported;q('#unavailable').textContent=supported?'':d.unavailable[lang];q('#chapter').disabled=!supported;q('#chapter-position').textContent='';applyTheme();
  if(!supported)return;
  if(!d.book.chapters.some(c=>c.id===chapter))chapter=d.book.chapters[0].id;
  const toc=e('details');toc.open=!window.matchMedia('(max-width:1000px)').matches;toc.append(e('summary',d.labels[lang].contents));const contents=e('nav');toc.append(contents);q('#contents').append(toc);
  for(const c of d.book.chapters){const option=e('option',c.number+' · '+c.titles[lang]);option.value=c.id;q('#chapter').append(option);
   const b=e('button',c.number+' · '+c.titles[lang]);b.type='button';b.setAttribute('aria-current',c.id===chapter?'page':'false');b.onclick=()=>{chapter=c.id;render();q('#pages').scrollIntoView({block:'start'});};contents.append(b);
  }q('#chapter').value=chapter;const c=d.book.chapters.find(c=>c.id===chapter);q('#chapter-position').textContent=(d.book.chapters.indexOf(c)+1)+' / '+d.book.chapters.length;q('#pages').append(chapterArticle(c));
 }
 d.languages.forEach((code,i)=>{const o=e('option',names[i]);o.value=code;q('#language').append(o);});q('#language').value=lang;q('#language').onchange=()=>{lang=q('#language').value;render();};
 q('#chapter').onchange=()=>{chapter=q('#chapter').value;render();};q('#theme').onclick=()=>{dark=!dark;applyTheme();};
 d.fonts.forEach((f,i)=>{const o=e('option',f.name);o.value=String(i);q('#font').append(o);});q('#font').onchange=()=>{font=d.fonts[Number(q('#font').value)];document.documentElement.style.setProperty('--arabic-font','"HZN '+font.name+'",serif');};
 function preparePrint(){q('#print-book')?.remove();if(!d.ready_locales.includes(lang))return;
  const out=e('main');out.id='print-book';out.append(e('h1',d.labels[lang].intro),prose(d.mode==='demo'?d.demo_copy[lang].demoLabel+' · '+d.demo_copy[lang].lockedText:d.labels[lang].warning));
  const toc=e('nav',undefined,'print-contents');toc.append(e('h2',d.labels[lang].contents));for(const c of d.book.chapters)toc.append(e('p',c.number+' · '+c.titles[lang]));out.append(toc);const key=soundKey();key.open=true;out.append(key);
  for(const c of d.book.chapters)out.append(chapterArticle(c,true));const solutions=e('section',undefined,'solutions');solutions.append(e('h2',d.labels[lang].answers));for(const c of d.book.chapters)solutions.append(e('h3',c.number+' · '+c.titles[lang]),prose(c.exercise.answers[lang]));out.append(solutions);
  const sig=signature();sig.classList.add('print-signature');out.append(sig);document.body.append(out);
 }
 q('#print').onclick=()=>window.print();window.addEventListener('beforeprint',preparePrint);window.addEventListener('afterprint',()=>q('#print-book')?.remove());render();
})();
