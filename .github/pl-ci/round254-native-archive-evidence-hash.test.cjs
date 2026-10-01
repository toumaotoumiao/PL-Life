'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const browser=fs.readFileSync(path.join(__dirname,'round187-native-fullapp-restore-browser.py'),'utf8');
const attest=fs.readFileSync(path.join(__dirname,'round251-native-result-attestation.py'),'utf8');
test('Round254 native browser records anonymous archive evidence at four release phases',()=>{
 for(const token of ["['archive_evidence']={'source':source_evidence_hash}","['reloaded_native']=native_evidence_hash","['second_zip']=second_evidence_hash","['post_rejected_reload']=post_evidence_hash"])
  assert.ok(browser.includes(token),token);
 assert.match(browser,/backupSha256Bytes\(new TextEncoder\(\)\.encode\(completeBackupRuleEvidence/);
});
test('Round254 attestation requires four equal SHA-256 archive evidence hashes',()=>{
 for(const token of ["required_evidence = ('source','reloaded_native','second_zip','post_rejected_reload')","re.fullmatch(r'[a-fA-F0-9]{64}'","len({evidence[k].lower() for k in required_evidence}) != 1"])
  assert.ok(attest.includes(token),token);
});
test('Round254 evidence remains anonymous metadata rather than backup bytes',()=>{
 assert.doesNotMatch(browser,/report\[[^\]]+\]\s*=\s*(?:built\.archive|parsed\.incoming|localStorage\.getItem\(STORAGE_KEY\))/);
 assert.match(attest,/reads only check labels and run metadata/);
});
