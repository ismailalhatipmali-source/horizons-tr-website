// Execute the real approved demo closure and overlay without a browser or network.
// This DOM fixture checks behavior; visual layout is checked separately in CUA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(join(root,p),'utf8');
const copy=JSON.parse(read('src/demo-pwa/demo-experience-locales.json'));
const letters=JSON.parse(read('src/demo-pwa/demo-letter-overview.json'));
const creator=JSON.parse(read('release-assets/creator-credit-20261004-r1/manifest.json'));
const baseline=read('src/demo-pwa/workbook.js');
assert.equal(createHash('sha256').update(baseline).digest('hex'),creator.files['try/workbook.js'].sha256,
 'The original creator-approved demo closure must remain byte-identical.');
assert.deepEqual(Object.keys(copy).sort(),[...creator.interface_languages].sort());
assert.equal(letters.length,28);
assert.deepEqual(letters.map(x=>x.order),Array.from({length:28},(_,i)=>i+1));
const hook=read('src/demo-pwa/demo-experience.js')
 .replace('/*HZN_DEMO_EXPERIENCE_LOCALES*/',JSON.stringify(copy))
 .replace('/*HZN_DEMO_LETTER_OVERVIEW*/',JSON.stringify(letters));
assert.doesNotMatch(hook,/\b(?:fetch|XMLHttpRequest|indexedDB|localStorage|caches)\b/);
const decode=s=>String(s).replace(/&#(\d+);|&#x([a-f\d]+);|&(amp|lt|gt|quot|apos|#39);/gi,
 (_,n,h,key)=>n?String.fromCodePoint(+n):h?String.fromCodePoint(parseInt(h,16)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",'#39':"'"})[key]);
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const camel=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
const dash=s=>s.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
class Text {
 constructor(text){this.textContent=text;this.parentElement=null;}
 get outerHTML(){return escape(this.textContent);}
}
class Element {
 constructor(tag,doc){this.tagName=tag.toUpperCase();this.doc=doc;this.attrs={};this.childNodes=[];this.parentElement=null;this.style={};this.hidden=false;this.open=false;this.clickWrites=0;
  this.dataset=new Proxy({}, {get:(_,k)=>this.attrs['data-'+dash(k)],set:(_,k,v)=>(this.attrs['data-'+dash(k)]=String(v),true)});
  this.classList={contains:c=>this.className.split(/\s+/).includes(c),add:(...cs)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...cs])].join(' ');},remove:(...cs)=>{this.className=this.className.split(/\s+/).filter(c=>!cs.includes(c)).join(' ');},toggle:(c,force)=>{const add=force??!this.classList.contains(c);this.classList[add?'add':'remove'](c);return add;}};
 }
 get children(){return this.childNodes.filter(n=>n instanceof Element);}
 get firstElementChild(){return this.children[0]??null;}
 get className(){return this.attrs.class??'';}set className(v){this.attrs.class=String(v);}
 get id(){return this.attrs.id??'';}set id(v){this.attrs.id=String(v);}
 get lang(){return this.attrs.lang??'';}set lang(v){this.attrs.lang=String(v);}
 get dir(){return this.attrs.dir??'';}set dir(v){this.attrs.dir=String(v);}
 get href(){return this.attrs.href?new URL(this.attrs.href,this.doc.baseURI).href:'';}set href(v){this.attrs.href=String(v);}
 get onclick(){return this._click;}set onclick(v){this._click=v;this.clickWrites++;this.firstClick??=v;}
 setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
 append(...nodes){for(let n of nodes){if(n==null)continue;if(typeof n==='string')n=new Text(n);if(n.parentElement)n.parentElement.childNodes=n.parentElement.childNodes.filter(x=>x!==n);n.parentElement=this;this.childNodes.push(n);}}
 prepend(...nodes){for(const n of nodes.reverse()){this.append(n);this.childNodes.unshift(this.childNodes.pop());}}
 before(node){const p=this.parentElement;if(!p)return;node.parentElement?.removeChild(node);node.parentElement=p;p.childNodes.splice(p.childNodes.indexOf(this),0,node);}
 after(node){const p=this.parentElement;if(!p)return;node.parentElement?.removeChild(node);node.parentElement=p;p.childNodes.splice(p.childNodes.indexOf(this)+1,0,node);}
 removeChild(node){this.childNodes=this.childNodes.filter(n=>n!==node);node.parentElement=null;return node;}
 insertAdjacentElement(where,node){if(where==='afterend')this.after(node);else if(where==='beforebegin')this.before(node);else if(where==='afterbegin')this.prepend(node);else this.append(node);}
 insertAdjacentHTML(where,html){const container=new Element('fragment',this.doc);parse(html,container);if(where==='afterbegin')this.prepend(...container.childNodes);else this.append(...container.childNodes);}
 get textContent(){return this.childNodes.map(n=>n.textContent).join('');}set textContent(v){this.childNodes=[];this.append(new Text(String(v)));}
 get innerHTML(){return this.childNodes.map(n=>n.outerHTML).join('');}set innerHTML(v){this.childNodes=[];parse(String(v),this);}
 get outerHTML(){return '<'+this.tagName.toLowerCase()+Object.entries(this.attrs).map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+'>'+this.innerHTML+'</'+this.tagName.toLowerCase()+'>';}
 querySelectorAll(selector){return query(this,selector);}querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
 showModal(){this.open=true;}close(){this.open=false;}click(){return this.onclick?.call(this,{target:this});}
 addEventListener(type,callback){(this.events??={})[type]??=[];this.events[type].push(callback);}
}
function parse(html,parent){
 const stack=[parent],voids=new Set(['meta','link','input','img','br','hr','source','wbr']);
 for(const token of html.match(/<!--[^]*?-->|<![^>]*>|<[^>]+>|[^<]+/g)??[]){
  if(token.startsWith('<!'))continue;
  if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
  if(token.startsWith('<')){const m=token.match(/^<([\w:-]+)/);if(!m)continue;const node=new Element(m[1],parent.doc);
   for(const a of token.slice(m[0].length).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))node.setAttribute(a[1],decode(a[2]??a[3]??a[4]??''));
   stack.at(-1).append(node);if(!voids.has(m[1])&&!token.endsWith('/>'))stack.push(node);
  }else stack.at(-1).append(new Text(decode(token)));
 }
}
function simple(node,selector){
 const tag=selector.match(/^[\w-]+/);if(tag&&node.tagName!==tag[0].toUpperCase())return false;
 for(const m of selector.matchAll(/([.#])([\w-]+)|\[([^\]=]+)(?:="([^"]*)")?\]/g)){
  if(m[1]==='.'&&!node.classList.contains(m[2]))return false;
  if(m[1]==='#'&&node.id!==m[2])return false;
  if(m[3]&&(!Object.hasOwn(node.attrs,m[3])||(m[4]!==undefined&&node.attrs[m[3]]!==m[4])))return false;
 }return true;
}
function matches(node,selector){const parts=selector.trim().replaceAll('>',' > ').split(/\s+/);let i=parts.length-1;if(!simple(node,parts[i--]))return false;let p=node.parentElement;
 while(i>=0){if(parts[i]==='>'){i--;if(!p||!simple(p,parts[i--]))return false;p=p.parentElement;}else{while(p&&!simple(p,parts[i]))p=p.parentElement;if(!p)return false;i--;p=p.parentElement;}}return true;}
function query(root,selector){const all=[];const visit=n=>{for(const child of n.children){all.push(child);visit(child);}};visit(root);return all.filter(n=>selector.split(',').some(s=>matches(n,s)));}
function documentFixture(html){const doc={baseURI:'https://horizons-tr.com/try/',createElement:tag=>new Element(tag,doc),createElementNS:(_,tag)=>new Element(tag,doc),fonts:{ready:Promise.resolve()},addEventListener(){}};
 const tree=new Element('document',doc);parse(html,tree);doc.querySelectorAll=s=>query(tree,s);doc.querySelector=s=>doc.querySelectorAll(s)[0]??null;doc.getElementById=id=>doc.querySelector('#'+id);doc.documentElement=doc.querySelector('html');doc.head=doc.querySelector('head');doc.body=doc.querySelector('body');return doc;}

const document=documentFixture(read('src/demo-pwa/index.html'));
const storage=new Map(),requests=[],audioPlayed=[],observations=[],events={};
class Audio {
 pause(){}load(){}removeAttribute(){}async play(){audioPlayed.push(this.src);queueMicrotask(()=>this.onended?.());}
}
class MutationObserver {constructor(fn){this.fn=fn;}observe(target,options){observations.push({target,options,observer:this});}disconnect(){}}
const context=vm.createContext({document,Audio,MutationObserver,URL,Blob,Intl,Date,console,structuredClone,queueMicrotask,
 navigator:{languages:['ar'],language:'ar'},location:new URL(document.baseURI),
 localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))},
 fetch:(...args)=>{requests.push(args);throw Error('This functional test forbids network requests.');},
 addEventListener:(type,fn)=>(events[type]??=[]).push(fn),cancelAnimationFrame(){},requestAnimationFrame(){return 0;},
 setTimeout(){return 0;},clearTimeout(){}});
