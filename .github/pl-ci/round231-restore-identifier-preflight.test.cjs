'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../backup-restore-preflight.js'),'utf8'),sandbox);
const audit=sandbox.PLBackupRestorePreflight.audit;
function fictional(){
 const archive={data:{pcs:[{id:'fiction-pc',avatarMediaId:'fiction-image',galleryMediaIds:[],excelSource:{kind:'fixed'}}]}};
 const manifest={backupMode:'complete',mediaCount:1,media:[{id:'fiction-image',pcId:'fiction-pc',path:'media/fiction.png',type:'image/png'}],workbooks:[{pcId:'fiction-pc',path:'workbooks/fiction.xlsx',kind:'fixed'}]};
 const files=Object.fromEntries(['manifest.json','archive.json','media/fiction.png','workbooks/fiction.xlsx'].map(n=>[n,new Uint8Array([0])]));
 return {archive,manifest,files};
}
test('Round231 normal fictional identifiers and legacy positive integer IDs are allowed',()=>{
 let x=fictional();assert.equal(audit(x.manifest,x.archive,x.files).pcCount,1);
 x=fictional();x.archive.data.pcs[0].id=17;x.archive.data.pcs[0].avatarMediaId=31;
 x.manifest.media[0].pcId=17;x.manifest.media[0].id=31;x.manifest.workbooks[0].pcId=17;
 assert.equal(audit(x.manifest,x.archive,x.files).mediaCount,1);
});
for(const [label,edit] of [
 ['object PC identifier',x=>x.archive.data.pcs[0].id={id:'fiction-pc'}],
 ['boolean PC identifier',x=>x.archive.data.pcs[0].id=true],
 ['object image identifier',x=>x.manifest.media[0].id={id:'fiction-image'}],
 ['object image owner',x=>x.manifest.media[0].pcId={id:'fiction-pc'}],
 ['object workbook owner',x=>x.manifest.workbooks[0].pcId={id:'fiction-pc'}],
 ['fractional reference',x=>x.archive.data.pcs[0].avatarMediaId=1.5],
 ['nonfinite reference',x=>x.archive.data.pcs[0].avatarMediaId=NaN]
])test(`Round231 ${label} is refused before restore writes`,()=>{
 const x=fictional();edit(x);assert.throws(()=>audit(x.manifest,x.archive,x.files),/未被覆盖/);
});
