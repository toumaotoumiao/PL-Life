'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const browser=fs.readFileSync(path.join(__dirname,'round242-dnd-xlsx-browser.py'),'utf8');
const start=html.indexOf('/* Stage83: accept the harmless OOXML normalization'),end=html.indexOf('async function pcDndVerifyStandaloneFile(',start);
const guard=html.slice(start,end);
test('Round252 read-only D&D verification validates worksheet geometry before generic parser normalization',()=>{
 assert.ok(start>0&&end>start);
 assert.match(html,/pcDndAssertStandaloneGrid\(parts\);\s*const sheets=await pcExcelReadXlsx\(raw\)/);
 assert.match(guard,/doc\.getElementsByTagNameNS\('\*','sheetData'\)/);
 assert.match(guard,/row\.getAttribute\('r'\)!==String\(rowNumber\)/);
});
test('Round252 protects every cell coordinate while permitting safe shared-string normalization',()=>{
 for(const token of ["cells.length>4","match=/^([A-D])(\\d+)$/","seen.has(ref)","type==='inlineStr'","type==='s'","usesSharedStrings&&!parts['xl/sharedStrings.xml']","cell.getElementsByTagNameNS('*','f').length"])
   assert.ok(guard.includes(token),token);
});
test('Round252 real browser test rewrites fictional OOXML and rejects duplicate/shifted coordinates',()=>{
 for(const token of ['pcMakeExcelZipEntries(entries)','response.rejectDuplicateCell','response.rejectShiftedRow','pcDndVerifyStandaloneFile(new File([broken]'])
   assert.ok(browser.includes(token),token);
 assert.doesNotMatch(guard,/pcWorkbookPut|saveState|pcMediaPut/);
});