context.window=context;context.HORIZONS_RELEASE={edition:'demo'};
const ids=creator.chapter_ids;
const freeLetters=ids.map(id=>letters.find(l=>l.id===id));
// Synthetic text/audio data keeps this fixture public-only. The unmodified real
// render/nav/save functions and free-letter handlers are executed below.
const publicData={
 course:{chapters:freeLetters.map(l=>({id:l.id,letter:l.letter,nameAr:l.name})),alphabet:{letters:freeLetters.map(l=>({id:'alphabet.'+l.id,letter:l.letter,spokenNameText:l.name,displayForms:Object.fromEntries(['isolated','initial','medial','final'].map(f=>[f,l.letter]))}))}},
 chapters:Object.fromEntries(freeLetters.map(l=>[l.id,{id:l.id,letter:l.letter,words:Array.from({length:20},(_,i)=>({id:l.id+'-'+i,word:l.letter+' '+i,sentence:l.letter+' '+i+' مثال',targetOccurrences:[]})),microstories:[]}]))
};
context.fixtureData=publicData;
const tail='\ninit();\n\n})();';assert.equal(baseline.split(tail).length,2);
const expose=`
course=fixtureData.course;alphabet=course.alphabet;chapters=fixtureData.chapters;
guideBank=Object.fromEntries(Object.keys(chapters).map(id=>[id,{forms:{}}]));
dict=Object.fromEntries(LANGS.map(lang=>[lang,{word:{},story:{}}]));
audioIndex=Object.fromEntries(alphabet.letters.map(l=>[l.id,{path:'course/audio/'+l.id+'.mp3',status:'approved'}]));
state=fresh();state.updatedAt='2026-10-01T00:00:00.000Z';
state.heard={'word.baa-0':true,'sentence.baa-0':true};state.attempts={'word-baa-0':{count:2,completed:true}};
state.written={'baa:isolated':true};state.ink={'baa:isolated':[[{x:100,y:200}]]};
state.bookmarks={yaa:{...freshPosition(),word:7}};
globalThis.demoTest={render:(...args)=>render(...args),nav:changes=>nav(changes),setLocale:lang=>{locale=lang;},state:()=>state,valid:()=>valid(state),play:key=>play(key)};
render();
`;
vm.runInContext(baseline.replace(tail,'\n'+hook+'\n'+expose+'\n})();'),context,{filename:'approved-demo-with-overlay.js'});
const api=context.demoTest,select=s=>document.querySelector(s),all=s=>document.querySelectorAll(s);
const sections=['alphabet','phonics','blending2','blending3','blending4','catalog'];
const snapshot=()=>JSON.stringify(api.state());
const pass=[];
function cards(kind){const grid=select(kind==='alphabet'?'.alphabet-grid':'.chapter-grid');assert.ok(grid);assert.equal(grid.children.length,28);assert.equal(grid.querySelectorAll('.demo-free-card').length,5);assert.equal(grid.querySelectorAll('.demo-locked-letter').length,23);
 assert.deepEqual(grid.children.map(n=>n.dataset.demoLockedLetter??(kind==='alphabet'?publicData.course.alphabet.letters[+n.dataset.letter].id.slice(9):n.dataset.chapter)),letters.map(l=>l.id));
 for(const n of grid.querySelectorAll('.demo-free-card')){assert.equal(n.onclick,n.firstClick);assert.equal(n.clickWrites,1,'The original free handler must not be replaced.');}
 return grid;
}
cards('alphabet');assert.equal(api.valid(),true);
const progressStart=snapshot();
for(const section of sections.slice(1,5)){
 const savedBefore=storage.get('horizons-arabic-level1|demo|1');select(`[data-demo-section="${section}"]`).click();
 assert.equal(snapshot(),progressStart,'Locked navigation must not mutate learner state.');
 assert.equal(storage.get('horizons-arabic-level1|demo|1'),savedBefore,'Locked navigation must not save progress.');
 assert.equal(select('#stages').hidden,true);assert.equal(select('.lesson-footer').hidden,true);assert.equal(select('.progress-box').hidden,true);
 assert.equal(select('#activity h2').textContent,copy.ar[section]);
 assert.equal(select('#activity p').textContent,copy.ar[section==='blending4'?'comingSoonText':'lockedText']);
 select('[data-demo-return]').click();assert.equal(snapshot(),progressStart);cards('alphabet');assert.equal(select('.progress-box').hidden,false);assert.equal(select('#stages').hidden,false);
}
pass.push('locked sections and B4 coming soon preserve progress and return to the original activity');

