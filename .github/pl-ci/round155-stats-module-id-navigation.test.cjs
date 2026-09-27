'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const between=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a,`missing ${start}`);return html.slice(a,b);};
const group=require(path.join(root,'record-group.js'));
const co={familyId:'brp',systemId:'coc',editionId:'7e'},brp={familyId:'brp',systemId:'brp-generic',editionId:''};
const modules=[{id:'co-id',name:'同名模组',ruleMeta:co},{id:'br-id',name:'同名模组',ruleMeta:brp},{id:'unique',name:'唯一模组',ruleMeta:co}];
const records=[{id:'co-run',moduleId:'co-id',moduleName:'同名模组'},{id:'br-run',moduleId:'br-id',moduleName:'同名模组'},{id:'expired-run',moduleId:'old-id',moduleName:'同名模组'},{id:'legacy-run',moduleId:'',moduleName:'同名模组'},{id:'unique-run',moduleId:'',moduleName:'唯一模组'}];
const normalized=s=>String(s||'').trim().normalize('NFKC').toLowerCase();
const display=m=>m?.systemId==='coc'?'CoC · 第七版':m?.systemId==='brp-generic'?'BRP 通用':'未知规则';
function harness(overrides={}){
 const c={window:{PLRecordGroups:group},runRecords:records,modules,moduleById:id=>modules.find(m=>m.id===id)||null,moduleRuleDisplay:display,
  normalizedEntityNameKey:normalized,statsRunRoles:()=>({kp:true,pl:false}),statsRecordDate:()=> '2026-09-01',statsParticipantRefs:()=>[],statsKpRef:()=>null,...overrides};
 vm.createContext(c);
 vm.runInContext(between('function statsModuleAggregates(runs) {','function statsCurrentPlanSummary() {'),c);
 return c;
}
test('statistics uses exactly the record board grouping for same-title rule identities',()=>{
 const c=harness();const rows=c.statsModuleAggregates(records);
 assert.deepEqual([...rows].map(r=>r.groupKey),['id:co-id','id:br-id','missing:old-id','legacy:同名模组','id:unique']);
 assert.deepEqual([...rows].map(r=>r.total),[1,1,1,1,1]);
 assert.match(rows[0].displayName,/CoC/);assert.match(rows[1].displayName,/BRP/);
 assert.equal(rows[2].moduleId,'');assert.equal(rows[3].moduleId,'');
 assert.equal(rows[4].moduleId,'unique');
});
test('statistics filters do not alter grouping identity of a legacy desk',()=>{
 const c=harness();const rows=c.statsModuleAggregates([records[4],records[1]]);
 assert.deepEqual([...rows].map(r=>r.groupKey),['id:unique','id:br-id']);
});
test('ranking and bar views carry exact group key and distinct rule label',()=>{
 const c=harness();const rows=c.statsModuleAggregates(records);
 Object.assign(c,{escapeHTML:String,statsUiState:{},STATS_PANEL_PARTIAL_LIMITS:{modules:10},i18nCompareText:(a,b)=>a.localeCompare(b),statsFormatDate:()=>'-',statsVisibleCountNote:()=>''});
 vm.runInContext(between('function statsModuleRowsHTML(rows,mode,view,displayMode="partial") {','function statsPeriodKey('),c);
 for(const view of ['rank','bar']){
  const htmlOut=c.statsModuleRowsHTML(rows,'all',view,'all');
  assert.match(htmlOut,/data-stats-module-group-key="id:co-id"/);
  assert.match(htmlOut,/data-stats-module-group-key="id:br-id"/);
  assert.match(htmlOut,/data-stats-module-group-key="missing:old-id"/);
  assert.match(htmlOut,/data-stats-module-group-key="legacy:同名模组"/);
  assert.match(htmlOut,/CoC/);assert.match(htmlOut,/BRP/);
 }
 assert.match(html,/data-stats-module-group-key="\$\{escapeHTML\(row\.groupKey\|\|''\)\}"/,'rank link includes group key');
 assert.match(html,/openStatsModuleRecordGroup\(statsModule\.dataset\.statsModuleGroupKey\|\|'',statsModule\.dataset\.statsModule\|\|'',statsModule\.dataset\.statsModuleName\|\|''\)/,'click handler uses the supplied group key');
});
function navigationHarness(visibleIds){
 const groups=group.group(records,modules).map(g=>[g.label,g.records,0,g.records.length,null,g.key,g.name,g.moduleId,g.ambiguous]);
 const state={open:[],renders:0,notices:[]};
 const c={groupedRunRecordsForDisplay:()=>groups,recordQueryArchive:()=>({idSet:new Set(visibleIds)}),
  selectedRecordGroupKey:'',selectedModuleName:'',recordSpotlightId:'',normalizedEntityNameKey:normalized,
  switchView:v=>state.open.push(v),renderRunRecords:()=>state.renders++,showToast:v=>state.notices.push(v)};
 vm.createContext(c);
 vm.runInContext(between('function openStatsModuleRecordGroup(groupKey,moduleId,moduleName){','document.addEventListener("click", e => {'),c);
 return {c,state};
}
test('a CoC click never opens the BRP same-title group',()=>{
 const {c,state}=navigationHarness(records.map(r=>r.id));
 assert.equal(c.openStatsModuleRecordGroup('id:co-id','co-id','同名模组'),true);
 assert.equal(c.selectedRecordGroupKey,'id:co-id');assert.equal(c.recordSpotlightId,'');
 assert.deepEqual(state.open,['records']);assert.equal(state.renders,1);
 assert.equal(c.openStatsModuleRecordGroup('id:br-id','br-id','同名模组'),true);
 assert.equal(c.selectedRecordGroupKey,'id:br-id');
});
test('filtered-out target uses temporary preview, preserving record filters',()=>{
 const {c}=navigationHarness(['co-run']);
 assert.equal(c.openStatsModuleRecordGroup('id:br-id','br-id','同名模组'),true);
 assert.equal(c.selectedRecordGroupKey,'id:br-id');assert.equal(c.recordSpotlightId,'br-run');
});
test('lost explicit ID remains isolated even when another module shares its name',()=>{
 const {c,state}=navigationHarness(['co-run']);
 assert.equal(c.openStatsModuleRecordGroup('missing:old-id','old-id','同名模组'),true);
 assert.equal(c.selectedRecordGroupKey,'missing:old-id');assert.equal(c.recordSpotlightId,'expired-run');
 assert.equal(c.openStatsModuleRecordGroup('id:nonexistent','nonexistent','同名模组'),false);
 assert.equal(state.notices.length,1);assert.equal(c.selectedRecordGroupKey,'missing:old-id');
});
test('unlinked ambiguous legacy records never gain an arbitrary module ID',()=>{
 const {c}=navigationHarness(records.map(r=>r.id));
 assert.equal(c.openStatsModuleRecordGroup('legacy:同名模组','','同名模组'),true);
 assert.equal(c.selectedRecordGroupKey,'legacy:同名模组');
 assert.equal(c.openStatsModuleRecordGroup('','','同名模组'),false); // missing-id and unlinked buckets share a title; bare names must not guess
 assert.equal(c.selectedRecordGroupKey,'legacy:同名模组');
});
test('current version and cache align; historic tests do not lock previous versions',()=>{
 const version=html.match(/const APP_UI_VERSION = "([\d.]+)";/)?.[1];
 assert.match(version,/^8\.1\.12\.\d+$/);
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert.equal(sw.match(/CACHE_NAME=`\$\{CACHE_PREFIX\}v([^`]+)`/)?.[1],version);
 assert.doesNotMatch(fs.readFileSync(path.join(root,'.github/pl-ci/round154-multirule-destructive-id.test.cjs'),'utf8'),/assert\.equal\(version,'8\.1\.12\.221'\)/);
 assert.equal(html.split(`<strong class="version-log-version">v${version}</strong>`).length-1,1);
});
