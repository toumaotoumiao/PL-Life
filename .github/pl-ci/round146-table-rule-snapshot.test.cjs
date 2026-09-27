'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
function extract(name,next){const begin=html.indexOf('function '+name+'(');assert.ok(begin>=0,name);const end=html.indexOf(next,begin);assert.ok(end>begin,name+' end');return html.slice(begin,end);}
function sandbox(){const context={
  normalizeModuleRuleMeta:(raw)=>({...raw}),defaultModuleRuleMeta:(source='new-default')=>({familyId:'brp',systemId:'coc',editionId:'7e',confirmed:source==='new-default',source}),
  moduleRuleDisplay:r=>(r.systemId||r.familyId)+'/'+(r.editionId||''),moduleById:id=>context.modules.find(m=>m.id===id),modules:[],
  nativeModuleRulePopoverHTML:()=>'<div data-native-module-rule-family>切换规则只改变适用字段的显示，不删除已填写的 CoC / 招募资料。</div>',
  escapeHTML:x=>String(x).replaceAll('<','&lt;'),CSS:{escape:x=>x},document:{querySelector:()=>null},
  normalizeLogRows:()=>[],normalizeParticipantAssignments:()=>[],normalizeKpc:()=>({}),normalizePlanSlots:()=>[],normalizeTableStatus:()=>'',hasPostRunDraft:()=>false,normalizePostRunDraft:()=>({}),
  uid:()=> 'id-1',clone:x=>JSON.parse(JSON.stringify(x)),mutateRunPlan:()=>true,mutateRunRecord:()=>true,
  planInputPending:null,recordInputPending:null,runPlans:[],runRecords:[],
  };vm.createContext(context);vm.runInContext(extract('normalizeRunRuleSnapshot','function normalizeRunPlan('),context);return context;}
