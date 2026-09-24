'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(fs.existsSync(path.join(root,'index.html'))?path.join(root,'index.html'):path.join(root,'site','index.html'),'utf8');
function section(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`missing section ${a} ${b}`);return html.slice(i,j)}
function runtime(){
  const ctx={MAX_LOG_URLS:12,MAX_LOG_LABEL_LENGTH:30,runPlans:[],runRecords:[],escapeHTML:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),safeLogUrl:s=>/^https:\/\//.test(s)?s:'',uid:()=> 'synthetic-id',Date};
  vm.createContext(ctx);
  vm.runInContext(section('function normalizeLogRows(', '\nfunction isoDatePart('),ctx);
  vm.runInContext(section('/* 桌次状态属于存档启动依赖', '/* ---------- 02. 自定义字段默认评价模板'),ctx);
  vm.runInContext(section('/* 第71轮：桌次的生命周期', 'function normalizeRunPlan('),ctx);
  vm.runInContext(section('function assertRunLogInputPreserved()', 'function assertPcCollectionInputPreserved('),ctx);
  return ctx;
}
test('历史桌次的默认状态分别为开团计划进行中、跑团记录已结团',()=>{
 const c=runtime();assert.equal(c.normalizeTableStatus(undefined,'plan'),'ongoing');assert.equal(c.normalizeTableStatus(undefined,'record'),'completed');
 assert.equal(c.tableStatusLabel({},'plan'),'进行中');assert.equal(c.tableStatusLabel({},'record'),'已结团');
 assert.deepEqual(Array.from(vm.runInContext('TABLE_STATUS_OPTIONS',c),x=>x.label),['卫星中','进行中','已结团','已散团']);
});
test('用户自定义桌状态可选择四态、标签安全转义且不与数据分区混淆',()=>{
 const c=runtime();for(const status of ['satellite','ongoing','completed','disbanded']){
  assert.equal(c.normalizeTableStatus(status,'record'),status);
  assert.match(c.tableStatusBadge({tableStatus:status},'record'),new RegExp(`class="table-lifecycle-badge ${status}"`));
 }assert.match(c.tableStatusSelect({tableStatus:'satellite'},'plan'),/data-plan-table-status/);
 assert.match(c.tableStatusSelect({tableStatus:'disbanded'},'record'),/data-record-table-status/);
 const canonical=section('function canonicalRunFromRuntime(', '\nfunction buildCanonicalCollections(');
 assert.match(canonical,/status: planned \? "planned" : "completed", tableStatus: normalizeTableStatus/);
 assert.match(html,/tableName: plan\.tableName, tableStatus: plan\.tableStatus/);
 assert.match(html,/tableName: rec\.tableName, tableStatus: rec\.tableStatus/);
 assert.match(html,/tableStatus: run\?\.tableStatus/);
});
test('只输入一条 Log 备注不再触发保存失败，原样保存并显示',()=>{
 const c=runtime(),run={id:'fictional-run',logUrls:[''],logLabels:['虚构备注'],logUrl:''};
 c.runPlans=[run];c.runRecords=[];
 assert.doesNotThrow(()=>c.assertRunLogInputPreserved());
 const rows=Array.from(c.normalizeLogRows(run,true),x=>({url:x.url,label:x.label}));
 assert.deepEqual(rows,[{url:'',label:'虚构备注'}]);
 assert.match(c.readonlyLogLinksHTML(run),/虚构备注/);
 assert.doesNotMatch(c.readonlyLogLinksHTML(run),/无效链接/);
 assert.deepEqual(Array.from(c.normalizeLogUrls(run,true)),['']);
 assert.deepEqual(Array.from(c.normalizeLogLabels(run,true)),['虚构备注']);
});
test('先写备注后补网址、删除网址保留备注及再次保存均不丢失',()=>{
 const c=runtime(),run={logUrls:[''],logLabels:[''],logUrl:''};
 c.setEntityLogLabelAt(run,0,'团后虚构笔记');
 assert.equal(run.logLabels[0],'团后虚构笔记');assert.equal(run.logUrls[0],'');
 c.setEntityLogUrlAt(run,0,'https://example.invalid/log');assert.equal(run.logLabels[0],'团后虚构笔记');
 c.setEntityLogUrlAt(run,0,'');assert.equal(run.logLabels[0],'团后虚构笔记');
 c.runRecords=[run];c.assertRunLogInputPreserved();
});
test('Log 真正存在冲突或超上限仍阻止静默丢失',()=>{
 const c=runtime();c.runPlans=[{id:'synthetic',logUrls:['https://example.invalid/a','https://example.invalid/a'],logLabels:['甲','乙']}];
 assert.throws(()=>c.assertRunLogInputPreserved(),/相同网址但名称不同/);
 c.runPlans=[{id:'synthetic',logUrls:Array.from({length:13},(_,i)=>'https://example.invalid/'+i),logLabels:[]}];
 assert.throws(()=>c.assertRunLogInputPreserved(),/超过 12 个保存上限/);
});
test('编辑事件与界面覆盖计划/记录、标题换行、统计页和筛选密度',()=>{
 assert.match(html,/if \(e\.target\.matches\("\[data-plan-table-status\]"\)\)/);
 assert.match(html,/if \(e\.target\.matches\("\[data-record-table-status\]"\)\)/);
 assert.match(html,/id="round71-release-ui-polish"/);
 for(const marker of ['#profilesView>.filter-workbench','#pcsView>.filter-workbench','#statsView>.stats-toolbar','#recordsView .record-title-name','#plansView .plan-row-title'])assert.ok(html.includes(marker),marker);
 assert.match(html,/APP_UI_VERSION\s*=\s*"\d+\.\d+\.\d+\.\d+"/);
});
test('真实规范化函数和规范档案往返保留状态与只有备注的 Log',()=>{
 const c=runtime();Object.assign(c,{
 normalizePcHoNumber:()=>0,normalizeLinkedProfileId:()=>'',normalizeParticipantAssignments:()=>[],normalizeKpc:()=>({enabled:false}),extractLegacyParticipantNames:()=>[],normalizePlanSlots:()=>[],normalizePostRunDraft:()=>null,parseLegacyRunDuration:()=>({startDate:'',endDate:'',legacyDuration:''}),normalizeDateValue:()=>'',isGenericLegacyTableLabel:()=>true,hasPostRunDraft:()=>false,
 });
 vm.runInContext(section('function normalizeRunPlan(', '\nfunction makeBlankRunPlan('),c);
 vm.runInContext(section('function normalizeRunRecord(', '\n/* v3 及更早版本'),c);
 vm.runInContext(section('function canonicalRunFromRuntime(', '\nfunction buildCanonicalCollections('),c);
 const legacy={id:'synthetic-run',moduleName:'合成模组',tableName:'合成桌',logUrls:[''],logLabels:['备团备注'],logUrl:''};
 const plan=c.normalizeRunPlan(legacy),record=c.normalizeRunRecord(legacy);
 assert.equal(plan.tableStatus,'ongoing');assert.equal(record.tableStatus,'completed');
 assert.deepEqual(Array.from(plan.logLabels),['备团备注']);
 const planned=c.canonicalRunFromRuntime({...plan,tableStatus:'satellite'},'planned','');
 const completed=c.canonicalRunFromRuntime({...record,tableStatus:'disbanded'},'completed','m1');
 assert.equal(planned.status,'planned');assert.equal(planned.tableStatus,'satellite');
 assert.equal(completed.status,'completed');assert.equal(completed.tableStatus,'disbanded');
 assert.deepEqual(Array.from(completed.logUrls),['']);
 assert.deepEqual(Array.from(completed.logLabels),['备团备注']);
 assert.equal(c.normalizeRunPlan({...legacy,tableStatus:planned.tableStatus}).tableStatus,'satellite');
 assert.equal(c.normalizeRunRecord({...legacy,tableStatus:completed.tableStatus}).tableStatus,'disbanded');
});
test('同类 Log 备注在搜索、PL 足迹和模组桥接中也保留',()=>{
 const c=runtime(),record={logUrls:[''],logLabels:['备团备注'],logUrl:''};
 assert.deepEqual(Array.from(c.filledLogLabels(record)),['备团备注']);
 assert.match(html,/normalizeLogRows\(p, true\)\.some\(row => row\.url \|\| row\.label\)/);
 assert.match(html,/Log：\$\{readonlyLogLinksHTML\(r\)\}/);
 assert.match(html,/tableStatus: normalizeTableStatus\(r\.tableStatus, "record"\), sessionSlots:/);
 assert.match(html,/base\.tableStatus = normalizeTableStatus\(run\._central\.tableStatus \|\| base\.tableStatus/);
});
