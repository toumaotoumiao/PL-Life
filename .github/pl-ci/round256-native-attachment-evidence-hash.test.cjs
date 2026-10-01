'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const browser=fs.readFileSync(path.join(__dirname,'round187-native-fullapp-restore-browser.py'),'utf8');
const attest=fs.readFileSync(path.join(__dirname,'round251-native-result-attestation.py'),'utf8');
test('Round256 native result records attachment evidence at all four release phases',()=>{
 for(const token of ["report['attachment_evidence']={'source':source_attachment_hash}","['reloaded_native']=native_attachment_hash","['second_zip']=second_attachment_hash","['post_rejected_reload']=post_attachment_hash"])
   assert.ok(browser.includes(token),token);
 assert.ok(browser.includes('attachmentEvidenceHash:await attachmentEvidence'));
});
test('Round256 attachment evidence includes originals thumbnails MIME metadata and future fields before hashing',()=>{
 for(const token of ['blobHash','thumbHash','blobType','thumbType','futureMedia','futureOrphan','futureWorkbook','futureOrphanWorkbook'])
   assert.ok(browser.includes(token),token);
});
test('Round256 attestation requires four equal anonymous attachment SHA-256 hashes',()=>{
 for(const token of ["attachment_evidence = record.get('attachment_evidence')","native result lacks complete anonymous attachment evidence hashes","native attachment evidence changed across restore"])
   assert.ok(attest.includes(token),token);
});
