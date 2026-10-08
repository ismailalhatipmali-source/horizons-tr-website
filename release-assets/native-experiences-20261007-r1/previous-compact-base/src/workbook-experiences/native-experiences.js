/* HORIZONS single reader, 0.4.0. Light/dark presentation only.
 * Mounts over the verified WORKBOOK_FOCUS shell; never re-renders an activity,
 * decrypts content, requests audio, changes entitlements, or copies progress.
 * Assets are supplied by stage_workbook_experiences.py, not fetched at runtime.
 */
(function (scope) {
  'use strict';
  const MODES = Object.freeze(['focus']);
  const FUTURE = Object.freeze(['pronouns', 'possessives', 'numbers', 'colors', 'calendar', 'directions', 'stories']);
  const VERSION = '0.4.0';
  function normalizeRecord(row) {
    return {schema: 1, experience: 'focus',
      tone: row?.tone === 'dark' ? 'dark' : 'light', seen: row?.seen === true};
  }
  function install(win, doc, assets) {
    if (!doc || !assets || typeof assets.css !== 'string' || typeof assets.shadow !== 'string') {
      throw new TypeError('HZN_EXPERIENCES_ASSETS_REQUIRED');
    }
    const locales = assets.locales;
    if (!locales?.en || !locales?.ar) throw new TypeError('HZN_EXPERIENCES_LOCALES_REQUIRED');
    if (win.hznExperiences?.version === VERSION) return win.hznExperiences;
    const memory = new Map(), shadows = new Map();
    const q = selector => doc.querySelector(selector);
    let owner = null, record = normalizeRecord(null), mounted = false, destroyed = false;
    let scheduled = false, trigger, future;
    let documentObserver, pollTimer;
    let persistent = true;
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
    }
    function readOwner(next) {
      owner=next; let row=memory.get(next);
      if (!row) {try{row=JSON.parse(win.localStorage.getItem(storageKey()));}catch(_){persistent=false;}}
      record=normalizeRecord(row);
    }
    function setTone(tone) {
      if(!['light','dark'].includes(tone)||!mounted)return false;
      record.tone=tone;save();apply();return true;
    }
    function installFuture() {
      const home=q('#hzn-home');if(!home)return;
      if(!future){
        future=own(element('section','hzn-exp-future'));future.id='hzn-exp-future';
        const heading=element('h2');heading.dataset.copy='future';future.append(heading);
        const list=element('div','hzn-future-grid');
        for(const key of FUTURE){
          const tile=element('button','hzn-future-tile');tile.type='button';tile.disabled=true;
          const label=element('strong'),state=element('small');
          label.dataset.copy=key;state.dataset.copy='soon';tile.append(label,state);list.append(tile);
        }
        future.append(list);
      }
      if(future.parentElement!==home)home.append(future);
      future.querySelectorAll('[data-copy]').forEach(n=>text(n,t(n.dataset.copy)));
      attr(future,'aria-label',t('future'));
    }
    function syncStageMenu() {
      const stages=q('#stages');
      if(stages)attr(doc.body,'data-hzn-has-stages',!stages.hidden);
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
      attr(trigger,'aria-label',t('brightness')+': '+t(record.tone));
      attr(trigger,'aria-pressed',record.tone==='dark');
      text(trigger,(record.tone==='dark'?'☾ ':'☀ ')+t(record.tone));
      installFuture();syncStageMenu();syncShadows();
    }
    function mount() {
      const shell=win.hznFocusShell;
      if(!shell?.currentLearnerKey || !q('#hzn-home') || !q('#activity') || !q('.hzn-top-controls') || !q('#stages'))return false;
      const style=own(element('style'));style.id='hzn-native-experiences-style';style.textContent=assets.css;doc.head.append(style);
      trigger=own(button('hzn-exp-trigger',()=>setTone(record.tone==='dark'?'light':'dark')));trigger.id='hzn-experience-button';
      q('.hzn-top-controls').append(trigger);mounted=true;
      attr(doc.body,'data-hzn-experiences-ready',VERSION);return true;
    }
    function sync() {
      scheduled=false;if(destroyed)return;
      if(!mounted&&!mount())return;
      const next=String(win.hznFocusShell.currentLearnerKey());
      if(owner!==next)readOwner(next);
      const toolbar=q('.hzn-top-controls');if(toolbar&&trigger.parentElement!==toolbar)toolbar.append(trigger);
      apply();
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
      doc.removeEventListener('change',onChange);win.removeEventListener('storage',onStorage);
      for(const [root,entry] of shadows){entry.observer.disconnect();entry.style.remove();root.host.removeAttribute('data-hzn-experience');root.host.removeAttribute('data-hzn-tone');}
      shadows.clear();for(const n of created)n.remove();
      doc.querySelectorAll('[data-hzn-step]').forEach(n=>n.removeAttribute('data-hzn-step'));
      for(const key of ['data-hzn-experience','data-hzn-tone','data-hzn-experiences-ready','data-hzn-has-stages'])doc.body.removeAttribute(key);
      if(win.hznExperiences===api)delete win.hznExperiences;
    }
    const api=Object.freeze({version:VERSION,setTone,refresh:schedule,destroy,
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
