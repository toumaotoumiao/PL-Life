'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=html.match(/<style id="stats-panel-collapse-v203">([\s\S]*?)<\/style>/)?.[1]||'';
const script=html.slice(html.indexOf('/* 个人统计：各图表可独立折叠'),html.indexOf('function renderStats() {'));
const renderer=html.slice(html.indexOf('function renderStats() {'),html.indexOf('/* ---------- PC 档案：列表、编辑、关联与 CoC7 导入 ---------- */'));
const expected=['calendar','timeline','people','modules','footprint','habits'];
test('Round139: six separate dashboard sections are eligible and keep existing content',()=>{
 assert(css&&script&&renderer);
 assert.match(script,/STATS_COLLAPSIBLE_PANEL_IDS=\["calendar","timeline","people","modules","footprint","habits"\]/);
 assert.match(renderer,/enhanceStatsPanelCollapses\(\)/);
 for(const text of ['我的跑团回顾年历','逐桌时间带','我的跑团关系统计','我的模组统计','我的跑团足迹','跑团时间分布']) assert(renderer.includes(text),text);
 assert.match(renderer,/statsPanelRoleControlsHTML\("people"\)/);assert.match(renderer,/data-stats-module-view="bar"/);assert.match(renderer,/data-stats-footprint-mode="all"/);
});
test('Round139: heading toggles do not nest the existing filter and display buttons',()=>{
 assert.match(script,/title\.replaceWith\(button\);button\.append\(title,arrow\)/);
 assert.match(script,/head\.querySelector\(':scope > \.stats-panel-controls'\)/);
 assert.match(script,/button\.setAttribute\('aria-controls',body\.id/);
 assert.match(script,/button\.setAttribute\('aria-expanded'/);
 assert.match(script,/setStatsPanelCollapsed\(panel,saved\[id\]===true\)/);
 assert.match(css,/\.stats-panel-toggle:focus-visible/);
});
test('Round139: every section starts open and preserves each collapse state across rendering and view navigation',()=>{
 assert.match(script,/statsUiState\.collapsedPanels=\{\.\.\.\(statsUiState\.collapsedPanels\|\|\{\}\),\[id\]:collapsed\}/);
 assert.match(script,/captureCurrentViewState\('stats'\)/);
 assert.match(script,/body\.hidden=collapsed/);
 assert.match(script,/controls\.hidden=collapsed/);
 assert.match(html,/if \(view === "stats"\)\s*next\.stats = Object\.assign\(\{\}, statsUiState\)/);
 assert.match(html,/Object\.assign\(statsUiState, s\.stats\)/);
});
test('Round139: collapsed panels show only title, normal previews and exports are unchanged',()=>{
 assert.match(css,/\.is-collapsed \.stats-panel-title span\{display:none!important\}/);
 assert.match(css,/\.is-collapsed>\.stats-panel-body,/);
 assert.match(css,/\.is-collapsed>\.stats-panel-head>\.stats-panel-controls\{display:none!important\}/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/min-height:44px/);
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 assert(workflow.includes('round139-stats-panel-collapse.test.cjs'));
 assert(workflow.includes('round139-stats-panel-collapse-browser.cjs'));
 assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
 assert.match(fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8'),/MAX_SCHEMA\s*=\s*26/);
});
