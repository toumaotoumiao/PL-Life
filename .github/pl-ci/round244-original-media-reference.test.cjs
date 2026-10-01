'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const a=source.indexOf('function backupMediaRefsFromPcs('),b=source.indexOf('function pcOriginalSourceExt(',a),c=source.indexOf('function backupAttachmentKey(',b),d=source.indexOf('async function buildUnlinkedAttachmentEntries(',c);
assert.ok(a>0&&b>a&&c>b&&d>c);
const api=new Function(source.slice(a,b)+source.slice(c,d)+'\nreturn {refs:backupMediaRefsFromPcs,owners:backupMediaOwnersFromPcs,key:backupAttachmentKey};')();
test('Round244 stable text and old positive numeric references are compatible',()=>{
 const pcs=[{id:7,avatarMediaId:9,galleryMediaIds:['image-a',9]}];
 assert.deepEqual([...api.refs([{id:9,avatarMediaId:null,galleryMediaIds:null}])],[]);
 assert.deepEqual([...api.refs(pcs)].sort(),['9','image-a']);
 assert.deepEqual([...api.owners(pcs)], [['9','7'],['image-a','7']]);
});
test('Round244 refuses damaged original avatar and gallery IDs before String coercion',()=>{
 for(const bad of [{},[],true,false,0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'  ','undefined',null]){
  for(const field of ['avatarMediaId','galleryMediaIds']){
   const pc={id:'pc-fiction',avatarMediaId:'image-a',galleryMediaIds:['image-b']};
   if(field==='avatarMediaId')pc.avatarMediaId=bad;else pc.galleryMediaIds=[bad];
   // null is absent only for optional avatar; a gallery entry cannot be absent.
   if(field==='avatarMediaId'&&bad===null)continue;
   assert.throws(()=>api.refs([pc]),/编号无效/);
   assert.throws(()=>api.owners([pc]),/编号无效/);
  }
 }
});
test('Round244 refuses malformed gallery collections and owners',()=>{
 for(const bad of ['image-a',{},true,0]){
  const pc={id:'pc-fiction',galleryMediaIds:bad};
  assert.throws(()=>api.refs([pc]),/图库引用格式无效/);
  assert.throws(()=>api.owners([pc]),/图库引用格式无效/);
 }
 assert.throws(()=>api.owners([{id:{},avatarMediaId:'image-a',galleryMediaIds:[]}]),/编号无效/);
 assert.throws(()=>api.owners([{id:'pc-1',avatarMediaId:'image-a',galleryMediaIds:[]},{id:'pc-2',galleryMediaIds:['image-a']}]),/同时被多个/);
});
test('Round244 production linked and unlinked manifest paths use the guarded functions',()=>{
 assert.match(source,/const referencedMedia=backupMediaRefsFromPcs\(archive\.data\.pcs\|\|\[\]\)/);
 assert.match(source,/owners=backupMediaOwnersFromPcs\(/);
});
