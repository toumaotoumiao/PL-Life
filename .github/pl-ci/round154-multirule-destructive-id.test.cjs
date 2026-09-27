'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const between=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a,`missing ${start}`);return html.slice(a,b);};
const norm=x=>String(x||'').trim().normalize('NFKC').toLowerCase();
const coc={familyId:'brp',systemId:'coc',editionId:'7e'},brp={familyId:'brp',systemId:'brp-generic',editionId:''};
const modules=[{id:'co',name:'相同名字',ruleMeta:coc},{id:'br',name:'相同名字',ruleMeta:brp},{id:'unique',name:'唯一模组',ruleMeta:coc}];
function run(id,mid,name='相同名字'){return{id,moduleId:mid,moduleName:name,plIds:[],kpProfileId:''};}
function ctx(extra={},code=''){const scope=vm.createContext({...extra});vm.runInContext(code,scope);return scope;}
const deleteCode=between('async function deleteModuleRecords(moduleName, groupKey = "") {','function setModuleBatchMode(enabled)');
const grouping=require(path.join(root,'record-group.js'));
function deleteHarness(records,override={}){
 const messages=[],trash=[],state={save:0,notice:0,touched:0,afterConfirm:null};
 const context={
   runRecords:records,modules,selectedModuleName:'',selectedRecordGroupKey:'',
   groupedRunRecordsForDisplay(){return grouping.group(context.runRecords,modules).map(g=>[g.label,g.records,0,g.records.length,null,g.key,g.name,g.moduleId,g.ambiguous]);},
   normalizedEntityNameKey:norm,showContextIssue:x=>{messages.push(x);state.notice++},
   appConfirm:async()=>{if(state.afterConfirm)state.afterConfirm();return true},
   addTrashEntry:(type,label,payload)=>{const entry={id:String(trash.length+1),payload:structuredClone(payload)};trash.push(entry);return entry},
   removeTrashEntry:id=>{const i=trash.findIndex(x=>x.id===id);if(i>=0)trash.splice(i,1)},
   saveState:()=>{state.save++;return !override.failSave},touchProfiles:()=>state.touched++,renderRunRecords:()=>{},renderProfiles:()=>{}
 };
 Object.assign(context,override);
 vm.runInNewContext(deleteCode+'\nthis.removeGroup=deleteModuleRecords;',context);
 return {context,state,trash,messages};
}
test('bulk delete only removes the chosen stable-ID group and preserves other-rule same-title desks',async()=>{
 const records=[run('co-1','co'),run('br-1','br'),run('unique-1','unique','唯一模组')];
 const h=deleteHarness(records);const before=h.context.runRecords;
 assert.equal(await h.context.removeGroup('唯一模组','id:unique'),true);
 assert.deepEqual(h.context.runRecords.map(r=>r.id),['co-1','br-1']);
 assert.deepEqual(h.trash[0].payload.map(r=>r.id),['unique-1']);assert.equal(h.state.save,1);
 assert.equal(before.length,3);
});
test('ambiguous same-title buckets and missing group keys are rejected before confirmation',async()=>{
 const h=deleteHarness([run('co-1','co'),run('br-1','br')]);
 assert.equal(await h.context.removeGroup('相同名字','id:co'),false);
 assert.equal(await h.context.removeGroup('相同名字',''),false);
 assert.equal(h.state.save,0);assert.equal(h.trash.length,0);assert.equal(h.context.runRecords.length,2);
});
test('confirmation-time group changes abort before trash writes or data mutations',async()=>{
 const h=deleteHarness([run('one','unique','唯一模组')]);
 h.state.afterConfirm=()=>h.context.runRecords.push(run('later','unique','唯一模组'));
 assert.equal(await h.context.removeGroup('唯一模组','id:unique'),false);
 assert.deepEqual(h.context.runRecords.map(r=>r.id),['one','later']);assert.equal(h.trash.length,0);assert.equal(h.state.save,0);
});
test('editing a desk while confirmation is open cannot delete the newly changed content',async()=>{
 const h=deleteHarness([run('one','unique','唯一模组')]);
 h.state.afterConfirm=()=>{h.context.runRecords[0].updatedAt=12345;};
 assert.equal(await h.context.removeGroup('唯一模组','id:unique'),false);
 assert.equal(h.context.runRecords[0].updatedAt,12345);assert.equal(h.trash.length,0);assert.equal(h.state.save,0);
});
test('failed primary save restores records and removes pending trash entry',async()=>{
 const h=deleteHarness([run('one','unique','唯一模组')],{failSave:true});
 assert.equal(await h.context.removeGroup('唯一模组','id:unique'),false);
 assert.deepEqual(h.context.runRecords.map(r=>r.id),['one']);assert.equal(h.trash.length,0);
});
test('explicit expired module IDs never fall back to a same-title archive, including ordinal grouping',()=>{
 const scope=ctx({moduleById:id=>modules.find(m=>m.id===id)||null,uniqueModuleByNormalizedName:name=>modules.find(m=>m.name===name)||null,
 normalizedEntityNameKey:norm,compareRunChronology:()=>0},between('function moduleForRunEntity(entity) {','function moduleHoSystemForEntity(')+between('function recordsForSameModuleEntity(record, source = runRecords) {','function recordOrdinal('));
 assert.equal(scope.moduleForRunEntity({moduleId:'missing',moduleName:'唯一模组'}),null);
 assert.equal(scope.moduleForRunEntity({moduleId:'unique',moduleName:'相同名字'}).id,'unique');
 const rows=[run('first','missing','唯一模组'),run('second','unique','唯一模组'),run('third','','唯一模组')];
 assert.deepEqual(Array.from(scope.recordsForSameModuleEntity(rows[0],rows),r=>r.id),['first']);
});
test('PC module metric does not assign unlinked same-title history to either rule',()=>{
 const pc={id:'pc'};const links=[{entity:{moduleName:'相同名字',moduleId:''}},{entity:{moduleName:'相同名字',moduleId:'co'}}];
 const scope=ctx({moduleById:id=>modules.find(m=>m.id===id),modulesByNormalizedName:name=>modules.filter(m=>m.name===name),normalizedEntityNameKey:norm,pcs:[pc],pcRunLinks:()=>links},
 between('  function pcsForModule(moduleId){','  let pcStage5OptionsStamp='));
 assert.equal(scope.pcsForModule('co').length,1);
 assert.equal(scope.pcsForModule('br').length,0);
});
test('the page labels same-title groups with actual rule and event passes group key to deletion',()=>{
 assert.match(html,/const label=g\.ambiguous&&m\?`\$\{g\.name\} · \$\{moduleRuleDisplay\(m\.ruleMeta\)\}/);
 assert.match(html,/data-delete-module-group-key="\$\{escapeHTML\(groupKey\)\}"/);
 assert.match(html,/deleteModuleRecords\(delModule\.dataset\.deleteModule,delModule\.dataset\.deleteModuleGroupKey\|\|""\)/);
});
test('publish version and SW cache agree, earlier CI test does not hardcode previous release',()=>{
 const version=html.match(/const APP_UI_VERSION = "([\d.]+)";/)?.[1];assert.match(version,/^8\.1\.12\.\d+$/);
 assert.equal(fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/CACHE_PREFIX\}v([\d.]+)`/)?.[1],version);
 assert.doesNotMatch(fs.readFileSync(path.join(root,'.github/pl-ci/round153-multirule-crossview-id.test.cjs'),'utf8'),/assert\.equal\(version,'8\.1\.12\.220'\)/);
 assert.equal(html.split(`<strong class="version-log-version">v${version}</strong>`).length-1,1);
});
