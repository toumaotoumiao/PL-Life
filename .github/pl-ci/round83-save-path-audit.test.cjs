'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,`missing ${a}`);return html.slice(i,j)};
const guard=cut('function assertRunLogInputPreserved()','function assertPcCollectionInputPreserved(');
const logs=cut('function normalizeLogRows(','\nfunction isoDatePart(');
test('independent Log entries never silently discard trailing legacy URLs or notes',()=>{
 const c={MAX_LOG_URLS:12,MAX_LOG_LABEL_LENGTH:30,runPlans:[],runRecords:[],escapeHTML:x=>x,safeLogUrl:x=>x};vm.createContext(c);vm.runInContext(logs+guard,c);
 c.runPlans=[{logEntries:[{url:'https://example.invalid/1',label:'one'}],logUrls:['https://example.invalid/1','https://example.invalid/2']}];
 assert.throws(()=>c.assertRunLogInputPreserved(),/条目以外的网址/);
 c.runPlans=[{logEntries:[{url:'',label:'one'}],logLabels:['one','orphan']}];
 assert.throws(()=>c.assertRunLogInputPreserved(),/条目以外的备注/);
});
test('verified-save transaction observers are isolated as noncritical post-commit work',()=>{
 const save=cut('function saveState(options = {}) {','\nfunction enforceTopLevelUse()');
 const start=save.indexOf('localStorage.setItem(STORAGE_KEY, serialized);');
 const end=save.indexOf('return true;',start);
 const committed=save.slice(start,end);
 assert.match(committed,/afterSave\("保存事务观察", \(\) => observeSaveMeta\(saveMeta\)\)/);
 assert.match(committed,/afterSave\("保存基线更新", \(\) => setStateBaseSaveMeta\(saveMeta\)\)/);
 assert.doesNotMatch(committed,/^\s*observeSaveMeta\(saveMeta\);/m);
 assert.doesNotMatch(committed,/^\s*setStateBaseSaveMeta\(saveMeta\);/m);
});
