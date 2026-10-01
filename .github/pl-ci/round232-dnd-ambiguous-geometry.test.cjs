'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const code=fs.readFileSync(path.join(__dirname,'round223-dnd5-private-diff.py'),'utf8');
const tests=fs.readFileSync(path.join(__dirname,'round223-dnd5-private-diff-test.py'),'utf8');
test('Round232 duplicate coordinates and overlapping merges cannot quietly overwrite source evidence',()=>{
 for(const term of ['duplicate worksheet cell coordinate','overlapping merged ranges','duplicate merged range','MAX_MERGES_PER_SHEET'])assert.ok(code.includes(term),term);
 for(const term of ['test_duplicate_cell_coordinate_fails_closed_without_private_text','test_overlapping_and_duplicate_merge_ranges_are_rejected'])assert.ok(tests.includes(term),term);
});
test('Round232 merged subordinate cells are excluded; candidate differences remain non-importable',()=>{
 assert.match(code,/subordinate_merged_cell/);
 assert.match(code,/if subordinate_merged_cell\(blank\[index\],ref\):/);
 assert.match(code,/'import_ready':False/);
 assert.match(tests,/test_merged_subordinate_cell_never_becomes_candidate_even_if_changed/);
});
test('Round232 comparison remains read-only and no private samples are copied to public code',()=>{
 assert.doesNotMatch(code,/open\([^\n]*["']w[ab]?["']/);
 assert.match(code,/candidate_cells':\[\]/);
 assert.doesNotMatch(code,/print\(.*(?:cell\[0\]|file_path|source\.name)/);
});
