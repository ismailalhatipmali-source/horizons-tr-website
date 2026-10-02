import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const [root,checks,mode] = process.argv.slice(2);
await fs.mkdir(checks,{recursive:true});
const langs=(mode==='guides'?'en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja':'de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja').split(' ');
const rtl=new Set(['ar','he','fa','ur']);
const browser=await chromium.launch({headless:true,...(process.env.HZN_TRAVEL_CHROMIUM?{executablePath:process.env.HZN_TRAVEL_CHROMIUM}:{})});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const results=[];
const densityCSS=`.page{--density:1}.page h1{font-size:calc(36px * var(--density));margin-top:calc(27px * var(--density));margin-bottom:calc(13px * var(--density))}.page.cover h1{font-size:calc(53px * var(--density));margin-top:calc(62px * var(--density))}.page .desc{margin-bottom:calc(20px * var(--density))}.page .meta{padding:calc(12px * var(--density)) 14px;margin-bottom:calc(21px * var(--density))}.page .fields{gap:calc(15px * var(--density));margin-bottom:calc(18px * var(--density))}.page .field{padding:calc(13px * var(--density)) 14px}.page .field label{margin-bottom:calc(8px * var(--density))}.page th{padding:calc(12px * var(--density)) 10px}.page td{padding:calc(10px * var(--density))}.page td .value{min-height:calc(39px * var(--density));line-height:1.5}.page .checklist{gap:calc(13px * var(--density))}.page .checkitem{padding:calc(16px * var(--density))}.page .next{margin-top:calc(21px * var(--density));padding:calc(15px * var(--density)) 16px}.page .footer{margin-top:calc(20px * var(--density))}.page .tag{overflow-wrap:anywhere}`;
for(const lang of langs){
  const dir=path.join(root,'Agency_Kit_'+lang.toUpperCase());
  for(const name of mode==='guides'?[]:['Agency_Documents','Worked_Example']){
    const filename=path.join(dir,name+'.html');
    await page.goto(pathToFileURL(filename).href);await page.evaluate(()=>document.fonts.ready);
    await page.addStyleTag({content:densityCSS});
    // Use the denser of A4/Letter requirements in the saved editable HTML.
    const densities={};
    for(const size of ['A4','Letter']){
      await page.locator('#paper').selectOption(size);
      const check=await page.evaluate(()=>{
        const result=[];
        for(const p of document.querySelectorAll('.page')){
          const body=p.querySelector('.page-body');
          for(const d of [1,.95,.9,.85,.8,.75]){
            p.style.setProperty('--density',String(d));
            if(body.scrollHeight<=body.clientHeight+2)break;
          }
          const d=Number(p.style.getPropertyValue('--density'));
          result.push({id:p.id,d,overflow:body.scrollHeight>body.clientHeight+2});
        }
        return result;
      });
      if(check.some(c=>c.overflow))throw Error(`${lang} ${name} ${size} overflow: `+JSON.stringify(check.filter(c=>c.overflow)));
      for(const c of check)densities[c.id]=Math.min(densities[c.id]??1,c.d);
    }
    await page.locator('#paper').selectOption('A4');
    await page.evaluate(ds=>{for(const [id,d] of Object.entries(ds))document.getElementById(id).style.setProperty('--density',String(d));},densities);
    const persisted=await page.evaluate(()=>{
      for(const input of document.querySelectorAll('input')){if(input.type==='checkbox'){if(input.checked)input.setAttribute('checked','');else input.removeAttribute('checked');}else input.setAttribute('value',input.value)}
      for(const s of document.querySelectorAll('select'))for(const o of s.options){if(o.value===s.value)o.setAttribute('selected','');else o.removeAttribute('selected');}
      return '<!doctype html>\n'+document.documentElement.outerHTML;
    });
    await fs.writeFile(filename,persisted);
    for(const size of name==='Agency_Documents'?['A4','Letter']:['A4']){
      await page.locator('#paper').selectOption(size);
      await page.evaluate(()=>window.AG_SELECT('all'));
      await page.emulateMedia({media:'print'});
      await page.pdf({path:path.join(dir,name+'_'+size+'.pdf'),preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
      await page.emulateMedia({media:'screen'});
    }
    if(['he','hi','zh','de'].includes(lang))await page.locator('.page').first().screenshot({path:path.join(checks,lang+'-'+name+'.png')});
    const structure=await page.evaluate(()=>({lang:document.documentElement.lang,dir:document.documentElement.dir,pages:document.querySelectorAll('.page').length,editable:document.querySelectorAll('[contenteditable]').length}));
    results.push({locale:lang,name,...structure,densities});
  }
  for(const name of mode==='guides'?['START_HERE']:['START_HERE','Email_Scripts','License']){
    const txt=await fs.readFile(path.join(dir,name+'.txt'),'utf8');const paras=txt.trim().split(/\n\s*\n/);
    const contents=paras.map((s,i)=>i===0?'<h1>'+escape(s)+'</h1>':'<p>'+escape(s)+'</p>').join('');
    await page.setContent(`<!doctype html><html lang="${lang}" dir="${rtl.has(lang)?'rtl':'ltr'}"><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font-family:'Noto Sans','Noto Sans Arabic','Noto Sans Hebrew','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans CJK JP',sans-serif;color:#172d49;font-size:11pt;line-height:1.65}h1{font-size:22pt;color:#132a47}p{white-space:pre-wrap;orphans:3;widows:3}h1{break-after:avoid}</style></head><body>${contents}</body></html>`);
    await page.evaluate(()=>document.fonts.ready);
    await page.pdf({path:path.join(dir,name+'.pdf'),preferCSSPageSize:true,printBackground:true});
  }
  await fs.writeFile(path.join(checks,'document-checks.json'),JSON.stringify(results,null,2));
  console.log('PDFs complete',lang);
}
await browser.close();
