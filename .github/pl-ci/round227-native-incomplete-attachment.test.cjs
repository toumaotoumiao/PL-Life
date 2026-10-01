'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const native=fs.readFileSync(path.join(__dirname,'round187-native-fullapp-restore-browser.py'),'utf8');
test('Round227 genuine ZIP with linked image, workbook or orphan thumbnail missing must reject before write',()=>{
 const a=native.indexOf('const missingPaths='),b=native.indexOf('return {rejected,missingAttachmentsRejected',a);
 assert.ok(a>=0&&b>a);
 const block=native.slice(a,b);
 for(const token of ['listed.media?.[0]?.path','listed.workbooks?.[0]?.path','listed.unlinkedAttachments?.media?.[0]?.thumbPath','delete omitted[missingPath]','restoreUnifiedCompleteBackup(new File','catch(_){blocked=true;}'])assert.ok(block.includes(token),token);
 assert.ok(native.indexOf('attachmentsUnchanged:beforeAttachments===await attachmentEvidence()',b)>b);
});
test('Round227 missing attachment results remain behind native release gate',()=>{
 for(const name of ['pl-browser-synthetic.yml','pl-native-restore-gate.yml']){
  const y=fs.readFileSync(path.join(root,'.github/workflows',name),'utf8');
  assert.match(y,/round227-native-incomplete-attachment\.test\.cjs/);
 }
 assert.match(native,/if report\['status'\]!='PASS':raise SystemExit\(1\)/);
});