for(const kind of ['alphabet','catalog']){
 select(`[data-demo-section="${kind}"]`).click();cards(kind);
 for(const letter of letters.filter(l=>!ids.includes(l.id))){const before=snapshot();const writes=storage.get('horizons-arabic-level1|demo|1');select(`[data-demo-locked-letter="${letter.id}"]`).click();const dialog=select('#demo-lock-dialog');assert.equal(dialog.open,true);assert.equal(dialog.querySelector('h2').textContent,letter.name);assert.equal(dialog.querySelector('#'+dialog.getAttribute('aria-labelledby')).tagName,'H2');assert.equal(snapshot(),before);assert.equal(storage.get('horizons-arabic-level1|demo|1'),writes);dialog.querySelector('[data-demo-return]').click();assert.equal(dialog.open,false);}
}
pass.push('all 23 locked letters in both overviews open a public-only preview without state changes');

for(const [i,id]of ids.entries()){
 select('[data-demo-section="alphabet"]').click();const n=select(`[data-letter="${i}"]`);assert.equal(n.clickWrites,1);n.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(api.state().letter,i);assert.equal(api.state().heard['alphabet.'+id],true);assert.ok(audioPlayed.at(-1).endsWith('/course/audio/alphabet.'+id+'.mp3'));
 select('[data-demo-section="catalog"]').click();const chapter=select(`[data-chapter="${id}"]`);assert.equal(chapter.clickWrites,1);chapter.click();
 assert.equal(api.state().chapter,id);assert.equal(api.state().course,'lesson');assert.equal(select('.vocab-word').textContent,publicData.chapters[id].words[api.state().word].word);
 select('#next').click();assert.equal(select('.vocab-word').textContent,publicData.chapters[id].words[api.state().word].word);assert.equal(api.valid(),true);
}
pass.push('all five original alphabet auto-audio and lesson/next handlers remain functional');

