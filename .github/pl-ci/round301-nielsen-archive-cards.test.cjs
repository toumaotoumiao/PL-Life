'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
function fromTo(a,b){const start=html.indexOf(a),end=html.indexOf(b,start);assert.ok(start>=0&&end>start,`${a} -> ${b}`);return html.slice(start,end);}
const pcDelete=fromTo('async function deletePcArchive(id){','async function openPcLinkedRun(');
function setup({missing=false,badBlob=false,saveResults=[true],retain=false,crash=false,snapshotFail=false,readbackStale=false,attached=true}={}){
 const log=[],notices=[],toasts=[],phases=[],media=new Map();
 if(!missing)media.set('m1',{id:'m1',pcId:'pc1',blob:badBlob?{size:0}:{size:12}});
 let workbook=attached?{pcId:'pc1',blob:{size:42}}:null,saveIndex=0;
 const ctx={
  pcMediaUploadBusy:false,pcs:[{id:'pc1',name:'测试角色',galleryMediaIds:['m1'],avatarMediaId:'m1'}],editingPcId:'pc1',
  pcById:id=>ctx.pcs.find(p=>p.id===id),pcRunLinks:()=>[],
  appConfirm:async()=>true,appNotice:(msg,title)=>notices.push({msg,title}),showToast:(...args)=>toasts.push(args),
  plLongTaskBegin:(...args)=>phases.push(['begin',...args]),plLongTaskPhase:x=>phases.push(['phase',x]),plLongTaskEnd:()=>phases.push(['end']),
  pcMediaRowsForPc:async()=>[...media.values()],pcWorkbookGet:async()=>workbook,
  createRecoverySnapshot:async()=>{log.push('snapshot');if(snapshotFail)throw new Error('snapshot failed');return {id:'snap1',attachmentVersions:{version:1}}},buildCanonicalArchive:()=>({}),
  saveState:()=>{log.push('save');return saveResults[Math.min(saveIndex++,saveResults.length-1)]},
  pcMediaDelete:async id=>{log.push('delete media');if(crash)throw Error('write failed');if(retain)return false;if(!readbackStale)media.delete(id);return true},
  pcMediaGet:async id=>media.get(id)||null,pcMediaPut:async row=>{media.set(row.id,row);log.push('restore media');return true},
  pcWorkbookDelete:async()=>{log.push('delete Excel');if(retain)return false;workbook=null;return true},
  pcWorkbookPut:async row=>{workbook=row;log.push('restore Excel');return true},
  closePcEditor:async()=>{log.push('close');return true},renderPcArchive:()=>{log.push('render')},
  clone:x=>JSON.parse(JSON.stringify(x)),console,Set,Number,String,Date
 };
 vm.createContext(ctx);vm.runInContext(pcDelete,ctx);
 return {ctx,log,notices,toasts,phases,media,run:()=>ctx.deletePcArchive('pc1'),getWorkbook:()=>workbook};
}
test('Stage131 sole state and release version remain in sync',()=>{
 assert.ok(status.current.stage>=131);assert.equal(status.current.appVersion,JSON.parse(fs.readFileSync(path.join(root,'production-release-manifest.json'),'utf8')).appVersion);assert.equal(status.current.schemaVersion,26);
 assert.ok(html.includes(`const APP_UI_VERSION = "${status.current.appVersion}"`));
 assert.match(html,/v8\.1\.12\.308<\/strong><span class="version-log-copy">Nielsen 可用性整改第四批/);
});
test('PL compact list keeps contact and history visible, secondary demographic details accessible',()=>{
 const code=fromTo('function compactRowHTML(p) {','function cardHTML(p) {');
 assert.match(code,/class="compact-meta"/);assert.match(code,/profileContactHTML/);assert.match(code,/\$\{runs\.length\}桌经历/);
 assert.match(code,/<details class="card-extra-facts compact-profile-extra" data-collapse-key=/);
 assert.match(html,/closest\("\.profile-secondary-actions,\.compact-profile-extra"\)/);
});
test('plan list keeps actionable status/next slot/KP/PL primary, other facts outside nested button',()=>{
 const code=fromTo('function planListItemHTML(plan) {','function renderPlannerCalendars() {');
 assert.match(code,/const supplemental=\[/);assert.match(code,/<div class="plan-row-content"><button/);
 assert.match(code,/<\/button>\s+\$\{supplemental\.length \? `<details/);
 assert.match(code,/plan-row-actions/);assert.match(html,/\.plan-row-content\{min-width:0\}/);
});
test('record header keeps date/KP/PL/Log visible and additional facts recoverable',()=>{
 const code=fromTo('function recordHeaderSummaryChips(r) {','function recordHeaderTitle(r, index) {');
 assert.match(code,/\["date","muted","kp","people","log"\]/);assert.match(code,/record-summary-extra/);
 assert.match(code,/extra\.map\(chipHTML\)/);assert.match(code,/kpDisplayHTML\(r, "privacy-chip-name"\)/);
});
test('PC deletion missing referenced image aborts before any snapshot or write',async()=>{
 const v=setup({missing:true});assert.equal(await v.run(),false);assert.equal(v.ctx.pcs.length,1);
 assert(!v.log.includes('snapshot'));assert(!v.log.includes('save'));assert(v.notices.some(x=>x.msg.includes('缺少原件')));
 assert.equal(v.phases.filter(x=>x[0]==='end').length,1);
});
test('PC deletion with empty image refuses destructive action',async()=>{
 const v=setup({badBlob:true});assert.equal(await v.run(),false);assert.equal(v.ctx.pcs.length,1);assert(!v.log.includes('save'));
});
test('PC deletion snapshot failure leaves PCs and attachments untouched',async()=>{
 const v=setup({snapshotFail:true});assert.equal(await v.run(),false);assert.equal(v.ctx.pcs.length,1);assert(!v.log.includes('save'));
});
test('PC deletion main archive write failure preserves PC and attachments',async()=>{
 const v=setup({saveResults:[false]});assert.equal(await v.run(),false);assert.equal(v.ctx.pcs.length,1);assert(v.media.has('m1'));
 assert(!v.log.includes('delete media'));assert(v.notices.some(x=>x.msg.includes('未能保存')));
});
test('recovery-point protected media and Excel are kept, never reported as physically purged',async()=>{
 const v=setup({retain:true});assert.equal(await v.run(),true);assert.equal(v.ctx.pcs.length,0);assert(v.media.has('m1'));assert(v.getWorkbook());
 assert(v.toasts.some(x=>x[0].includes('受恢复点保护')));assert.equal(v.phases.at(-1)[0],'end');
});
test('PC deletion successful physical cleanup verifies removal',async()=>{
 const v=setup();assert.equal(await v.run(),true);assert.equal(v.ctx.pcs.length,0);assert(!v.media.has('m1'));assert.equal(v.getWorkbook(),null);
 assert(v.toasts.some(x=>x[0].includes('清理完成')));
});
test('attachment cleanup error attempts restore and does not display success toast',async()=>{
 const v=setup({crash:true});assert.equal(await v.run(),false);assert.equal(v.ctx.pcs.length,1);assert.equal(v.media.has('m1'),true);
 assert.equal(v.log.filter(x=>x==='save').length,2);assert.equal(v.toasts.length,0);assert(v.notices.some(x=>x.msg.includes('清理中断')));
});
test('cleanup readback mismatch forces safe restore attempt',async()=>{
 const v=setup({readbackStale:true});assert.equal(await v.run(),false);assert.equal(v.ctx.pcs.length,1);
 assert(v.notices.some(x=>x.msg.includes('核对未通过')));
});
test('failed deletion rollback save is reported as unverified instead of successful',async()=>{
 const v=setup({crash:true,saveResults:[true,false]});assert.equal(await v.run(),false);
 assert(v.notices.some(x=>x.msg.includes('PC 档案恢复保存')));assert.equal(v.toasts.length,0);
});
