'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const txn=fs.readFileSync(path.join(root,'data-migration-transaction.js'),'utf8');
const runner=fs.readFileSync(path.join(__dirname,'round151-native-storage-roundtrip-browser.cjs'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
test('Round151 release, cache and history stay in step',()=>{
 const version=html.match(/const APP_UI_VERSION = "([\d.]+)";/)?.[1];assert.ok(version,'current release version missing');
 assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes(`v${version}`),'offline cache version mismatched');
 assert.equal(html.split(`<strong class="version-log-version">v${version}</strong>`).length-1,1,'current version must appear exactly once in history');
});
test('Round151 isolated native browser test includes ZIP, two storage engines, reload and second ZIP',()=>{
 for(const item of ['PLDataMigrationTransaction.run','PLDataMigrationTransaction.recover','page.reload','indexedDB.open','localStorage.getItem','sessionStorage.getItem','pcMakeZipEntries','pcExcelUnzip','PLBackupRestorePreflight.audit','completeBackupRuleEvidence','reexportVerified','failureRolledBack'])assert.ok(runner.includes(item),item);
 assert.match(workflow,/round151-native-storage-roundtrip-browser\.cjs/);
 assert.doesNotMatch(runner,/\/mnt\/data\/PL收集|PL-Life_v8.*备份\.zip|https:\/\/toumaotoumiao\.github\.io/);
});
test('Round151 production restore remains tied to PRE-import source and saved-archive evidence',()=>{
 assert.match(html,/const sourceRuleEvidence=completeBackupRuleEvidence\(incoming\)/);
 assert.match(html,/verifyArchive:\s*async text=>\{[\s\S]*?completeBackupRuleEvidence\(persisted\)!==sourceRuleEvidence/);
 assert.match(txn,/await verifyTargetEvidence\(db,targetEvidence\)/);
 assert.match(txn,/const candidateHash=await sha\(current\)/);
 assert.match(txn,/if\(marker\.abortReason==='source-drift'\)/);
});
test('Round151 fixed data model and prior export protections remain intact',()=>{
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 assert.match(html,/function moduleRecruitBlocks\(/);
 assert.match(html,/function normalizePcRuleSheets\(/);
 assert.match(html,/function completeBackupRuleEvidence\(/);
 assert.doesNotMatch(html,/id="(?:selfIntro|intro)(?:Played|WantRules|HostRules|FamiliarRules)/i);
});
