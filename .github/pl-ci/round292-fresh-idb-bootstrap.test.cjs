'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
test('Round292 fresh PC attachment DB uses progressive v0→v1→v2→v3 initialization',()=>{
  assert.match(html,/knownVersion!==null&&knownVersion<targetVersion/);
  assert.match(html,/for\(let version=Math\.max\(1,knownVersion\+1\);version<=targetVersion;version\+\+\)/);
  assert.match(html,/openPcMediaDbAtVersion\(version\)/);
  assert.match(html,/建立 PC 图片仓库/);
  assert.match(html,/建立 PC 原始 Excel 仓库/);
  assert.match(html,/建立完整恢复事务日志仓库/);
});
test('Round292 fresh recovery DB uses progressive v0→v1→v2 initialization',()=>{
  assert.match(html,/knownVersion !== null && knownVersion < RECOVERY_DB_VERSION/);
  assert.match(html,/openRecoveryDbAtVersion\(version\)/);
  assert.match(html,/建立恢复点仓库/);
  assert.match(html,/建立历史附件仓库/);
});
test('Round292 upgrade failures report the exact schema step and transaction error',()=>{
  assert.match(html,/失败步骤：\$\{context\.currentStep\}/);
  assert.match(html,/事务异常：\$\{context\.transactionError\}/);
  assert.match(html,/attachIndexedDbUpgradeTransactionDiagnostics/);
  assert.match(html,/completedSteps/);
});
test('Round292 user-side migration report exposes the failing database substep without record data',()=>{
  assert.match(html,/function deviceMigrationDbDiagnosticLines/);
  assert.match(html,/失败数据库：\$\{String\(diag\.label\)\}/);
  assert.match(html,/数据库步骤：\$\{String\(diag\.currentStep\)\}/);
  assert.match(html,/已完成步骤：\$\{completed\.join\(' → '\)\}/);
  assert.match(html,/版本变更事务：\$\{String\(diag\.transactionError\)\}/);
});
test('Round292 schema upgrades repair required media indexes while a versionchange transaction is active',()=>{
  assert.match(html,/tx\.objectStore\(PC_MEDIA_STORE\)/);
  assert.match(html,/indexNames\.contains\("pcId"\)/);
  assert.match(html,/indexNames\.contains\("createdAt"\)/);
});
test('Round292 keeps current app/schema contract aligned with the authoritative status',()=>{
  assert.ok(Number(status.current.stage)>=122);
  assert.equal(status.current.schemaVersion,26);
  assert.match(html,new RegExp(`const APP_UI_VERSION = \"${String(status.current.appVersion).replace(/\./g,'\\.')}\"`));
  assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
});
