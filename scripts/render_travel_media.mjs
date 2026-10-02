// Deterministic localization of the existing code-native HORIZONS cover design.
// Only flattened sample pages are public. The editable paid archive stays private.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
const [repo,temporary]=process.argv.slice(2);
const source=await fs.readFile(path.join(repo,'dist/travel-kit.js'),'utf8');
const {L,T}=vm.runInNewContext(source.slice(0,source.indexOf('const qp='))+';({L,T});');
const orders=JSON.parse(await fs.readFile(path.join(repo,'dist/manual-order-locales.json'),'utf8'));
const media=JSON.parse(await fs.readFile(path.join(repo,'dist/travel-kit-media.json'),'utf8'));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await fs.mkdir(temporary,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.HZN_TRAVEL_CHROMIUM});
const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});
const reports=[];
try{for(const lang of L){
 const t=T[lang],o=orders[lang],m=media[lang],dir=['ar','he','fa','ur'].includes(lang)?'rtl':'ltr';
 const images=await Promise.all(m.samples.map(async s=>'data:image/jpeg;base64,'+(await fs.readFile(path.join(repo,'dist',s.src))).toString('base64')));
 const css=`*{box-sizing:border-box}html,body{margin:0;width:960px;height:540px;overflow:hidden}body{font-family:Arial,'Noto Sans','Noto Sans Arabic','Noto Sans Hebrew','Noto Sans Devanagari','Noto Sans Bengali',sans-serif;background:#08233d;color:#fff}.frame{height:540px;position:relative;padding:36px 42px;display:grid;grid-template-columns:1.18fr 1fr;gap:24px;align-items:center}.brand{color:#acdacf;letter-spacing:5px;font-size:19px;font-weight:700}.copy{z-index:2}h1{font-size:36px;line-height:1.25;margin:24px 0 18px;font-weight:700;max-height:180px}h2{font-size:34px;line-height:1.3;margin:26px 0 18px;max-height:190px}.labels{display:grid;gap:9px;font-size:17px;line-height:1.5;color:#e2ece9}.price{font-size:31px;font-weight:700;margin-top:22px;display:flex;align-items:center;gap:14px}.price small{font-size:14px;font-weight:400;line-height:1.45;color:#d5dedc;max-width:285px}.stack{position:relative;height:410px;direction:ltr}.stack img{position:absolute;width:230px;height:326px;object-fit:contain;background:#fff;box-shadow:0 18px 36px #0005;border-radius:3px}.stack img:nth-child(1){left:18px;top:24px;transform:rotate(-8deg)}.stack img:nth-child(2){left:122px;top:48px;transform:rotate(10deg)}.stack img:nth-child(3){left:68px;top:62px;transform:rotate(-1deg)}.bottom{position:absolute;bottom:20px;left:42px;right:42px;display:flex;justify-content:space-between;font-size:12px;color:#b2c7ca}.sample{height:465px;max-width:100%;object-fit:contain;background:#fff;border-radius:3px;box-shadow:0 12px 36px #0005}.step{color:#acdacf;font-size:16px;margin:26px 0 0}.summary{font-size:18px;line-height:1.6;color:#d5e3e1}`;
 const body=inner=>`<!doctype html><html lang="${lang}" dir="${dir}"><meta charset="utf-8"><style>${css}</style><body>${inner}</body></html>`;
 const brand='<div class="brand" dir="ltr">HORIZONS</div>';
 const cover=body(`<div class="frame"><div class="copy">${brand}<h1>${escape(t.title)}</h1><div class="labels"><span>${escape(o.feature_documents)}</span><span>${escape(o.feature_workbook)}</span><span>${escape(o.feature_emails)}</span></div><div class="price"><b dir="ltr">$29</b><small>${escape(t.note)}</small></div></div><div class="stack">${images.map(i=>`<img src="${i}" alt="">`).join('')}</div><div class="bottom"><span>HTML · PDF · XLSX · TXT</span><span dir="ltr">horizons-tr.com</span></div></div>`);
 await page.setContent(cover);await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>{const n=document.querySelector('h1');while(n.scrollHeight>164&&parseFloat(getComputedStyle(n).fontSize)>25)n.style.fontSize=(parseFloat(getComputedStyle(n).fontSize)-1)+'px';});
 const check=await page.evaluate(()=>({titleFont:getComputedStyle(document.querySelector('h1')).fontSize,overflow:[...document.querySelectorAll('h1,.price,.labels')].some(e=>e.scrollHeight>e.clientHeight+2),boxes:[...document.querySelectorAll('h1,.price,.labels')].map(e=>({tag:e.className||e.tagName,scroll:e.scrollHeight,client:e.clientHeight})),width:document.documentElement.scrollWidth}));
 if(check.overflow||check.width!==960)throw Error('Cover overflow '+lang+' '+JSON.stringify(check));
 const coverBytes=await page.screenshot({type:'jpeg',quality:86});
 const target=path.join(repo,'dist/assets/covers',lang,'travel-kit.svg');
 await fs.writeFile(target,`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" xml:lang="${lang}" role="img"><title>${escape(t.title)}</title><desc>${escape([o.feature_documents,o.feature_workbook,o.feature_emails,t.note].join(' · '))}</desc><image width="960" height="540" href="data:image/jpeg;base64,${coverBytes.toString('base64')}"/></svg>\n`);
 const frames=[path.join(temporary,lang+'-0.jpg')];await fs.writeFile(frames[0],coverBytes);
 for(let i=0;i<3;i++){
  await page.setContent(body(`<div class="frame"><div class="copy">${brand}<p class="step">${escape(m.preview_title)} · ${String(i+1).padStart(2,'0')}</p><h2>${escape(m.samples[i].caption)}</h2><p class="summary">${escape(t.summary)}</p><p class="step">${escape(t.how)}</p></div><img class="sample" src="${images[i]}" alt=""><div class="bottom"><span>HTML · PDF · XLSX · TXT</span><span dir="ltr">horizons-tr.com</span></div></div>`));
  await page.evaluate(()=>document.fonts.ready);
  frames.push(path.join(temporary,lang+'-'+(i+1)+'.jpg'));await page.screenshot({path:frames.at(-1),type:'jpeg',quality:88});
 }
 const listing=path.join(temporary,lang+'.txt');
 await fs.writeFile(listing,frames.map((f,i)=>`file '${f}'\nduration ${i===0?3:4}\n`).join('')+`file '${frames.at(-1)}'\n`);
 const video=path.join(repo,'dist',m.video);
 const ff=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',listing,'-vf','fps=15,format=yuv420p','-t','15','-c:v','libx264','-preset','medium','-crf','29','-threads','1','-movflags','+faststart',video],{encoding:'utf8'});
 if(ff.status!==0)throw Error(ff.stderr);
 reports.push({language:lang,...check,cover_bytes:(await fs.stat(target)).size,video_bytes:(await fs.stat(video)).size,duration_seconds:15,preview_pages:3});
 console.log('Rendered '+lang+' cover, interior samples and localized 15-second preview.');
}await fs.writeFile(path.join(temporary,'media-build-checks.json'),JSON.stringify(reports,null,2));}finally{await browser.close();}