api.nav({course:'lesson',chapter:'yaa',tab:'words',word:7});const current=snapshot(),pageLabel=select('#page-label').textContent;
select('[data-demo-section="blending2"]').click();assert.equal(snapshot(),current);select('[data-demo-return]').click();assert.equal(snapshot(),current);assert.equal(api.state().word,7);assert.equal(api.state().chapter,'yaa');assert.equal(select('#stages').hidden,false);assert.equal(select('.lesson-footer').hidden,false);assert.equal(select('#page-label').textContent,pageLabel);
assert.equal(select('[data-demo-section="catalog"]').getAttribute('aria-pressed'),'true');
pass.push('locked preview returns to the exact current free chapter and word without changing bookmarks');

for(const lang of creator.interface_languages){
 api.setLocale(lang);api.render();assert.deepEqual(all('#course-nav [data-demo-section]').map(n=>n.dataset.demoSection),sections);
 assert.equal(all('#course-nav .demo-section-title').length,6);assert.deepEqual(all('#course-nav .demo-section-title').map(n=>n.textContent),sections.map(s=>copy[lang][s]));
 assert.equal(select('#demo-upgrade').lang,lang);assert.equal(select('#demo-upgrade').dir,['ar','he','fa','ur'].includes(lang)?'rtl':'ltr');assert.equal(select('#demo-upgrade').getAttribute('aria-label'),copy[lang].buyFull);
 assert.equal(select('#demo-upgrade .demo-buy-link').href,`https://horizons-tr.com/${lang}/checkout.html?product=horizons-arabic-level1`);
 assert.ok(select('.author-credit').textContent.includes(context.hznCreatorCredit.labels[lang]));assert.ok(select('.author-credit').textContent.includes('İsmail Alhatip'));
 const before=snapshot();select('[data-demo-section="blending4"]').click();assert.equal(select('#activity p').textContent,copy[lang].comingSoonText);assert.equal(select('#activity .demo-buy-link').href,`https://horizons-tr.com/${lang}/checkout.html?product=horizons-arabic-level1`);assert.equal(snapshot(),before);select('[data-demo-return]').click();
 api.nav({course:'catalog'});cards('catalog');assert.equal(select('.demo-free-card .demo-card-status').textContent,copy[lang].availableLabel);
 api.nav({course:'lesson',chapter:'yaa',word:7});
}
assert.equal(requests.length,0);assert.equal(document.body.onclick,undefined);
assert.ok(observations.every(o=>JSON.stringify(o.options)===JSON.stringify({attributes:true,attributeFilter:['lang']})));
pass.push('all 32 locales retain six sections, RTL/LTR copy, creator credits and actual localized checkout URLs');

