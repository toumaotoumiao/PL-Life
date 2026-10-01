'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const core=require(path.join(root,'showcase-core.js'));

test('two-column organizer accepts an explicit 5/1 distribution instead of forcing 3/3',()=>{
  let order=['ho1','ho2','ho3','ho4','ho5','ho6'];
  let layout={ho1:{lane:0,span:1},ho2:{lane:1,span:1},ho3:{lane:0,span:1},ho4:{lane:1,span:1},ho5:{lane:0,span:1},ho6:{lane:1,span:1}};
  ({order,layout}=core.insertIntoFreeLane(order,layout,{sourceId:'ho2',targetLane:0,laneCount:2}));
  ({order,layout}=core.insertIntoFreeLane(order,layout,{sourceId:'ho4',targetLane:0,laneCount:2}));
  const counts=[0,0]; for(const id of order) counts[layout[id].lane]++;
  assert.deepEqual(counts,[5,1]);
  const items=order.map(id=>({id,lane:layout[id].lane,span:1,height:100}));
  const packed=core.packFreeLanes(items,{laneCount:2,startY:180,gap:14});
  assert.equal(packed.placements.filter(x=>x.lane===0).length,5);
  assert.equal(packed.placements.filter(x=>x.lane===1).length,1);
});

test('organizer editor exposes direct cross-column drag and empty-lane drop zones',()=>{
  for(const token of [
    'v270-ho-free-lane-drag-js',
    'data-ho-row-drag',
    'hoLaneDrop',
    '拖动分组可跨列，列数不强制均分',
    '两列／三列只规定画布列数，不要求均分',
    'decorateHoOrganizerPreviewPages',
    'PLHoOrganizerLaneDistribution'
  ]) assert.ok(html.includes(token),`missing ${token}`);
  assert.match(html,/currentHoOrganizerComposerState\(\).*insertIntoFreeLane/s);
});

test('paged and long organizer source previews keep drag overlays',()=>{
  assert.match(html,/if\(mode==='long'\|\|pagedStates\.length>1\)[\s\S]*decorateHoOrganizerPreviewPages\(pagedStates,mode\)/);
  assert.match(html,/export-live-preview-page[\s\S]*ho-export-page-surface/);
  assert.match(html,/hoPreviewDropTarget\(clientX,clientY\)/);
});

test('release metadata advanced without changing schema',()=>{
  assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.270"/);
  assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
  assert.match(html,/v8\.1\.12\.270<\/strong><span class="version-log-copy">修复 PL／HO 跑团整理图片导出/);
});
