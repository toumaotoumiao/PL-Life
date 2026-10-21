'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const start=html.indexOf('function plIncidentSafeAtom('),end=html.indexOf('function buildIssueReport(',start);
assert(start>0&&end>start);
const body=html.slice(start,end);
function harness(){const ctx={sanitizeIssueDiagnosticText:(s)=>String(s).slice(0,6000),console};vm.createContext(ctx);vm.runInContext(body,ctx);return ctx;}
const badDb={name:'AbortError',message:'Version change transaction was aborted in upgradeneeded event handler.',plStorageFailure:'browser-database-unreadable',plDbDiagnostic:{label:'PC 附件数据库',oldVersion:0,newVersion:1,currentStep:'结构升级完成',completedSteps:['建立 PC 图片仓库'],transactionError:'NotReadableError: Data lost due to missing file. Affected record should be considered irrecoverable'}};
function specimen(){return harness().plBuildDiagnosticIncident({error:badDb,operation:'检查本机恢复条件',phase:'预检 PC 附件数据库',zipCheck:'passed',writeState:'not-started',source:'openPcMediaDbAtVersion → pcMediaDbUpgradeSchema / req.onerror',module:'PC_ATTACHMENT_STORAGE',expected:'数据库可读写',observed:'失败',result:'备份未提交'});}
test('reports native NotReadableError despite outer AbortError',()=>{const item=specimen();assert.equal(item.classification,'IDB_BACKING_STORE_UNREADABLE');assert.equal(item.component,'PC_ATTACHMENT_STORAGE');assert.match(item.evidence.join(' '),/外层异常：AbortError/);assert.match(item.evidence.join(' '),/底层异常：NotReadableError/);});
test('reports stable function boundary without blaming false source line',()=>{const item=specimen();assert.match(item.source,/openPcMediaDbAtVersion/);assert.match(item.observedAt,/request.onerror/);assert.match(item.unknown,/JavaScript 调用行不等于底层故障代码行/);});
test('preserves ZIP pass and no-commit facts independently',()=>{const item=specimen();assert.equal(item.zipCheck,'passed');assert.equal(item.writeState,'not-started');assert.equal(item.result,'备份未提交');});
test('phase marked as last observed step, not necessarily exception origin',()=>{const item=specimen();assert.equal(item.lastStep,'结构升级完成');assert.match(item.evidence.join('\n'),/升级处理器已执行：建立 PC 图片仓库/);});
test('unclassified operation remains unclassified when no root evidence',()=>{const item=harness().plBuildDiagnosticIncident({error:new Error('Something went wrong'),source:'saveState'});assert.equal(item.classification,'UNCLASSIFIED_OPERATION_FAILURE');assert.match(item.unknown,/未确认/);});
test('distinguishes blocked database from corrupt backing store',()=>{const item=harness().plBuildDiagnosticIncident({error:new Error('媒体库升级被其他打开的标签页阻止'),phase:'预检 PC 附件数据库'});assert.equal(item.classification,'IDB_DATABASE_BLOCKED');});
test('structured report uses explicit evidence/provenance',()=>{const text=harness().plDiagnosticIncidentLines(specimen()).join('\n');for(const k of ['故障类别：','程序观测位置：','事务报告：','已确认事实：','尚无法证明：','写入提交状态：'])assert.match(text,new RegExp(k));});
test('no sensitive ZIP filename or contents included in bounded structured report',()=>{const item=specimen();const text=harness().plDiagnosticIncidentLines(item).join('\n');assert.doesNotMatch(text,/PL收集梦想生活_自动备份_2026|zip.*\.zip|Excel 正文/);});
test('new DB opened once at target version; no v0→v1→v2→v3 loop',()=>{const section=html.slice(html.indexOf('async function openPcMediaDb()'),html.indexOf('function pcMediaTxDone',html.indexOf('async function openPcMediaDb()')));assert.match(section,/return await openPcMediaDbAtVersion\(targetVersion\)/);assert.doesNotMatch(section,/for\s*\(let version/);});
test('restored attachments checked by content digests across reload',()=>{assert.match(html,/async function completeRestoreAttachmentDigests/);assert.match(html,/backupSha256Bytes\(bytes\)/);assert.match(html,/attachmentDigests:await completeRestoreAttachmentDigests/);assert.match(html,/JSON\.stringify\(attachmentDigests\)===JSON\.stringify\(receipt\.attachmentDigests\)/);});
test('migration error uses structured incident and does not auto-delete browser database',()=>{const chunk=html.slice(html.indexOf('async function showDeviceMigrationRestoreIssue('),html.indexOf('async function restoreVerifiedDeviceMigrationFile('));assert.match(chunk,/incident:plBuildDiagnosticIncident/);assert.match(chunk,/localStorageUnusable/);assert.doesNotMatch(chunk,/deleteDatabase\(/);});

test('auxiliary pages use stable code, source and explicit unknown cause without leaking error messages',()=>{
 const code=fs.readFileSync(path.resolve(__dirname,'../../aux-issue-report.js'),'utf8');
 const context={window:{},document:{},Blob,URL,Date,Set,String,Math};vm.createContext(context);vm.runInContext(code,context);
 const report=context.window.PlAuxIssueReport.report({code:'MODULE-SAVE-FAIL',area:'模组高级工具',action:'自动保存',state:'提交状态不确定',error:{name:'NotReadableError',message:'private_CN_CONTACT_123.xlsx'}});
 assert.match(report,/故障类别：PERSISTENCE_NOT_CONFIRMED/);
 assert.match(report,/程序观测位置：module-tools.save → putdb\/getdb/);
 assert.match(report,/尚无法证明：/);
 assert.match(report,/错误类型：NotReadableError/);
 assert.doesNotMatch(report,/private_CN_CONTACT|123.xlsx/);
});
test('post-reload recovery report specifies exactly which independent checks failed',()=>{
 const i=html.indexOf('const checks={',html.indexOf('async function verifyCompleteRestoreAfterReload'));
 const chunk=html.slice(i,html.indexOf('if(typeof window',i));
 for(const key of ['archiveFingerprint','saveNonce','inMemoryCounts','persistedCounts','attachmentCounts','attachmentBytes','pcListQuery'])assert.match(chunk,new RegExp(key));
 assert.match(chunk,/BACKUP-POSTRELOAD-MISMATCH/);
 assert.match(chunk,/incident:plBuildDiagnosticIncident/);
});
