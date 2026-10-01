'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const start=source.indexOf('function backupAttachmentKey(value,context){'),end=source.indexOf('async function buildUnlinkedAttachmentEntries(',start);
assert.ok(start>0&&end>start);
const key=new Function(source.slice(start,end)+'\nreturn backupAttachmentKey;')();
test('Round241 accepts explicit stable legacy identifiers, with no implicit object conversion',()=>{
 for(const v of ['media-1','1','旧编号',1,42,Number.MAX_SAFE_INTEGER])assert.equal(key(v,'test'),String(v));
});
test('Round241 rejects ambiguous source IDs before orphan export or preservation',()=>{
 for(const v of [undefined,null,{},[],true,false,0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'','  ','undefined','null'])assert.throws(()=>key(v,'test'),/编号无效/);
});
test('Round241 identical source ID policy is used at export, read-back and preservation',()=>{
 const segment=source.slice(start,source.indexOf('async function backupRowsExactlySame(',end));
 assert.match(segment,/backupAttachmentKey\(kind==='media'\?row\?\.id:row\?\.pcId/);
 assert.match(segment,/backupAttachmentKey\(kind==='media'\?metadata\.id:metadata\.pcId/);
 assert.match(segment,/backupAttachmentKey\(item\?\.id/);
 assert.match(segment,/referencedMedia\.has\(backupAttachmentKey\(row\?\.id/);
 assert.match(segment,/referencedBooks\.has\(backupAttachmentKey\(row\?\.pcId/);
 assert.match(segment,/backupAttachmentKey\(meta\[kind==='media'\?'id':'pcId'\]/);
 const preserve=source.slice(source.indexOf('async function preserveLocalUnlinkedForZip('),source.indexOf('async function ',source.indexOf('async function preserveLocalUnlinkedForZip(')+10));
 assert.match(preserve,/backupAttachmentKey\(row\?\.id/);
 assert.match(preserve,/backupAttachmentKey\(row\?\.pcId/);
});
const endBuild=source.indexOf('async function readVerifiedUnlinkedAttachmentRows(',end);
assert.ok(endBuild>end);
const build=new Function('backupMediaRefsFromPcs','backupUnlinkedMeta','backupSha256Bytes','pcCrc32',source.slice(start,endBuild)+'\nreturn buildUnlinkedAttachmentEntries;')(
  pcs=>new Set(pcs.flatMap(pc=>[pc.avatarMediaId,...(pc.galleryMediaIds||[])].filter(Boolean).map(String))),
  row=>Object.fromEntries(Object.entries(row).filter(([k])=>!['blob','thumbBlob'].includes(k))),
  async()=>('a'.repeat(64)),()=>12345
);
test('Round241 real backup exporter refuses an object source ID before it can be hidden by a same-string reference',async()=>{
 const archive={data:{pcs:[{avatarMediaId:'[object Object]',galleryMediaIds:[]}]}};
 const entries=[];
 await assert.rejects(()=>build(archive,[{id:{},pcId:'fiction',blob:new Blob(['synthetic'])}],[],entries),/编号无效/);
 assert.equal(entries.length,0);
});
test('Round241 valid unlinked media and workbook originals remain included in complete backup',async()=>{
 const entries=[];
 const media={id:'media-1',pcId:'historical',blob:new Blob(['synthetic-image'])};
 const workbook={pcId:4,kind:'fixed',blob:new Blob(['synthetic-workbook'])};
 const result=await build({data:{pcs:[]}},[media],[workbook],entries);
 assert.equal(result.media.length,1);assert.equal(result.workbooks.length,1);
 assert.equal(entries.length,2);assert.equal(result.workbooks[0].id,'4');
});
