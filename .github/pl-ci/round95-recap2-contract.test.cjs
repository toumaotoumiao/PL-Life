'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('single-record recap keeps logs, richer public controls and unified preview',()=>{
  assert.match(html,/RECORD_SHOWCASE_SCOPE_ORDER=\["summary","schedule","cast","logs","reflection"\]/);
  assert(html.includes('label:"Log / 网页"'));
  assert(html.includes('id="recordShowcaseLogUrls"'));
  assert(html.includes('id="recordShowcaseNameMode"'));
  assert(html.includes('<option value="name">显示档案名</option>'));
  assert(html.includes('<option value="anonymous">编号匿名</option>'));
  assert(html.includes('<option value="hidden">隐藏人物</option>'));
  assert.match(html,/async function openRecordShowcaseFinalPreview\([\s\S]*?PLUnifiedExportPreview/);
});

test('records page exposes integrated recap and reuses the current query result',()=>{
  assert(html.includes('id="recordsRecapBtn"'));
  assert(html.includes("wrap.id='recordsRecapBackdrop'"));
  assert(html.includes("window.PLRecordsRecapOpen=open"));
  assert.match(html,/state\.range==='filtered'[\s\S]*?recordQueryArchive\(\)/);
  assert.match(html,/PLUnifiedExportPreview\(canvases,'跑团记录 · 整合回顾 · 导出预览'/);
});

test('integrated recap can include PC HO Log URLs notes and exact time without rewriting archives',()=>{
  for(const id of ['recordsRecapPc','recordsRecapHo','recordsRecapLogs','recordsRecapLogUrls','recordsRecapNotes','recordsRecapTime'])assert(html.includes(`id="${id}"`),`${id} missing`);
  assert(html.includes("showLogUrls:true"));
  assert(html.includes("showPc:true"));
  assert(html.includes("showHo:true"));
  const recapBlock=html.slice(html.indexOf('<script id="recap-v154-js">'),html.indexOf('</script>',html.indexOf('<script id="recap-v154-js">')));
  assert(!/runRecords\s*=/.test(recapBlock),'recap export must not replace the formal runRecords archive');
});

test('PL and KP organizer export uses visible overlay composer and keeps final export action',()=>{
  assert(html.includes('.ho-export-composer.v154-overlay'));
  assert.match(html,/toggleHoOrganizerExportComposer=function\([\s\S]*?classList\.toggle\('v154-overlay'/);
  assert(html.includes('id="hoExportComposerNow"'));
  assert.match(html,/exportHoOrganizerImage=async function\([\s\S]*?openUnifiedExportPreview/);
});
