'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const script=read('.github/pl-ci/round187-native-fullapp-restore-browser.py');
const batch=read('RUN_STAGE48_NATIVE_RECOVERY.cmd');
const guide=read('STAGE48_NATIVE_RECOVERY_WINDOWS.md');
const workflow=read('.github/workflows/pl-browser-synthetic.yml');
test('Round194 local Windows runner invokes unchanged real-app native gate, keeping the terminal open',()=>{
 for(const term of ['round187-native-fullapp-restore-browser.py','PL_SYNTHETIC_REPORT_DIR','stage48-evidence','round187-console.log','round187-result.json','pause','exit /b %RUN_EXIT%'])assert.ok(batch.includes(term),term);
 assert.doesNotMatch(batch,/https?:\/\/toumaotoumiao|localStorage\.clear\(|indexedDB\.deleteDatabase\(|git push|curl /i);
 assert.match(guide,/完全虚构|虚构/);assert.match(guide,/不上传私人备份/);
});
test('Round194 test-only dependency install needs user confirmation',()=>{
 assert.match(batch,/choice \/c YN[^\n]*Install Playwright/);
 assert.match(batch,/choice \/c YN[^\n]*Chromium/);
 assert.match(batch,/playwright==1\.55\.0/);
 assert.match(batch,/if errorlevel 2 goto missing_playwright/);
});
test('Round194 blocked navigation is explicitly nonpassing with retained diagnostic phase',()=>{
 assert.match(script,/ERR_BLOCKED_BY_ADMINISTRATOR/);
 assert.match(script,/report\['status'\]='BLOCKED'/);
 assert.match(script,/report\['phase'\] = 'navigate-native-local-origin'/);
 assert.match(script,/if report\['status'\]!='PASS':raise SystemExit\(1\)/);
 assert.match(script,/service_workers='block'/);
 assert.match(script,/context\.route\('\*\*\/\*'/);
 assert.match(script,/external_requests_blocked/);
 assert.doesNotMatch(script,/set_content\(|Object\.defineProperty\(window\s*,\s*['"]indexedDB/);
});
test('Round194 release gate remains mandatory in Actions summary',()=>{
 assert.match(workflow,/round194-native-gate-portability\.test\.cjs/);
 assert.match(workflow,/Round187:\$\{\{ steps\.round187_browser\.outcome \}\}/);
 assert.match(workflow,/if \[ "\$\{check#\*:}" != "success" \]/);
});
