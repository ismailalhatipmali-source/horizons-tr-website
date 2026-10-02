import fs from 'node:fs/promises';
import path from 'node:path';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const [root,report]=process.argv.slice(2);
const langs=(process.env.HZN_VERIFY_LANGS||'en ar tr fr es de it pt nl ru uk pl cs ro hu el sv da no fi bg sr hr he fa ur hi bn id ms zh ja').split(' ');
const results=[];
const eq=(actual,expected,label)=>{if(!Number.isFinite(Number(actual))||Math.abs(Number(actual)-expected)>.001)throw Error(`${label}: ${actual} expected ${expected}`)};
for(const lang of langs)for(const name of ['Operations_Blank.xlsx','Operations_Example.xlsx']){
 const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(root,'Agency_Kit_'+lang.toUpperCase(),name)));
 wb.recalculate();const overview=wb.worksheets.getItemAt(0),example=name.includes('Example');
 const numeric=[8,9,10,11,13,14,15,16,17,19,20,21].map(r=>overview.getRange('B'+r).values[0][0]);
 const expected=example?[5600,1900,3700,1460,240.8,300,0,75,-75,0,1,0]:Array(12).fill(0);
 numeric.forEach((v,i)=>eq(v,expected[i],lang+' '+name+' metric '+i));
 const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!',options:{useRegex:true,maxResults:5},maxChars:1000});
 if(!errors.ndjson.includes('matched 0 entries'))throw Error(lang+' formula error '+errors.ndjson);
 if(example){
  const receipts=wb.worksheets.getItemAt(5);
  receipts.getRange('E8').values=[[1000]];wb.recalculate();eq(overview.getRange('B10').values[0][0],3200,lang+' partial balance');eq(overview.getRange('B11').values[0][0],960,lang+' partial overdue');
  receipts.getRange('E8').values=[[500]];receipts.getRange('A9:C9').values=[['R-003',46464,'TR001-MID']];receipts.getRange('E9').values=[[-300]];wb.recalculate();
  eq(overview.getRange('B9').values[0][0],1600,lang+' net refund');eq(overview.getRange('B10').values[0][0],4000,lang+' refund balance');
 }
 results.push({locale:lang,file:name,numeric,formula_errors:0,partial_receipt:example,refund:example});
 await fs.writeFile(report,JSON.stringify(results,null,2));console.log('PASS final',lang,name);
}
