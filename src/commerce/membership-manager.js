// Integration component, NOT deployed into the current workbook until its
// authenticated private membership adapter is available. Never stores emails.
export function mountMembershipManager(host,api,labels) {
  let policy=null,busy=false,disposed=false;
  const controller=new AbortController(),listen=(node,event,fn)=>node.addEventListener(event,fn,{signal:controller.signal});
  const node=(tag,text='',attrs={})=>{const n=document.createElement(tag);n.textContent=text;for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  const status=node('p','',{role:'status','aria-live':'polite'}),title=node('h2',labels.title),list=node('ul');
  const form=node('form'),email=node('input','',{type:'email',required:'',maxlength:'254',autocomplete:'off',dir:'ltr'}),confirmation=node('input','',{type:'email',required:'',maxlength:'254',autocomplete:'off',dir:'ltr'});
  const warning=node('p',labels.permanent_warning,{class:'commerce-email-warning'}),ackLabel=node('label'),ack=node('input','',{type:'checkbox'}),submit=node('button',labels.add,{type:'submit'});
  const emailLabel=node('label',labels.email),confirmLabel=node('label',labels.email_confirm);emailLabel.append(email);confirmLabel.append(confirmation);ackLabel.append(ack,document.createTextNode(labels.permanent_consent));form.append(emailLabel,confirmLabel,warning,ackLabel,submit);host.replaceChildren(title,status,list,form);
  function lock(value){busy=value;submit.disabled=value||!policy||policy.learners.length>=policy.max_learners;for(const b of list.querySelectorAll('button'))b.disabled=value;}
  async function refresh(){
    const next=await api.list();if(disposed)return;
    if(!next||!['individual','family','institution'].includes(next.account_type)||!Array.isArray(next.learners)||next.max_learners!==({individual:1,family:5,institution:100})[next.account_type])throw Error('INVALID_MEMBERSHIP_RESPONSE');
    policy=next;list.replaceChildren();
    title.textContent=labels.title+' · '+next.learners.length+' / '+next.max_learners;
    const family=next.account_type==='family';form.hidden=next.account_type==='individual'||!next.can_manage;warning.hidden=!family;ackLabel.hidden=!family;ack.required=family;
    for(const learner of next.learners){
      const row=node('li'),label=node('span',learner.email);row.append(label);
      if(next.account_type==='institution'&&next.can_manage){
        const remove=node('button',labels.remove,{type:'button'}),confirmationPanel=node('span','',{hidden:''}),message=node('span',labels.remove_warning),yes=node('button',labels.remove,{type:'button'}),cancel=node('button',labels.cancel,{type:'button'});
        confirmationPanel.append(message,yes,cancel);row.append(remove,confirmationPanel);
        listen(remove,'click',()=>{confirmationPanel.hidden=false;yes.focus();});listen(cancel,'click',()=>{confirmationPanel.hidden=true;remove.focus();});
        listen(yes,'click',async()=>{if(busy)return;lock(true);try{await api.remove(learner.id);await refresh();status.textContent=labels.removed;}catch{status.textContent=labels.error;}finally{lock(false);}});
      }
      list.append(row);
    }
    lock(busy);
  }
  listen(form,'submit',async event=>{
    event.preventDefault();if(busy||!policy||!policy.can_manage)return;
    confirmation.setCustomValidity(email.value.trim().toLowerCase()===confirmation.value.trim().toLowerCase()?'':labels.email_confirm);
    if(!form.reportValidity())return;lock(true);status.textContent='';
    try {await api.invite({email:email.value.trim(),confirmation:confirmation.value.trim(),permanent_acknowledged:ack.checked});email.value='';confirmation.value='';ack.checked=false;await refresh();status.textContent=labels.invited;}
    catch {status.textContent=labels.error;}finally{lock(false);}
  });
  listen(confirmation,'input',()=>confirmation.setCustomValidity(''));
  refresh().catch(()=>{if(!disposed){form.hidden=true;status.textContent=labels.error;}});
  return {refresh,destroy(){disposed=true;controller.abort();host.replaceChildren();}};
}
