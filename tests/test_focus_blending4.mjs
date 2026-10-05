// Pure renderer/state checks using the authorized private Section 05 file passed as argv[2].
// This does not substitute for visual/browser verification and never emits private entries.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
if(!process.argv[2])throw new Error('Pass the authorized local Section 05 data.json path.');
const rootUrl=new URL('../',import.meta.url);
const source=readFileSync(new URL('src/workbook-focus/blending4-component.js',rootUrl),'utf8');
const oldSource=readFileSync(new URL('src/workbook-web/blending4-component.js',rootUrl),'utf8');
const css=readFileSync(new URL('src/workbook-focus/blending4-component.css',rootUrl),'utf8');
const data=JSON.parse(readFileSync(process.argv[2],'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const originalHash=hash(data);
const body=(src,a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
for(const [start,end] of [[' function shape(', ' const type='],[' const type=', ' function reset()'],[' function card(', ' function allWords()']]){
 assert.equal(body(source,start,end),body(oldSource,start,end),'content shapes, activity reveal rules and choices are byte-identical');
}
const calls={progress:[],snapshots:[],audio:[]};
class FakeAudio {
 constructor(src){this.src=src;this.pauses=0;calls.audio.push(this);}
 async play(){} pause(){this.pauses++;} removeAttribute(){} load(){}
}
const context=vm.createContext({Audio:FakeAudio,Intl});vm.runInContext(source,context);
function mount(snapshot={},locale='ar'){
 const listeners=new Map(),props={};
 const root={innerHTML:'',activeElement:null,host:{setAttribute(){},style:{setProperty:(k,v)=>props[k]=v}},
  addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k),
  getElementById:()=>null,querySelectorAll:()=>[],contains:()=>true};
 const reader=context.mountBlending4Component(root,data,{css,locale,font:'noto-naskh',snapshot,externalSettings:true,
  resolveAudio:async path=>path,onAudioError:()=>{},onLocale:()=>{},
  onProgress:x=>calls.progress.push(x),onSnapshot:x=>calls.snapshots.push(x)});
 function click(dataset){listeners.get('click')({target:{closest:()=>({dataset,disabled:false})}});}
 return {root,reader,click,props};
}
for(const locale of Object.keys(data.ui.locales)){
 for(const mode of ['learn','readCheck','meaningCheck','quiz']){
  const {root,reader,props}=mount({mode},locale);
  assert.ok(!/id="settings"/.test(root.innerHTML),'external settings do not duplicate controls');
  assert.ok(/id="lesson-panel"\s*>/.test(root.innerHTML),'directory begins collapsed at every width');
  assert.ok(!/data-meaning-panel/.test(root.innerHTML),'meaning remains gated');
  if(mode==='readCheck')assert.ok(!/data-play=/.test(root.innerHTML),'reading hides audio before reveal');
  if(mode==='quiz')assert.ok(!/data-target=/.test(root.innerHTML),'listening target is absent until correct choice');
  for(const font of data.outlines.font_ids){reader.setPreferences({font,size:2});assert.equal(reader.snapshot().mode,mode);assert.equal(reader.snapshot().size,2);assert.equal(props['--word-size'],2);}
  reader.dispose();
 }
}
assert.equal(calls.progress.length,0,'preferences and mounting do not assess answers');
const {root,reader,click}=mount({mode:'readCheck'});
click({action:'answer'});const revealed=reader.snapshot();
assert.equal(revealed.answer,true);assert.ok(/data-meaning-panel/.test(root.innerHTML));
click({play:data.bank.entries[0].id});await new Promise(resolve=>setImmediate(resolve));
assert.equal(calls.audio.length,1);const playing=calls.audio[0],pauses=playing.pauses;
reader.setPreferences({locale:'tr',font:'amiri',size:2});
assert.equal(playing.pauses,pauses,'preference changes preserve playing audio');
assert.equal(reader.snapshot().answer,true,'preference changes preserve reveal state');
assert.equal(calls.progress.length,0,'reveals and preferences do not change score');
click({action:'next'});assert.ok(playing.pauses>pauses,'card transition stops audio');
assert.equal(reader.snapshot().answer,false,'next card resets reveal as before');
assert.equal(reader.snapshot().index,1);
reader.dispose();
assert.equal(hash(data),originalHash,'runtime never mutates private content');
console.log(JSON.stringify({status:'pass',rendererConfigurations:Object.keys(data.ui.locales).length*4*data.outlines.font_ids.length,checks:['same curriculum render/gates','collapsed directory','all locales/fonts','200% state','answer preservation','audio preservation on preferences','audio stop on navigation','content unchanged'],scope:'Pure renderer/state; no browser layout claim'}));
