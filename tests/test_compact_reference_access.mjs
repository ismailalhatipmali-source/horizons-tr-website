import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{JSDOM}from'./node_modules/jsdom/lib/api.js';
const script=readFileSync(new URL('../src/workbook-experiences/compact-home.js',import.meta.url),'utf8');
const keys=['alphabet','phonics','blending2','blending3','blending4','catalog'];const future=['pronouns','possessives','numbers','colors','calendar','directions','stories'];
for(const demo of [true,false]){
 const html='<body data-hzn-experiences-ready><section id="hzn-home-nav"><nav id="course-nav">'+keys.map((key,i)=>'<button data-demo-section="'+key+'"><span class="demo-section-number">0'+(i+1)+'</span><span class="demo-section-title">'+key+'</span>'+((demo&&!['alphabet','catalog'].includes(key))?'<small class="demo-section-status">Full version</small>':'')+'</button>').join('')+'</nav></section><section id="hzn-exp-future"><div class="hzn-future-grid">'+future.map(k=>'<button disabled><strong data-copy="'+k+'">'+k+'</strong></button>').join('')+'</div></section></body>';
 const dom=new JSDOM(html,{url:'https://example.test/'+(demo?'try':'learn')+'/',runScripts:'outside-only',pretendToBeVisual:true});const win=dom.window;win.document.documentElement.lang='tr';win.HZN_REFERENCE_ROUTES=Object.fromEntries([...keys,...future].map(k=>[k,{href:'/reference/horizons-theory-paid-20261008-r3.html?chapter='+k,languages:['tr']}]));
 win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new win.Event('close'))};
 let entered=0;win.document.querySelector('#course-nav').addEventListener('click',()=>entered++,true);
 win.eval(script);win.HZNInstallCompactHome(win,win.document);
 const cards=[...win.document.querySelectorAll('.hzn-lesson-card')];assert.equal(cards.length,13);assert.equal(cards.filter(x=>!x.querySelector('.hzn-theory-action').disabled).length,demo?2:13);
 assert.equal(win.document.querySelectorAll('.hzn-interactive-action[disabled]').length,7);
 if(demo){assert.equal(cards[6].querySelector('.hzn-theory-action').title,'Full version');assert.equal(cards[1].querySelectorAll('.hzn-theory-status,.hzn-access-status').length,1);}
 const action=cards[0].querySelector('.hzn-theory-action');action.click();assert.equal(entered,0);const frame=win.document.querySelector('dialog iframe');assert.ok(frame.src.includes(demo?'horizons-theory-demo':'horizons-theory-paid'));assert.ok(frame.src.includes('lang=tr'));win.document.querySelector('dialog button').click();assert.equal(win.document.querySelector('dialog'),null);cards[0].querySelector('.hzn-interactive-action').click();assert.equal(entered,1);
 win.hznCompactHome.destroy();dom.window.close();
}
console.log('PASS: 13 unified cards, free theory lock, paid theory availability, seven locked interactive sections and capture-handler preservation');

