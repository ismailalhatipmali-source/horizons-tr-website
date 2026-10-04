/*DEMO_MEANING_EXTENSION_BEGIN*/
/* Public meanings for the five approved free chapters only. Compile the single
 * placeholder with demo-meanings-locales.json. Original curriculum, media,
 * resolver functions, progress schema and learner records stay unchanged. */
(function(){
 'use strict';
 const DATA=/*HZN_DEMO_MEANINGS_LOCALES*/;
 const RTL=new Set(['ar','he','fa','ur']);
 let populatedDictionary=null;
 function sync(){
  meaningLocale=locale;
  if(!dict||typeof dict!=='object'||populatedDictionary===dict)return;
  for(const language of DATA.language_codes){
   const row=dict[language]??(dict[language]={});
   row.word??={};row.story??={};
   for(const [id,entry]of Object.entries(DATA.lesson_words)){
    const value=entry.translations[language];
    row.word[id]={wordMeaning:value.word_meaning,sentenceMeaning:value.sentence_meaning};
   }
   for(const [id,entry]of Object.entries(DATA.stories)){
    const value=entry.translations[language];
    row.story[id]={title:value.title,lines:value.lines,question:value.question,options:value.options};
   }
  }
  populatedDictionary=dict;
 }
 function direction(){return RTL.has(locale)?'rtl':'ltr';}
 function localizePanels(){
  const activity=$('#activity');if(!activity)return;
  activity.querySelectorAll('.translation,.activity-header p,.story-question p').forEach(node=>{
   if(node.lang==='ar')return;node.lang=locale;node.dir=direction();
  });
 }
 function wrap(original){
  const wrapped=function(...args){sync();const result=original.apply(this,args);localizePanels();return result;};
  wrapped.hznDemoMeaningExtension=true;return wrapped;
 }
 if(typeof render==='function'&&!render.hznDemoMeaningExtension)render=wrap(render);
 if(typeof renderWords==='function'&&!renderWords.hznDemoMeaningExtension)renderWords=wrap(renderWords);
 if(typeof renderStory==='function'&&!renderStory.hznDemoMeaningExtension)renderStory=wrap(renderStory);
 if(typeof openSettingsWithTypography==='function'&&!openSettingsWithTypography.hznDemoMeaningExtension){
  const original=openSettingsWithTypography;
  const wrapped=function(...args){
   sync();const result=original.apply(this,args);
   const legacy=$('#meaning-language'),section=legacy?.closest('.setting-section');
   const copy=DATA.ui[locale];
   if(section&&copy){section.innerHTML=`<h3 lang="${esc(locale)}" dir="${direction()}">${esc(copy.language)}</h3><p lang="${esc(locale)}" dir="${direction()}" data-demo-meaning-sync>${esc(copy.languageSync)}</p>`;}
   if($('#settings-button'))$('#settings-button').onclick=openSettingsWithTypography;
   return result;
  };
  wrapped.hznDemoMeaningExtension=true;openSettingsWithTypography=wrapped;
 }
 if($('#settings-button'))$('#settings-button').onclick=openSettingsWithTypography;
})();
/*DEMO_MEANING_EXTENSION_END*/
