// Execute the successor shell with the real frozen demo reader and public-only
// synthetic fixtures. jsdom checks state/DOM contracts; browser layout is separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>fs.readFileSync(join(root,path),'utf8');
const jsdomPath=process.env.HZN_JSDOM_PATH;
assert.ok(jsdomPath,'Set HZN_JSDOM_PATH to the installed jsdom/lib/api.js');
const {JSDOM}=await import(pathToFileURL(jsdomPath));
const dom=new JSDOM(read('src/demo-pwa/index.html'),{url:'https://example.test/try/',runScripts:'outside-only',pretendToBeVisual:true});
const {window:w}=dom,d=w.document;
w.structuredClone=structuredClone;
w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
w.ResizeObserver=class{observe(){}disconnect(){}};
let plays=0,requests=0;
w.Audio=class{pause(){}load(){}removeAttribute(){}async play(){plays++;this.onended?.();}};
w.fetch=()=>{requests++;throw Error('Network forbidden in shell fixture');};
w.HTMLElement.prototype.scrollIntoView=function(){};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
Object.defineProperty(d,'fonts',{value:{ready:Promise.resolve()}});
w.HORIZONS_RELEASE={edition:'demo'};
const letters=JSON.parse(read('src/demo-pwa/demo-letter-overview.json'));
const ids=['baa','dhaa_emphatic','daad','yaa','dhaal'];
const free=ids.map(id=>letters.find(l=>l.id===id));
w.fixture={course:{chapters:free.map(l=>({id:l.id,letter:l.letter,nameAr:l.name})),alphabet:{letters:free.map(l=>({id:'alphabet.'+l.id,letter:l.letter,spokenNameText:l.name,displayForms:Object.fromEntries(['isolated','initial','medial','final'].map(f=>[f,l.letter]))}))}},chapters:Object.fromEntries(free.map(l=>[l.id,{id:l.id,letter:l.letter,words:Array.from({length:20},(_,i)=>({id:l.id+'-'+String(i+1).padStart(2,'0'),word:l.letter+' '+i,sentence:l.letter+' مثال '+i,targetOccurrences:[]})),microstories:[]}]))};
const shell=read('src/workbook-focus/focus-shell.js').replace('/*HZN_FOCUS_LOCALES*/',read('src/workbook-focus/focus-locales.json')).replace('/*HZN_FOCUS_CSS*/',JSON.stringify(read('src/workbook-focus/focus-shell.css')));
const demo=read('src/demo-pwa/demo-experience.js').replace('/*HZN_DEMO_EXPERIENCE_LOCALES*/',read('src/demo-pwa/demo-experience-locales.json')).replace('/*HZN_DEMO_LETTER_OVERVIEW*/',JSON.stringify(letters));
const prepare=`
course=fixture.course;alphabet=course.alphabet;chapters=fixture.chapters;
guideBank=Object.fromEntries(Object.keys(chapters).map(id=>[id,{forms:{}}]));
dict=Object.fromEntries(LANGS.map(lang=>[lang,{word:{},story:{}}]));
audioIndex=Object.fromEntries(alphabet.letters.map(l=>[l.id,{path:'course/audio/'+l.id+'.mp3',status:'approved'}]));
state=fresh();
globalThis.shellFixture={nav:changes=>nav(changes),render:()=>render(),state:()=>state,answer:value=>{answer=value;heardQuestion=true;},feedback:()=>({answer,heardQuestion}),locale:lang=>{locale=lang;render();},profile:profile=>{Object.defineProperty(learnerStorage,'enabled',{configurable:true,get:()=>true});Object.defineProperty(learnerStorage,'current',{configurable:true,get:()=>profile});Object.defineProperty(learnerStorage,'profiles',{configurable:true,get:()=>[profile]});setLearner(profile);}};
render();`;
const tail='\ninit();\n\n})();';
const baseline=read('src/demo-pwa/workbook.js');assert.equal(baseline.split(tail).length,2);
w.eval(baseline.replace(tail,'\n'+demo+'\n'+shell+'\n'+prepare+'\n})();'));
const api=w.shellFixture,query=selector=>d.querySelector(selector),sameState=()=>JSON.stringify(api.state());
assert.equal(d.body.dataset.focusView,'home');
assert.equal(d.body.dataset.hznExperience,'focus');
for(const mode of ['sprouts','adventure','discovery','focus']){
 query('#hzn-experience-home-'+mode).click();
 assert.equal(d.body.dataset.hznExperience,mode);
 assert.equal(query('#hzn-experience-home-'+mode).getAttribute('aria-pressed'),'true');
 assert.equal(query('#hzn-experience-settings-'+mode).getAttribute('aria-pressed'),'true');
}
assert.equal(query('#hzn-resume-label').textContent,JSON.parse(read('src/workbook-focus/focus-locales.json')).ar.start);
assert.equal(query('#course-nav').parentElement.id,'hzn-home-nav');
assert.equal(query('#locale').closest('#hzn-language-dock').id,'hzn-language-dock');
assert.equal(query('#hzn-home').hidden,false);
query('#hzn-resume').click();assert.equal(d.body.dataset.focusView,'lesson');
assert.equal(query('#course-nav').closest('dialog').id,'hzn-lessons-dialog');
api.nav({course:'lesson',chapter:'yaa',tab:'words',word:7});
api.answer('fixture-existing-answer');
const before=sameState(),feedback=JSON.stringify(api.feedback()),activity=query('#activity'),activityNodes=[...activity.querySelectorAll('*')];
for(const mode of ['sprouts','adventure','discovery','focus']){
 query('#hzn-experience-settings-'+mode).click();
 assert.equal(w.hznFocusShell.currentExperience(),mode);
 assert.equal(sameState(),before,'Changing presentation must preserve the lesson and progress');
 assert.deepEqual([...activity.querySelectorAll('*')],activityNodes,'Changing presentation must preserve the active activity');
}
const originalFont=query('#typography-font'),originalLanguage=query('#locale');
for(let i=0;i<4;i++){
 query('#hzn-lessons-button').click();assert.equal(query('#hzn-lessons-dialog').open,true);query('#hzn-lessons-dialog-close').click();
 query('#settings-button').click();assert.equal(query('#settings').open,true);query('#close-settings').click();
 assert.equal(query('#activity'),activity);assert.deepEqual([...activity.querySelectorAll('*')],activityNodes);assert.equal(sameState(),before);assert.equal(JSON.stringify(api.feedback()),feedback);
 assert.equal(query('#typography-font'),originalFont);assert.equal(query('#locale'),originalLanguage);
}
assert.equal(plays,0);assert.equal(requests,0);
assert.equal(query('#settings-content .typography-settings'),null);
assert.equal(d.querySelectorAll('#typography-toolbar').length,1);
assert.equal(d.querySelectorAll('#locale').length,1);
query('#hzn-back-lessons').click();assert.equal(d.body.dataset.focusView,'home');
assert.equal(api.state().word,7);query('#hzn-resume').click();assert.equal(api.state().word,7);assert.equal(d.body.dataset.focusView,'lesson');
query('#hzn-lessons-button').click();query('[data-demo-section="blending4"]').click();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(sameState(),before,'Locked preview must not touch progress or answers');
query('#hzn-back-lessons').click();query('#hzn-resume').click();assert.equal(api.state().chapter,'yaa');assert.equal(api.state().word,7);assert.equal(query('#activity [data-demo-return]'),null);
for(const lang of Object.keys(JSON.parse(read('src/workbook-focus/focus-locales.json')))){
 api.locale(lang);assert.equal(query('#hzn-home-title').textContent,JSON.parse(read('src/workbook-focus/focus-locales.json'))[lang].homeTitle);
 assert.equal(query('#hzn-experience-home-sprouts strong').textContent,JSON.parse(read('src/workbook-focus/focus-locales.json'))[lang].experiencesprouts);
 assert.equal(d.querySelectorAll('#hzn-home').length,1);assert.equal(d.querySelectorAll('#hzn-lessons-button').length,1);
}
// Isolated synthetic adult-owned learner records: UI location keys do not mix.
const first={id:'fixture-a',nickname:'',progress:JSON.parse(before),settings:{}},second={id:'fixture-b',nickname:'',progress:JSON.parse(before),settings:{}};
api.profile(first);w.hznFocusShell.rememberComponent('blending4',{lesson:4,index:2,mode:'readCheck',review:true,practice:false,answer:true,secretWord:'PRIVATE',ratings:{x:'correct'}});
assert.equal(w.hznFocusShell.restoreComponent('blending4').lesson,4);
api.profile(second);assert.equal(d.body.dataset.focusView,'home');assert.equal(w.hznFocusShell.restoreComponent('blending4'),null);
query('#hzn-experience-home-adventure').click();assert.equal(w.hznFocusShell.currentExperience(),'adventure');
api.profile(first);assert.equal(w.hznFocusShell.restoreComponent('blending4').index,2);
assert.equal(w.hznFocusShell.currentExperience(),'focus','Experience choice must be scoped to each learner');
assert.equal(w.hznFocusShell.restoreComponent('blending4').secretWord,undefined);assert.equal(w.hznFocusShell.restoreComponent('blending4').answer,undefined);
assert.equal(w.hznFocusShell.restoreComponent('blending4').review,true);assert.equal(w.hznFocusShell.restoreComponent('blending4').practice,false);
assert.equal(sameState(),before);
query('#settings-button').click();
for(const lang of ['en','ar','tr','ar']){api.locale(lang);w.hznFocusShell.sync();assert.equal(d.querySelectorAll('.hzn-account-details').length,1);assert.equal(d.querySelectorAll('.hzn-account-details .hzn-account-details').length,0);assert.ok(query('.hzn-account-details .learner-settings'));}
query('#close-settings').click();
query('#hzn-account-button').click();assert.equal(query('#hzn-account-dialog').open,true);query('#learner-manage').click();assert.equal(query('#hzn-account-dialog').open,false);assert.equal(query('#settings').open,true);assert.equal(query('#settings-content .typography-settings'),null);query('#close-settings').click();
query('#hzn-resume').click();api.profile(second);assert.equal(w.history.state.hznFocus.learner,'demo:fixture-b');query('#hzn-resume').click();assert.equal(d.body.dataset.focusView,'lesson');
const returned=new Promise(resolve=>w.addEventListener('popstate',resolve,{once:true}));w.history.back();await returned;assert.equal(d.body.dataset.focusView,'home');assert.equal(w.hznFocusShell.currentLearnerKey(),'demo:fixture-b');
console.log('PASS focus shell: 32 locales, real reader navigation, modal state preservation, native control identity, no audio/network, resume, paid preview isolation, learner-scoped safe location.');
dom.window.close();
