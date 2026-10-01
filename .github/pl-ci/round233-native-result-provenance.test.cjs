'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'.github/pl-ci/round187-native-fullapp-restore-browser.py'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-native-restore-gate.yml'),'utf8');
test('Round233 native restore browser writes source commit and actual application version to its result',()=>{
 assert.match(source,/'commit': os\.environ\.get\('GITHUB_SHA', 'local'\)/);
 assert.match(source,/report\['app_version'\] = evaluate\(page, "\(\) => APP_UI_VERSION"\)/);
});
test('Round233 release gate checks result commit and version against the current checkout, not a stale report',()=>{
 assert.match(workflow,/actual_commit=data\.get\('commit'\)/);
 assert.match(workflow,/actual_version=data\.get\('app_version'\)/);
 assert.match(workflow,/expected_commit=os\.environ\['GITHUB_SHA'\]/);
 assert.match(workflow,/match=re\.search\(/);
 assert.match(workflow,/expected_version=match\.group\(1\)/);
 assert.match(workflow,/if status!='PASS' or actual_commit!=expected_commit or actual_version!=expected_version:/);
});
