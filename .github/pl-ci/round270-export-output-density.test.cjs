'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('Stage97 density-first release note remains in history',()=>{
  assert.match(html,/v8\.1\.12\.275<\/strong><span class=\"version-log-copy\">图片导出成品密度第一轮/);
});

test('unified export header supports truly compact no-eyebrow mode',()=>{
  assert.match(html,/const eyebrowText = String\(eyebrow \|\| ""\)\.trim\(\), hasEyebrow = Boolean\(eyebrowText\)/);
  assert.match(html,/hasEyebrow \? \(hasSubtitle \? 138 : 122\) : \(hasSubtitle \? 116 : \(hasStats \? 100 : 70\)\)/);
  assert.match(html,/return y \+ cardH \+ \(hasEyebrow \? 18 : 14\)/);
});

test('PL and KP organizer output no longer prints a redundant identity eyebrow',()=>{
  const matches=[...html.matchAll(/drawUnifiedExportHeader\(ctx,baseW,theme,\{eyebrow:'',title:`\$\{publicProfileName\(profile\)\}`/g)];
  assert.ok(matches.length>=2,`expected >=2 compact organizer headers, got ${matches.length}`);
  assert.match(html,/headBottom=146/);
});

test('year planner top header drops duplicate implementation legend',()=>{
  assert.doesNotMatch(html,/全年完整年历：上半年与下半年依次排列，不重复标题/);
  assert.match(html,/title:`\$\{data\.year\} 全年排期`,subtitle:''/);
  assert.doesNotMatch(html,/计划与归档的确定日期使用同一事件口径/);
});

test('integrated recap uses compact data-first header',()=>{
  assert.match(html,/eyebrow:'',title:state\.range==='year'\?`\$\{state\.year\} 跑团回顾`:'跑团回顾',subtitle:''/);
  assert.doesNotMatch(html,/高密度回顾/);
  assert.doesNotMatch(html,/使用跑团记录页面当前搜索与筛选范围/);
  assert.match(html,/let y=146/);
});

test('PC and final-preview copy no longer carries implementation prose',()=>{
  assert.doesNotMatch(html,/仅用于本次展示/);
  assert.doesNotMatch(html,/在开团计划或跑团记录中关联此 PC 后，这里会自动形成时间轴/);
  assert.doesNotMatch(html,/总标题与页脚各出现一次/);
  assert.match(html,/显示 Log 网页地址时，地址会原样进入图片/);
});
