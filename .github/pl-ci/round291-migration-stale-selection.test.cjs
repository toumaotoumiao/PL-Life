const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const bridge=fs.readFileSync(path.join(root,'.github/pl-ci/stage2-real-site-bridge.js'),'utf8');
const current=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8')).current;
function between(a,b){const start=index.indexOf(a);const end=index.indexOf(b,start);assert.ok(start>0&&end>start,`${a} block missing`);return index.slice(start,end);}
test('invalid replacement backup clears the previously verified recovery target',()=>{
  const body=between('async function inspectDeviceMigrationInput(file)','async function deviceMigrationAnonymousDiagnosticText');
  assert.match(index,/function clearDeviceMigrationVerifiedSelection\(\)/);
  assert.match(body,/summary\.mode!==\'complete\'[\s\S]*clearDeviceMigrationVerifiedSelection\(\)/);
  assert.match(body,/catch\(err\)[\s\S]*deviceMigrationLastInspect=\'failed\';[\s\S]*clearDeviceMigrationVerifiedSelection\(\)/);
});
test('clear helper disables and hides recovery while returning file selection to neutral state',()=>{
  const body=between('function clearDeviceMigrationVerifiedSelection()','function resetDeviceMigrationSelection');
  assert.match(body,/deviceMigrationVerifiedFile=null/);
  assert.match(body,/restore\.disabled=true/);
  assert.match(body,/restore\.hidden=true/);
  assert.match(body,/inspect\.textContent='选择备份'/);
});
test('real-browser bridge follows the current verified-file status card instead of retired copy',()=>{
  assert.match(bridge,/summary\.includes\('synthetic-transfer\.zip'\)/);
  assert.match(bridge,/summary\.includes\('核验完成'\)/);
  assert.match(bridge,/summary\.includes\('可恢复'\)/);
  assert.doesNotMatch(bridge,/summary\.includes\('只读核验'\)/);
  assert.match(bridge,/deviceMigrationVerifiedFile===null/);
  assert.match(bridge,/restoreAfterBad\?\.hidden===true/);
});
test('current release metadata points to Stage121 without schema migration',()=>{
  assert.equal(current.stage,121);
  assert.equal(current.appVersion,'8.1.12.299');
  assert.equal(current.schemaVersion,26);
  assert.ok(index.includes('const APP_UI_VERSION = "8.1.12.299";'));
});
