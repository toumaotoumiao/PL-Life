'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const start=html.indexOf('async function backupLinkedWorkbookFidelity('),end=html.indexOf('async function buildUnlinkedAttachmentEntries(',start);
assert.ok(start>0&&end>start);
const {back,restore}=new Function('backupUnlinkedMeta','backupSha256Bytes','backupVerifySha256',html.slice(start,end)+'\nreturn {back:backupLinkedWorkbookFidelity,restore:restoreLinkedWorkbookFidelity};')(
 row=>Object.fromEntries(Object.entries(row).filter(([k])=>k!=='blob'&&k!=='thumbBlob')),async()=>('a'.repeat(64)),async()=>true);
const blob=new Blob(['fiction']);
test('Round243 linked original workbook accepts stable text and old positive numeric PC IDs',async()=>{
 for(const id of ['pc-1',9]){const item={pcId:String(id),sha256:'a'.repeat(64)},row={pcId:id,blob,kind:'fixed',future:{keep:0}};await back(row,item);const recovered=await restore(item,new Uint8Array([12]));assert.equal(recovered.pcId,id);assert.equal(recovered.future.keep,0);}
});
test('Round243 rejects object, boolean, non-safe integer, and ambiguous linked metadata IDs',async()=>{
 for(const invalid of [{},[],true,false,0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'','undefined','null']){
  const item={pcId:String(invalid),sha256:'a'.repeat(64),metadataSha256:'a'.repeat(64),metadata:{pcId:invalid}};
  await assert.rejects(()=>back({...item.metadata,blob},item),/编号无效|归属错误/);
  await assert.rejects(()=>restore(item,new Uint8Array([1])),/编号无效|清单无效/);
 }
});
test('Round243 legacy no-metadata workbook route stays unchanged and linked call sites remain wired',()=>{
 assert.match(html,/if\(item.metadata===undefined\)return \{pcId:String\(item.pcId\)/);
 assert.match(html,/await backupLinkedWorkbookFidelity\(row,wbItems\[wbItems.length-1\]\)/);
 assert.match(html,/workbookRows.push\(await restoreLinkedWorkbookFidelity\(item,bytes\)\)/);
});
