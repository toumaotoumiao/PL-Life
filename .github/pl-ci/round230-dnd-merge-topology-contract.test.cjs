'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const audit=fs.readFileSync(path.join(__dirname,'round223-dnd5-private-diff.py'),'utf8');
const tests=fs.readFileSync(path.join(__dirname,'round223-dnd5-private-diff-test.py'),'utf8');
test('Round230 merged range geometry is compared before anonymous candidate generation',()=>{
 for(const token of ['merged_ranges','merged-topology-mismatch','candidate_cells'])assert.ok(audit.includes(token),token);
 assert.ok(audit.indexOf("result['reason']='merged-topology-mismatch'") < audit.indexOf("result['comparison']='comparable'"));
 assert.match(tests,/test_same_labels_and_formula_positions_reject_shifted_merged_cells/);
});
test('Round230 audit remains local and import cannot be enabled from geometry alone',()=>{
 assert.match(audit,/'import_ready':False/);
 assert.match(audit,/'status':'unverified-difference'/);
 assert.doesNotMatch(audit,/print\(.*(?:cell\[0\]|source\.name|file_path)/);
 for(const name of ['pl-browser-synthetic.yml','pl-native-restore-gate.yml']){
  const y=fs.readFileSync(path.join(root,'.github/workflows',name),'utf8');
  assert.match(y,/round230-dnd-merge-topology-contract\.test\.cjs/);
  assert.match(y,/round229-gallery-reference-preflight\.test\.cjs/);
 }
});
