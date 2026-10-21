'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function part(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,`missing ${a}`);return html.slice(i,j);}
const source=part('function issueDiagnosticValue(', 'function showPendingRunSaveIssue(');
const PII='SECRET_PC_NAME_WITH_SENSITIVE_STORY__home_user_archive.xlsx__13999888777';
function harness(){const state={};const saves=[];let downloaded=[];const context={console,Date,Set,Blob,APP_UI_VERSION:'8.1.12.325',DATA_SCHEMA_VERSION:26,
 ISSUE_REPORT_SESSION_KEY:'diag',latestIssueReportMemory:'',location:{pathname:'/PL-Life/'},navigator:{userAgent:'Chromium',platform:'Win32',onLine:true},window:{indexedDB:{}},
 sessionStorage:{getItem:key=>state[key]||null,setItem:(key,value)=>state[key]=value},document:{getElementById:()=>null},
 actionDialogResolver:null,queuedContextIssues:[],showToast:()=>{},downloadBlobFile:(blob,name)=>{downloaded.push(blob);return true;},openActionDialog:()=>Promise.resolve(true)};
 vm.createContext(context);vm.runInContext(source,context);return {context,state,downloaded,saves};}
test('Stage147 forged diagnostic-v2 report is reconstructed, not passed verbatim',()=>{
 const {context}=harness();const genuine=context.buildIssueReport({diagnostics:'问题编号：DEVICE-MIGRATION-RESTORE\n错误类型：AbortError',
  incident:context.plBuildDiagnosticIncident({error:{name:'AbortError',plStorageFailure:'browser-database-unreadable',plDbDiagnostic:{transactionError:'NotReadableError: missing backing file',oldVersion:0,newVersion:3}},module:'PC_ATTACHMENT_STORAGE',source:'openPcMediaDbAtVersion',phase:'预检 PC 附件数据库',writeState:'not-started',zipCheck:'passed'})});
 const malicious=genuine+`\n用户自定义字段：${PII}\n原始异常：${PII}\n堆栈：${PII}`;
 const safe=context.plReportForDownload(malicious);
 assert(!safe.includes(PII));assert.match(safe,/IDB_BACKING_STORE_UNREADABLE/);assert.match(safe,/事务提交状态：未开始写入/);
 assert.match(safe,/底层异常：NotReadableError/);assert.match(safe,/ZIP 只读核验：passed/);
});
test('Stage147 forged issue code cannot carry an uppercase private identifier',()=>{
 const {context}=harness();const original=context.buildIssueReport({diagnostics:'问题编号：DEVICE-MIGRATION-RESTORE'});
 const altered=original.replace('问题编号：DEVICE-MIGRATION-RESTORE','问题编号：PRIVATE_PERSON_NAME_2026');
 const clean=context.plReportForDownload(altered);
 assert(!clean.includes('PRIVATE_PERSON_NAME_2026'));assert.match(clean,/问题编号：UNCLASSIFIED/);
});
test('Stage147 download strips previously stored v2 injected PII and keeps issue classification',async()=>{
 const {context,state,downloaded}=harness();const current=context.buildIssueReport({diagnostics:'问题编号：PC-EXCEL-IMPORT\n错误类型：AbortError',
 incident:context.plDiagnoseOperation('PC_EXCEL_IMPORT',{writeState:'draft-only'})});
 const unsafe=current+`\n记录标题：${PII}`;
 state.diag=JSON.stringify([{report:unsafe,time:1,area:'PC 档案 → '+PII}]);
 const latest=context.latestIssueReport();assert(!latest.includes(PII));assert.match(latest,/PC_EXCEL_IMPORT/);
 assert.equal(context.downloadIssueReportText(unsafe),true);const txt=await downloaded[0].text();
 assert(!txt.includes(PII));assert.match(txt,/故障类别/);assert.match(txt,/PC_EXCEL_IMPORT/);
});
test('Stage147 session history is normalized during next persist',()=>{
 const {context,state}=harness();const report=context.buildIssueReport({diagnostics:'问题编号：PC-EXCEL-IMPORT'});
 state.diag=JSON.stringify([{report:report+'\n'+PII,time:1,area:PII}]);
 context.persistIssueReport(report,{area:'PC 档案'});
 assert(!state.diag.includes(PII));
});
test('Stage147 export preview technical details never reproduce stack and names',()=>{
 const rec=part('function renderRecordShowcasePreview()', 'function clearRecordShowcasePreviewDragMarks(');
 const recap=html.slice(html.indexOf('function render(){window.PLExportLivePreview?.register(\'recordsRecapBackdrop\''),html.indexOf('function open(){ensure();const w=document.getElementById(\'recordsRecapBackdrop\'') );
 assert.doesNotMatch(rec,/String\(err\?\.stack\|\|err\)/);
 assert.doesNotMatch(recap,/String\(err\?\.stack\|\|err\)/);
 assert.match(rec,/原始异常消息、堆栈及档案内容/);
 assert.match(recap,/原始异常消息、堆栈及档案内容/);
});

test('Stage147 four risky legacy dialogs now carry transaction-aware incidents',()=>{
 for(const [code,id] of [
  ['DEVICE_RESET','DEVICE-RESET-INCOMPLETE'],['BACKUP_SAVED_FILE_VERIFY','BACKUP-SAVED-VERIFY'],
  ['ENCRYPTED_BACKUP_PREFLIGHT','ENCRYPTED-BACKUP-PREFLIGHT'],['DATA_INTEGRITY_CHECK','DATA-INTEGRITY-CHECK']]){
  assert.match(html,new RegExp("plDiagnoseOperation\\('"+code+"'"));assert(html.includes(id));
 }
});
