'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../backup-restore-preflight.js'),'utf8'),box);
const audit=box.PLBackupRestorePreflight.audit;
const hash='a'.repeat(64);
const bytes=()=>new Uint8Array([1]);
function fixture(kind='media'){
 const item={id:'orphan-1',metadata:{id:'orphan-1',pcId:'orphan-1'},path:`unlinked/${kind}/1.bin`,sha256:hash,metadataSha256:hash,size:1,crc32:1};
 const files={'archive.json':bytes(),'manifest.json':bytes(),[item.path]:bytes()};
 return {manifest:{backupMode:'complete',mediaCount:0,media:[],workbooks:[],unlinkedAttachments:{version:1,media:kind==='media'?[item]:[],workbooks:kind==='workbook'?[item]:[]}},archive:{data:{pcs:[]}},files,item};
}
test('Round239 valid legacy unlinked identifiers preserve complete backup compatibility',()=>{
 for(const kind of ['media','workbook']){let f=fixture(kind);assert.equal(audit(f.manifest,f.archive,f.files).pcCount,0);f.item.metadata[kind==='media'?'id':'pcId']=1;f.item.id='1';assert.equal(audit(f.manifest,f.archive,f.files).pcCount,0);}
});
for(const kind of ['media','workbook'])for(const invalid of [{},true,[],1.5,NaN,0])test(`Round239 ${kind} orphan metadata rejects invalid identity before restore`,()=>{
 const f=fixture(kind);f.item.id=String(invalid);f.item.metadata[kind==='media'?'id':'pcId']=invalid;
 assert.throws(()=>audit(f.manifest,f.archive,f.files),/未被覆盖/);
});
