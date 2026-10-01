'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,'backup-restore-preflight.js'),'utf8'),sandbox);
const audit=sandbox.PLBackupRestorePreflight.audit, sha='a'.repeat(64);
function fixture(){
 const archive={data:{pcs:[{id:'p1',avatarMediaId:'m1',galleryMediaIds:['m2']} ]}};
 const manifest={archivePath:'archive.json',backupMode:'complete',mediaCount:2,
  media:['m1','m2'].map(id=>({id,pcId:'p1',type:'image/png',path:`media/${id}.png`,sha256:sha})),workbooks:[]};
 const files=Object.fromEntries(['archive.json','manifest.json','media/m1.png','media/m2.png'].map(x=>[x,new Uint8Array([1])]));
 return {archive,manifest,files};
}
test('Round229 valid PC gallery remains complete',()=>{
 const {archive,manifest,files}=fixture();assert.equal(audit(manifest,archive,files).mediaCount,2);
});
test('Round229 malformed gallery string is rejected rather than silently interpreted as empty',()=>{
 const {archive,manifest,files}=fixture();archive.data.pcs[0].galleryMediaIds='m2';
 assert.throws(()=>audit(manifest,archive,files),/图库引用格式无效/);
});
test('Round229 object gallery ID is rejected rather than coerced to an apparent ID',()=>{
 const {archive,manifest,files}=fixture();archive.data.pcs[0].galleryMediaIds=[{id:'m2'}];
 assert.throws(()=>audit(manifest,archive,files),/图片引用编号无效/);
});
test('Round229 missing linked gallery original still refuses before writes',()=>{
 const {archive,manifest,files}=fixture();delete files['media/m2.png'];
 assert.throws(()=>audit(manifest,archive,files),/未被覆盖/);
});
