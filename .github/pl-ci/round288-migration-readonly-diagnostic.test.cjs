const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const diagnostic=fs.readFileSync(path.join(root,'storage-diagnostic.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const current=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8')).current;
const versionRe=new RegExp(String(current.appVersion).replace(/\./g,'\\.'));

test('device migration ZIP inspection stays read-only and separate from restore',()=>{
  const start=index.indexOf('async function inspectDeviceMigrationInput(file)');
  const end=index.indexOf('async function deviceMigrationAnonymousDiagnosticText',start);
  assert.ok(start>0&&end>start,'inspection function missing');
  const body=index.slice(start,end);
  assert.match(body,/inspectMigrationZipReadOnly\(file\)/);
  assert.doesNotMatch(body,/restoreUnifiedCompleteBackup\(/);
  assert.doesNotMatch(body,/openPcMediaDb\(/);
  assert.doesNotMatch(body,/openRecoveryDb\(/);
  assert.match(index,/id="deviceMigrationInspectBtn"[^>]*>选择备份</);
  assert.match(index,/id="deviceMigrationRestoreBtn"[^>]*>恢复这份备份</);
});

test('restore path requires explicit confirmation before restore preflight',()=>{
  const start=index.indexOf('async function restoreVerifiedDeviceMigrationFile()');
  const end=index.indexOf('/* v8.1.12.30:',start);
  assert.ok(start>0&&end>start,'restore function missing');
  const body=index.slice(start,end);
  const confirm=body.indexOf('const proceed=await appConfirm(');
  const gate=body.indexOf('if(!proceed)return false;');
  const restore=body.indexOf('restoreUnifiedCompleteBackup(file)');
  assert.ok(confirm>=0&&gate>confirm&&restore>gate,'restore must be gated by explicit confirmation before restore/preflight code');
  assert.match(body,/showDeviceMigrationRestoreIssue\(err\)/);
});

test('standalone storage diagnostic contains no schema mutation or record enumeration',()=>{
  assert.match(diagnostic,/检查过程使用只读方式/);
  assert.match(diagnostic,/indexedDB\.databases/);
  assert.match(diagnostic,/indexedDB\.open\(name\)/);
  assert.doesNotMatch(diagnostic,/createObjectStore\s*\(/);
  assert.doesNotMatch(diagnostic,/deleteDatabase\s*\(/);
  assert.doesNotMatch(diagnostic,/\.put\s*\(/);
  assert.doesNotMatch(diagnostic,/\.add\s*\(/);
  assert.doesNotMatch(diagnostic,/getAll\s*\(/);
  assert.doesNotMatch(diagnostic,/openCursor\s*\(/);
  assert.doesNotMatch(diagnostic,/indexedDB\.open\(name\s*,/);
});

test('diagnostic page is versioned from the unique current project status and included in offline shell',()=>{
  assert.match(index,new RegExp(`const APP_UI_VERSION = [\"']${versionRe.source}[\"'];`));
  assert.match(diagnostic,versionRe);
  assert.match(sw,versionRe);
  assert.match(sw,/\.\/storage-diagnostic\.html/);
});
