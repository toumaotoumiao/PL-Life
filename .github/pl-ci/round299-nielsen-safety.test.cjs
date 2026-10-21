const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const test=require('node:test');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
const text=(a,b)=>{
  const start=html.indexOf(a),end=html.indexOf(b,start);
  assert.ok(start>=0&&end>start,`missing region ${a} -> ${b}`);
  return html.slice(start,end);
};

test('current candidate version is 308/schema26, Stage129 release history remains readable',()=>{
  assert.ok(status.current.stage>=131);
  assert.equal(status.current.schemaVersion,26);
  assert.ok(html.includes(`const APP_UI_VERSION = "${status.current.appVersion}"`));
  assert.match(html,/v8\.1\.12\.307<\/strong><span class="version-log-copy">Nielsen 可用性整改第三批/);
  assert.match(html,/v8\.1\.12\.306<\/strong><span class="version-log-copy">Nielsen 可用性整改第二批/);
});

test('bulk Excel preview and save show truthful phases and progress with no guessed percentages',()=>{
 const preview=text('async function pcBatchExcelPreview(', 'async function pcBatchExcelCommit(');
 const commit=text('async function pcBatchExcelCommit(', 'function initPcBatchExcelDrop(');
 assert.match(preview,/plLongTaskBegin\('正在识别 PC Excel'/);
 assert.match(preview,/plLongTaskPhase\(`识别第 \$\{i\+1\}\/\$\{deduped\.length\} 份 Excel`\)/);
 assert.match(commit,/plLongTaskPhase\(`保存原始 Excel · \$\{i\+1\}\/\$\{prepared\.length\}`\)/);
 assert.match(commit,/plLongTaskPhase\('正在提交批量 PC 档案'\)/);
 assert.match(commit,/plLongTaskPhase\(`核对已保存的 PC · \$\{i\+1\}\/\$\{prepared\.length\}`\)/);
});

function simulateBatchCommit({saveOK=true,verifyOK=false,retainOriginal=false}={}){
 const source=text('async function pcBatchExcelCommit(', 'function initPcBatchExcelDrop(');
 const rows={querySelector:()=>({querySelector:(selector)=>selector.includes('pick')?{checked:true}:{value:'P1'}})};
 const entries=[{file:{name:'fixture.xlsx'},raw:new ArrayBuffer(10),parsed:{name:'TestCharacter',_excelWarnings:[],_excelAudit:{requiresOriginal:retainOriginal}},error:''}];
 let pcs=[],saveCalls=0,deleted=0,notices=[],reports=[],renders=0,phases=[],storedFiles=0;
 const ctx={
  pcBatchExcelBusy:false,pcBatchExcelEntries:entries,
  pcBatchExcelElements:()=>({rows}),clone:x=>JSON.parse(JSON.stringify(x)),
  pcs,profiles:[{id:'P1'}],profileById:id=>id==='P1'?{id}:null,
  normalizedEntityNameKey:x=>x.toLowerCase(),pcCandidatesByOwnerName:()=>[],
  makeBlankPc:()=>({id:'base'}),pcMergeImportedDraft:(_base,parsed)=>({...parsed,id:'pc-1'}),
  pcValidateArchiveInput:()=>'',normalizePcArchive:x=>x,
  pcExcelAssertApplied:()=>{},profileNameById:()=> 'Fixture Owner',
  PC_EXCEL_KAGURA_TEMPLATE:{id:'fixture'},document:{getElementById:()=>({checked:retainOriginal})},
  pcBatchExcelRefresh:()=>{},plLongTaskBegin:()=>{},plLongTaskPhase:x=>phases.push(x),plLongTaskEnd:x=>phases.push(x),
  pcWorkbookGet:async()=>null,pcWorkbookPut:async()=>{storedFiles++},pcWorkbookDelete:async()=>{deleted++;return true},
  PC_XLSX_MIME:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',Blob,
  setTimeout,saveState:()=>{saveCalls++;return saveOK},pcExcelVerifySavedPc:async()=>{if(!verifyOK)throw new Error('fixture readback failed')},
  pcBatchExcelClose:()=>{},renderPcArchive:()=>{renders++},showToast:()=>{},appNotice:msg=>notices.push(msg),showContextIssue:info=>reports.push(info),plDiagnoseOperation:(code,details)=>({component:code,writeState:details.writeState,phase:details.phase}),plIncidentSafeAtom:x=>String(x),console:{error:()=>{}},
  appConfirm:async()=>true,JSON,Date,Array,Set,Number,String,Boolean
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return Promise.resolve(ctx.pcBatchExcelCommit()).then(result=>({result,pcs:ctx.pcs,saveCalls,deleted,notices,reports,renders,phases,storedFiles}));
}

test('after a successful bulk save, failed readback does not remove persisted PCs or originals',async()=>{
 const r=await simulateBatchCommit({saveOK:true,verifyOK:false,retainOriginal:true});
 assert.equal(r.result,false); // not verified, caller must not claim success
 assert.equal(r.pcs.length,1);
 assert.equal(r.deleted,0);
 assert.equal(r.storedFiles,1);
 assert.ok(r.reports.some(x=>x.incident.writeState==='committed-readback-unverified'&&x.status.includes('不能重复导入')));
 assert.ok(r.phases.some(x=>x.includes('核对已保存的 PC')));
});

test('before a successful bulk save, failure leaves PC list unchanged and rolls back workbook files',async()=>{
 const r=await simulateBatchCommit({saveOK:false,retainOriginal:true});
 assert.equal(r.result,false);
 assert.equal(r.pcs.length,0);
 assert.equal(r.deleted,1);
 assert.equal(r.storedFiles,1);
 assert.ok(r.reports.some(x=>x.incident.writeState==='commit-not-confirmed'&&x.status.includes('保存未确认')));
});

test('bulk Excel confirmed successful only after verified readback',async()=>{
 const r=await simulateBatchCommit({saveOK:true,verifyOK:true,retainOriginal:true});
 assert.equal(r.result,true);
 assert.equal(r.pcs.length,1);
 assert.equal(r.deleted,0);
 assert.ok(r.phases.some(x=>x.includes('已核对 1 张 PC')));
});

test('contextual action blockers have visible screen-reader connected reasons',()=>{
 const code=text('function setDisabledReason(', 'async function backupRestoreStep(');
 assert.match(code,/button\.dataset\.showDisabledHint==="true"/);
 assert.match(code,/button\.setAttribute\('aria-describedby',parts\.join\(' '\)\)/);
 assert.match(code,/hint\.textContent=reason/);
 assert.match(html,/\.disabled-action-reason\{display:block/);
 assert.match(html,/now\.dataset\.showDisabledHint='true'/);
});

test('integrity scan is read-only and visibly reports completion or interruption',()=>{
 const code=text('els.runDataIntegrity?.addEventListener(', 'els.installApp.addEventListener(');
 assert.match(code,/plLongTaskBegin\('正在检查档案完整性'/);
 assert.match(code,/renderDataIntegrity\(dataIntegrityReport\(\),true\)/);
 assert.match(code,/setDisabledReason\(button,false\)/);
 assert.match(code,/检查不会修改档案数据/);
});

test('compact weekly planner font readability is targeted to actual density-compact board class',()=>{
 assert.match(html,/#plansView \.week-board\.density-compact \.calendar-event-time/);
 assert.match(html,/font-size:12px!important;line-height:1\.35!important/);
});

test('linked PC archive only signals success after saveState and restores old status on failed persistence',()=>{
 const code=text('async function deletePcArchive(', 'async function openPcLinkedRun(');
 assert.match(code,/const before=clone\(pc\)/);
 assert.match(code,/if\(!saveState\(\)\)\{Object\.assign\(pc,before\)/);
 assert.match(code,/PC 封存未能保存/);
});
