const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
const test=require('node:test');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));

test('Stage128 P1 features remain present while Stage129 is authoritative',()=>{
  assert.ok(status.current.stage>=131);
  assert.equal(status.current.appVersion,JSON.parse(fs.readFileSync(path.join(root,'production-release-manifest.json'),'utf8')).appVersion);
  assert.equal(status.current.schemaVersion,26);
  assert.ok(html.includes(`const APP_UI_VERSION = "${status.current.appVersion}"`));
  assert.ok(sw.includes('v'+status.current.appVersion+'`'));
});

test('desktop quick rail keeps create and search visible and moves low-frequency actions behind more',()=>{
  assert.match(html,/id="globalMoreBtn"/);
  assert.match(html,/#desktopQuickRail #globalCreateBtn,#desktopQuickRail #globalSearchBtn,#desktopQuickRail #globalMoreBtn/);
  assert.match(html,/#desktopQuickRail #shareModeBtn,#desktopQuickRail #privacyMaskBtn,#desktopQuickRail #scrollBottomBtn\{display:none!important\}/);
  assert.match(html,/body\.desktop-rail-more-open #desktopQuickRail #shareModeBtn/);
  assert.match(html,/body\.share-mode #desktopQuickRail #shareModeBtn/);
  assert.match(html,/body\.privacy-mask #desktopQuickRail #privacyMaskBtn/);
});

test('association result is explicit for linked and local-only people and characters',()=>{
  assert.match(html,/association-state-badge linked">已关联档案/);
  assert.match(html,/association-state-badge local">仅本桌名称/);
  assert.match(html,/association-state-badge linked">PL 档案/);
  assert.match(html,/association-state-badge local">仅本桌 PL/);
  assert.match(html,/function planKpPickerStateHTML\(plan\)/);
  assert.match(html,/function recordKpPickerStateHTML\(record\)/);
});

test('long operations expose a reusable live status and backup restore phase',()=>{
  assert.match(html,/id="longTaskStatus"/);
  assert.match(html,/function plLongTaskBegin\(title,phase="准备中"\)/);
  assert.match(html,/function plLongTaskPhase\(phase\)/);
  assert.match(html,/async function backupRestoreStep\(phase, task\) \{\n    plLongTaskPhase\(phase\)/);
  assert.match(html,/plLongTaskBegin\('正在恢复完整备份','检查本机恢复条件'\)/);
});

test('disabled actions can explain why they are unavailable',()=>{
  assert.match(html,/function setDisabledReason\(button,disabled,reason=""\)/);
  assert.match(html,/请先选择并核验一份完整备份/);
  assert.match(html,/请至少选择 1 个有内容的导出区域/);
  assert.match(html,/请至少选择 1 个导出分组/);
});

test('second typography pass raises frequent planner record and module metadata',()=>{
  assert.match(html,/\.assignment-name,\.assignment-summary,\.assignment-mini-label/);
  assert.match(html,/\.record-picker-state,\.assignment-picker-hint/);
  assert.match(html,/\.native-module-row-main strong/);
  assert.match(html,/font-size:12px!important;line-height:1\.45/);
});

test('Stage128 release note describes user-visible changes and Stage127 history remains',()=>{
  assert.match(html,/v8\.1\.12\.306<\/strong><span class="version-log-copy">Nielsen 可用性整改第二批/);
  assert.match(html,/v8\.1\.12\.305<\/strong><span class="version-log-copy">Nielsen 可用性整改第一批/);
});
