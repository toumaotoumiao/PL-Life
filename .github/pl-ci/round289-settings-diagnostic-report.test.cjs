const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const current=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8')).current;

test('migration settings keep the normal path compact and task-led',()=>{
  const a=index.indexOf('data-settings-panel="migration"');
  const b=index.indexOf('data-settings-panel="version"',a);
  assert.ok(a>0&&b>a,'migration panel missing');
  const body=index.slice(a,b);
  assert.match(body,/旧设备/);
  assert.match(body,/新设备/);
  assert.match(body,/导出完整备份/);
  assert.match(body,/id="deviceMigrationInspectBtn"[^>]*>选择备份/);
  assert.match(body,/<button[^>]*hidden[^>]*id="deviceMigrationRestoreBtn"[^>]*>恢复这份备份<\/button>/);
  assert.match(body,/历史数据/);
  assert.match(body,/高级工具/);
  assert.doesNotMatch(body,/选择 ZIP 并只读核验/);
  assert.doesNotMatch(body,/下一步：检查恢复条件/);
  assert.doesNotMatch(body,/“本机存储诊断”是独立页面/);
});

test('advanced tools contain diagnostics without crowding the primary migration cards',()=>{
  const a=index.indexOf('class="secondary-tools-details settings-advanced-tools"');
  const b=index.indexOf('</section>\n<section class="settings-section settings-purpose-section" data-settings-panel="version"',a);
  const body=index.slice(a,b);
  assert.match(body,/问题诊断/);
  assert.match(body,/检查本机存储/);
  assert.match(body,/下载最近错误报告/);
  assert.match(body,/复制迁移诊断/);
  assert.match(body,/旧版兼容/);
});

test('warning dialog exposes structured problem details and downloadable report',()=>{
  assert.match(index,/id="actionDialogDiagnostics"[^>]*><summary>问题详情<\/summary>/);
  assert.match(index,/id="actionDialogCopyReport"[^>]*>复制问题详情/);
  assert.match(index,/id="actionDialogDownloadReport"[^>]*>下载错误报告/);
  assert.match(index,/function buildIssueReport/);
  for(const label of ['问题编号：','发生位置：','执行操作：','执行阶段：','当前状态：','建议处理：','程序版本：','数据结构：']) assert.ok(index.includes(label),`missing ${label}`);
});

test('issue report is session-scoped and sanitizes common local identifiers',()=>{
  assert.match(index,/ISSUE_REPORT_SESSION_KEY/);
  assert.match(index,/sessionStorage\.setItem\(ISSUE_REPORT_SESSION_KEY/);
  assert.match(index,/文件名已隐藏/);
  assert.match(index,/本机路径已隐藏/);
  assert.match(index,/隐私说明：报告会隐藏常见文件名、本机路径和网址参数/);
});

test('restore action is revealed only after ZIP inspection passes',()=>{
  const clearStart=index.indexOf('function clearDeviceMigrationVerifiedSelection');
  const resetStart=index.indexOf('function resetDeviceMigrationSelection',clearStart);
  const inspectStart=index.indexOf('async function inspectDeviceMigrationInput',resetStart);
  const diagStart=index.indexOf('async function deviceMigrationAnonymousDiagnosticText',inspectStart);
  const clear=index.slice(clearStart,resetStart);
  const reset=index.slice(resetStart,inspectStart);
  const inspect=index.slice(inspectStart,diagStart);
  assert.match(clear,/restore\.hidden=true/);
  assert.match(reset,/clearDeviceMigrationVerifiedSelection\(\)/);
  assert.match(inspect,/restore\.hidden=false/);
  assert.match(inspect,/restore\.textContent='恢复这份备份'/);
});

test('current version is sourced consistently',()=>{
  assert.ok(Number.isInteger(current.stage)&&current.stage>=119);
  assert.match(current.appVersion,/^8\.1\.12\.\d+$/);
  assert.ok(index.includes(`const APP_UI_VERSION = "${current.appVersion}";`));
});
