'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-native-restore-gate.yml'),'utf8');
const existing=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
const runner=fs.readFileSync(path.join(__dirname,'round187-native-fullapp-restore-browser.py'),'utf8');
test('Round196 native gate runs on test-code push or manual dispatch, never deploys or writes repository',()=>{
 assert.match(workflow,/workflow_dispatch:/);
 assert.match(workflow,/\bpush:\s*\n\s*paths:/);
 for(const file of ['index.html','sw.js','.github/pl-ci/**','.github/workflows/pl-native-restore-gate.yml'])
   assert.ok(workflow.includes('- '+file),file);
 assert.doesNotMatch(workflow,/\bpull_request:\s*\n|pages:\s*write|contents:\s*write|deploy-pages|git push|actions\/upload-pages-artifact/);
 assert.match(workflow,/contents: read/);
 assert.match(workflow,/runs-on: ubuntu-latest/);
 assert.match(workflow,/timeout-minutes: 20/);
});
test('Round196 runs existing production app with native storage and still uses pinned test browser',()=>{
 assert.match(workflow,/round187-native-fullapp-restore-browser\.py/);
 assert.match(workflow,/playwright==1\.55\.0/);
 assert.match(workflow,/python -m playwright install --with-deps chromium/);
 assert.match(workflow,/set -o pipefail/);
 assert.match(runner,/page\.goto\(/);
 assert.match(runner,/restoreUnifiedCompleteBackup/);
 assert.match(runner,/page\.reload\(/);
 assert.match(runner,/if report\['status'\]!='PASS':raise SystemExit\(1\)/);
});
test('Round196 records both failure and pass and never accepts BLOCKED or NOT_RUN as success',()=>{
 assert.match(workflow,/if: always\(\)/);
 assert.match(workflow,/if status!='PASS' or actual_commit!=expected_commit or actual_version!=expected_version:/);
 assert.match(workflow,/status,phase,count='NOT_RUN'/);
 assert.match(workflow,/round187-result\.json/);
 assert.match(workflow,/round187-console\.log/);
 assert.match(workflow,/actions\/upload-artifact@v7/);
 assert.match(workflow,/if-no-files-found: error/);
 assert.match(existing,/Round187:\$\{\{ steps\.round187_browser\.outcome \}\}/);
});
