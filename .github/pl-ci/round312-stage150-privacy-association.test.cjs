'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const relation=require(path.join(ROOT,'relation-index.js'));
const moduleRows=[{id:'m-old',name:'Demo'}];
const make=(entity)=>relation.build({profiles:[],pcs:[],modules:moduleRows,plans:[{id:'plan1',...entity}],records:[]});

test('明确仅名称：唯一同名时索引不建立关联，也不产生破损诊断',()=>{
 const idx=make({moduleId:'',moduleName:'Demo',moduleLinkMode:'name-only'});
 assert.equal(idx.resolveModule({id:'plan1',moduleId:'',moduleName:'Demo',moduleLinkMode:'name-only'}).status,'name-only');
 assert.deepEqual([...idx.modulePlans('m-old')],[]);
 assert.equal(idx.diagnostics().length,0);
});
test('旧记录没有新标记：仍提供只读 legacy-unique 线索，不静默抹除历史',()=>{
 const idx=make({moduleId:'',moduleName:'Demo'});
 assert.equal(idx.resolveModule({id:'plan1',moduleId:'',moduleName:'Demo'}).status,'legacy-unique');
 assert.deepEqual([...idx.modulePlans('m-old')],['plan1']);
});
test('明确选择 ID：关联到指定档案；同名异规则不靠名称串档',()=>{
 const idx=relation.build({profiles:[],pcs:[],modules:[{id:'m1',name:'Demo',ruleMeta:{systemId:'coc'}},{id:'m2',name:'Demo',ruleMeta:{systemId:'dnd'}}],plans:[{id:'p1',moduleId:'m2',moduleName:'Demo'}],records:[]});
 assert.equal(idx.resolveModule({id:'p1',moduleId:'m2',moduleName:'Demo'}).status,'id');
 assert.deepEqual([...idx.modulePlans('m1')],[]);
 assert.deepEqual([...idx.modulePlans('m2')],['p1']);
});
test('历史同名冲突：保持 ambiguous，禁止猜选一个 ID',()=>{
 const idx=relation.build({profiles:[],pcs:[],modules:[{id:'m1',name:'Demo'},{id:'m2',name:'Demo'}],plans:[{id:'p1',moduleName:'Demo'}],records:[]});
 assert.equal(idx.resolveModule({id:'p1',moduleName:'Demo'}).status,'ambiguous');
 assert.deepEqual([...idx.modulePlans('m1')],[]);
});
test('正式档案构建：仅名称、历史空 ID、失效 ID 均保留；有效 ID 使用指定对象',()=>{
 const start=html.indexOf('function buildCanonicalCollections()');
 const end=html.indexOf('    const all = [...runRecords, ...runPlans];',start);
 assert.ok(start>=0&&end>start);
 const slice=html.slice(start,end)+'    return {runPlans,runRecords};\n}';
 const sandbox={settings:{moduleArchive:{}},modules:[{id:'m1',name:'Demo'}],runPlans:[
  {id:'explicit-name',moduleId:'',moduleLinkMode:'name-only',moduleName:'Demo'},
  {id:'old-idless',moduleId:'',moduleName:'Demo'},
  {id:'broken-id',moduleId:'missing',moduleName:'Original'},
  {id:'linked',moduleId:'m1',moduleName:'Stale Name'}],runRecords:[],
  normalizeRichModule:m=>m,normalizedEntityNameKey:v=>String(v||'').toLowerCase()};
 vm.createContext(sandbox);vm.runInContext(slice+'\nvar result=buildCanonicalCollections();',sandbox);
 const rs=sandbox.result.runPlans;
 assert.equal(rs[0].moduleId,'');assert.equal(rs[0].moduleLinkMode,'name-only');
 assert.equal(rs[1].moduleId,'');assert.equal(rs[1].moduleName,'Demo');
 assert.equal(rs[2].moduleId,'missing');assert.equal(rs[2].moduleName,'Original');
 assert.equal(rs[3].moduleId,'m1');assert.equal(rs[3].moduleName,'Demo');
});
test('归档计划代码只允许显式 name-only 或有效 ID；不含 legacy-unique 自动选取',()=>{
 const start=html.indexOf('async function archiveRunPlan('),end=html.indexOf('function openPlanEditor(',start);
 const code=html.slice(start,end);
 assert.match(code,/explicitNameOnly\s*=\s*!resolvedModule\s*&&\s*plan\.moduleLinkMode\s*===\s*"name-only"/);
 assert.doesNotMatch(code,/uniqueModuleByNormalizedName\(moduleName\)/);
 assert.match(code,/moduleLinkMode:\s*explicitNameOnly\s*\?\s*"name-only"/);
 assert.match(code,/moduleId:\s*resolvedModule\?\.id\s*\|\|\s*""/);
});
test('从记录退回计划不按名称自行创建关联，明确名称选择穿过归档',()=>{
 const pos=html.indexOf('const mod = moduleById(rec.moduleId);',html.indexOf('async function archiveRunPlan('));
 assert.ok(pos>0);const part=html.slice(pos,pos+2900);
 assert.doesNotMatch(part,/uniqueModuleByNormalizedName/);
 assert.match(part,/returnModuleName\s*=\s*mod\?\.name\s*\|\|\s*rec\.moduleName/);
 assert.match(html,/moduleLinkMode:\s*rec\.moduleLinkMode\s*===\s*"name-only"\s*\?/);
});
test('分享全局搜索真实函数：私人联系方式、备注、Log 均不产生命中',()=>{
 const begin=html.indexOf('function buildGlobalSearchRows('),end=html.indexOf('function renderGlobalSearch(',begin);
 const code=html.slice(begin,end);
 assert.ok(code.includes('if (shareModeEnabled)'));
 const secret='case-private-62q@example.invalid',note='private-note-73m',log='https://example.invalid/log-private-88z';
 const sandbox={shareModeEnabled:true,profiles:[{id:'p1',name:'Visible PL',contact:secret,profileRemark:note}],pcs:[],modules:[],runPlans:[],runRecords:[{id:'r1',moduleName:'Visible Module',logUrl:log}],isBlacklistedProfile:()=>false,displayProfileName:p=>p.name,
  normalizedEntityNameKey:x=>String(x||'').toLocaleLowerCase(),searchFieldRank:(s,q)=>String(s||'').toLocaleLowerCase().includes(q)?0:99,
  profilePickerNameCollator:new Intl.Collator('zh-CN')};
 vm.createContext(sandbox);vm.runInContext(code,sandbox);
 for(const q of [secret,note,log]) assert.equal(sandbox.buildGlobalSearchRows(q).length,0,q);
 assert.deepEqual(Array.from(sandbox.buildGlobalSearchRows('visible').map(x=>x.type)),['PL','记录']);
});
test('分享模式的 PL 页面查询：只向只读查询索引传入脱敏字段，不污染原档案',()=>{
 const start=html.indexOf('function profileQueryArchive()'),end=html.indexOf('function renderProfiles()',start),code=html.slice(start,end);
 const secret='private-case-91e@example.invalid',note='hidden-remark-63j',log='https://example.invalid/private-log';
 const p={id:'p1',name:'Visible PL',contact:secret,profileRemark:note,notes:{alpha:note},blacklist:{active:false,reason:note}};
 let passed;
 const sandbox={window:{PLProfileQueryBridge:{create:()=>({query:arg=>{passed=arg;return arg;}})}},profileQueryRuntime:null,buildSearchIndex:x=>x.join(' '),profileExactNameSearchMatch:()=>false,profiles:[p],draft:null,editingId:'',pcs:[],modules:[],runPlans:[],runRecords:[{id:'r1',moduleName:'Secret Module',logUrl:log,plIds:['p1'],kpProfileId:'',participantAssignments:[]}],runRecordsDraft:null,shareModeEnabled:true,els:{search:{value:'x'}},document:{getElementById:()=>({value:''})},selfProfileId:()=>'',settings:{},profileListMode:'active',displayProfileName:p=>p.name};
 vm.createContext(sandbox);vm.runInContext(code+'\nvar result=profileQueryArchive();',sandbox);
 assert.equal(passed.data.profiles[0].contact,'');assert.equal(passed.data.profiles[0].profileRemark,'');
 assert.equal(passed.data.profiles[0].notes.alpha,undefined);
 assert.equal(passed.data.records[0].logUrl,'');
 assert.equal(p.contact,secret);assert.equal(p.profileRemark,note);
 assert.equal(sandbox.runRecords[0].logUrl,log);
});
test('创建模组：就地流程按名称和规则判重，不跨不同规则一刀切',()=>{
 const snippets=[html.slice(html.indexOf('function createAndLinkModuleForRecord('),html.indexOf('async function changeRecordModule(')),html.slice(html.indexOf('function createAndLinkModuleForPlan('),html.indexOf('function renderPlanEditor('))];
 for(const code of snippets){assert.match(code,/sameRuleNamedModules/);assert.doesNotMatch(code,/if\s*\(exact\.length\s*===\s*1\)\s*return linkPlanToModule/);}
});
test('分享模式各档案页的查询结果：仅可见标题命中，不回传私人字段匹配',()=>{
 const start=html.indexOf('function restrictSharedSearchRows('),end=html.indexOf('function pcQueryArchive()',start);
 const code=html.slice(start,end);
 const sandbox={shareModeEnabled:true,normalizedEntityNameKey:v=>String(v||'').toLowerCase(),searchFieldRank:(title,q)=>String(title||'').toLowerCase().includes(q)?0:99,moduleRunCount:()=>1};
 vm.createContext(sandbox);vm.runInContext(code,sandbox);
 const result={rawRows:[{id:'p1',name:'Visible PC',notes:'secret-note-c67'},{id:'p2',name:'Visible Two',notes:''}],ids:['p1','p2'],total:2,count:2};
 const secret=sandbox.restrictSharedSearchRows(result,'secret-note-c67',p=>p.name);
 assert.equal(secret.rawRows.length,0);assert.equal(secret.ids.length,0);assert.equal(secret.count,0);
 const publicResult=sandbox.restrictSharedSearchRows(result,'visible',p=>p.name);
 assert.equal(publicResult.rawRows.length,2);
 assert.equal(result.rawRows.length,2);
});
test('PC 关联筛选：仅本桌名称不得转换成模块 ID 筛选项',()=>{
 const code=fs.readFileSync(path.join(ROOT,'pc-query-bridge.js'),'utf8');
 assert.match(code,/row\.moduleLinkMode==='name-only'/);
 assert.match(code,/仅本桌名称/);
 assert.match(code,/add\(row\?\.moduleLinkMode\)/);
});
test('模拟旧档案与新档案正向规范化：无 ID 旧名称保留，显式 name-only 保留',()=>{
 const start=html.indexOf('function normalizeRunPlan('),end=html.indexOf('function makeBlankRunPlan()',start);
 const src=html.slice(start,end);
 const sb={uid:()=> 'generated',normalizeLogUrls:()=>[],normalizeLogLabels:()=>[],normalizeLinkedProfileId:x=>x||'',normalizeTableStatus:x=>x||'',normalizeRunRuleSnapshot:x=>x||{},normalizeParticipantAssignments:()=>[],normalizeExternalParticipants:()=>[],normalizeKpc:()=>({}),normalizePcHoNumber:()=>0,extractLegacyParticipantNames:()=>[],normalizePlanSchedulePreset:()=>({}),normalizePlanSlots:()=>[],normalizePostRunDraft:()=>({}),pcPreserveUnknownJsonProps:(raw,norm)=>({...raw,...norm}),RUN_CANONICAL_ONLY_KEYS:new Set()};
 vm.createContext(sb);vm.runInContext(src,sb);
 const old=sb.normalizeRunPlan({id:'legacy-1',moduleId:'',moduleName:'Demo'});
 const explicit=sb.normalizeRunPlan({id:'new-1',moduleId:'',moduleName:'Demo',moduleLinkMode:'name-only'});
 assert.equal(old.moduleId,'');assert.equal(old.moduleName,'Demo');assert.equal(old.moduleLinkMode,'');
 assert.equal(explicit.moduleId,'');assert.equal(explicit.moduleName,'Demo');assert.equal(explicit.moduleLinkMode,'name-only');
});
test('模拟标准备份输出：显示名称和用户显式链接方式写入 schema26 run，旧对象不强制改为 name-only',()=>{
 const start=html.indexOf('function canonicalRunFromRuntime('),end=html.indexOf('function buildCanonicalCollections()',start);
 const sb={normalizeLogRows:()=>[],normalizePostRunDraft:()=>({}),runCanonicalExtras:()=>({}),RUN_DRAFT_KNOWN_KEYS:new Set(),hasPostRunDraft:()=>false,pcPreserveUnknownJsonProps:(raw,base)=>({...raw,...base}),normalizeRunRuleSnapshot:raw=>raw||{},normalizeTableStatus:(v,d)=>v||d,normalizeParticipantAssignments:()=>[],normalizeExternalParticipants:()=>[],normalizeKpc:()=>({}),normalizePlanSlots:()=>[],uid:()=> 'generated',RUN_RUNTIME_ONLY_KEYS:new Set()};
 vm.createContext(sb);vm.runInContext(html.slice(start,end),sb);
 for(const [mode,want] of [['name-only','name-only'],['','']]){
   const entity={id:'row1',moduleId:'',moduleName:'Demo',moduleLinkMode:mode,plIds:[],kp:'',createdAt:1,updatedAt:1};
   const output=sb.canonicalRunFromRuntime(entity,'planned','');
   assert.equal(output.moduleId,'');assert.equal(output.moduleLinkMode,want);assert.equal(output.moduleName,'Demo');
 }
});

