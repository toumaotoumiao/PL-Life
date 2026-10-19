'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
test('Round287 complete-backup restore reports a named stage before asking users for private archives',()=>{
  assert.match(html,/backupRestoreStep\("读取并校验 ZIP"/);
  assert.match(html,/backupRestoreStep\("预检 PC 附件数据库"/);
  assert.match(html,/backupRestoreStep\("预检恢复点数据库"/);
  assert.match(html,/backupRestoreStep\("创建恢复前安全快照"/);
  assert.match(html,/backupRestoreStep\("提交完整恢复事务"/);
  assert.match(html,/恢复阶段：\$\{phase\}/);
});
test('Round287 IndexedDB upgrade diagnostics identify the database and legacy/current version without row content',()=>{
  assert.match(html,/indexedDbUpgradeError\("恢复点数据库",req,ctx\)/);
  assert.match(html,/indexedDbUpgradeError\("PC 附件数据库",req,ctx\)/);
  assert.match(html,/oldVersion=event\.oldVersion/);
  assert.match(html,/storesBefore=Array\.from\(db\.objectStoreNames/);
  assert.match(html,/storesAfter=Array\.from\(db\.objectStoreNames/);
});
test('Round287 copied diagnostics explicitly exclude private archive content',()=>{
  assert.match(html,/匿名诊断说明：以下数据库信息只包含本机数据库版本和对象仓库名称，不包含 PL／PC 名称、Log、图片、Excel 内容或备份正文/);
  assert.match(html,/文件类型：\$\{zip\?"ZIP":"其他导入文件"\}/);
  const begin=html.indexOf('async function anonymousBackupStorageDiagnostics()');
  const end=html.indexOf('async function openRecoveryDb()',begin);
  assert(begin>0&&end>begin);
  const body=html.slice(begin,end);
  assert.doesNotMatch(body,/getAll\(|\.get\(|archive\.json|manifest\.json|file\.text\(|arrayBuffer\(/);
});
test('Round287 keeps schema and complete ZIP format unchanged',()=>{
  assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
  assert.match(html,new RegExp('const APP_UI_VERSION = \"'+String(status.current.appVersion).replace(/\./g,'\\.')+'\"'));
});
