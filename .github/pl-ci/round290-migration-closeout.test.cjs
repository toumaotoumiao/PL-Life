const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const current=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8')).current;
function migrationBody(){const a=index.indexOf('data-settings-panel="migration"');const b=index.indexOf('data-settings-panel="version"',a);assert.ok(a>0&&b>a);return index.slice(a,b);}
test('primary migration flow has one dominant old-device action and delayed restore',()=>{
  const body=migrationBody();
  assert.match(body,/id="deviceMigrationExportBtn"[^>]*>导出完整备份/);
  assert.match(body,/class="migration-secondary-link" id="deviceMigrationVerifyCurrentBtn"[^>]*>已有备份？核验文件/);
  assert.match(body,/id="deviceMigrationInspectBtn"[^>]*>选择备份/);
  assert.match(body,/hidden[^>]*id="deviceMigrationRestoreBtn"[^>]*>恢复这份备份/);
});
test('verified backup renders a compact file state card and switches primary action',()=>{
  assert.match(index,/function renderDeviceMigrationStatus\(state,data=\{\}\)/);
  assert.match(index,/migration-file-card/);
  assert.match(index,/migration-file-counts/);
  assert.match(index,/inspect\.textContent='更换文件'/);
  assert.match(index,/restore\.hidden=false/);
});
test('heritage export lives inside heritage review instead of migration landing page',()=>{
  const body=migrationBody();
  assert.doesNotMatch(body,/id="heritageExportBtn"/);
  const dialog=index.slice(index.indexOf('<dialog id="heritageReviewDialog"'),index.indexOf('<script id="heritage-review-action"'));
  assert.match(dialog,/id="heritageExportBtn"[^>]*>导出核对文件/);
});
test('advanced migration tools separate legacy, history recovery, and other export',()=>{
  const body=migrationBody();
  assert.match(body,/>旧版兼容</);
  assert.match(body,/>历史恢复</);
  assert.match(body,/>其他导出</);
  assert.doesNotMatch(body,/>其他导出与历史恢复</);
});
test('issue report exposes an exact problem path and visible execution stage',()=>{
  assert.match(index,/`问题路径：\$\{problemPath\}`/);
  assert.match(index,/phase\?`阶段：\$\{phase\}`/);
  assert.match(index,/id="actionDialogContextActions"/);
  assert.match(index,/contextActions = \[\]/);
});
test('migration restore failures provide direct diagnostic and retry actions',()=>{
  const a=index.indexOf('async function showDeviceMigrationRestoreIssue');
  const b=index.indexOf('async function restoreVerifiedDeviceMigrationFile',a);
  const body=index.slice(a,b);
  assert.match(body,/label:'检查本机存储'/);
  assert.match(body,/storage-diagnostic\.html/);
  assert.match(body,/label:'重新选择备份'/);
});
test('Stage120 version is consistent',()=>{
  assert.equal(current.stage,120);
  assert.equal(current.appVersion,'8.1.12.298');
  assert.match(index,/const APP_UI_VERSION = "8\.1\.12\.298";/);
});
