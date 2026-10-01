'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('Round261 mobile PC rule panel is dynamically anchored below its trigger',()=>{
  assert.match(source,/\.pc-rule-menu>summary\{[^}]*z-index:102/);
  assert.match(source,/\.pc-rule-menu \.native-module-rule-popover\{[^}]*top:var\(--mobile-rule-popover-top,[^)]+\)[^}]*max-height:var\(--mobile-rule-popover-max-height/);
});

test('Round261 module, plan and record rule panels share the same mobile anchor contract',()=>{
  assert.match(source,/\.native-module-rule-menu>summary\{[^}]*z-index:102/);
  assert.match(source,/\.native-module-rule-popover\{[^}]*top:var\(--mobile-rule-popover-top,70px\)[^}]*max-height:var\(--mobile-rule-popover-max-height/);
  assert.match(source,/\.plan-editor-drawer \.run-rule-menu>summary,#recordsView \.run-rule-menu>summary\{[^}]*z-index:102/);
  assert.match(source,/\.run-rule-menu \.native-module-rule-popover[^}]*top:var\(--mobile-rule-popover-top,[^)]+\)[^}]*max-height:var\(--mobile-rule-popover-max-height/);
});

test('Round261 runtime positions every open rule panel from trigger bottom, not a page-global constant',()=>{
  const stage88=source.indexOf('/* ===== Stage88 · 手机规则选择面板锚定与可关闭保障 ===== */');
  const stage87=source.indexOf('/* ===== Stage87 · 手机规则选择面板锚定 ===== */');
  const start=stage88>0?stage88:stage87;
  assert.ok(start>0,'mobile rule anchor helper missing');
  const end=source.indexOf('/* ===== 主应用运行增强 · PC 档案长期管理与 Excel 导入 ===== */',start);
  assert.ok(end>start,'Stage87 helper boundary missing');
  const block=source.slice(start,end);
  assert.match(block,/details\.native-module-rule-menu/);
  assert.match(block,/trigger\.getBoundingClientRect\(\)/);
  assert.match(block,/rect\.bottom\+gap/);
  assert.match(block,/--mobile-rule-popover-top/);
  assert.match(block,/--mobile-rule-popover-max-height/);
  assert.match(block,/addEventListener\('toggle'/);
  assert.match(block,/addEventListener\('click'/);
  assert.match(block,/MutationObserver/);
  assert.match(block,/addEventListener\('scroll'/);
  assert.match(block,/visualViewport\?\.addEventListener\('resize'/);
});

test('Round261 rule trigger stays operable while fixed panel position is being synchronized',()=>{
  assert.match(source,/\.pc-rule-menu>summary\{[^}]*z-index:102/);
  assert.match(source,/\.pc-rule-menu \.native-module-rule-popover\{[^}]*z-index:101/);
  assert.match(source,/\.plan-editor-drawer \.run-rule-menu>summary,#recordsView \.run-rule-menu>summary\{[^}]*z-index:102/);
  assert.match(source,/overscroll-behavior:contain;z-index:101!important/);
});
