'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('stats footprint panel exposes partial/full toggle in the card header',()=>{
  assert.match(html,/我的跑团足迹[\s\S]*?data-stats-footprint-mode="partial"[\s\S]*?部分显示/);
  assert.match(html,/我的跑团足迹[\s\S]*?data-stats-footprint-mode="all"[\s\S]*?完全显示/);
  assert.match(html,/statsUiState\.footprintMode === "partial"/);
  assert.match(html,/statsUiState\.footprintMode === "all"/);
});

test('stats footprint renderer can switch between recent-only and full-year display with updated notes',()=>{
  assert.match(html,/function statsFootprintHTML\(events, limit = 24, mode = statsUiState\.footprintMode\)/);
  assert.match(html,/normalizedMode === "all" \? ordered : ordered\.slice\(0, limit\)/);
  assert(html.includes('右上角切到“完全显示”') || html.includes('右上角可切到“完全显示”'));
  assert(html.includes('当前已完整显示全年 ${ordered.length} 场足迹；右上角可切回“部分显示”'));
  assert(html.includes('当前范围内共有 ${ordered.length} 场带确定日期的足迹，页面已全部显示。'));
});

test('clicking stats footprint toggle updates UI state and keeps the preference in the current view session',()=>{
  assert.match(html,/const footprintMode = e\.target\.closest\("\[data-stats-footprint-mode\]"\);/);
  assert.match(html,/statsUiState\.footprintMode = footprintMode\.dataset\.statsFootprintMode === "all" \? "all" : "partial";/);
  assert.match(html,/renderStats\(\);[\s\S]*?captureCurrentViewState\("stats"\);/);
  assert.match(html,/if \(view === "stats"\)\s*next\.stats = Object\.assign\(\{\}, statsUiState\);/);
});