test('第一桌显式新建不能再次按同名回退选择别的规则模组',()=>{
 const start=html.indexOf('async function createFirstRunRecord('),end=html.indexOf('function addTableToModule(',start);
 const code=html.slice(start,end);
 assert.match(code,/let matches = mode==="create" \? \[\]/);
 assert.match(code,/if \(!matches\.length && mode!=="create"\)/);
 assert.match(code,/mode==="create"\s*&&\s*!await appConfirm/);
});

test('显式仅名称在其他模块统计、HO 与记录分组中均不能回流成关联',()=>{
 const p=html.indexOf('function moduleForRunEntity('), q=html.indexOf('function moduleHoSystemForEntity(',p);
 const c=html.slice(p,q);
 const sandbox={moduleById:()=>null,uniqueModuleByNormalizedName:()=>({id:'m-old',name:'Demo'})};
 vm.createContext(sandbox);vm.runInContext(c,sandbox);
 assert.equal(sandbox.moduleForRunEntity({moduleId:'',moduleName:'Demo',moduleLinkMode:'name-only'}),null);
 assert.equal(sandbox.moduleForRunEntity({moduleId:'',moduleName:'Demo'}).id,'m-old');
 const start=html.indexOf('function recordBelongsToModule('),end=html.indexOf('function moduleRunCount(',start);
 vm.runInContext(html.slice(start,end),sandbox);
 assert.equal(sandbox.recordBelongsToModule({moduleName:'Demo',moduleLinkMode:'name-only'},{id:'m-old'}),false);
 assert.equal(sandbox.recordBelongsToModule({moduleName:'Demo'},{id:'m-old'}),true);
 const snippet=html.slice(html.indexOf('async function setModuleHoSystemInline('),html.indexOf('    const hasHoDetail = item =>',html.indexOf('async function setModuleHoSystemInline(')));
 assert.match(snippet,/filter\(item => String\(item\.moduleId \|\| ""\) === String\(mod\.id\)\)/);
 assert.doesNotMatch(snippet,/uniqueModuleByNormalizedName\(item\.moduleName\)/);
 const group=html.slice(html.indexOf('function recordsForSameModuleEntity('),html.indexOf('function recordOrdinal(',html.indexOf('function recordsForSameModuleEntity(')));
 assert.match(group,/record\.moduleLinkMode === "name-only"/);
 assert.match(group,/r\.moduleLinkMode !== "name-only"/);
});
