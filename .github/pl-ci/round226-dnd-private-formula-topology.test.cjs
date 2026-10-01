'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const audit=fs.readFileSync(path.join(__dirname,'round223-dnd5-private-diff.py'),'utf8');
const tests=fs.readFileSync(path.join(__dirname,'round223-dnd5-private-diff-test.py'),'utf8');
test('Round226 same sheet count and labels do not override divergent formula topology',()=>{
 for(const token of ['filled_formula_refs','blank_formula_refs',"reason']='formula-topology-mismatch'","result['candidate_cells']"])
  assert.ok(audit.includes(token),token);
 assert.ok(audit.indexOf('formula-topology-mismatch')<audit.indexOf("result['comparison']='comparable'"));
 assert.match(tests,/test_identical_sheet_count_and_labels_do_not_hide_formula_topology_drift/);
});
test('Round226 diff remains local only, with no import or raw-value output',()=>{
 assert.match(audit,/'import_ready':False/);
 assert.match(audit,/'status':'unverified-difference'/);
 assert.doesNotMatch(audit,/print\(.*(?:cell\[0\]|source\.name|file_path)/);
 assert.match(tests,/test_formula_cache_change_does_not_become_candidate_source/);
});
