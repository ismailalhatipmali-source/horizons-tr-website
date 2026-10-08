/* HORIZONS native experiences, 0.3.0. Presentation only.
 * Mounts over the verified WORKBOOK_FOCUS shell; never re-renders an activity,
 * decrypts content, requests audio, changes entitlements, or copies progress.
 * Assets are supplied by stage_workbook_experiences.py, not fetched at runtime.
 */
(function (scope) {
  'use strict';
  const MODES = Object.freeze(['sprout', 'adventure', 'discovery', 'focus']);
  const FUTURE = Object.freeze(['pronouns', 'possessives', 'numbers', 'colors', 'calendar', 'directions', 'stories']);
  const VERSION = '0.3.0';
  function normalizeRecord(row) {
    return {schema: 1, experience: MODES.includes(row?.experience) ? row.experience : 'focus',
      tone: row?.tone === 'dark' ? 'dark' : 'light', seen: row?.seen === true};
  }
  function install(win, doc, assets) {
    if (!doc || !assets || typeof assets.css !== 'string' || typeof assets.shadow !== 'string') {
      throw new TypeError('HZN_EXPERIENCES_ASSETS_REQUIRED');
    }
    const locales = assets.locales;
    if (!locales?.en || !locales?.ar) throw new TypeError('HZN_EXPERIENCES_LOCALES_REQUIRED');
    if (win.hznExperiences?.version === VERSION) return win.hznExperiences;
    const memory = new Map(), shadows = new Map(), numbers = new WeakMap();
    const q = selector => doc.querySelector(selector);
    let owner = null, record = normalizeRecord(null), mounted = false, destroyed = false;
    let scheduled = false, dialog, trigger, status, future, stageMenu, stageDock;
    let returnFocus = null, documentObserver, pollTimer, initialCheck = false;
    let persistent = true, chooserLocale = null, futureLocale = null, suppressCloses = 0;
    const storagePrefix = 'horizons.experiences.v1:';
    const created = new Set();
    const own = node => {created.add(node); return node;};
    const text = (node, value) => {if (node && node.textContent !== value) node.textContent = value;};
    const attr = (node, key, value) => {value=String(value);if(node.getAttribute(key)!==value)node.setAttribute(key,value);};
    const language = () => {
      const raw = String(q('#locale')?.value || doc.documentElement.lang || 'en').toLowerCase().split(/[-_]/)[0];
      return Object.hasOwn(locales, raw) ? raw : 'en';
    };
    const t = key => locales[language()][key] ?? locales.en[key] ?? key;
    const element = (tag, cls) => {const n = doc.createElement(tag); if(cls)n.className=cls;return n;};
    const button = (cls, action) => {const b = element('button',cls);b.type='button';b.addEventListener('click',action);return b;};
    function storageKey() {return storagePrefix + owner;}
    function save() {
      if (owner === null) return;
      memory.set(owner, {...record});
      try {win.localStorage.setItem(storageKey(), JSON.stringify(record));}
      catch (_) {persistent = false;}
      if(status)text(status, t(persistent ? 'deviceOnly' : 'sessionOnly'));
    }
    function readOwner(next) {
      owner=next; let row=memory.get(next);
      if (!row) {try{row=JSON.parse(win.localStorage.getItem(storageKey()));}catch(_){persistent=false;}}
      record=normalizeRecord(row); initialCheck=false;
    }
    function closeChooser() {if(dialog?.open)dialog.close();}
    function restoreFocus() {
      const target=returnFocus?.isConnected && returnFocus.getClientRects().length ? returnFocus : trigger;
      target?.focus({preventScroll:true});
    }
    function openChooser() {
      if(!mounted || destroyed)return false;
      // Never open a second modal above the reader's account/activation dialog.
      if([...doc.querySelectorAll('dialog[open]')].some(d=>d!==dialog))return false;
      returnFocus=doc.activeElement;
      refreshChooser(); if(!dialog.open)dialog.showModal(); return true;
    }
    function choose(mode) {
      if(!MODES.includes(mode) || !mounted)return false;
      record.experience=mode;record.seen=true;save();apply();closeChooser();return true;
    }
    function setTone(tone) {
      if(!['light','dark'].includes(tone)||!mounted)return false;
      record.tone=tone;save();apply();return true;
    }
    function makeChooser() {
      dialog=own(element('dialog','hzn-exp-dialog'));dialog.id='hzn-experience-dialog';
      dialog.setAttribute('aria-labelledby','hzn-exp-title');
      const head=element('div','hzn-exp-dialog-head'), title=element('h2');title.id='hzn-exp-title';
      const close=button('hzn-exp-close',closeChooser);close.dataset.copy='close';
      head.append(title,close);dialog.append(head);
      const hint=element('p','hzn-exp-help');hint.dataset.copy='choiceHint';dialog.append(hint);
      const grid=element('div','hzn-exp-choices');
      for(const mode of MODES){
        const b=button('hzn-exp-choice',()=>choose(mode));b.dataset.experience=mode;
        b.setAttribute('aria-describedby','hzn-exp-hint-'+mode);
        const diagram=element('span','hzn-exp-mini '+mode);diagram.setAttribute('aria-hidden','true');
        for(let i=0;i<4;i++)diagram.append(element('i'));
        const name=element('strong');name.dataset.copy=mode;
        const info=element('span','hzn-exp-choice-info');info.dataset.copy=mode+'Hint';info.id='hzn-exp-hint-'+mode;
        b.append(diagram,name,info);grid.append(b);
      }
      dialog.append(grid);
      const tones=element('fieldset','hzn-exp-tones'), legend=element('legend');legend.dataset.copy='brightness';tones.append(legend);
      for(const tone of ['light','dark']){const b=button('hzn-exp-tone',()=>setTone(tone));b.dataset.tone=tone;b.dataset.copy=tone;tones.append(b);}
      status=element('p','hzn-exp-save-note');status.setAttribute('role','status');dialog.append(tones,status);
      dialog.addEventListener('close',()=>{if(destroyed)return;if(suppressCloses){suppressCloses--;return;}record.seen=true;save();restoreFocus();});
      dialog.addEventListener('click',e=>{
        if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();
        if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();
      });
      doc.body.append(dialog);
    }
    function refreshChooser() {
      if(!dialog)return;
      const lang=language();
      if(chooserLocale!==lang){
        chooserLocale=lang;text(q('#hzn-exp-title'),t('choose'));
        dialog.querySelectorAll('[data-copy]').forEach(n=>text(n,t(n.dataset.copy)));
        attr(dialog,'lang',lang);attr(dialog,'dir',['ar','he','fa','ur'].includes(lang)?'rtl':'ltr');
      }
      dialog.querySelectorAll('[data-experience]').forEach(b=>attr(b,'aria-pressed',b.dataset.experience===record.experience));
      dialog.querySelectorAll('[data-tone]').forEach(b=>attr(b,'aria-pressed',b.dataset.tone===record.tone));
      text(status,t(persistent?'deviceOnly':'sessionOnly'));
    }
    function installFuture() {
      const home=q('#hzn-home');if(!home)return;
      if(!future){
        future=own(element('details','hzn-exp-future'));future.id='hzn-exp-future';
        const summary=element('summary');summary.dataset.copy='future';future.append(summary);
        const list=element('ul');
        for(const key of FUTURE){const row=element('li'),label=element('span'),state=element('small');
          label.dataset.copy=key;state.dataset.copy='soon';row.append(label,state);list.append(row);}
        future.append(list);
      }
      if(future.parentElement!==home)home.append(future);
      if(futureLocale!==language()){
        futureLocale=language();future.querySelectorAll('[data-copy]').forEach(n=>text(n,t(n.dataset.copy)));
      }
    }
    function decorateSteps() {
      // Number decorations belong to navigation only, not lesson text or images.
      for(const selector of ['#course-nav button','#stages button']){
        [...doc.querySelectorAll(selector)].forEach((b,i)=>{
          const label=new Intl.NumberFormat(language()).format(i+1);
          if(numbers.get(b)!==label){attr(b,'data-hzn-step',label);numbers.set(b,label);}
        });
      }
    }
    function syncStageMenu() {
      const stages=q('#stages'), dock=q('#activity-navigation');
      if(!stages||!dock)return;
      if(!stageMenu){
        stageMenu=own(element('details','hzn-exp-stage-menu'));stageMenu.id='hzn-exp-stage-menu';
        const summary=element('summary');summary.dataset.copy='activities';stageMenu.append(summary);
        stageMenu.addEventListener('click',e=>{if(e.target.closest('#stages button'))stageMenu.open=false;});
      }
      stageDock=dock;
      attr(doc.body,'data-hzn-has-stages',!stages.hidden);
      const compact=record.experience==='sprout';
      if(compact){
        if(stageMenu.parentElement!==dock)dock.prepend(stageMenu);
        if(stages.parentElement!==stageMenu)stageMenu.append(stages);
        stageMenu.hidden=stages.hidden;
      }else{
        if(stages.parentElement===stageMenu)dock.prepend(stages);
        if(stageMenu.isConnected)stageMenu.remove();
      }
      text(stageMenu.firstElementChild,t('activities'));
    }
    function syncShadows() {
      const activity=q('#activity');if(!activity)return;
      const found=new Set();
      function visit(container){
        for(const host of container.querySelectorAll('*')){
          const root=host.shadowRoot;if(!root)continue;
          // Only the known readers. Do not recolor arbitrary widgets or glyphs.
          if(root.querySelector('#reader-inner,.b4')){
            found.add(root);let entry=shadows.get(root);
            if(!entry){
              const style=element('style');style.dataset.hznExperienceStyle=VERSION;
              const observer=new win.MutationObserver(schedule);
              observer.observe(root,{childList:true,subtree:true});
              entry={style,observer};shadows.set(root,entry);
            }
            if(entry.style.textContent!==assets.shadow)entry.style.textContent=assets.shadow;
            if(entry.style.parentNode!==root)root.append(entry.style);
            attr(host,'data-hzn-experience',record.experience);attr(host,'data-hzn-tone',record.tone);
          }
          visit(root);
        }
      }
      visit(activity);
      for(const [root,entry] of shadows){if(!found.has(root)){
        entry.observer.disconnect();entry.style.remove();
        root.host.removeAttribute('data-hzn-experience');root.host.removeAttribute('data-hzn-tone');shadows.delete(root);
      }}
    }
    function apply() {
      if(!mounted)return;
      attr(doc.body,'data-hzn-experience',record.experience);attr(doc.body,'data-hzn-tone',record.tone);
      attr(trigger,'aria-label',t('experience')+': '+t(record.experience));
      text(trigger,t('experience')+' · '+t(record.experience));
      refreshChooser();installFuture();syncStageMenu();decorateSteps();syncShadows();
    }
    function mount() {
      const shell=win.hznFocusShell;
      if(!shell?.currentLearnerKey || !q('#hzn-home') || !q('#activity') || !q('.hzn-top-controls') || !q('#stages'))return false;
      const style=own(element('style'));style.id='hzn-native-experiences-style';style.textContent=assets.css;doc.head.append(style);
      trigger=own(button('hzn-exp-trigger',openChooser));trigger.id='hzn-experience-button';
      trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','hzn-experience-dialog');
      q('.hzn-top-controls').append(trigger);makeChooser();mounted=true;
      attr(doc.body,'data-hzn-experiences-ready',VERSION);return true;
    }
    function sync() {
      scheduled=false;if(destroyed)return;
      if(!mounted&&!mount())return;
      const next=String(win.hznFocusShell.currentLearnerKey());
      if(owner!==next){if(dialog?.open){suppressCloses++;closeChooser();}readOwner(next);}
      const toolbar=q('.hzn-top-controls');if(toolbar&&trigger.parentElement!==toolbar)toolbar.append(trigger);
      apply();
      if(!initialCheck&&!record.seen)initialCheck=openChooser();
    }
    function schedule() {
      if(destroyed||scheduled)return;scheduled=true;win.requestAnimationFrame(sync);
    }
    function onChange(e) {if(e.target?.id==='locale')schedule();}
    function onStorage(e) {
      if(owner!==null && e.key===storageKey()){
        try{record=normalizeRecord(JSON.parse(e.newValue));memory.set(owner,{...record});apply();}catch(_){}
      }
    }
    function destroy() {
      if(destroyed)return;destroyed=true;documentObserver?.disconnect();win.clearInterval(pollTimer);
      closeChooser();doc.removeEventListener('change',onChange);win.removeEventListener('storage',onStorage);
      const stages=q('#stages');if(stages&&stages.parentElement===stageMenu&&stageDock)stageDock.prepend(stages);
      for(const [root,entry] of shadows){entry.observer.disconnect();entry.style.remove();root.host.removeAttribute('data-hzn-experience');root.host.removeAttribute('data-hzn-tone');}
      shadows.clear();for(const n of created)n.remove();
      doc.querySelectorAll('[data-hzn-step]').forEach(n=>n.removeAttribute('data-hzn-step'));
      for(const key of ['data-hzn-experience','data-hzn-tone','data-hzn-experiences-ready','data-hzn-has-stages'])doc.body.removeAttribute(key);
      if(win.hznExperiences===api)delete win.hznExperiences;
    }
    const api=Object.freeze({version:VERSION,choose,setTone,openChooser,refresh:schedule,destroy,
      snapshot:()=>Object.freeze({mounted,experience:record.experience,tone:record.tone,persistent,shadowReaders:shadows.size})});
    doc.addEventListener('change',onChange);win.addEventListener('storage',onStorage);
    documentObserver=new win.MutationObserver(schedule);
    documentObserver.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,
      attributeFilter:['lang','dir','data-focus-view','data-course','hidden','aria-pressed']});
    // Native readers can create an initially empty shadow root without an outer DOM mutation.
    // A bounded-rate scan also discovers those late mounts; no fetch, rebuild or media access.
    pollTimer=win.setInterval(()=>{if(!doc.hidden)schedule();},1500);
    win.hznExperiences=api;sync();return api;
  }
  if(typeof module==='object'&&module.exports)module.exports={install,normalizeRecord,MODES,VERSION};
  else scope.HZNInstallExperiences=install;
})(typeof globalThis!=='undefined'?globalThis:this);
