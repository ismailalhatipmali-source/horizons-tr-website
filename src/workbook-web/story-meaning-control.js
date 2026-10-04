/*STORY_MEANING_CONTROL_BEGIN*/
/* Install inside either workbook closure, after the meaning-localization hook
 * and immediately before init(). The shared meaning flag and save path stay
 * unchanged; Stories gains the same localized control already used by Words. */
(function(){
 'use strict';
 if(typeof renderStory!=='function'||renderStory.hznStoryMeaningControl)return;
 const original=renderStory;
 const wrapped=function(...args){
  const result=original.apply(this,args);
  const panel=$('#activity .story-text');
  if(!panel||locale==='ar')return result;
  panel.id='story-meaning-region';
  const button=document.createElement('button');
  button.type='button';button.id='story-meaning-toggle';button.className='text-button';
  button.textContent=t(state.meaning?'hideMeaning':'showMeaning');
  button.setAttribute('aria-expanded',String(state.meaning));
  button.setAttribute('aria-controls','story-meaning-region');
  button.onclick=()=>{
   state.meaning=!state.meaning;renderStory();save();
   $('#story-meaning-toggle')?.focus({preventScroll:true});
  };
  panel.append(button);
  return result;
 };
 wrapped.hznStoryMeaningControl=true;renderStory=wrapped;
})();
/*STORY_MEANING_CONTROL_END*/
