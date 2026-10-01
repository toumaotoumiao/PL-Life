'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const code=fs.readFileSync(path.join(root,'backup-restore-preflight.js'),'utf8');
const sandbox={};vm.createContext(sandbox);vm.runInContext(code,sandbox);
const audit=sandbox.PLBackupRestorePreflight.audit;
const sha='a'.repeat(64);
function synthetic(){
 const archive={data:{pcs:[{id:'fiction-pc',avatarMediaId:'fiction-image',galleryMediaIds:[],excelSource:{kind:'fixed',fileName:'fiction.xlsx'}}]}};
 const manifest={archivePath:'archive.json',backupMode:'complete',mediaCount:1,
  media:[{id:'fiction-image',pcId:'fiction-pc',type:'image/png',path:'media/fiction-image.png',sha256:sha,metadataSha256:sha,
    metadata:{id:'fiction-image',pcId:'fiction-pc'},thumbPath:'media-thumbnails/fiction-image.webp',thumbSha256:sha}],
  workbooks:[{pcId:'fiction-pc',path:'workbooks/fiction-pc.xlsx',kind:'fixed',sha256:sha,metadataSha256:sha,metadata:{pcId:'fiction-pc'}}],
  unlinkedAttachments:{version:1,media:[{id:'fiction-orphan',path:'unlinked/media/orphan.png',sha256:sha,
    metadataSha256:sha,size:3,crc32:0,metadata:{id:'fiction-orphan'},thumbPath:'unlinked/media/orphan-thumb.webp',thumbSha256:sha,thumbSize:3}],workbooks:[]}};
 const files=Object.fromEntries(['archive.json','manifest.json','media/fiction-image.png','media-thumbnails/fiction-image.webp','workbooks/fiction-pc.xlsx','unlinked/media/orphan.png','unlinked/media/orphan-thumb.webp'].map(k=>[k,new Uint8Array([1,2,3])]));
 return {archive,manifest,files};
}
test('Round228 fictional complete ZIP passes structural preflight without accessing storage',()=>{
 const {archive,manifest,files}=synthetic();const result=audit(manifest,archive,files);
 assert.equal(result.pcCount,1);assert.equal(result.mediaCount,1);assert.equal(result.workbookCount,1);
});
for(const name of ['media/fiction-image.png','media-thumbnails/fiction-image.webp','workbooks/fiction-pc.xlsx','unlinked/media/orphan.png','unlinked/media/orphan-thumb.webp']){
 test(`Round228 missing ${name} refuses before mutations`,()=>{
  const {archive,manifest,files}=synthetic();delete files[name];
  assert.throws(()=>audit(manifest,archive,files),/未被覆盖/);
 });
}
test('Round228 undeclared historic attachment cannot silently be discarded',()=>{
 const {archive,manifest,files}=synthetic();files['unlinked/media/unlisted.png']=new Uint8Array([8]);
 assert.throws(()=>audit(manifest,archive,files),/清单外附件/);
});
test('Round228 preflight retains absent-workbook references as hard failure',()=>{
 const {archive,manifest,files}=synthetic();manifest.workbooks=[];delete files['workbooks/fiction-pc.xlsx'];
 assert.throws(()=>audit(manifest,archive,files),/原始 Excel/);
});
