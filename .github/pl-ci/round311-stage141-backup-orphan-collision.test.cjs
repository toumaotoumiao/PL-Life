'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const start=html.indexOf('async function backupRowsExactlySame(');
const end=html.indexOf('\nasync function buildUnifiedCompleteBackupBlob(',start);
assert.ok(start>0&&end>start,'real restore preflight code found');
const impl=html.slice(start,end);
function row(id,value,kind='workbook'){
 return kind==='media'?{id,pcId:'old-pc',name:'historical',blob:new Blob([value],{type:'image/png'})}
   :{pcId:id,fileName:'old.xlsx',kind:'xlsx',blob:new Blob([value],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})};
}
function setup({localBooks=[],localMedia=[],incomingBooks=[],incomingMedia=[],currentPcs=[],incomingPcs=[],changeConfirmation=false}={}){
 const sandbox={
  pcs:currentPcs,
  Blob,
  backupMediaRefsFromPcs:items=>new Set(items.flatMap(x=>x.mediaIds||[]).map(String)),
  backupAttachmentKey:(x,ctx)=>{if(!String(x??'').trim())throw Error(ctx+' invalid');return String(x);},
  backupAttachmentRowMap:(rows,key,label)=>{const result=new Map();for(const r of rows){const id=String(r[key]);if(result.has(id))throw Error(label+' duplicate');result.set(id,r);}return result;},
  snapshotAttachmentDigest:async blob=>crypto.createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex'),
  backupUnlinkedMeta:r=>Object.fromEntries(Object.entries(r).filter(([k])=>k!=='blob'&&k!=='thumbBlob')),
  pcMediaAllRows:async()=>localMedia,
  pcWorkbookAllRows:async()=>localBooks,
  pcVerifyStoredBlobRows:async(actual,expected,key)=>{
   assert.equal(actual.length,expected.length,'no attachment count drift across confirmation');
   for(const old of expected){const now=actual.find(x=>String(x[key])===String(old[key])); assert.ok(now,'attachment still exists');assert.ok(await sandbox.backupRowsExactlySame(old,now),'attachment unchanged during confirm');}
  }
 };
 vm.createContext(sandbox);
 new vm.Script(impl).runInContext(sandbox);
 const prepared={rows:incomingMedia.slice(),workbookRows:incomingBooks.slice(),incoming:{pcs:incomingPcs}};
 return {sandbox,prepared};
}
test('orphan Excel colliding with newly restored PC is preserved under a separate unlinked key',async()=>{
 const t=setup({localBooks:[row('pc1','old-content')],incomingBooks:[row('pc1','new-content')],incomingPcs:[{id:'pc1',excelSource:{fileName:'new.xlsx'}}]});
 const before=t.prepared.workbookRows.length;
 const result=await t.sandbox.preserveLocalUnlinkedForZip(t.prepared);
 assert.equal(t.prepared.workbookRows.length,before+1);assert.equal(result.relocatedWorkbooks,1);
 assert.equal(t.prepared.workbookRows[0].pcId,'pc1');
 const orphan=t.prepared.workbookRows[1];assert.match(orphan.pcId,/^pl-retained-orphan-workbook-/);
 assert.equal(orphan.plRetainedOrphanOriginalKey,'pc1');assert.equal(await orphan.blob.text(),'old-content');
 assert.equal(await t.prepared.workbookRows[0].blob.text(),'new-content');
 const second=await t.sandbox.preserveLocalUnlinkedForZip(t.prepared,{media:[],workbooks:[row('pc1','old-content')]});
 assert.equal(t.prepared.workbookRows.length,before+1,'second source check is idempotent');
 assert.equal(second.relocatedWorkbooks,1);
});
test('identical local workbook is not duplicated or relocated',async()=>{
 const source=row('pc1','same');
 const t=setup({localBooks:[source],incomingBooks:[row('pc1','same')],incomingPcs:[{id:'pc1',excelSource:{}}]});
 const result=await t.sandbox.preserveLocalUnlinkedForZip(t.prepared);
 assert.equal(result.workbooks,0);assert.equal(t.prepared.workbookRows.length,1);
});
test('orphan image collision is preserved with the original bytes and a non-linked id',async()=>{
 const t=setup({localMedia:[row('img1','old-image','media')],incomingMedia:[row('img1','new-image','media')],incomingPcs:[{id:'pc1',mediaIds:['img1']}]});
 const result=await t.sandbox.preserveLocalUnlinkedForZip(t.prepared);
 assert.equal(result.relocatedMedia,1);assert.equal(t.prepared.rows.length,2);
 assert.match(t.prepared.rows[1].id,/^pl-retained-orphan-media-/);
 assert.equal(await t.prepared.rows[1].blob.text(),'old-image');
});
test('unlinked file without any collision keeps its original key',async()=>{
 const t=setup({localBooks:[row('old-pc','old')],incomingBooks:[row('new-pc','new')],incomingPcs:[{id:'new-pc',excelSource:{}}]});
 await t.sandbox.preserveLocalUnlinkedForZip(t.prepared);
 assert.equal(t.prepared.workbookRows.at(-1).pcId,'old-pc');
});
test('local originals referenced by the current archive are not treated as orphan copies',async()=>{
 const t=setup({localBooks:[row('pc1','old')],incomingBooks:[row('pc1','new')],currentPcs:[{id:'pc1',excelSource:{}}],incomingPcs:[{id:'pc1',excelSource:{}}]});
 await t.sandbox.preserveLocalUnlinkedForZip(t.prepared);
 assert.equal(t.prepared.workbookRows.length,1);
});
test('local source changed while confirmation is open causes a safe abort',async()=>{
 const t=setup({localBooks:[row('pc1','old')],incomingBooks:[row('pc1','new')],incomingPcs:[{id:'pc1',excelSource:{}}]});
 await t.sandbox.preserveLocalUnlinkedForZip(t.prepared);
 await assert.rejects(()=>t.sandbox.preserveLocalUnlinkedForZip(t.prepared,{media:[],workbooks:[row('pc1','mutated')]}),/attachment unchanged/);
});
test('duplicate local workbook identifiers are rejected before any prepared inventory modification',async()=>{
 const t=setup({localBooks:[row('pc1','A'),row('pc1','B')],incomingBooks:[row('pc1','new')],incomingPcs:[{id:'pc1',excelSource:{}}]});
 await assert.rejects(()=>t.sandbox.preserveLocalUnlinkedForZip(t.prepared),/duplicate/);
 assert.equal(t.prepared.workbookRows.length,1);
});
test('missing original file fails rather than silently discarding the orphan',async()=>{
 const missing={pcId:'pc1'};const t=setup({localBooks:[missing],incomingBooks:[row('pc1','new')],incomingPcs:[{id:'pc1',excelSource:{}}]});
 await assert.rejects(()=>t.sandbox.preserveLocalUnlinkedForZip(t.prepared),/原件缺失/);
});
test('legacy unversioned recovery snapshot protection remains in the live restore workflow',()=>{
 const restore=html.slice(html.indexOf('async function restoreUnifiedCompleteBackup('),html.indexOf('const BACKUP_DOWNLOAD_PENDING_KEY='));
 assert.match(restore,/assertCompleteZipPreservesRecoveryAttachments\(prepared/);
 assert.ok(restore.indexOf('assertCompleteZipPreservesRecoveryAttachments(prepared)')<restore.indexOf('appConfirm('));
 assert.match(restore,/pcVerifyStoredBlobRows\(workbooks\.map\(pcWorkbookHydrateRow\),approvedSource\.workbooks/);
});
