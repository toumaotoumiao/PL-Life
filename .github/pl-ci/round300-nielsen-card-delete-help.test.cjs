'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
const fromTo=(begin,end)=>{
 const a=html.indexOf(begin),b=html.indexOf(end,a);
 assert.ok(a>=0&&b>a,`missing ${begin} or ${end}`);
 return html.slice(a,b);
};
test('Stage130 behavior retained in current release',()=>{
 assert.ok(status.current.stage>=131);
 assert.equal(status.current.appVersion,JSON.parse(fs.readFileSync(path.join(root,'production-release-manifest.json'),'utf8')).appVersion);
 assert.equal(status.current.schemaVersion,26);
 assert.ok(html.includes(`const APP_UI_VERSION = "${status.current.appVersion}"`));
 assert.match(html,/v8\.1\.12\.307<\/strong><span class="version-log-copy">Nielsen 可用性整改第三批/);
 assert.ok(status.nielsen20Audit.items.filter(i=>[14,17,18].includes(i.no)).every(i=>i.codePct>=65));
});
test('module and both PC card layouts keep extra facts accessible behind details',()=>{
 const module=fromTo('function nativeModuleCardHTML(', '/* v8.1.11.82');
 assert.match(module,/const primaryTags=tags\.slice\(0,3\),extraTags=tags\.slice\(3\)/);
 assert.ok(module.includes('<details class="card-extra-facts native-module-extra"'));
 const card=fromTo('function pcCardHTML(', 'let pcQueryRuntime=null;');
 assert.match(card,/primaryMeta=meta\.slice\(0,3\),extraMeta=meta\.slice\(3\)/);
 assert.ok(card.includes('data-collapse-key="pc:${escapeHTML(pc.id)}:meta"'));
 assert.ok(card.includes('data-collapse-key="pc:${escapeHTML(pc.id)}:list-meta"'));
 assert.doesNotMatch(module,/tags\.splice\(/);
});
test('PC card more-details click cannot enter editor nor select a PC in bulk mode',()=>{
 assert.match(html,/if\(row&&!e\.target\.closest\('details,summary,button,a,input,select,textarea,label'\)\)openPcEditor/);
 assert.match(html,/\[data-pc-empty-new\],details,summary'\)\)\{e\.preventDefault\(\);e\.stopImmediatePropagation\(\);togglePcBatchPick/);
 assert.match(html,/\.card-extra-facts>summary:focus-visible/);
});
test('home help has three task-centered steps plus separate backup safety notice, with support and shortcuts disclosed separately',()=>{
 const help=fromTo('<details class="hero-help"','<div aria-live="polite" class="autosave-status-chip"');
 assert.equal((help.match(/class="guide-item"/g)||[]).length,3);
 for(const label of ['建档','安排','归档'])assert.ok(help.includes(`<strong>${label}</strong>`));
 assert.match(help,/<details class="hero-help-extra"><summary>更多帮助<\/summary>/);
 assert.match(help,/Ctrl\/⌘ K 搜索/);
 assert.match(help,/3 步快速开始/);assert.match(help,/class="hero-backup-reminder"/);assert.match(help,/导出完整备份 ZIP/);
});
function createPlanContext(saveOk){
 const log=[],ctx={runPlans:[{id:'p1',moduleName:'短团'}],plannerPickedPlanId:null,editingPlanId:null,
 appConfirm:async()=>true,addTrashEntry:(type,label,payload,opts)=>{log.push(['trash',type,opts]);return {id:'trash1',label}},
 saveState:()=>saveOk,removeTrashEntry:id=>{log.push(['cleanup',id]);return true},
 showUndoDelete:entry=>log.push(['undo',entry.id]),renderRunPlans:()=>log.push(['render']),closePlanEditor:()=>{},console};
 vm.runInNewContext(fromTo('async function deleteRunPlan(', ';\nasync function deleteRunRecord')+';',ctx);
 return {ctx,log};
}
test('plan deletion save failure rolls data back without showing a false undo toast',async()=>{
 const {ctx,log}=createPlanContext(false);
 await ctx.deleteRunPlan('p1');
 assert.equal(ctx.runPlans.length,1);
 assert.equal(log.filter(x=>x[0]==='undo').length,0);
 assert.equal(log.filter(x=>x[0]==='cleanup').length,1);
 assert.equal(log[0][2].deferUi,true);
});
test('plan deletion save success shows undo only after persistence succeeds',async()=>{
 const {ctx,log}=createPlanContext(true);
 await ctx.deleteRunPlan('p1');
 assert.equal(ctx.runPlans.length,0);
 assert.ok(log.some(x=>x[0]==='undo'));
 assert.equal(log.filter(x=>x[0]==='cleanup').length,0);
});
test('PL, module and record deletions all defer undo until after successful save',()=>{
 for(const [begin,end] of [
  ['async function deleteRunRecord(','async function deleteModuleRecords('],
  ['async function deleteNativeModule(','async function deleteProfile('],
  ['async function deleteProfile(','function renderAllPrimaryViews(']]){
  const part=fromTo(begin,end);
  assert.match(part,/\{deferUi:true\}/);
  assert.match(part,/if \(!saveState\(\)\)/);
  assert.match(part,/showUndoDelete\(entry\)/);
  assert.ok(part.indexOf('showUndoDelete(entry)')>part.indexOf('if (!saveState())'));
 }
});
test('failed undo keeps toast visible; successful restoration hides it',()=>{
 const listener=fromTo('document.getElementById("undoDeleteBtn").addEventListener(', 'document.getElementById("trashBinList").addEventListener(');
 let callback,restored=false,timeoutCleared=false;
 const toast={hidden:false};
 const context={document:{getElementById:id=>id==='undoDeleteBtn'?{addEventListener:(name,cb)=>callback=cb}:toast},
 lastUndoTrashId:'record-1',restoreTrashEntry:()=>restored,clearTimeout:()=>timeoutCleared=true,undoToastTimer:9};
 vm.runInNewContext(listener,context);
 assert.equal(typeof callback,'function');
 callback();assert.equal(toast.hidden,false);assert.equal(context.lastUndoTrashId,'record-1');
 restored=true;callback();assert.equal(toast.hidden,true);assert.equal(context.lastUndoTrashId,'');assert.equal(timeoutCleared,true);
});
test('record deletion failure also restores touched PL update timestamps',async()=>{
 const log=[],ctx={
  runRecords:[{id:'r1',plIds:['p1'],kpProfileId:null}],profiles:[{id:'p1',updatedAt:100}],
  appConfirm:async()=>true,recordDisplayLabel:()=>"测试桌次",clone:value=>JSON.parse(JSON.stringify(value)),
  addTrashEntry:(type,label,payload,opts)=>{log.push(['trash',opts]);return {id:'t1'}},
  saveState:()=>false,removeTrashEntry:()=>{log.push(['cleanup'])},
  showUndoDelete:()=>log.push(['undo']),renderRunRecords:()=>{},renderProfiles:()=>{},
  touchProfiles:ids=>{for(const p of ctx.profiles){if(ids.includes(p.id))p.updatedAt=999}},console};
 vm.runInNewContext(fromTo('async function deleteRunRecord(', ';\nasync function deleteModuleRecords')+';',ctx);
 await ctx.deleteRunRecord('r1');
 assert.equal(ctx.runRecords.length,1);
 assert.equal(ctx.profiles[0].updatedAt,100);
 assert.equal(log.filter(x=>x[0]==='undo').length,0);
 assert.equal(log.filter(x=>x[0]==='cleanup').length,1);
});
