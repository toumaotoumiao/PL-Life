'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const browser=fs.readFileSync(path.join(__dirname,'round242-dnd-xlsx-browser.py'),'utf8');
const start=html.indexOf('/* Stage84: Office/WPS may omit physically empty cells'),end=html.indexOf('async function pcDndVerifyStandaloneFile(',start),guard=html.slice(start,end);
test('Round255 permits omitted blank A-D cells while keeping strict coordinates',()=>{
  assert.match(guard,/cells\.length>4/);
  assert.match(guard,/\^\(\[A-D\]\)\(\\d\+\)\$/);
  assert.ok(guard.includes('seen.has(ref)'));
  assert.ok(guard.includes('sparseBlankCells=true'));
});
test('Round255 sparse allowance does not permit formulas or unknown cell types',()=>{
  assert.ok(guard.includes("cell.getElementsByTagNameNS('*','f').length"));
  assert.ok(guard.includes("type==='inlineStr'"));
  assert.ok(guard.includes("type==='s'"));
  assert.ok(guard.includes("else throw new Error('D&D 单元格数据类型异常"));
});
test('Round255 comparison normalizes sparse logical rows back to four columns',()=>{
  assert.ok(html.includes("const rows=rawRows.map(r=>Array.from({length:4},(_,i)=>r?.[i]??''))"));
});
test('Round255 browser fixture actually removes blank cells and expects an exact match',()=>{
  assert.ok(browser.includes("inline&&(inline.textContent||'')===''"));
  assert.ok(browser.includes('safeOfficeSparseBlankCells'));
  assert.ok(browser.includes('officeResult.exact&&officeResult.changed===0'));
});
