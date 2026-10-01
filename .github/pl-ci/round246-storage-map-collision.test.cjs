'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const a=html.indexOf('function backupAttachmentKey('),b=html.indexOf('async function buildUnlinkedAttachmentEntries(',a);
assert.ok(a>0&&b>a);
const key=new Function(html.slice(a,b)+'\nreturn backupAttachmentRowMap;')();
test('Round246 typed attachment inventories preserve legacy positive integer IDs',()=>{
 const rows=[{id:'media-1'},{id:7}];const m=key(rows,'id','media');assert.deepEqual([...m.keys()],['media-1','7']);assert.equal(m.get('7'),rows[1]);
});
test('Round246 collisions caused by numeric/text IDs must stop before backup construction',()=>{
 assert.throws(()=>key([{id:'7'},{id:7}],'id','media'),/重复编号/);
 assert.throws(()=>key([{pcId:'9'},{pcId:9}],'pcId','workbook'),/重复编号/);
});
test('Round246 invalid stored IDs do not masquerade as a legitimate string',()=>{
 for(const bad of [{},[],true,false,0,1.5,'  ','undefined',null])assert.throws(()=>key([{id:bad}],'id','media'),/编号无效/);
});
test('Round246 full ZIP and same-device JSON inventory use validated mapping',()=>{
 assert.match(html,/rowMap=backupAttachmentRowMap\(rows,'id','备份源图片'\)/);
 assert.match(html,/sourceMap=includeWorkbooks\?backupAttachmentRowMap\(allWorkbookRows,'pcId','备份源 Excel'\)/);
 assert.match(html,/available=backupAttachmentRowMap\(rows\.filter\(row=>row\?\.blob\),'id','本设备 JSON 图片'\)/);
 assert.match(html,/available=backupAttachmentRowMap\(rows\.filter\(row=>row\?\.blob\),'pcId','本设备 JSON Excel'\)/);
});
