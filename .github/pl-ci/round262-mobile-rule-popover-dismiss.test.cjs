'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=source.indexOf('/* ===== Stage88 · 手机规则选择面板锚定与可关闭保障 ===== */');
const end=source.indexOf('/* ===== 主应用运行增强 · PC 档案长期管理与 Excel 导入 ===== */',start);
assert.ok(start>0&&end>start,'Stage88 mobile rule popover helper missing');
const block=source.slice(start,end);

test('Round262 mobile rule menus keep one open instance and close on outside interaction',()=>{
  assert.match(block,/const closeOthers=keep=>/);
  assert.match(block,/if\(menu\.open\)\{closeOthers\(menu\);requestSync\(\);\}/);
  assert.match(block,/document\.querySelectorAll\(`\$\{selector\}\[open\]`\)\.forEach\(menu=>\{/);
  assert.match(block,/!menu\.contains\(target\)\)closeMenu\(menu\)/);
});

test('Round262 Escape closes the open rule panel and restores the trigger focus',()=>{
  assert.match(block,/event\.key!=='Escape'/);
  assert.match(block,/closeMenu\(menu,index===open\.length-1\)/);
  assert.match(block,/trigger\.focus\(\{preventScroll:true\}\)/);
});

test('Round262 low mobile trigger is nudged into usable space while panel remains below trigger',()=>{
  assert.match(block,/const ensureRoomBelow=menu=>/);
  assert.match(block,/minUsefulPanel=180/);
  assert.match(block,/trigger\.scrollIntoView\(\{block:'center',inline:'nearest',behavior:'auto'\}\)/);
  assert.match(block,/const top=Math\.max\(8,Math\.ceil\(rect\.bottom\+gap\)\)/);
  assert.match(block,/const available=Math\.max\(48,Math\.floor\(vh-top-10\)\)/);
});

test('Round262 PC, module, plan and record menus still share the same rule-menu class',()=>{
  assert.match(source,/id="nativeModuleRuleMenu"/);
  assert.match(source,/id="pcRuleMenu"/);
  assert.match(source,/data-run-rule-menu="\$\{name\}"/);
  assert.match(source,/details\.native-module-rule-menu/);
});