function json(value){return JSON.parse(JSON.stringify(value));}
test('new table inherits selected taxonomy; old run without saved rule remains unrecorded',()=>{
  const x=sandbox(),m={id:'m1',ruleMeta:{familyId:'saikoro-fiction',systemId:'insane',editionId:'',source:'user-selected'}};
  x.modules.push(m);
  assert.equal(x.normalizeRunRuleSnapshot(undefined),null);assert.equal(x.normalizeRunRuleSnapshot(null),null);
  assert.equal(x.runRuleDisplay({id:'old',moduleId:'m1'}),'规则未记录（旧桌次）');
  const inherited=json(x.newRunRuleFromModule(m));assert.equal(inherited.systemId,'insane');assert.equal(inherited.source,'module-inherited');
  const created={moduleId:'m1',ruleMeta:inherited};assert.ok(x.runRuleMatchesModule(created));
  m.ruleMeta={familyId:'brp',systemId:'coc',editionId:'7e'};
  assert.equal(created.ruleMeta.systemId,'insane');assert.equal(x.runRuleMatchesModule(created),false);
  assert.equal(x.runRuleMatchesModule({moduleId:'m1',ruleMeta:null}),true);
});
test('canonical format stores a nullable historical snapshot, then hydrates it from the run (not current module)',()=>{
  const x=sandbox();vm.runInContext(extract('canonicalRunFromRuntime','function buildCanonicalCollections('),x);
  const recorded={id:'run1',moduleId:'m1',moduleName:'测试',ruleMeta:{familyId:'saikoro-fiction',systemId:'insane',editionId:'',source:'user-selected'},plIds:[]};
  const c=json(x.canonicalRunFromRuntime(recorded,'completed','m1'));
  assert.equal(c.ruleMeta.systemId,'insane');assert.equal(c.moduleId,'m1');
  assert.equal(json(x.canonicalRunFromRuntime({...recorded,ruleMeta:null},'completed','m1')).ruleMeta,null);
  assert.match(html,/ruleMeta: normalizeRunRuleSnapshot\(run\?\.ruleMeta\)/);
  assert.match(html,/ruleMeta:clone\(m\.ruleMeta\),recruitment:/);
  assert.match(html,/ruleMeta:clone\(plan\.ruleMeta\)/);
  assert.match(html,/ruleMeta:clone\(rec\.ruleMeta\)/);
});
test('canonical recovery projection preserves module taxonomy and actual per-table rules',()=>{
 const x=sandbox();vm.runInContext(extract('canonicalRunFromRuntime','function buildCanonicalCollections('),x);
 Object.assign(x,{PLDataMigrationGuard:{requireReadable:()=>{}},isCanonicalArchive:()=>true,assertCanonicalIntegrity:()=>{},normalizeSettings:r=>r,runtimeProfileFromCanonical:p=>p,
  normalizePcArchive:r=>r,normalizeCanonicalModule:r=>r,normalizeRunPlan:r=>r,normalizeRunRecord:r=>r,canonicalProfileFromRuntime:p=>p,normalizeRichModule:m=>m,
  BACKUP_FORMAT:'fixture',PLDataHeritage:{capture:(raw,projection)=>{x.projection=projection;return {};}}});
 vm.runInContext(extract('hydrateCanonicalArchive','function isSelfProfile('),x);
 const rule={familyId:'saikoro-fiction',systemId:'insane',editionId:'',source:'user-selected'};
 const mod={id:'m1',name:'测试模组',ruleMeta:{...rule},recruitment:{rules:'旧原文'},rating:{},legacySideOffset:{}};
 const a=json(x.canonicalRunFromRuntime({id:'p1',moduleId:'m1',moduleName:'测试模组',ruleMeta:rule,plIds:[]},'planned','m1'));
 const b=json(x.canonicalRunFromRuntime({id:'r1',moduleId:'m1',moduleName:'测试模组',ruleMeta:null,plIds:[]},'completed','m1'));
 const hydrated=x.hydrateCanonicalArchive({schemaVersion:26,app:{},settings:{},data:{profiles:[],pcs:[],modules:[mod],runs:[a,b]}});
 assert.equal(hydrated.runPlans[0].ruleMeta.systemId,'insane');assert.equal(hydrated.runRecords[0].ruleMeta,null);
 assert.equal(hydrated.modules[0].ruleMeta.systemId,'insane');assert.equal(x.projection.data.modules[0].ruleMeta.systemId,'insane');
 assert.equal(x.projection.data.runs[0].ruleMeta.systemId,'insane');assert.equal(x.projection.data.runs[1].ruleMeta,null);
});
test('all table creation and conversion routes explicitly preserve or inherit rule',()=>{
  assert.match(html,/makeBlankRunPlan\(\)[\s\S]*?ruleMeta: newRunRuleFromModule\(null\)/);
  assert.match(html,/plan\.ruleMeta\?\.source!==['"]user-selected['"]\)plan\.ruleMeta=newRunRuleFromModule\(mod\)/);
  assert.match(html,/ruleMeta:newRunRuleFromModule\(linkedModule\)/);
  assert.match(html,/ruleMeta:newRunRuleFromModule\(module\)/);
  assert.match(html,/r\.moduleId=mod\.id;r\.moduleName=mod\.name;\/\* This archived table keeps its actual rule snapshot/);
  assert.doesNotMatch(html,/function normalizeRunRecord[\s\S]{0,400}ruleMeta: ?defaultModuleRuleMeta/);
});
test('plan and record editing expose a consistent family/system/edition selector with explicit commit',()=>{
  assert.match(html,/runRuleSelectorHTML\(plan,"plan"\)/);assert.match(html,/runRuleSelectorHTML\(r,"record"\)/);
  assert.match(html,/runRuleChangeFromControl\("plan",planId,e\.target\)/);assert.match(html,/runRuleChangeFromControl\("record",recordId,e\.target\)/);
  assert.match(html,/本桌规则与当前模组不同；已保留原桌规则/);
  assert.match(html,/#recordsView \.table-record\.is-editing:has\(\.run-rule-menu\[open\]\)/);
  const x=sandbox(),record={id:'r1',moduleId:'m1',ruleMeta:{familyId:'brp',systemId:'coc',editionId:'7e',source:'module-inherited'}};
  x.runRecords.push(record);
  let actual=null;x.applyRunRuleSelection=(kind,id,patch)=>actual={kind,id,patch};
  assert.equal(x.runRuleChangeFromControl('record','r1',{getAttribute:key=>key==='data-record-rule-family'?'':null,value:'saikoro-fiction'}),true);
  assert.deepEqual(json(actual),{kind:'record',id:'r1',patch:{familyId:'saikoro-fiction',systemId:'',editionId:'',customName:'',customEdition:''}});
});
test('publish version, fixed taxonomy, previous releases, recovery boundaries',()=>{
 const version=html.match(/const APP_UI_VERSION = "([^"]+)";/)?.[1];assert.match(version,/^8\.1\.12\.\d+$/);
 assert.equal(version,sw.match(/CACHE_NAME=`\$\{CACHE_PREFIX\}v([^`]+)`/)?.[1]);
 const hist=html.slice(html.indexOf('<div class="version-history-list" id="releaseNotesBox">'),html.indexOf('</details>',html.indexOf('<div class="version-history-list" id="releaseNotesBox">')));
 for(const v of ['212','211','210'])assert.ok(hist.includes('version-log-version">v8.1.12.'+v),'history '+v);
 assert.doesNotMatch(html,/id:'(?:wuxia|gufeng)'|label:'(?:古风武侠|古風武俠)'/);
 assert.match(html,/function normalizeRunRuleSnapshot/);assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
});
