'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=html.indexOf('<style id="main-query-workbench-reduction-v179">');
const end=html.indexOf('</style>',start)+8;
const css=html.slice(start,end);

test('five principal archive/workflow pages share the lighter query workbench layer',()=>{
  assert(start>=0,'v179 query workbench style is missing');
  assert(css.includes('#profilesView,#pcsView,#modulesView,#plansView,#recordsView'));
  assert.match(css,/\.filter-workbench\{[\s\S]*?border-top:1px solid var\(--query-ui-line\)!important;[\s\S]*?border-radius:0!important;[\s\S]*?box-shadow:none!important/);
  assert.match(css,/\.filter-panel\{[\s\S]*?background:transparent!important/);
  assert.match(css,/margin-left:0!important;margin-right:0!important/);
});

test('desktop primary order is search then filter then sort then view where applicable',()=>{
  assert.match(css,/\.filter-primary-row>\.filter-search\{grid-column:1!important/);
  assert(css.includes('[data-filter-toggle="profiles"]'));
  assert(css.includes('[data-filter-toggle="pcs"]'));
  assert(css.includes('[data-filter-toggle="modules"]'));
  assert(css.includes('[data-filter-toggle="records"]'));
  assert(css.includes('[data-affordance-for="pcSortSelect"]'));
  assert(html.includes('wrapSelectAffordance("pcSortSelect", "排序")'));
  assert(html.includes('class="select-affordance records-order-affordance"'));
});

test('result summaries stay visible and redundant generic filter copy is retired',()=>{
  assert.match(html,/pcCount\.hidden=false;els\.pcCount\.textContent=filtered\?`\$\{rows\.length\} \/ \$\{result\.total\} 个 PC`:`\$\{result\.total\} 个 PC`/);
  assert.match(html,/pl-module-query-rendered'\,\{detail:\{count:rows\.length,total:result\.total\}\}/);
  assert.match(html,/moduleFilterSummary[\s\S]*?count===total\?`\$\{total\} 个模组`:`\$\{count\} \/ \$\{total\} 个模组`/);
  assert(!html.includes('id="recordsFilterSummary"'),'records should use chips plus the real result count, not a second generic summary');
  assert(html.includes('id="recordsSearchCount"') || html.includes('ensureRecordsSearchCount()'),'record result-count bridge must remain');
  assert.match(html,/planFilterSummary[\s\S]*?`\$\{filtered\.length\} \/ \$\{runPlans\.length\} 个计划`/);
});

test('mobile keeps the primary row quiet and routes module filter/sort/display to one sheet',()=>{
  assert(html.includes('data-filter-toggle="modules" data-mobile-page-sheet="modules"'));
  assert(html.includes("['pcs','profiles','modules'].includes(t.dataset.filterToggle)"));
  assert(css.includes('#pcsView .mobile-page-tools-btn[data-mobile-page-sheet="pcs"]{display:none!important}'));
  assert(css.includes('#pcsView .pc-search-toolbar .filter-primary-row>#pcLayoutSwitch'));
  assert(css.includes('#modulesView .module-native-controls>.filter-primary-row,#recordsView .records-filter-workbench>.filter-primary-row{grid-template-columns:minmax(0,1fr) auto auto!important'));
});

test('secondary filters are multi-column on desktop and one-column on mobile',()=>{
  assert(!html.includes('<div class="filter-panel-grid one-column">\n<label class="filter-field"><span>我的身份</span><select class="sort-select" id="planRoleFilter"'));
  assert.match(css,/\.filter-panel-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*?\.filter-panel-grid\{grid-template-columns:1fr!important\}/);
});

test('search placeholders stop repeating implementation details while pinyin search code remains',()=>{
  assert(html.includes('placeholder="搜索模组、作者、地点、时代或备注"'));
  assert(html.includes('placeholder="搜索模组、桌名、人物、PC、日期或 Log"'));
  assert.match(html,/id="moduleNativeSearch"[^>]*placeholder="搜索模组、作者、地点、时代或备注"/);
  assert.match(html,/id="recordsSearchInput"[^>]*placeholder="搜索模组、桌名、人物、PC、日期或 Log"/);
  assert(html.includes('normalizedEntityNameKey'),'pinyin/query normalization infrastructure must remain');
});
