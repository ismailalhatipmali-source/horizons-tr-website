import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const [mode, input, outdir] = process.argv.slice(2);
await fs.mkdir(outdir,{recursive:true});
if(mode==='baseline') {
  const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(input));
  console.log(wb.help('worksheet.name',{include:'index,notes,examples',maxChars:1500}).ndjson);
  console.log((await wb.inspect({kind:'table',range:'Overview!A6:C21',include:'values,formulas',tableMaxRows:16,tableMaxCols:3,maxChars:2200})).ndjson);
  const png=await wb.render({sheetName:'Overview',range:'A1:C22',scale:1.4,format:'png'});
  await fs.writeFile(path.join(outdir,'baseline-overview.png'),new Uint8Array(await png.arrayBuffer()));
  wb.recalculate();console.log('baseline',JSON.stringify(wb.worksheets.getItem('Overview').getRange('B7:B21').values));
  process.exit(0);
}
if(mode!=='build') throw Error('Expected baseline or build');
const tasks=JSON.parse(await fs.readFile(input,'utf8'));
const results=[];
for(const task of tasks) {
  const spec=JSON.parse(await fs.readFile(task,'utf8'));
  const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(spec.source));
  // Author against original technical sheet names; the preservation wrapper
  // supplies translated names and restores native XML features after export.
  const authoredFormula=f=>f.replace(/'((?:[^']|'')*)'!/g,(_,n)=>{
    const old=spec.sheets.find(s=>s.name===n.replace(/''/g,"'"))?.original_name;
    return "'"+(old||n).replace(/'/g,"''")+"'!";
  });
  for(let i=0;i<spec.sheets.length;i++) {
    const sheet=wb.worksheets.getItemAt(i),s=spec.sheets[i];
    for(const c of s.cells.filter(c=>!c.formula)) sheet.getRange(c.address).values=[[c.value]];
    const columns={};
    for(const c of s.cells.filter(c=>c.formula)) {
      const [,col,row]=c.address.match(/^([A-Z]+)(\d+)$/);
      (columns[col]??=[]).push({row:Number(row),formula:authoredFormula(c.formula)});
    }
    for(const [col,cells] of Object.entries(columns)) {
      cells.sort((a,b)=>a.row-b.row);
      for(let start=0;start<cells.length;) {
        let end=start+1;while(end<cells.length&&cells[end].row===cells[end-1].row+1)end++;
        sheet.getRange(`${col}${cells[start].row}:${col}${cells[end-1].row}`).formulas=cells.slice(start,end).map(c=>[c.formula]);
        start=end;
      }
    }
  }
  wb.recalculate();
  const overview=wb.worksheets.getItemAt(0);
  const numeric=[8,9,10,11,13,14,15,16,17,19,20,21].map(r=>overview.getRange('B'+r).values[0][0]);
  const example=spec.source.endsWith('Operations_Example.xlsx');
  const expected=example?[5600,1900,3700,1460,240.8,300,0,75,-75,0,1,0]:null;
  if(expected) for(let i=0;i<expected.length;i++) if(!Number.isFinite(Number(numeric[i]))||Math.abs(Number(numeric[i])-expected[i])>0.001) {
    console.log((await wb.inspect({kind:'table',range:"'Agency income'!A7:M9",include:'values,formulas',tableMaxRows:3,tableMaxCols:13,maxChars:5000})).ndjson);
    console.log('B13',overview.getRange('B13').formulas);
    throw Error(`${spec.locale} calculation ${i}: ${numeric[i]} expected ${expected[i]}`);
  }
  const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!',options:{useRegex:true,maxResults:10},maxChars:2000});
  await fs.writeFile(path.join(outdir,spec.locale+'-'+path.basename(spec.source)+'.errors.json'),errors.ndjson);
  if(!errors.ndjson.includes('matched 0 entries')) throw Error(spec.locale+' workbook formula errors');
  if(example) {
    const receipts=wb.worksheets.getItemAt(5);
    receipts.getRange('E8').values=[[1000]];wb.recalculate();
    if(Number(overview.getRange('B10').values[0][0])!==3200 || Number(overview.getRange('B11').values[0][0])!==960) throw Error(spec.locale+' partial receipt failed');
    receipts.getRange('E8').values=[[500]];
    receipts.getRange('A9:C9').values=[['R-003',46464,'TR001-MID']];receipts.getRange('E9').values=[[-300]];wb.recalculate();
    if(Number(overview.getRange('B9').values[0][0])!==1600 || Number(overview.getRange('B10').values[0][0])!==4000) throw Error(spec.locale+' refund failed');
    receipts.getRange('A9:C9').clear({applyTo:'contents'});receipts.getRange('E9').clear({applyTo:'contents'});wb.recalculate();
    if(Number(overview.getRange('B9').values[0][0])!==1900) throw Error(spec.locale+' restore failed');
  }
  const model={sheets:[]};
  for(let i=0;i<spec.sheets.length;i++) {
    const sheet=wb.worksheets.getItemAt(i),s=spec.sheets[i];
    const values=sheet.getRange(s.dimension).values;
    model.sheets.push({name:s.name,values,cells:s.cells});
  }
  const dest=path.join(outdir,spec.locale+'-'+path.basename(spec.source));
  const exported=await SpreadsheetFile.exportXlsx(wb);await exported.save(dest);
  await fs.writeFile(dest+'.model.json',JSON.stringify(model));
  // Representative visual verification; all native sheet styles are retained.
  if(example && ['de','he','hi','ja'].includes(spec.locale)) {
    const png=await wb.render({sheetName:spec.sheets[0].original_name,range:'A1:C22',scale:1.4,format:'png'});
    await fs.writeFile(path.join(outdir,spec.locale+'-overview.png'),new Uint8Array(await png.arrayBuffer()));
  }
  results.push({locale:spec.locale,file:path.basename(spec.source),numeric,partial_receipt:example,refund:example});
  await fs.writeFile(path.join(outdir,'workbook-checks.json'),JSON.stringify(results,null,2));
  console.log('Verified',spec.locale,path.basename(spec.source),JSON.stringify(numeric));
}
