'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const s=fs.readFileSync(path.join(__dirname,'round187-native-fullapp-restore-browser.py'),'utf8');
test('Round248 native gate seeds two separate fictional D&D editions with no source-template inference',()=>{
 for(const token of ["'5e-2014'","'5e-2024'","'r187-dnd-'",'pcRuleEditableData(draft).resources','normalizePcArchive(draft,owners)'])assert.ok(s.includes(token),token);
 assert.doesNotMatch(s,/pcDndStructurePreviewFile\(|pcDndAbilityCandidates\(/);
});
test('Round248 native acceptance requires edition and rules after parsing, reload, second ZIP and rejected refresh',()=>{
 for(const key of ['parsedDnd:', 'dndNative:', 'dndSecondZip:', 'dndStillDistinct:'])assert.ok(s.includes(key),key);
 assert.match(s,/for k,v in seed\.items\(\): check\('seed-'\+k, bool\(v\)\)/);
 assert.match(s,/for k,v in final\.items\(\): check\('reload-'\+k,bool\(v\)\)/);
 assert.match(s,/for name,passed in post_rejection\.items\(\):/);
});
