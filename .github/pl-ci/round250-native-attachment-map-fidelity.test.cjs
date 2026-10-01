'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const first=html.indexOf('function backupAttachmentKey('),last=html.indexOf('async function buildUnlinkedAttachmentEntries(',first);
const map=new Function(html.slice(first,last)+'\nreturn backupAttachmentRowMap;')();
const begin=html.indexOf('async function pcVerifyStoredBlobRows('),end=html.indexOf('/* Full ZIP replaces',begin);
const src=html.slice(begin,end);
const verify=new Function('backupAttachmentRowMap','backupSha256Bytes',src+'\nreturn pcVerifyStoredBlobRows;')(
 map, async bytes=>Array.from(bytes).join(':')
);
const row=(id,bytes=[1,2,3])=>({id,blob:new Blob([new Uint8Array(bytes)],{type:'image/png'}),name:'虚构附件'});
test('Round250 rejects numeric/text collision in expected and actual attachment inventories',async()=>{
 await assert.rejects(verify([row('7')],[row('7'),row(7)],'id','图片'),/重复编号/);
 await assert.rejects(verify([row('7'),row(7)],[row('7')],'id','图片'),/重复编号/);
});
test('Round250 rejects malformed keys before readback; preserves positive historical numeric IDs',async()=>{
 await assert.rejects(verify([row({})],[row('7')],'id','图片'),/编号无效/);
 await assert.rejects(verify([row(true)],[row('7')],'id','图片'),/编号无效/);
 assert.equal(await verify([row(7)],[row(7)],'id','图片'),undefined);
 await assert.rejects(verify([row(7)],[row('7')],'id','图片'),/元数据回读不一致/);
});
test('Round250 readback still detects different bytes and MIME',async()=>{
 await assert.rejects(verify([row('7',[9])],[row(7)],'id','图片'),/长度不一致/);
 const bad=row('7');bad.blob=new Blob([new Uint8Array([1,2,3])],{type:'application/pdf'});
 await assert.rejects(verify([bad],[row('7')],'id','图片'),/MIME/);
});
test('Round250 prior recovery point comparison validates all four inventories before Map construction',()=>{
 const start=html.indexOf('async function assertCompleteZipPreservesRecoveryAttachments('),end=html.indexOf('let interruptedRestoreInFlight',start);
 const code=html.slice(start,end);
 for(const token of ["prepared.rows,'id','待恢复图片'","prepared.workbookRows,'pcId','待恢复 Excel'","'id','原设备图片'","'pcId','原设备 Excel'"])assert.ok(code.includes(token),token);
 assert.doesNotMatch(code,/new Map\(prepared\.rows\.map/);
});