// Entry-page hook is run on its actual source with the shared locale JSON.
const entry=read('src/workbook-web/index.html');
assert.match(entry,/<a[^>]*id="demo"[^>]*data-demo-entry/);assert.doesNotMatch(entry,/<a[^>]*id="demo"[^>]*data-w=/);
const entryHook=entry.match(/<script>\/\*DEMO_ENTRY_BEGIN\*\/([^]*?)\/\*DEMO_ENTRY_END\*\/<\/script>/)?.[1];assert.ok(entryHook);
const entryDocument=documentFixture('<html lang="ar"><head></head><body><a id="demo" data-demo-entry href="../try/">old</a></body></html>');entryDocument.baseURI='https://horizons-tr.com/learn/';const entryObservers=[];
class EntryObserver {constructor(fn){this.fn=fn;}observe(target,options){entryObservers.push({target,options,observer:this});}}
vm.runInNewContext(entryHook.replace('/*HZN_DEMO_EXPERIENCE_LOCALES*/',JSON.stringify(copy)),{document:entryDocument,MutationObserver:EntryObserver});
assert.equal(entryObservers.length,1);assert.deepEqual(Array.from(entryObservers[0].options.attributeFilter),['lang']);assert.equal(entryObservers[0].options.subtree,undefined);
for(const lang of creator.interface_languages){entryDocument.documentElement.lang=lang;entryObservers[0].observer.fn();const link=entryDocument.querySelector('#demo');assert.equal(link.textContent,copy[lang].demoEntryLabel);assert.equal(link.lang,lang);assert.equal(link.href,`https://horizons-tr.com/try/?lang=${lang}`);}
for(const [input,expected]of [['iw-IL','he'],['nb-NO','no'],['nn-NO','no'],['TR_tr','tr'],['unknown','en']]){entryDocument.documentElement.lang=input;entryObservers[0].observer.fn();assert.equal(entryDocument.querySelector('#demo').lang,expected);}
pass.push('entry demo link localizes in all 32 languages and aliases without a subtree observer or old data-w rewriting');
console.log('PASS '+JSON.stringify({locales:32,sections:6,overviewLetters:28,originalFreeLetters:5,requests:requests.length,checks:pass},null,2));
