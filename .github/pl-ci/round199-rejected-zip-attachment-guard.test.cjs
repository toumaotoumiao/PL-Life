'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const script=fs.readFileSync(path.join(__dirname,'round187-native-fullapp-restore-browser.py'),'utf8');
const main=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
const isolated=fs.readFileSync(path.join(root,'.github/workflows/pl-native-restore-gate.yml'),'utf8');
test('Round199 rejected ZIP compares native attachment rows on both sides of actual restore API',()=>{
 const start=script.indexOf("corruption = evaluate(page,r'''async () => {");
 const end=script.indexOf("for name,passed in corruption.items():",start);
 assert.ok(start>0&&end>start,'real app corrupt ZIP stage exists');
 const block=script.slice(start,end);
 for(const token of ['pcMediaAllRows()','pcWorkbookAllRows()','blobHash:await hash(row.blob)','thumbHash:await hash(row.thumbBlob)','futureOrphanWorkbook','const beforeAttachments=await attachmentEvidence()','restoreUnifiedCompleteBackup(new File','attachmentsUnchanged:beforeAttachments===await attachmentEvidence()','archiveUnchanged:before===localStorage.getItem(STORAGE_KEY)','noMarker:PLDataMigrationTransaction.getMarker'])assert.ok(block.includes(token),token);
 assert.ok(block.indexOf('const beforeAttachments=')<block.indexOf('restoreUnifiedCompleteBackup(new File'));
 assert.ok(block.indexOf('restoreUnifiedCompleteBackup(new File')<block.indexOf('attachmentsUnchanged:'));
 assert.match(script,/for name,passed in corruption\.items\(\):\s*check\('corrupt-'/);
});
test('Round199 remains gated in both workflows and does not replace actual native browser test',()=>{
 assert.match(main,/round199-rejected-zip-attachment-guard\.test\.cjs/);
 assert.match(isolated,/round199-rejected-zip-attachment-guard\.test\.cjs/);
 assert.match(isolated,/python \.github\/pl-ci\/round187-native-fullapp-restore-browser\.py/);
 assert.doesNotMatch(isolated,/continue-on-error:\s*true/);
});
