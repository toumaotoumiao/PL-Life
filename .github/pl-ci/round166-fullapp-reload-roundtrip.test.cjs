'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const site=fs.readFileSync(path.join(__dirname,'stage3-local-synthetic-test.html'),'utf8');
const bridge=fs.readFileSync(path.join(__dirname,'stage2-real-site-bridge.js'),'utf8');
const runner=fs.readFileSync(path.join(__dirname,'run-browser-ci.cjs'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('Round166 native full-app reload and second ZIP are required checks, not optional green',()=>{
 for(const item of ['seed-rule-fixtures','checkpoint-reload','verify-reload-reexport','await loadRealSite();',
 '完整恢复后重新打开、原生存储回读及二次完整 ZIP 对照','failed.length'])assert.ok(site.includes(item),item);
 assert.match(runner,/report\.tests\.length===13/);
 assert.match(workflow,/node \.github\/pl-ci\/run-browser-ci\.cjs/);
 assert.match(workflow,/round166-fullapp-reload-roundtrip\.test\.cjs/);
});
test('Round166 real export, native attachment bytes and unknown rule values are independently compared after reload',()=>{
 for(const item of ['buildUnifiedCompleteBackupBlob','parseUnifiedCompleteBackupFile','verifyCompleteBackupZipFile',
 'localStorage.getItem(STORAGE_KEY)','pcMediaAllRows()','pcWorkbookAllRows()',
 "sessionStorage.getItem('__pl_stage3_restore_core_sha')",'completeBackupRuleEvidence',
 "p.ruleSheets['future-system']",'zipThumb','zipBook','noMarker:!marker','unprotected:!migrationReadOnly'])assert.ok(bridge.includes(item),item);
 assert.match(bridge,/case 'verify-reload-reexport':[\s\S]*?return result;/);
 assert.doesNotMatch(site,/https:\/\/toumaotoumiao\.github\.io/);
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
});
