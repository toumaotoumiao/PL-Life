'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'../..');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const start = html.indexOf('function restoreTrashEntry(id) {');
const end = html.indexOf('function renderTrashBin() {',start);
assert.ok(start>0 && end>start,'final restoreTrashEntry implementation found');
const script = new vm.Script(html.slice(start,end));
function context({saveResult=true,removeResult=true,renderError=false,removeError=false,entryType='plan',existingPlan=false}={}){
 const events=[];
 const sandbox={
   trashEntries:[{id:'trash-1',type:entryType,payload:{id:'plan-1'},label:'plan'}],
   profiles:[],runPlans:existingPlan?[{id:'plan-1'}]:[],runRecords:[],modules:[],pcs:[],
   clone:x=>JSON.parse(JSON.stringify(x)),
   normalizeRunPlan:x=>({...x}),
   normalizeRunRecord:x=>({...x}),
   normalizeRichModule:x=>({...x}),
   normalizedEntityNameKey:x=>String(x||'').toLowerCase(),
   settings:{moduleArchive:[]},
   saveState:()=>{events.push('save');return saveResult;},
   removeTrashEntry:()=>{events.push('remove');if(removeError)throw new Error('cleanup broken');return removeResult;},
   renderAllPrimaryViews:()=>{events.push('render');if(renderError)throw new Error('render broken');},
   showToast:message=>events.push('toast:'+message),
   appNotice:message=>events.push('notice:'+message),
   restoreProfileTrash:()=>0,
   console:{error:()=>{}}
 };
 vm.createContext(sandbox);
 script.runInContext(sandbox);
 return {sandbox,events};
}
test('restore is persisted before the trash item is removed',()=>{
 const {sandbox,events}=context();
 assert.equal(sandbox.restoreTrashEntry('trash-1'),true);
 assert.deepEqual(events.slice(0,2),['save','remove']);
 assert.equal(sandbox.runPlans.length,1);
});
test('a failed precommit save rolls memory back and does not remove trash',()=>{
 const {sandbox,events}=context({saveResult:false});
 assert.equal(sandbox.restoreTrashEntry('trash-1'),false);
 assert.equal(sandbox.runPlans.length,0);
 assert.equal(events.includes('remove'),false);
 assert.match(events.join(' '),/notice:恢复失败/);
});
test('postcommit render error leaves restored records in memory and tells the user',()=>{
 const {sandbox,events}=context({renderError:true});
 assert.equal(sandbox.restoreTrashEntry('trash-1'),true);
 assert.equal(sandbox.runPlans.length,1);
 assert.match(events.join(' '),/档案已经恢复并保存/);
 assert.doesNotMatch(events.join(' '),/当前数据未替换/);
});
test('postcommit trash removal exception does not undo saved records',()=>{
 const {sandbox,events}=context({removeError:true});
 assert.equal(sandbox.restoreTrashEntry('trash-1'),true);
 assert.equal(sandbox.runPlans.length,1);
 assert.match(events.join(' '),/回收站记录仍在/);
});
test('a false trash cleanup result says persisted record may need a separate cleanup',()=>{
 const {sandbox,events}=context({removeResult:false});
 assert.equal(sandbox.restoreTrashEntry('trash-1'),true);
 assert.equal(sandbox.runPlans.length,1);
 assert.match(events.join(' '),/回收站记录仍在/);
});
test('plan ID collision is rejected before writing or touching trash',()=>{
 const {sandbox,events}=context({existingPlan:true});
 assert.equal(sandbox.restoreTrashEntry('trash-1'),false);
 assert.equal(sandbox.runPlans.length,1);
 assert.equal(events.includes('save'),false);
 assert.equal(events.includes('remove'),false);
});
test('unknown type is rejected without changes',()=>{
 const {sandbox,events}=context({entryType:'unknown'});
 assert.equal(sandbox.restoreTrashEntry('trash-1'),false);
 assert.equal(sandbox.runPlans.length,0);
 assert.equal(events.includes('save'),false);
});
test('final recovery has an explicit commit boundary and protected postcommit branch',()=>{
 const impl=html.slice(start,end);
 assert.match(impl,/let committed = false/);
 assert.match(impl,/committed = true/);
 assert.ok(impl.indexOf('committed = true')>impl.indexOf('if (!saveState())'));
 assert.match(impl,/if \(committed\) \{/);
});
test('schema and status are not silently migrated during UI acceptance',()=>{
 const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json')));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'production-release-manifest.json')));
 assert.equal(status.current.schemaVersion,26);
 assert.equal(manifest.schemaVersion,26);
 assert.equal(status.current.appVersion,manifest.appVersion);
});
test('release gate reserves independent browser and device evidence',()=>{
 const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json')));
 assert.equal(status.nielsen20Audit.currentBrowserAndRealDeviceAccepted,false);
 assert.notEqual(status.currentVersionAcceptance.realDevice.state,'passed');
 assert.notEqual(status.currentVersionAcceptance.release.status,'deployed');
});


test('a group with one duplicate record restores none and retains the trash entry',()=>{
 const {sandbox,events}=context({entryType:'moduleRecords'});
 sandbox.runRecords=[{id:'record-old'}];
 sandbox.trashEntries[0].payload=[{id:'record-new'},{id:'record-old'}];
 assert.equal(sandbox.restoreTrashEntry('trash-1'),false);
 assert.equal(sandbox.runRecords.length,1);
 assert.equal(events.includes('save'),false);
 assert.equal(events.includes('remove'),false);
});
test('a valid group record restore commits all records together before trash cleanup',()=>{
 const {sandbox,events}=context({entryType:'moduleRecords'});
 sandbox.trashEntries[0].payload=[{id:'record-a'},{id:'record-b'}];
 assert.equal(sandbox.restoreTrashEntry('trash-1'),true);
 assert.deepEqual(sandbox.runRecords.map(x=>x.id),['record-a','record-b']);
 assert.deepEqual(events.slice(0,2),['save','remove']);
});
test('module batch internal duplicates are rejected without partial persistence',()=>{
 const {sandbox,events}=context({entryType:'moduleBatch'});
 sandbox.trashEntries[0].payload=[{id:'module-a',name:'A'},{id:'module-b',name:'a'}];
 assert.equal(sandbox.restoreTrashEntry('trash-1'),false);
 assert.equal(sandbox.modules.length,0);
 assert.equal(events.includes('save'),false);
});
test('record restore commit with render failure remains saved',()=>{
 const {sandbox,events}=context({entryType:'record',renderError:true});
 sandbox.trashEntries[0].payload={id:'record-ok'};
 assert.equal(sandbox.restoreTrashEntry('trash-1'),true);
 assert.equal(sandbox.runRecords.length,1);
 assert.match(events.join(' '),/已经恢复并保存/);
});

test('manual browser workflow is read-only and cannot target production by default',()=>{
 const script=fs.readFileSync(path.join(root,'.github/pl-ci/stage140-live-site-audit.py'),'utf8');
 const work=fs.readFileSync(path.join(root,'.github/workflows/pl-stage140-live-test-gate.yml'),'utf8');
 assert.match(script,/\/PL-Life-Test\//);
 assert.match(script,/生产站及其他地址禁止执行自动验收/);
 assert.doesNotMatch(script,/page\.screenshot\(/);
 assert.match(work,/workflow_dispatch/);
 assert.match(work,/stage140-live-site-audit\.py/);
});
test('Stage140 commit-safety regression is included in main GitHub regression workflow',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 assert.match(workflow,/node --test \.github\/pl-ci\/round310-stage140-release-atomicity\.test\.cjs/);
});
