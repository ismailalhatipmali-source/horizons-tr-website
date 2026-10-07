/*WORKBOOK_FOCUS_BEGIN*/
/* Shared presentation layer, installed inside the existing workbook closure.
 * Curriculum state and assessment handlers remain owned by the original reader.
 * Only a small, learner-scoped location bookmark is stored by this layer. */
(function installFocusShell(){
 'use strict';
 const COPY=/*HZN_FOCUS_LOCALES*/;
 const CSS=/*HZN_FOCUS_CSS*/;
 const q=selector=>document.querySelector(selector);
 const text=key=>COPY[locale]?.[key]??COPY.en[key];
 const sectionNames=['alphabet','phonics','blending2','blending3','blending4','catalog'];
 const experienceNames=['sprouts','adventure','discovery','focus'];
 const componentNames=new Set(['phonics','blending2','blending3','blending4']);
 const memory=new Map();
 const experienceMemory=new Map();
 const components=new Map();
 let view='home',owner=null,installed=false,returnFocus=null,restoring=false,wordObserver;
 let home,homeNav,drawer,drawerNav,accountDialog,languageDock,utilityDock,toolbar,backButton;
 const original={render,nav,setLearner,learnerToolbar,openSettingsWithTypography,applyTypography};
 function learnerKey(){return (IS_DEMO?'demo:':'full:')+(learnerStorage.enabled?learnerStorage.current?.id||'pending':'local');}
 function storageKey(){return 'horizons.focus-location.v1:'+learnerKey();}
 function experienceKey(){return 'horizons.experience.v1:'+learnerKey();}
 function experience(){
  const key=learnerKey();if(experienceMemory.has(key))return experienceMemory.get(key);
  let value;try{value=localStorage.getItem(experienceKey());}catch{}
  value=experienceNames.includes(value)?value:'focus';experienceMemory.set(key,value);return value;
 }
 function selectExperience(value){
  if(!experienceNames.includes(value))return;
  experienceMemory.set(learnerKey(),value);
  try{localStorage.setItem(experienceKey(),value);}catch{}
  syncExperience();
 }
 function experiencePicker(place){
  const group=element('section',{class:'hzn-experience-picker','aria-labelledby':'hzn-experience-title-'+place});
  const heading=element('h2',{id:'hzn-experience-title-'+place});group.append(heading);
  const choices=element('div',{class:'hzn-experience-choices'});
  for(const name of experienceNames){
   const choice=button('hzn-experience-'+place+'-'+name,()=>selectExperience(name));
   choice.className='hzn-experience-choice';choice.dataset.experienceChoice=name;
   const ornament=element('span',{class:'hzn-experience-ornament','aria-hidden':'true'});
   const label=element('strong'),description=element('small');
   choice.append(ornament,label,description);choices.append(choice);
  }
  group.append(choices);return group;
 }
 function syncExperience(){
  const selected=experience();document.body.dataset.hznExperience=selected;
  for(const picker of document.querySelectorAll('.hzn-experience-picker')){
   picker.querySelector('h2').textContent=text('experienceTitle');
   for(const choice of picker.querySelectorAll('[data-experience-choice]')){
    const name=choice.dataset.experienceChoice;
    choice.querySelector('strong').textContent=text('experience'+name);
    choice.querySelector('small').textContent=text('experience'+name+'Hint');
    choice.setAttribute('aria-pressed',String(name===selected));
   }
  }
 }
 function locationRecord(){
  const key=learnerKey();if(memory.has(key))return memory.get(key);
  let row=null;try{row=JSON.parse(localStorage.getItem(storageKey()));}catch{}
  if(!row||row.schema!==1||!sectionNames.includes(row.section)||typeof row.components!=='object')row={schema:1,section:null,components:{}};
  memory.set(key,row);return row;
 }
 function persistLocation(){try{localStorage.setItem(storageKey(),JSON.stringify(locationRecord()));}catch{/* Core progress saving remains authoritative. */}}
 function safeSnapshot(snapshot){
  const result={};
  for(const key of ['lesson','index','size'])if(Number.isFinite(snapshot?.[key])&&snapshot[key]>=0&&snapshot[key]<100000)result[key]=snapshot[key];
  for(const key of ['mode','font'])if(typeof snapshot?.[key]==='string'&&/^[a-zA-Z0-9_-]{1,40}$/.test(snapshot[key]))result[key]=snapshot[key];
  for(const key of ['practice','review'])if(typeof snapshot?.[key]==='boolean')result[key]=snapshot[key];
  return result;
 }
 function rememberComponent(section,snapshot){
  if(!componentNames.has(section)||!state||restoring)return;
  const row=locationRecord();row.components[section]=safeSnapshot(snapshot);
  if(view==='lesson')row.section=section;
  persistLocation();
 }
 function restoreComponent(section){const value=locationRecord().components[section];return value?{...value}:null;}
 function currentSection(){
  const selected=q('#course-nav button[aria-pressed="true"]');
  const value=selected?.dataset.demoSection||selected?.dataset.b4Course||selected?.dataset.b3Course||selected?.dataset.b2Course||selected?.dataset.phonicsCourse||selected?.dataset.course;
  if(sectionNames.includes(value))return value;
  const fromBody=document.body.dataset.course;
  return sectionNames.includes(fromBody)?fromBody:state.course==='lesson'?'catalog':state.course;
 }
 function hasProgress(){
  if(!state)return false;
  return state.course==='lesson'||state.letter>0||Object.values(state.heard||{}).some(Boolean)||
   Object.values(state.attempts||{}).some(value=>value?.count>0)||Object.values(state.written||{}).some(Boolean)||
   Object.values(state.ink||{}).some(strokes=>strokes.length>0)||!!locationRecord().section;
 }
 function element(tag,attributes={}){
  const node=document.createElement(tag);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,value);return node;
 }
 function button(id,action){const node=element('button',{type:'button',id});node.onclick=action;return node;}
 function createDialog(id,titleId){
  const dialog=element('dialog',{id,class:'hzn-focus-dialog','aria-labelledby':titleId});
  const head=element('div',{class:'hzn-dialog-head'}),title=element('h2',{id:titleId}),close=button(id+'-close',()=>dialog.close());
  close.className='secondary hzn-dialog-close';head.append(title,close);dialog.append(head);document.body.append(dialog);
  dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  return dialog;
 }
 function closePanels(){for(const dialog of [drawer,accountDialog])if(dialog?.open)dialog.close();}
 function openPanel(dialog,trigger){returnFocus=trigger;dialog.showModal();}
 function saveHistory(next,replace=false){
  if(restoring||!globalThis.history?.pushState)return;
  const previous=history.state&&typeof history.state==='object'?history.state:{};
  const value={...previous,hznFocus:{view:next,learner:learnerKey()}};
  try{history[replace?'replaceState':'pushState'](value,'');}catch{}
 }
 function lessonView(){
  const changed=view!=='lesson';view='lesson';closePanels();applyView();
  if(changed)saveHistory('lesson');
 }
 function showHome(){
  stopPenDemo();stop();closePanels();const changed=view!=='home';view='home';sync();
  if(changed)saveHistory('home');q('#hzn-home-title')?.focus({preventScroll:true});
 }
 function openLessons(){
  if(view==='home'){homeNav.scrollIntoView({block:'nearest',behavior:'auto'});q('#course-nav button')?.focus();return;}
  drawerNav.append(q('#course-nav'));openPanel(drawer,q('#hzn-lessons-button'));
 }
 function startOrResume(){
  // A locked preview is not a learning location. Return through its original
  // handler before resuming the untouched free activity beneath it.
  if(IS_DEMO)q('#activity [data-demo-return]')?.click();
  lessonView();const target=locationRecord().section;
  if(target&&target!==currentSection()&&componentNames.has(target)){
   const choice=[...q('#course-nav').querySelectorAll('button')].find(node=>[node.dataset.b4Course,node.dataset.b3Course,node.dataset.b2Course,node.dataset.phonicsCourse,node.dataset.course].includes(target));
   if(choice&&!choice.disabled)choice.click();
  }
  applyView();q('#activity')?.focus({preventScroll:true});
 }
 function install(){
  if(installed)return;installed=true;document.body.classList.add('hzn-focus');
  const style=element('style',{id:'hzn-focus-style'});style.textContent=CSS;document.head.append(style);
  const main=q('main');
  home=element('section',{id:'hzn-home','aria-labelledby':'hzn-home-title'});
  const welcome=element('div',{class:'hzn-home-welcome'}),heading=element('h1',{id:'hzn-home-title',tabindex:'-1'}),hint=element('p',{id:'hzn-home-hint'});
  const resume=button('hzn-resume',startOrResume);resume.className='primary hzn-resume';
  const resumeLabel=element('span',{id:'hzn-resume-label'}),resumeTitle=element('small',{id:'hzn-resume-title'});resume.append(resumeLabel,resumeTitle);
  welcome.append(heading,hint,resume);homeNav=element('div',{id:'hzn-home-nav'});
  home.append(experiencePicker('home'),welcome,homeNav);main.prepend(home);
  drawer=createDialog('hzn-lessons-dialog','hzn-lessons-title');drawerNav=element('div',{class:'hzn-drawer-nav'});drawer.append(drawerNav);
  accountDialog=createDialog('hzn-account-dialog','hzn-account-title');accountDialog.append(element('div',{id:'hzn-account-controls'}));
  const accountHelp=button('hzn-account-help',()=>{accountDialog.close();openSettings();});accountHelp.className='secondary';accountDialog.append(accountHelp);
  toolbar=element('nav',{class:'hzn-top-controls','aria-label':text('activityOptions')});
  toolbar.append(button('hzn-lessons-button',openLessons),button('hzn-account-button',()=>{
   if(learnerStorage.enabled)openPanel(accountDialog,q('#hzn-account-button'));else openSettings();
  }));
  const settingsButton=q('#settings-button');settingsButton.classList.add('hzn-settings-button');settingsButton.onclick=openSettings;toolbar.append(settingsButton);
  q('.topbar').append(toolbar);
  const language=q('#locale')?.closest('label')||q('#locale');
  languageDock=element('section',{id:'hzn-language-dock',class:'setting-section'});if(language)languageDock.append(language);
  q('#settings').append(languageDock);
  q('#settings').append(experiencePicker('settings'));
  utilityDock=element('section',{id:'hzn-utility-dock',class:'setting-section'});q('#settings').append(utilityDock);
  const collectUtilities=()=>{const actions=q('.top-actions');if(!actions)return;for(const node of [...actions.children])utilityDock.append(node);};
  collectUtilities();
  if(typeof MutationObserver==='function'&&q('.top-actions'))new MutationObserver(collectUtilities).observe(q('.top-actions'),{childList:true});
  const brand=q('.topbar .brand');if(brand)brand.addEventListener('click',event=>{event.preventDefault();showHome();});
  backButton=button('hzn-back-lessons',showHome);backButton.className='hzn-back-lessons';q('.lesson-heading').prepend(backButton);
  q('#course-nav').addEventListener('click',event=>{
   const target=event.target.closest('button');if(!target||target.disabled)return;
   lessonView();
   queueMicrotask(()=>{if(!state)return;const section=currentSection();if(!IS_DEMO||!componentNames.has(section)){locationRecord().section=section;persistLocation();}sync();q('#activity')?.focus({preventScroll:true});});
  },true);
  q('#settings').addEventListener('close',()=>{q('#settings-button')?.focus({preventScroll:true});});
  const originalLocale=q('#locale').onchange;
  q('#locale').onchange=function(event){const result=originalLocale?.call(this,event);syncSettings();return result;};
  addEventListener('popstate',event=>{
   const record=event.state?.hznFocus;if(!record||record.learner!==learnerKey())return;
   restoring=true;view=record.view==='lesson'?'lesson':'home';stopPenDemo();stop();closePanels();sync();restoring=false;
  });
  saveHistory('home',true);
 }
 function syncSettings(){
  const dialog=q('#settings');if(!dialog)return;
  q('#settings-title').textContent=text('settings');q('#close-settings').setAttribute('aria-label',text('close'));
  // The existing toolbar is relocated, not copied; its select handlers and font
  // preference persistence remain intact. The generated duplicate is removed.
  const nativeToolbar=q('#typography-toolbar');
  if(nativeToolbar){languageDock.append(nativeToolbar);nativeToolbar.querySelector('details')?.setAttribute('open','');}
  q('#settings-content .typography-settings')?.remove();
  if(languageDock.parentElement!==dialog)dialog.append(languageDock);
  const learnerTools=q('#settings-content .learner-settings');
  if(learnerTools){
   let wrapper=learnerTools.closest('.hzn-account-details');
   if(!wrapper){wrapper=element('details',{class:'hzn-account-details'});const summary=element('summary');learnerTools.before(wrapper);wrapper.append(summary,learnerTools);}
   wrapper.querySelector('summary').textContent=text('account');
  }
  q('#settings-button').onclick=openSettings;
 }
 function openSettings(){
  closePanels();returnFocus=q('#settings-button');original.openSettingsWithTypography();syncSettings();
  q('#settings').prepend(languageDock);q('#settings').prepend(q('#settings .dialog-head'));
 }
 function compactActivity(){
  const activity=q('#activity');if(!activity)return;
  const grid=activity.querySelector('.alphabet-grid');
  if(grid&&!grid.closest('.hzn-letter-index')){
   const details=element('details',{class:'hzn-letter-index'}),summary=element('summary');summary.textContent=text('letterIndex');details.append(summary,grid);activity.append(details);
   grid.addEventListener('click',event=>{if(event.target.closest('[data-letter]'))details.open=false;});
  }
  const header=activity.querySelector(':scope > .activity-header');
  if(header&&state.course!=='catalog'){
   const existing=activity.querySelector('.word-overview,.hzn-letter-index,.writing-notes');
   if(existing)existing.append(header);
   else{const details=element('details',{class:'hzn-activity-help'}),summary=element('summary');summary.textContent=text('activityOptions');details.append(summary,header);activity.append(details);}
  }
  const word=activity.querySelector('.vocab-word');
  if(typeof ResizeObserver==='function'){wordObserver??=new ResizeObserver(wordAccess);wordObserver.disconnect();if(word)wordObserver.observe(word);}
  wordAccess();
 }
 function wordAccess(){
  const word=q('#activity .vocab-word');if(!word)return;
  if(word.scrollWidth>word.clientWidth+1){word.setAttribute('tabindex','0');word.setAttribute('role','region');word.setAttribute('aria-label',t('words'));}
  else{word.removeAttribute('tabindex');word.removeAttribute('role');word.removeAttribute('aria-label');}
 }
 function applyView(){
  document.body.dataset.focusView=view;home.hidden=view!=='home';
  const nav=q('#course-nav'),destination=view==='home'?homeNav:drawerNav;if(nav.parentElement!==destination)destination.append(nav);
  const upgrade=q('#demo-upgrade');if(upgrade){const target=view==='home'?homeNav:drawerNav;if(upgrade.parentElement!==target||upgrade.nextElementSibling!==nav)nav.before(upgrade);}
  const navContainer=q('#activity-navigation');if(navContainer)navContainer.classList.toggle('hzn-has-activities',!q('#stages').hidden);
 }
 function sync(){
  if(!state||!q('#activity'))return;
  const nextOwner=learnerKey();if(nextOwner!==owner){owner=nextOwner;view='home';closePanels();if(installed)saveHistory('home',true);}
  install();
  syncExperience();
  const currentProfile=learnerStorage.enabled?learnerStorage.current:null;
  q('#hzn-home-title').textContent=text('homeTitle');q('#hzn-home-hint').textContent=text('homeHint');
  q('#hzn-resume-label').textContent=text(hasProgress()?'resume':'start');
  let title=IS_DEMO&&q('#activity [data-demo-return]')
   ?state.course==='lesson'?t('letterLesson',{letter:data.letter}):t(state.course==='catalog'?'courseTitle':'alphabet')
   :q('#lesson-title')?.textContent||'';
  const lastSection=locationRecord().section;
  if(lastSection&&componentNames.has(lastSection)&&lastSection!==currentSection()){
   const choice=[...q('#course-nav').querySelectorAll('button')].find(node=>[node.dataset.b4Course,node.dataset.b3Course,node.dataset.b2Course,node.dataset.phonicsCourse,node.dataset.course].includes(lastSection));
   if(choice)title=choice.querySelector('.demo-section-title')?.textContent||choice.textContent.trim();
   const saved=restoreComponent(lastSection);if(saved?.lesson)title+=' · '+text('lessons')+' '+new Intl.NumberFormat(locale).format(saved.lesson);
  }
  q('#hzn-resume-title').textContent=hasProgress()?title:'';
  q('#hzn-lessons-button').textContent=text('lessons');q('#hzn-account-button').textContent=currentProfile?.nickname||text('account');
  q('#settings-button').textContent=text('settings');q('#settings-button').setAttribute('aria-label',text('settings'));
  backButton.textContent=text('backToLessons');
  q('#hzn-lessons-title').textContent=text('lessons');q('#hzn-account-title').textContent=text('account');q('#hzn-account-help').textContent=text('account')+' · '+text('settings');
  for(const id of ['hzn-lessons-dialog','hzn-account-dialog']){q('#'+id+'-close').textContent=text('close');q('#'+id).lang=locale;q('#'+id).dir=document.documentElement.dir;}
  toolbar.setAttribute('aria-label',text('activityOptions'));
  const learnerToolbarNode=q('#learner-toolbar');if(learnerToolbarNode){q('#hzn-account-controls').append(learnerToolbarNode);const manage=q('#learner-manage');if(manage)manage.onclick=openSettings;}
  const nativeToolbar=q('#typography-toolbar');if(nativeToolbar)languageDock.append(nativeToolbar);
  const savedLabel=q('#saved-label');if(savedLabel)utilityDock.append(savedLabel);
  q('#settings-button').onclick=openSettings;
  compactActivity();applyView();if(q('#settings')?.open)syncSettings();
 }
 render=function(...args){const result=original.render.apply(this,args);sync();return result;};
 nav=function(...args){lessonView();const result=original.nav.apply(this,args);locationRecord().section=currentSection();persistLocation();return result;};
 learnerToolbar=function(...args){
  const result=original.learnerToolbar.apply(this,args),manage=q('#learner-manage');if(manage)manage.onclick=openSettings;
  const native=q('#learner-toolbar');if(installed&&native)q('#hzn-account-controls').append(native);return result;
 };
 setLearner=function(...args){view='home';closePanels();const result=original.setLearner.apply(this,args);sync();return result;};
 function wrapComponent(section,mount){
  return function(root,data,config){
   const componentOwner=learnerKey(),onSnapshot=config.onSnapshot;
   const snapshot=config.snapshot||restoreComponent(section);
   const instance=mount(root,data,{...config,externalSettings:true,snapshot,
    onSnapshot(value){if(componentOwner!==learnerKey())return;onSnapshot?.(value);rememberComponent(section,value);}
   });
   components.set(section,{instance,host:root.host,owner:componentOwner});
   instance.setPreferences?.({font:typographyFont().id,size:TYPOGRAPHY_SIZES[typography.size]/100,locale});
   return instance;
  };
 }
 if(typeof mountBlending3Component==='function')mountBlending3Component=wrapComponent('blending3',mountBlending3Component);
 if(typeof mountBlending4Component==='function')mountBlending4Component=wrapComponent('blending4',mountBlending4Component);
 applyTypography=function(...args){
  const result=original.applyTypography.apply(this,args);
  for(const item of components.values())if(item.owner===learnerKey()&&item.host.isConnected)item.instance.setPreferences?.({font:typographyFont().id,size:TYPOGRAPHY_SIZES[typography.size]/100,locale});
  requestAnimationFrame(wordAccess);
  return result;
 };
 addEventListener('resize',wordAccess);
 document.fonts?.ready.then(wordAccess);
 globalThis.hznFocusShell=Object.freeze({sync,currentLearnerKey:learnerKey,rememberComponent,restoreComponent,showHome,openSettings,currentExperience:experience});
})();
/*WORKBOOK_FOCUS_END*/
