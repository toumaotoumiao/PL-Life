"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(fs.existsSync(path.join(root,'site/index.html'))?path.join(root,'site/index.html'):path.join(root,'index.html'),'utf8');
function section(a,b){let i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return html.slice(i,j);}
test('桌次状态常量初始化顺序早于读取任何既有档案',()=>{
 const declaration=html.indexOf('const TABLE_STATUS_OPTIONS = Object.freeze(');
 const startup=html.indexOf('let { profiles, settings, runRecords, runPlans, modules, pcs } = loadState();');
 assert(declaration>0&&startup>declaration,`status initialised after first archive load: ${declaration} >= ${startup}`);
 assert.equal(html.split('const TABLE_STATUS_OPTIONS = Object.freeze(').length,2);
});
test('旧版桌次和带状态桌次在首次读取时都能安全标准化',()=>{
 const c={};vm.createContext(c);
 vm.runInContext(section('/* 桌次状态属于存档启动依赖','/* ---------- 02. 自定义字段默认评价模板'),c);
 vm.runInContext(section('function normalizeTableStatus(','function normalizeRunPlan('),c);
 assert.equal(c.normalizeTableStatus(undefined,'plan'),'ongoing');
 assert.equal(c.normalizeTableStatus(undefined,'record'),'completed');
 for(const value of ['satellite','ongoing','completed','disbanded']) assert.equal(c.normalizeTableStatus(value,'record'),value);
 assert.equal(c.tableStatusLabel({tableStatus:'disbanded'}),'已散团');
});
test('运行时入口对非空历史档案同样检查初始化顺序，不以空白档案冒充验收',()=>{
 assert.match(html,/let \{ profiles, settings, runRecords, runPlans, modules, pcs \} = loadState\(\)/);
 assert.match(html,/raw\.data\.runs\.forEach\(run =>/);
 assert.match(html,/tableStatus: normalizeTableStatus\(raw\?\.tableStatus, "plan"\)/);
 assert.match(html,/tableStatus: normalizeTableStatus\(raw\?\.tableStatus, "record"\)/);
});
