"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
function excerpt(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a,`${start} / ${end}`);return html.slice(a,b);}
const proofSource=excerpt('let pcCleanupBackupProof=null','async function cleanupPcOrphanWorkbooks(){');
const pcDelete=excerpt('async function deletePcArchive(id){','async function openPcLinkedRun(');
function setup({media=[{id:'m1',pcId:'deleted',name:'图像',blob:new Blob(['image-v1'],{type:'image/png'})}],workbooks=[{pcId:'gone',fileName:'source.xlsx',blob:new Blob(['excel-v1'])}],invalid=false,oldFormat=false}={}){
 const nodes=new Map(),events={};for(const id of ['pcCleanupBackupStatus','cleanupPcMediaOrphansBtn','cleanupPcOrphanWorkbooksBtn','pcWorkbookOrphanStatus'])nodes.set(id,{textContent:'无对应 PC：可清理 1 份',disabled:true});
 let calls=[];
 const ctx={Blob,Map,Set,String,Number,Boolean,Date,JSON,TextEncoder,console,
  document:{getElementById:id=>nodes.get(id)||{addEventListener:(event,fn)=>events[id+':'+event]=fn}},
  setDisabledReason:(button,flag,reason)=>{button.disabled=flag;button.title=reason},
  snapshotAttachmentDigest:async blob=>require('node:crypto').createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex'),
  backupUnlinkedMeta:row=>Object.fromEntries(Object.entries(row).filter(([key])=>!['blob','thumbBlob'].includes(key))),
  plLongTaskBegin:(...x)=>calls.push(['begin',...x]),plLongTaskPhase:x=>calls.push(['phase',x]),plLongTaskEnd:()=>calls.push(['end']),
  verifyCompleteBackupZipFile:async file=>{if(invalid)throw new Error('invalid ZIP');return {manifest:{backupMode:'complete',unlinkedAttachments:oldFormat?undefined:{version:1,media:media.map(x=>({id:x.id})),workbooks:workbooks.map(x=>({id:x.pcId}))}},unlinkedRows:{media,workbooks}}}
 };
 vm.createContext(ctx);vm.runInContext(proofSource,ctx);
 return {ctx,media,workbooks,nodes,calls,events,run:()=>ctx.pcCleanupVerifyBackup({name:'user-offline-copy.zip'}),match:(m=media,w=workbooks)=>ctx.pcCleanupRequireCopies(m,w)};
}
test('Stage132 is the sole current state without changing schema or ZIP format',()=>{
 assert.ok(status.current.stage>=132);assert.equal(status.current.appVersion,JSON.parse(fs.readFileSync(path.join(root,'production-release-manifest.json'),'utf8')).appVersion);assert.equal(status.current.schemaVersion,26);
 assert.ok(html.includes(`const APP_UI_VERSION = "${status.current.appVersion}"`));
 assert.match(html,/pcCleanupBackupFile/);
 assert.match(html,/const verified=await verifyCompleteBackupZipFile\(file\)/);
 assert.match(html,/const unlinkedRows=await readVerifiedUnlinkedAttachmentRows\(manifest,files,archive\)/);
});
test('cleanup controls are disabled by default until an actual external ZIP is checked',()=>{
 const v=setup();assert.equal(v.nodes.get('cleanupPcMediaOrphansBtn').disabled,true);assert.equal(v.nodes.get('cleanupPcOrphanWorkbooksBtn').disabled,true);
 return assert.rejects(v.match(),/完整 ZIP/);
});
test('verified ZIP permits exact byte and metadata matches, and releases disabled reasons',async()=>{
 const v=setup();assert.equal(await v.run(),true);assert.equal(await v.match(),true);
 assert.equal(v.nodes.get('cleanupPcMediaOrphansBtn').disabled,false);assert.equal(v.nodes.get('cleanupPcOrphanWorkbooksBtn').disabled,false);
 assert(v.nodes.get('pcCleanupBackupStatus').textContent.includes('已核验'));
});
test('an invalid or incomplete backup cannot authorize any orphan deletion',async()=>{
 const v=setup({invalid:true});assert.equal(await v.run(),false);await assert.rejects(v.match(),/完整 ZIP/);
 const old=setup({oldFormat:true});assert.equal(await old.run(),false);await assert.rejects(old.match(),/完整 ZIP/);
});
test('a ZIP lacking the exact local orphan is not sufficient, even if its own integrity passes',async()=>{
 const v=setup();assert.equal(await v.run(),true);
 await assert.rejects(v.match([{id:'m2',pcId:'gone',blob:new Blob(['image-v1'],{type:'image/png'})}],[]),/未包含/);
});
test('changed original bytes or metadata stop deletion after a ZIP is verified',async()=>{
 const v=setup();assert.equal(await v.run(),true);
 await assert.rejects(v.match([{...v.media[0],blob:new Blob(['image-v2'],{type:'image/png'})}],[]),/不一致/);
 await assert.rejects(v.match([{...v.media[0],name:'changed'}],[]),/不一致/);
 await assert.rejects(v.match([],[{...v.workbooks[0],blob:new Blob(['new-excel'])}]),/不一致/);
});
test('starting a new failed check invalidates any previous successful backup proof',async()=>{
 const v=setup();assert.equal(await v.run(),true);
 v.ctx.verifyCompleteBackupZipFile=async()=>{throw new Error('corrupt')};
 assert.equal(await v.run(),false);await assert.rejects(v.match(),/完整 ZIP/);
});
test('orphan bulk delete entrypoints check the external backup before and after user confirmation',()=>{
 const excel=excerpt('async function cleanupPcOrphanWorkbooks(){','async function removePcOriginalWorkbook(');
 const media=excerpt('async function cleanupPcMediaOrphans(){','async function pcMakeMediaZip(');
 for(const code of [excel,media]){
  assert.match(code,/pcCleanupBackupReady\(\)/);
  assert((code.match(/pcCleanupRequireCopies\(/g)||[]).length>=3);
  assert.ok(code.indexOf('pcCleanupRequireCopies(')<code.indexOf('await appConfirm('));
 }
 assert.match(media,/freshHistory=await recoveryAttachmentReferenceIndex\(\)/);
 assert.match(excel,/recoveryAttachmentReferenceIndex\(\{unversionedOnly:true\}\)/);
});
test('PC deletion rejects invalid/fallback/unversioned restoration proof before saving archive',async()=>{
 const ctx={pcMediaUploadBusy:false,pcs:[{id:'x',name:'Demo',galleryMediaIds:[],avatarMediaId:''}],pcById:id=>ctx.pcs[0],pcRunLinks:()=>[],appConfirm:async()=>true,
  pcMediaRowsForPc:async()=>[],pcWorkbookGet:async()=>null,createRecoverySnapshot:async()=>({id:'fallback_1',attachmentVersions:{version:0}}),
  buildCanonicalArchive:()=>({}),plLongTaskBegin:()=>{},plLongTaskPhase:()=>{},plLongTaskEnd:()=>{},appNotice:()=>{},clone:o=>JSON.parse(JSON.stringify(o)),
  saveState:()=>{throw Error('must never save')},Set,Number,String,Date};
 vm.createContext(ctx);vm.runInContext(pcDelete,ctx);assert.equal(await ctx.deletePcArchive('x'),false);assert.equal(ctx.pcs.length,1);
});
