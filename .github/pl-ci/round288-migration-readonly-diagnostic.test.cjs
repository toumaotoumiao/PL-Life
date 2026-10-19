const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const diagnostic=fs.readFileSync(path.join(root,'storage-diagnostic.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('device migration ZIP inspection stays read-only and separate from restore',()=>{
  const start=index.indexOf('async function inspectDeviceMigrationInput(file)');
  const end=index.indexOf('async function deviceMigrationAnonymousDiagnosticText',start);
  assert.ok(start>0&&end>start,'inspection function missing');
  const body=index.slice(start,end);
  assert.match(body,/inspectMigrationZipReadOnly\(file\)/);
  assert.doesNotMatch(body,/restoreUnifiedCompleteBackup\(/);
  assert.doesNotMatch(body,/openPcMediaDb\(/);
  assert.doesNotMatch(body,/openRecoveryDb\(/);
  assert.match(index,/选择 ZIP 并只读核验/);
  assert.match(index,/下一步：检查恢复条件/);
});

test('restore path requires explicit confirmation before restore preflight',()=>{
  const start=index.indexOf('async function restoreVerifiedDeviceMigrationFile()');
  const end=index.indexOf('/* v8.1.12.30:',start);
  assert.ok(start>0&&end>start,'restore function missing');
  const body=index.slice(start,end);
  const confirm=body.indexOf('下一步只检查本机恢复条件');
  const restore=body.indexOf('restoreUnifiedCompleteBackup(file)');
  assert.ok(confirm>=0&&restore>confirm,'restore must be gated before restore/preflight code');
  assert.match(body,/showDeviceMigrationRestoreIssue\(err\)/);
});

test('standalone storage diagnostic contains no schema mutation or record enumeration',()=>{
  assert.match(diagnostic,/不会读取任何档案记录内容/);
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

test('diagnostic page is versioned and included in offline shell',()=>{
  assert.match(index,/const APP_UI_VERSION = "8\.1\.12\.295";/);
  assert.match(diagnostic,/v8\.1\.12\.295/);
  assert.match(sw,/v8\.1\.12\.295/);
  assert.match(sw,/\.\/storage-diagnostic\.html/);
});
