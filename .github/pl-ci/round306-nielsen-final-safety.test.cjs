'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const moduleTool=fs.readFileSync(path.join(root,'module-tools.html'),'utf8');
const diagnostic=fs.readFileSync(path.join(root,'storage-diagnostic.html'),'utf8');
const slice=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,`${start}/${end} missing`);return html.slice(a,b)};
const code=slice('async function deleteModuleRecords(moduleName, groupKey = "") {','function setModuleBatchMode(enabled)');
function groupScenario(saved){
 const record={id:'r1',plIds:['p1'],kpProfileId:'p2',moduleId:'m1',moduleName:'Cthulhu',updatedAt:1,ruleMeta:null};
 const profile={id:'p1',updatedAt:123},kp={id:'p2'};
 const group=['Cthulhu',[record],null,null,null,'g1','Cthulhu',null,false];
 const calls=[];
 const ctx={runRecords:[record],profiles:[profile,kp],selectedRecordGroupKey:'g1',selectedModuleName:'Cthulhu',
   groupedRunRecordsForDisplay:()=>[group],normalizedEntityNameKey:x=>x,appConfirm:async()=>true,
   addTrashEntry:(type,label,payload,opts)=>{calls.push(['add',opts]);return {id:'trash1'}},
   saveState:()=>{calls.push(['save',profile.updatedAt,kp.updatedAt]);return saved},
   removeTrashEntry:()=>{calls.push(['remove']);return true},showUndoDelete:()=>calls.push(['undo']),
   renderTrashBin:()=>calls.push(['renderTrash']),renderRunRecords:()=>{},renderProfiles:()=>{},
   touchProfiles:ids=>{for(const p of [profile,kp])if(ids.includes(p.id))p.updatedAt=999},
   showContextIssue:x=>calls.push(['issue',x]),clone:x=>JSON.parse(JSON.stringify(x))};
 vm.runInNewContext(code,ctx);return {ctx,calls,profile,kp};
}
test('group delete failure restores record and profile timestamps before any undo becomes visible',async()=>{
 const {ctx,calls,profile,kp}=groupScenario(false);
 assert.equal(await ctx.deleteModuleRecords('Cthulhu','g1'),false);
 assert.equal(ctx.runRecords.length,1);assert.equal(profile.updatedAt,123);
 assert.equal(Object.hasOwn(kp,'updatedAt'),false);
 assert.equal(calls.filter(x=>x[0]==='undo').length,0);
 assert.deepEqual(JSON.parse(JSON.stringify(calls.find(x=>x[0]==='add')[1])),{deferUi:true});
 assert.ok(calls.some(x=>x[0]==='remove'));
});
test('group delete commits changed participant timestamps atomically and only then offers undo',async()=>{
 const {ctx,calls}=groupScenario(true);
 assert.equal(await ctx.deleteModuleRecords('Cthulhu','g1'),true);
 assert.equal(ctx.runRecords.length,0);
 assert.ok(calls.findIndex(x=>x[0]==='save')<calls.findIndex(x=>x[0]==='undo'));
 assert.ok(calls.some(x=>x[0]==='save'&&x[1]===999&&x[2]===999));
 assert.ok(!calls.some(x=>x[0]==='remove'));
});
const restore=slice('function restoreTrashEntry(id) {','function renderTrashBin() {');
function restoreScenario(type,existing,payload){
 const original=JSON.stringify(existing),issues=[],ctx={trashEntries:[{id:'trash1',type,payload}],profiles:[],runPlans:[],runRecords:type==='moduleRecords'?existing:[],modules:type==='moduleBatch'?existing:[],pcs:[],
   clone:x=>JSON.parse(JSON.stringify(x)),normalizeRunRecord:x=>({...x}),normalizeRichModule:x=>({...x}),normalizedEntityNameKey:x=>String(x||'').toLowerCase(),
   saveState:()=>true,removeTrashEntry:()=>{issues.push('removed');return true},renderAllPrimaryViews:()=>{},showToast:()=>{},appNotice:(s)=>issues.push(s),console:{error:()=>{}},settings:{moduleArchive:{}},
   normalizeProfile:x=>x,normalizeRunPlan:x=>x,profileTrashPayload:x=>x,restoreProfileTrash:()=>0};
 vm.runInNewContext(restore,ctx);return {ctx,issues,original};
}
test('multi-record restore conflict preserves whole trash item and does not partially restore',()=>{
 const {ctx,issues,original}=restoreScenario('moduleRecords',[{id:'a',moduleName:'现有桌'}],[{id:'b'},{id:'a'}]);
 assert.equal(ctx.restoreTrashEntry('trash1'),false);
 assert.equal(JSON.stringify(ctx.runRecords),original);
 assert.ok(!issues.includes('removed'));
 assert.equal(ctx.trashEntries.length,1);
});
test('multi-module restore name conflict preserves whole trash item without partial restore',()=>{
 const {ctx,issues,original}=restoreScenario('moduleBatch',[{id:'existing',name:'同名'}],[{id:'new',name:'不同名'},{id:'another',name:'同名'}]);
 assert.equal(ctx.restoreTrashEntry('trash1'),false);
 assert.equal(JSON.stringify(ctx.modules),original);
 assert.ok(!issues.includes('removed'));
});
test('non-conflicting grouped items restore together and remove trash only after save',()=>{
 const {ctx,issues}=restoreScenario('moduleRecords',[],[{id:'b'},{id:'a'}]);
 assert.equal(ctx.restoreTrashEntry('trash1'),true);
 assert.deepEqual(ctx.runRecords.map(x=>x.id),['b','a']);
 assert.ok(issues.includes('removed'));
});
test('auxiliary tool offers clear safe return action and issue accessibility',()=>{
 assert.match(moduleTool,/class="aux-back-home btn" href="\.\/index\.html"/);
 assert.match(moduleTool,/id="auxIssuePanel" hidden role="region" aria-live="polite"/);
 assert.match(moduleTool,/\.aux-back-home:focus-visible/);
 assert.match(diagnostic,/status\.textContent=`正在检查 \$\{index\+1\}\/\$\{targets.length\}/);
 assert.match(diagnostic,/result\.setAttribute\('aria-busy','true'\)/);
 assert.match(diagnostic,/result\.removeAttribute\('aria-busy'\)/);
 assert.match(diagnostic,/检查尚未完成，复制与下载暂不可用/);
});
test('Stage136 source of truth remains distinct from browser and device acceptance',()=>{
 const st=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json')));
 const release=JSON.parse(fs.readFileSync(path.join(root,'production-release-manifest.json')));
 assert.ok(st.current.stage>=136);
 assert.equal(st.current.appVersion,release.appVersion);
 assert.match(st.current.appVersion,/^8\.1\.12\.3\d{2}$/);
 assert.equal(st.current.schemaVersion,26);
 assert.equal(st.nielsen20Audit.currentBrowserAndRealDeviceAccepted,false);
 assert.match(st.currentVersionAcceptance.release.status,/not-deployed/);
});
