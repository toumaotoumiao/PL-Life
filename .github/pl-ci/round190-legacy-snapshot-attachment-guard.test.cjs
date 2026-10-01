'use strict';
/* Real production helpers, fictional binary rows. This does NOT replace native IDB acceptance. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {webcrypto}=require('node:crypto');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const pick=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,`missing production function ${start}`);return html.slice(a,b)};
const makeApi=({beforeMedia,beforeBooks,refs})=>new Function('backupSha256Bytes','snapshotAttachmentDigest','recoveryAttachmentReferenceIndex','pcMediaAllRows','pcWorkbookAllRows',
  pick('function backupAttachmentKey(','async function buildUnlinkedAttachmentEntries(')+
  pick('function backupUnlinkedMeta(row){','/* Optional linked-attachment fidelity extension.')+
  pick('async function backupRowsExactlySame(left,right){','/* Import never silently drops local unlinked files')+
  pick('async function assertCompleteZipPreservesRecoveryAttachments(prepared,approvedSource=null){','let interruptedRestoreInFlight=')+
  '\nreturn {backupRowsExactlySame,assertCompleteZipPreservesRecoveryAttachments};')(
    async bytes=>Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex'),
    async blob=>Buffer.from(await webcrypto.subtle.digest('SHA-256',await blob.arrayBuffer())).toString('hex'),
    async()=>refs,async()=>beforeMedia,async()=>beforeBooks);
const blob=(bytes,type='application/octet-stream')=>new Blob([Uint8Array.from(bytes)],{type});
const media=()=>({id:'legacy-image',pcId:'retired-pc',name:'历史图片',type:'image/png',future:{keep:false,zeros:[0,'']},blob:blob([1,0,2],'image/png'),thumbBlob:blob([3,0,4],'image/webp')});
const book=()=>({pcId:'retired-pc',fileName:'历史角色卡.xlsx',kind:'fixed',future:{keep:false},blob:blob([80,75,3,4],'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')});
const fixture=()=>{const oldMedia=media(),oldBook=book(),refs={media:new Set([oldMedia.id]),workbooks:new Set([oldBook.pcId])};return {oldMedia,oldBook,refs,api:makeApi({beforeMedia:[oldMedia],beforeBooks:[oldBook],refs})};};
const prepared=(image,workbook)=>({rows:image?[image]:[],workbookRows:workbook?[workbook]:[]});
test('Round190 unchanged historical image, thumbnail, Excel, MIME and future metadata remain importable',async()=>{
 const f=fixture();assert.equal(await f.api.assertCompleteZipPreservesRecoveryAttachments(prepared(media(),book())),true);
 assert.equal(await f.api.backupRowsExactlySame(f.oldMedia,media()),true);
 assert.equal(await f.api.backupRowsExactlySame(f.oldBook,book()),true);
});
test('Round190 old unversioned image reference rejects missing original, changed blob, or changed owner',async()=>{
 const f=fixture();await assert.rejects(()=>f.api.assertCompleteZipPreservesRecoveryAttachments(prepared(null,book())),/旧恢复点/);
 const changed=media();changed.blob=blob([1,0,3],'image/png');await assert.rejects(()=>f.api.assertCompleteZipPreservesRecoveryAttachments(prepared(changed,book())),/旧恢复点|内容/);
 changed.blob=f.oldMedia.blob;changed.pcId='other-pc';await assert.rejects(()=>f.api.assertCompleteZipPreservesRecoveryAttachments(prepared(changed,book())),/旧恢复点|所属/);
});
test('Round190 old image reference rejects changed thumbnail bytes, missing thumbnail and changed thumbnail MIME',async()=>{
 const f=fixture();for(const change of [x=>{x.thumbBlob=blob([3,0,5],'image/webp')},x=>{delete x.thumbBlob},x=>{x.thumbBlob=blob([3,0,4],'image/png')}]){
  const image=media();change(image);await assert.rejects(()=>f.api.assertCompleteZipPreservesRecoveryAttachments(prepared(image,book())),/旧恢复点|缩略图|不一致/);
 }
});
test('Round190 old image reference rejects changed future row metadata and original MIME',async()=>{
 const f=fixture();for(const change of [x=>{x.future.keep=true},x=>{x.name='另一个历史图片'},x=>{x.blob=blob([1,0,2],'image/jpeg')}]){
  const image=media();change(image);await assert.rejects(()=>f.api.assertCompleteZipPreservesRecoveryAttachments(prepared(image,book())),/旧恢复点|不一致/);
 }
});
test('Round190 old Excel reference rejects missing blob, changed bytes, metadata and MIME',async()=>{
 const f=fixture();for(const change of [x=>{delete x.blob},x=>{x.blob=blob([80,75,3,5],x.blob.type)},x=>{x.future.keep=true},x=>{x.blob=blob([80,75,3,4],'application/octet-stream')}]){
  const workbook=book();change(workbook);await assert.rejects(()=>f.api.assertCompleteZipPreservesRecoveryAttachments(prepared(media(),workbook)),/旧恢复点|不一致/);
 }
});
test('Round190 unprotected unrelated historical attachments do not block verified import',async()=>{
 const f=fixture(),api=makeApi({beforeMedia:[f.oldMedia],beforeBooks:[f.oldBook],refs:{media:new Set(),workbooks:new Set()}});
 assert.equal(await api.assertCompleteZipPreservesRecoveryAttachments(prepared(null,null)),true);
});
test('Round190 protected comparison uses one full-row fidelity guard for both media and Excel',()=>{
 const code=pick('async function assertCompleteZipPreservesRecoveryAttachments(prepared,approvedSource=null){','let interruptedRestoreInFlight=');
 assert.match(code,/backupRowsExactlySame\(old,next\)/);assert.match(code,/for\(const id of protectedRefs\.media\)/);assert.match(code,/for\(const id of protectedRefs\.workbooks\)/);
 const same=pick('async function backupRowsExactlySame(left,right){','/* Import never silently drops local unlinked files');
 assert.match(same,/\.blob\.type/);assert.match(same,/thumbBlob\.type/);
});
test('Round190 mandatory CI contract retains independent native Round187 release gate',()=>{
 const workflow=fs.readFileSync(path.resolve(__dirname,'../workflows/pl-browser-synthetic.yml'),'utf8');
 assert.match(workflow,/round190-legacy-snapshot-attachment-guard\.test\.cjs/);
 assert.match(workflow,/round187-native-fullapp-restore-browser\.py/);
});
