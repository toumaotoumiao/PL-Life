'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
function between(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i,`missing boundaries ${a} / ${b}`);return html.slice(i,j);}
const primary=between('id="backupPrimaryActions"','id="storageBreakdownDisclosure"');
const workflow=between('let backupWorkflowBusy=false;','function markBackupDownloadRequested(');
const verification=between('async function verifySavedBackupFile(file){','/* v8.1.12.57: independent read-only ZIP verification');
const exportFull=between('async function exportBackup(){','async function exportCompactBackup(){');
const storage=between('let storageBreakdownSequence=0;','function openPcAttachmentManager(){');

test('Stage134 status, release manifest, cache and four round contract share the same version',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'production-release-manifest.json')));
 assert.ok(status.current.stage>=134);assert.match(status.current.appVersion,/^8\.1\.12\.3\d{2}$/);
 assert.equal(manifest.appVersion,status.current.appVersion);assert.equal(manifest.schemaVersion,26);
 assert.ok(html.includes(`const APP_UI_VERSION = "${status.current.appVersion}"`));
 assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes('CACHE_NAME=`${CACHE_PREFIX}v'+status.current.appVersion+'`')); 
 assert.equal(status.fourRoundCloseout.rounds[1].quarter,'2/4');
});
test('backup screen has three first-level actions; technical and legacy actions remain without lost IDs',()=>{
 for(const id of ['backupExportAction','backupVerifyAction','backupRestoreAction','exportBtn','verifySavedBackupBtn','restoreFromBackupBtn'])assert.ok(primary.includes(`id="${id}"`),id);
 assert.ok(html.includes('id="backupImportAction"'));assert.ok(html.includes('id="importBtn"'));
 assert.ok(html.includes('id="exportCompactBackupBtn"'));
 assert.match(html,/id="storageBreakdownDisclosure"[^>]*><summary>/);
 assert.match(html,/data-collapse-key="settings:data:backup-more-options"><summary>其他导入与导出/);
 assert.match(html,/id="backupRestoreAction"[\s\S]*?前往导入与迁移，核验文件后再确认恢复/);
});
test('restore from backup navigates to read-only inspection without performing restore or write',()=>{
 const handler=html.match(/getElementById\("restoreFromBackupBtn"\)\?\.addEventListener\("click",\(\)=>\{([^}]+)\}\);/);assert.ok(handler);
 assert.match(handler[1],/activateSettingsPanel\('migration'\)/);
 assert.doesNotMatch(handler[1],/restoreUnifiedCompleteBackup|write|replaceArchive|saveState/);
});
test('verification button requires an actual pending exported ZIP and gives visible accessible reason',()=>{
 assert.match(primary,/id="verifySavedBackupBtn"[^>]*data-show-disabled-hint="true"/);
 assert.match(workflow,/!pending/);assert.match(workflow,/请先导出完整备份/);
 assert.match(html,/hint\.setAttribute\('role','status'\)/);
 assert.match(html,/if\(!parts\.includes\(id\)\)parts\.push\(id\)/);
});
test('backup workflow provides lock, accurate phase feedback and a guaranteed final unlock',()=>{
 const calls=[],buttons=new Map();for(const id of ['verifySavedBackupBtn','exportBtn','exportCompactBackupBtn','restoreFromBackupBtn'])buttons.set(id,{id});
 const ctx={document:{getElementById:id=>buttons.get(id)},safeReadLocalMeta:()=>null,BACKUP_DOWNLOAD_PENDING_KEY:'backup-pending',setDisabledReason:(btn,off,why)=>calls.push([btn.id,off,why]),showToast:m=>calls.push(['toast',m]),plLongTaskBegin:(...x)=>calls.push(['begin',...x]),plLongTaskEnd:m=>calls.push(['end',m]),console};
 vm.createContext(ctx);vm.runInContext(workflow,ctx);
 vm.runInContext('syncBackupWorkflowButtons();',ctx);
 assert.equal(calls.find(x=>x[0]==='verifySavedBackupBtn')[1],true);
 assert.equal(vm.runInContext('beginBackupWorkflow("导出","收集")',ctx),true);
 assert.equal(vm.runInContext('beginBackupWorkflow("重复","冲突")',ctx),false);
 vm.runInContext('endBackupWorkflow("文件已请求保存")',ctx);
 assert.equal(vm.runInContext('backupWorkflowBusy',ctx),false);
 assert.ok(calls.some(x=>x[0]==='end'&&x[1]==='文件已请求保存'));
 assert.ok(calls.some(x=>x[0]==='exportBtn'&&x[1]===false));
});
test('malformed file fails closed and always unlocks verification UI, without marking completed backup',async()=>{
 const calls=[];
 const ctx={beginBackupWorkflow:()=>true,backupDownloadPendingMemory:{bytes:10},safeReadLocalMeta:()=>null,guardImportFile:()=>{throw new Error('invalid-file');},endBackupWorkflow:x=>calls.push(x)};
 vm.createContext(ctx);vm.runInContext(verification,ctx);
 await assert.rejects(vm.runInContext('verifySavedBackupFile({size:10})',ctx),/invalid-file/);
 assert.deepEqual(calls,['备份核验未完成']);
});
test('complete ZIP backup progress only labels request as saved request, not proven disk durability',async()=>{
 const phases=[],ends=[],marks=[];
 const ctx={hasUnsavedSettings:()=>false,beginBackupWorkflow:()=>true,buildUnifiedCompleteBackupBlob:async()=>({blob:new Blob(['a']),manifest:{mediaCount:0}}),Date,APP_NAME:'PL',downloadBlobFile:()=>true,markBackupDownloadRequested:(...x)=>marks.push(x),formatStorageBytes:()=> '1 B',plLongTaskPhase:x=>phases.push(x),showToast:()=>{},endBackupWorkflow:x=>ends.push(x)};
 vm.createContext(ctx);vm.runInContext(exportFull,ctx);
 assert.equal(await vm.runInContext('exportBackup()',ctx),true);
 assert.equal(marks.length,1);assert.equal(ends[0],'已请求下载，请在设备中核验文件');assert.ok(phases.some(x=>x.includes('请求保存 ZIP')));
});
test('complete ZIP download rejection keeps original records and reports failure, always releases lock',async()=>{
 const reports=[],ends=[];const ctx={hasUnsavedSettings:()=>false,beginBackupWorkflow:()=>true,buildUnifiedCompleteBackupBlob:async()=>({blob:new Blob(['test']),manifest:{mediaCount:0}}),Date,APP_NAME:'PL',downloadBlobFile:()=>false,markBackupDownloadRequested:()=>{throw new Error('should not mark')},formatStorageBytes:()=> '4 B',plLongTaskPhase:()=>{},showContextIssue:x=>reports.push(x),APP_UI_VERSION:'8.1.12.312',console,endBackupWorkflow:x=>ends.push(x)};
 vm.createContext(ctx);vm.runInContext(exportFull,ctx);
 assert.equal(await vm.runInContext('exportBackup()',ctx),false);
 assert.equal(ends[0],'导出未完成');assert.equal(reports[0].level,'warning');assert.match(reports[0].status,/没有确认发起下载/);
});
test('manual storage audit provides genuine read phases, leaves stored rows untouched and frees disabled button',async()=>{
 const values={},phases=[],disabled=[];
 const nodes=new Map(['storageBreakdownPanel','storageBreakdownDisclosure','storageBreakdownNote','refreshStorageBreakdownBtn','storageBreakdownArchive','storageBreakdownWorkbooks','storageBreakdownMedia','storageBreakdownTotal'].map(id=>[id,{id,open:true,hidden:false,textContent:''}]));
 const ctx={document:{getElementById:id=>nodes.get(id),querySelector:()=>({hidden:false})},navigator:{storage:{estimate:async()=>({usage:1200})}},backupWorkflowBusy:false,currentArchiveStoredBytes:()=>1024,formatStorageBytes:b=>`${b} B`,pcWorkbookAllRows:async()=>[{blob:{size:12}}],pcMediaAllRows:async()=>[{blob:{size:5},thumbBlob:{size:2}}],setDisabledReason:(b,d,r)=>disabled.push([d,r]),plLongTaskBegin:(...x)=>phases.push(x.join('/')),plLongTaskPhase:x=>phases.push(x),plLongTaskEnd:x=>phases.push(x),console};
 vm.createContext(ctx);vm.runInContext(storage,ctx);
 await vm.runInContext('refreshStorageBreakdown({manual:true})',ctx);
 assert.match(nodes.get('storageBreakdownWorkbooks').textContent,/1 份/);assert.match(nodes.get('storageBreakdownMedia').textContent,/1 张/);
 assert.deepEqual(disabled.map(x=>x[0]),[true,false]);assert.ok(phases.some(x=>x.includes('图片与 Excel')));assert.ok(phases.some(x=>x.includes('估算')));
});
test('responsive primary workflow has three columns wide and one column small; no fake percent',()=>{
 assert.match(html,/#settingsModal #backupPrimaryActions\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important\}/);
 assert.match(html,/#settingsModal #backupPrimaryActions\{grid-template-columns:minmax\(0,1fr\)!important\}/);
 assert.match(verification,/校验图片原件 · \$\{\+\+checkedMedia\}\/\$\{media.length\}/);
 assert.match(verification,/校验原始 Excel · \$\{\+\+checkedWorkbooks\}\/\$\{workbooks.length\}/);
});
test('old attachment restore safety gates remain unchanged by Stage134 UI restructuring',()=>{
 assert.match(html,/await readVerifiedUnlinkedAttachmentRows\(manifest,files,raw\)/);
 assert.match(html,/PLBackupRestorePreflight\.audit\(manifest,raw,files\)/);
 assert.match(html,/const currentComplete=currentIsSame&&archiveStillSame&&attachmentsCurrent/);
 assert.match(html,/async function restoreUnifiedCompleteBackup\(file\)/);
});
