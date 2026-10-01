'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const browser=fs.readFileSync(path.join(__dirname,'round242-dnd-xlsx-browser.py'),'utf8');
const start=html.indexOf('/* Stage83: accept the harmless OOXML normalization'),end=html.indexOf('async function pcDndVerifyStandaloneInput(',start),guard=html.slice(start,end);
test('Round253 permits bounded Office/WPS normalization parts without opening the importer boundary',()=>{
 for(const token of ["'docProps/core.xml'","'docProps/app.xml'","'xl/theme/theme1.xml'","'xl/sharedStrings.xml'","pcDndAssertStandalonePackage(parts)","pcDndAssertStandaloneGrid(parts)"])
  assert.ok(guard.includes(token),token);
 assert.doesNotMatch(guard,/pcWorkbookPut|pcMediaPut|saveState\(/);
});
test('Round253 still rejects executable, embedded, external and extra worksheet content',()=>{
 for(const token of ['names.some(name=>!allowed.has(name))',"getElementsByTagNameNS('*','externalReference')","getElementsByTagNameNS('*','oleObject')","getElementsByTagNameNS('*','drawing')","r.getAttribute('TargetMode')","sheets.length!==1"])
  assert.ok(guard.includes(token),token);
});
test('Round253 shared strings require an actual sharedStrings part and integer indexes',()=>{
 assert.match(guard,/type==='s'/);
 assert.match(guard,/\/\^\(0\|\[1-9\]\\d\*\)\$\//);
 assert.match(guard,/usesSharedStrings&&!parts\['xl\/sharedStrings\.xml'\]/);
});
test('Round253 browser regression constructs safe-resaved and unsafe fictional packages',()=>{
 for(const token of ['safeOfficeResave','safeSharedStrings','rejectMacroPart','rejectExtraSheetPart','pcMakeExcelZipEntries']) assert.ok(browser.includes(token),token);
});
