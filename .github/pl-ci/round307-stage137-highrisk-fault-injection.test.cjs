'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const slice=(a,b)=>{const x=html.indexOf(a),y=html.indexOf(b,x);assert.ok(x>=0&&y>x,`${a} missing`);return html.slice(x,y);};
const prepare=slice('function prepareTrashRestore(entry,choice){','restoreTrashEntry=async function(id){');
function prepareRun(entry,records=[],modules=[]){
 const notices=[];
 const ctx={profiles:[],runPlans:[],runRecords:records,modules,pcs:[],settings:{moduleArchive:{}},
 normalizeRunRecord:x=>({...x}),normalizeRichModule:x=>({...x}),normalizedEntityNameKey:x=>String(x||'').trim().toLowerCase(),
 moduleRulesMatch:(a,b)=>a.rule===b.rule,uid:()=>`unique-${modules.length}`,clone:x=>JSON.parse(JSON.stringify(x)),
 normalizeProfile:x=>x,mergeMissingDeep:(a,b)=>b,rawProfileName:x=>x.name,restoreProfileLinksTo:()=>0};
 vm.runInNewContext(prepare,ctx);return {ctx,notices,execute:()=>ctx.prepareTrashRestore(entry,'merge')};
}
test('verified trash restore rejects one conflicting record instead of losing the unresolved record',()=>{
 const r=prepareRun({type:'moduleRecords',payload:[{id:'r-new'},{id:'r-old'}]},[{id:'r-old'}]);
 assert.throws(r.execute,/整组桌次存在同编号/);assert.deepEqual(r.ctx.runRecords.map(x=>x.id),['r-old']);
});
test('verified trash restore rejects duplicate record IDs within the same batch before inserting',()=>{
 const r=prepareRun({type:'moduleRecords',payload:[{id:'same'},{id:'same'}]},[]);
 assert.throws(r.execute,/整组桌次存在同编号/);assert.equal(r.ctx.runRecords.length,0);
});
test('verified trash restore inserts complete valid batch without silently skipping items',()=>{
 const r=prepareRun({type:'moduleRecords',payload:[{id:'a'},{id:'b'}]},[{id:'existing'}]);
 assert.equal(r.execute(),0);assert.deepEqual(r.ctx.runRecords.map(x=>x.id),['existing','a','b']);
});
test('module batch duplicate ID preflight leaves current module list unchanged',()=>{
 const r=prepareRun({type:'moduleBatch',payload:[{id:'i',name:'M1',rule:'CoC'},{id:'i',name:'M2',rule:'DnD'}]},[],[{id:'old',name:'Current',rule:'CoC'}]);
 assert.throws(r.execute,/批次内部存在/);assert.deepEqual(r.ctx.modules.map(x=>x.id),['old']);
});
test('module batch same-rule same-name duplicate fails while other rules remain independent',()=>{
 const r=prepareRun({type:'moduleBatch',payload:[{id:'a',name:'M',rule:'CoC'},{id:'b',name:'M',rule:'CoC'}]},[]);
 assert.throws(r.execute,/批次内部存在/);assert.equal(r.ctx.modules.length,0);
 const r2=prepareRun({type:'moduleBatch',payload:[{id:'a',name:'M',rule:'CoC'},{id:'b',name:'M',rule:'DnD'}]},[]);
 assert.equal(r2.execute(),0);assert.equal(r2.ctx.modules.length,2);
});
const workbookCleanup=slice('async function cleanupPcOrphanWorkbooks(){','async function removePcOriginalWorkbook(pcId){');
async function workbookScenario(changeOnConfirm){
 let value='original',writes=0;const notes=[];
 const ctx={pcWorkbookManagerBusy:false,STORAGE_KEY:'archive',localStorage:{getItem:()=>value},
 pcOrphanWorkbookInventory:async()=>({candidates:[{pcId:'orphan',blob:{size:30}}],blocked:[]}),
 pcCleanupBackupReady:()=>true,pcCleanupRequireCopies:async()=>true,
 formatStorageBytes:x=>`${x} B`,appConfirm:async()=>{if(changeOnConfirm)value='changed-in-another-tab';return true;},
 appNotice:x=>notes.push(x),refreshPcWorkbookManager:async()=>{},
 PLDataMigrationTransaction:{assertWritable:()=>{}},pcById:()=>null,
 recoveryAttachmentReferenceIndex:async()=>({workbooks:new Set()}),pcWorkbookGet:async()=>({pcId:'orphan',blob:{size:30}}),
 pcWorkbookDelete:async()=>{writes++;return true;},console:{error:()=>{}},showToast:()=>{}};
 vm.runInNewContext(workbookCleanup,ctx);return {result:await ctx.cleanupPcOrphanWorkbooks(),writes,notes};
}
test('orphan workbook cleanup refuses deletions when a second tab edits archive during confirmation',async()=>{
 const res=await workbookScenario(true);assert.equal(res.result,false);assert.equal(res.writes,0);assert.match(res.notes.join(' '),/其他页面修改/);
});
const mediaCleanup=slice('async function cleanupPcMediaOrphans(){','async function pcMakeMediaZip(rows,pcName){');
async function mediaScenario(changeOnConfirm){
 let value='original',deletes=0;const notes=[];
 const row={id:'pic',pcId:'orphan',blob:{size:30}};
 const ctx={STORAGE_KEY:'archive',localStorage:{getItem:()=>value},pcMediaBackupImportNeedsReview:false,
 pcCleanupBackupReady:()=>true,pcMediaAllRows:async()=>[row],pcReferencedMediaIds:()=>new Set(),
 recoveryAttachmentReferenceIndex:async()=>({media:new Set()}),pcMediaStorageInventory:()=>({orphan:[row],pending:[],retained:[]}),
 pcCleanupRequireCopies:async()=>true,formatStorageBytes:x=>`${x} B`,
 appConfirm:async()=>{if(changeOnConfirm)value='updated';return true;},appNotice:x=>notes.push(x),
 pcById:()=>null,pcDraft:null,pcMediaDelete:async()=>{deletes++;return true;},
 updatePcMediaStoragePanel:async()=>{},showContextIssue:()=>{},showToast:()=>{},console:{warn:()=>{}}};
 vm.runInNewContext(mediaCleanup,ctx);return {result:await ctx.cleanupPcMediaOrphans(),deletes,notes};
}
test('orphan image cleanup refuses deletions when archive changes during confirmation',async()=>{
 const res=await mediaScenario(true);assert.equal(res.result,false);assert.equal(res.deletes,0);assert.match(res.notes.join(' '),/其他页面修改/);
});
test('complete backup restore requires a verified recovery snapshot before any attachment transaction',()=>{
 const backup=slice('async function restoreUnifiedCompleteBackup(file){','const BACKUP_DOWNLOAD_PENDING_KEY=');
 assert.match(backup,/snap\.attachmentVersions\?\.version!==1/);
 assert.match(backup,/!String\(snap\.id\|\|""\)\.trim\(\)/);
 assert.ok(backup.indexOf('恢复点未返回有效编号')<backup.indexOf('PLDataMigrationTransaction.run({'));
});
test('Stage137 current status distinguishes Node checks from browser and real-device evidence',()=>{
 const st=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
 const m=JSON.parse(fs.readFileSync(path.join(root,'production-release-manifest.json'),'utf8'));
 assert.ok(st.current.stage>=137);assert.equal(st.current.appVersion,m.appVersion);
 assert.equal(st.current.schemaVersion,26);assert.equal(st.nielsen20Audit.currentBrowserAndRealDeviceAccepted,false);
 assert.match(st.currentVersionAcceptance.release.status,/not-deployed/);
});
