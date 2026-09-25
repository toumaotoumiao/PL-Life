'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const block=html.slice(html.indexOf('<style id="ui-reduction-v178">'),html.indexOf('</style>',html.indexOf('<style id="ui-reduction-v178">'))+8);

test('export UI reduction stage ships after legacy styles and covers all major showcase surfaces',()=>{
  assert(block.includes('UI 减法重构第一轮'));
  for(const token of ['.export-center-panel','.record-showcase-modal','.entity-showcase-modal','.records-recap-modal','.ho-export-composer.v154-overlay']){
    assert(block.includes(token),`${token} is not covered by the shared export UI layer`);
  }
  assert(html.indexOf('<style id="ui-reduction-v178">') < html.indexOf('</head>'));
});

test('sections and option rows are flattened instead of card-inside-card styling',()=>{
  assert.match(block,/\.export-center-section\{[^}]*border-radius:0!important;[^}]*background:transparent!important/);
  assert.match(block,/\.export-option-grid\{[^}]*border:1px solid var\(--export-ui-line\)[^}]*background:var\(--export-ui-soft\)/);
  assert.match(block,/\.export-option-grid label\{[^}]*border:0!important;[^}]*background:transparent!important/);
});

test('scope items form one grouped list and reordering controls stay visually secondary',()=>{
  assert.match(block,/\.export-scope-list\{[^}]*gap:0!important;[^}]*overflow:hidden;[^}]*border:1px solid var\(--export-ui-line\)/);
  assert.match(block,/\.export-scope-row\{[^}]*border:0!important;[^}]*border-radius:0!important;[^}]*background:transparent!important/);
  assert.match(block,/\.export-scope-row\+\.export-scope-row\{border-top:1px solid var\(--export-ui-line\)!important\}/);
  assert.match(block,/\.export-scope-actions button\{background:transparent!important;border-color:transparent!important\}/);
});

test('reset stays a weak action while export remains the primary action',()=>{
  assert.match(block,/\.export-center-foot>\.btn:not\(\.primary\)[^{]*\{[^}]*background:transparent!important;[^}]*color:var\(--t-muted\)!important/);
  for(const id of ['selfIntroExportNowBtn','statsExportNowBtn','plannerYearShowcaseNow','recordShowcaseExport','entityShowcaseExport','recordsRecapExport','hoExportComposerNow']){
    assert(html.includes(`id="${id}"`),`${id} missing`);
  }
  assert((html.match(/class="btn primary image-export-btn"/g)||[]).length>=6,'primary export buttons should remain emphasized');
});

test('high-frequency export copy is shortened without removing safety-relevant privacy text',()=>{
  assert(html.includes('<strong>导出个人统计</strong>'));
  assert(html.includes('<strong>全年排期展示</strong>'));
  assert(html.includes('按当前筛选、年份或全部记录生成连续回顾。'));
  assert(html.includes('选择列数、内容状态与分组布局。'));
  assert(html.includes('隐私导出'));
});
