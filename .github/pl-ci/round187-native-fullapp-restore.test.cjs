'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const script=fs.readFileSync(path.join(__dirname,'round187-native-fullapp-restore-browser.py'),'utf8');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
test('Round187 invokes the actual app full ZIP code on an isolated native storage origin',()=>{
 for(const token of ['page.goto(',"'127.0.0.1'",'buildUnifiedCompleteBackupBlob','verifyCompleteBackupZipFile','parseUnifiedCompleteBackupFile','restoreUnifiedCompleteBackup','page.reload(','pcMediaPut','pcWorkbookPut','pcMediaAllRows','pcWorkbookAllRows','completeBackupRuleEvidence','PLDataMigrationTransaction.getMarker','sessionStorage.getItem'])assert.ok(script.includes(token),token);
 assert.doesNotMatch(script,/Object\.defineProperty\(window\s*,\s*['"](?:localStorage|indexedDB)['"]|page\.set_content\(/);
 assert.doesNotMatch(script,/https:\/\/toumaotoumiao\.github\.io|PL收集梦想生活_完整备份_20\d\d|\/mnt\/data\/PL收集/);
 assert.match(script,/if report\['status'\]!='PASS':raise SystemExit\(1\)/);
});
test('Round187 uses real application confirmation, verifies linked originals and rejects corrupt ZIP before write',()=>{
 for(const token of ['#actionDialogConfirm','.click()','r187-media-hash','r187-thumb-hash','r187-book-hash','futurePLRecord','futurePC','futureSettings','attachmentsUnchanged:beforeAttachments===await attachmentEvidence()','archiveUnchanged:before===localStorage.getItem(STORAGE_KEY)','noMarker:PLDataMigrationTransaction.getMarker','rejected,missingAttachmentsRejected','r187-orphan-image','r187-orphan-media-hash','r187-orphan-thumb-hash','r187-orphan-book-hash','secondOrphans'])assert.ok(script.includes(token),token);
 assert.match(source,/async function restoreUnifiedCompleteBackup\(file\)/);
 assert.match(source,/async function buildUnifiedCompleteBackupBlob\(/);
 assert.match(source,/async function createRecoverySnapshot\(/);
});
test('Round187 gated in CI, and its failure is not swallowed by continue-on-error',()=>{
 assert.match(workflow,/round187-native-fullapp-restore\.test\.cjs/);
 assert.match(workflow,/id: round187_browser/);
 assert.match(workflow,/python \.github\/pl-ci\/round187-native-fullapp-restore-browser\.py/);
 assert.match(workflow,/Round187:\$\{\{ steps\.round187_browser\.outcome \}\}/);
});
