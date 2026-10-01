'use strict';
/* Round189 executes the production attachment manifest/fidelity functions with
   invented bytes and metadata. This is NOT native IndexedDB or a hosted-site test. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pick=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a,`missing source ${start}`);return html.slice(a,b);};
const api=new Function('crypto','PC_XLSX_MIME','PC_MEDIA_CATEGORIES',
  pick('function pcCrc32Table()','function pcZipU16(')+
  pick('async function backupSha256Bytes(','async function backupRowsExactlySame(')+
  '\nreturn {pcCrc32,backupSha256Bytes,backupUnlinkedMeta,backupLinkedMediaFidelity,restoreLinkedMediaFidelity,backupLinkedWorkbookFidelity,restoreLinkedWorkbookFidelity,buildUnlinkedAttachmentEntries,readVerifiedUnlinkedAttachmentRows};'
)(webcrypto,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',['头像','立绘','差分','CG','跑团截图','约稿','其他']);
const bytes=x=>Uint8Array.from(x);
const asBytes=async x=>new Uint8Array(await x.arrayBuffer());
const eqBlob=async (a,b)=>assert.deepEqual(await asBytes(a),await asBytes(b));
const fixture=()=>({
  archive:{data:{pcs:[{id:'r189-pc',avatarMediaId:'r189-linked',galleryMediaIds:['r189-linked'],excelSource:{kind:'fixed',fileName:'fiction.xlsx'}}]}},
  linked:{id:'r189-linked',pcId:'r189-pc',name:'虚构图片.png',type:'image/png',createdAt:1,note:'虚构',futureMedia:{flags:[false,0,'']},blob:new Blob([bytes([137,80,78,71,13,10,26,10,1,2,3])],{type:'image/png'}),thumbBlob:new Blob([bytes([4,5,6,0])],{type:'image/webp'})},
  old:{id:'r189-unlinked',pcId:'retired-fiction',name:'孤立旧图.png',type:'image/png',createdAt:2,futureOrphan:{keep:false,values:[0,'']},blob:new Blob([bytes([7,0,8,9])],{type:'image/png'}),thumbBlob:new Blob([bytes([1,0,2])],{type:'image/webp'})},
  wb:{pcId:'r189-pc',fileName:'fiction.xlsx',kind:'fixed',futureWorkbook:{values:[0,false,'']},blob:new Blob([bytes([80,75,3,4,1])],{type:'application/octet-stream'})},
  oldWb:{pcId:'retired-fiction',fileName:'old-fiction.xlsx',kind:'fixed',futureWorkbook:{label:'遗留原件',empty:''},blob:new Blob([bytes([80,75,3,4,0])],{type:'application/octet-stream'})}
});
const entriesToFiles=async entries=>Object.fromEntries(await Promise.all(entries.map(async e=>[e.name,e.data instanceof Blob?await asBytes(e.data):e.data])));
const expectedKeys=()=>['futureMedia','futureOrphan','futureWorkbook'];
test('Round189 linked image restores original bytes, original thumbnail and all future metadata',async()=>{
 const f=fixture(),item={id:f.linked.id,pcId:f.linked.pcId,sha256:await api.backupSha256Bytes(await asBytes(f.linked.blob))},entries=[];
 await api.backupLinkedMediaFidelity(f.linked,item,entries,1);
 const files=await entriesToFiles(entries),restored=await api.restoreLinkedMediaFidelity(item,files,await asBytes(f.linked.blob));
 await eqBlob(restored.blob,f.linked.blob);await eqBlob(restored.thumbBlob,f.linked.thumbBlob);
 assert.deepEqual(api.backupUnlinkedMeta(restored),api.backupUnlinkedMeta(f.linked));
 assert.equal(restored.futureMedia.flags[0],false);assert.equal(restored.futureMedia.flags[1],0);assert.equal(restored.futureMedia.flags[2],'');
 assert.equal(restored.blob.type,f.linked.blob.type);assert.equal(restored.thumbBlob.type,f.linked.thumbBlob.type);
});
test('Round189 linked image cannot silently discard corrupted thumbnail, owner, metadata or original',async()=>{
 const f=fixture(),item={id:f.linked.id,pcId:f.linked.pcId,sha256:await api.backupSha256Bytes(await asBytes(f.linked.blob))},entries=[];
 await api.backupLinkedMediaFidelity(f.linked,item,entries,1);const files=await entriesToFiles(entries),source=await asBytes(f.linked.blob);
 await assert.rejects(()=>api.restoreLinkedMediaFidelity(item,{...files,[item.thumbPath]:bytes([4,5,6,1])},source),/缩略图/);
 await assert.rejects(()=>api.restoreLinkedMediaFidelity({...item,pcId:'wrong'},files,source),/归属/);
 await assert.rejects(()=>api.restoreLinkedMediaFidelity({...item,metadata:{...item.metadata,futureMedia:{flags:[true,0,'']}}},files,source),/SHA-256/);
 await assert.rejects(()=>api.restoreLinkedMediaFidelity(item,files,bytes([137,80,78,71,13,10,26,10,1,2,4])),/SHA-256/);
});
test('Round189 linked workbook preserves original bytes, MIME and unknown row metadata',async()=>{
 const f=fixture(),item={pcId:f.wb.pcId,sha256:await api.backupSha256Bytes(await asBytes(f.wb.blob))};
 await api.backupLinkedWorkbookFidelity(f.wb,item);const source=await asBytes(f.wb.blob),restored=await api.restoreLinkedWorkbookFidelity(item,source);
 await eqBlob(restored.blob,f.wb.blob);assert.deepEqual(api.backupUnlinkedMeta(restored),api.backupUnlinkedMeta(f.wb));
 assert.deepEqual(restored.futureWorkbook.values,[0,false,'']);
 await assert.rejects(()=>api.restoreLinkedWorkbookFidelity({...item,metadata:{...item.metadata,kind:'csv'}},source),/SHA-256/);
});
test('Round189 unlinked originals and thumbnails survive manifest roundtrip without changing source',async()=>{
 const f=fixture(),before=JSON.stringify([api.backupUnlinkedMeta(f.old),api.backupUnlinkedMeta(f.oldWb)]),entries=[];
 const group=await api.buildUnlinkedAttachmentEntries(f.archive,[f.linked,f.old],[f.wb,f.oldWb],entries);
 assert.equal(group.media.length,1);assert.equal(group.workbooks.length,1);assert.equal(group.version,1);
 const restored=await api.readVerifiedUnlinkedAttachmentRows({unlinkedAttachments:group},await entriesToFiles(entries),f.archive);
 assert.equal(JSON.stringify([api.backupUnlinkedMeta(f.old),api.backupUnlinkedMeta(f.oldWb)]),before);
 assert.deepEqual(api.backupUnlinkedMeta(restored.media[0]),api.backupUnlinkedMeta(f.old));
 assert.deepEqual(api.backupUnlinkedMeta(restored.workbooks[0]),api.backupUnlinkedMeta(f.oldWb));
 await eqBlob(restored.media[0].blob,f.old.blob);await eqBlob(restored.media[0].thumbBlob,f.old.thumbBlob);
 await eqBlob(restored.workbooks[0].blob,f.oldWb.blob);
 assert.equal(restored.media[0].futureOrphan.keep,false);assert.equal(restored.workbooks[0].futureWorkbook.empty,'');
});
test('Round189 unlinked tampering, collision and undeclared extra attachments are blocked',async()=>{
 const f=fixture(),entries=[],group=await api.buildUnlinkedAttachmentEntries(f.archive,[f.linked,f.old],[f.wb,f.oldWb],entries),files=await entriesToFiles(entries);
 const image=group.media[0],thumb=image.thumbPath;
 await assert.rejects(()=>api.readVerifiedUnlinkedAttachmentRows({unlinkedAttachments:group},{...files,[image.path]:bytes([7,1,8,9])},f.archive),/SHA-256|内容或元数据/);
 await assert.rejects(()=>api.readVerifiedUnlinkedAttachmentRows({unlinkedAttachments:group},{...files,[thumb]:bytes([1,1,2])},f.archive),/SHA-256/);
 await assert.rejects(()=>api.readVerifiedUnlinkedAttachmentRows({unlinkedAttachments:group},{...files,'unlinked/media/unlisted.bin':bytes([1])},f.archive),/未登记/);
 const duplicated=structuredClone(group);duplicated.media[0].id='r189-linked';
 await assert.rejects(()=>api.readVerifiedUnlinkedAttachmentRows({unlinkedAttachments:duplicated},files,f.archive),/清单异常/);
 const mutated=structuredClone(group);mutated.workbooks[0].metadata.futureWorkbook.empty='CHANGED';
 await assert.rejects(()=>api.readVerifiedUnlinkedAttachmentRows({unlinkedAttachments:mutated},files,f.archive),/SHA-256/);
});
test('Round189 metadata with accessor, hidden field, unsafe key or non-JSON values refuses lossy export',()=>{
 for(const make of [
  ()=>Object.defineProperty({id:'x'},'secret',{value:42,enumerable:false}),
  ()=>Object.defineProperty({id:'x'},'trap',{get(){throw Error('GETTER EXECUTED');},enumerable:true}),
  ()=>JSON.parse('{"id":"x","__proto__":{"poisoned":true}}'),
  ()=>({id:'x',nested:{f:()=>0}}),
  ()=>({id:'x',nested:{bad:NaN}}),
  ()=>({id:'x',nested:[undefined]})
 ])assert.throws(()=>api.backupUnlinkedMeta(make()),/元数据|字段|序列化|不能/);
 assert.equal({}.poisoned,undefined);
});
test('Round189 stays in CI and native Round187 remains separate mandatory release gate',()=>{
 const y=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 assert.match(y,/round189-complete-zip-attachment-fidelity\.test\.cjs/);
 assert.match(y,/round187-native-fullapp-restore-browser\.py/);
 assert.match(y,/Round187:\$\{\{ steps\.round187_browser\.outcome \}\}/);
 assert.match(html,/async function restoreUnifiedCompleteBackup\(file\)/);
});
