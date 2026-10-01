'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const begin=html.indexOf('function pcPreserveUnknownJsonProps('),end=html.indexOf('function pcValidateArchiveInput(',begin);
assert(begin>=0&&end>begin);
const section=html.slice(begin,end),source=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
const preserve=new Function('clone',section.slice(0,section.indexOf('function normalizePcArchive('))+'\nreturn pcPreserveUnknownJsonProps;')(x=>JSON.parse(JSON.stringify(x)));
test('Round183 unknown future top-level extensions survive without overriding canonical fields',()=>{
 const incoming={name:'untrusted',newValue:{items:[0,false,'']},future:{deep:{keep:'yes'}}},canonical={name:'normalized',id:'safe'};
 const before=JSON.stringify(incoming),result=preserve(incoming,canonical);
 assert.equal(result.name,'normalized');assert.deepEqual(result.future,incoming.future);assert.equal(JSON.stringify(incoming),before);
 result.future.deep.keep='modified';assert.equal(incoming.future.deep.keep,'yes');
});
test('Round183 ignores imported prototype-control names',()=>{
 const incoming=JSON.parse('{"__proto__":{"polluted":true},"constructor":{"bad":true},"prototype":1,"future":true}');
 const result=preserve(incoming,{id:'test'});assert.equal(Object.prototype.hasOwnProperty.call(result,'__proto__'),false);
 assert.equal(Object.prototype.hasOwnProperty.call(result,'constructor'),false);assert.equal(Object.prototype.hasOwnProperty.call(result,'prototype'),false);
 assert.equal(result.future,true);assert.equal(({}).polluted,undefined);
});
test('Round183 known sanitization remains active and extensions are cloned',()=>{
 assert.match(section,/const normalized = \{/);assert.match(section,/return pcPreserveUnknownJsonProps\(raw,normalized\)/);
 for(const field of ['ruleMeta','coc','background','excelSource','importSource','importReports'])assert.match(section,new RegExp('\\b'+field+':[^\\n]*pcPreserveUnknownJsonProps|pcPreserveUnknownJsonProps\\([^\\n]*'+field));
 assert.match(section,/normalizePcRuleSheets\(raw\?\.ruleSheets\)/);assert.match(section,/excelEdits:migratedTime\.excelEdits/);assert.match(html,/function normalizePcExcelEdits\(/);
});
test('Round183 original complete ZIP and CoC7 rule gates remain present',()=>{
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);assert.match(html,/function pcRuleIsCoc\(/);assert.match(html,/async function restoreUnifiedCompleteBackup\(/);
 assert.match(html,/completeBackupRuleEvidence\(/);assert.match(html,/PLDataMigrationTransaction\.run\(/);
});
test('Round183 browser test is mandatory in CI failure summary',()=>{
 assert.match(source,/round183-pc-unknown-fields\.test\.cjs/);
 assert.match(source,/id: round183_browser/);
 assert.match(source,/round183-pc-unknown-fields-browser\.py/);
 assert.match(source,/Round183:\$\{\{ steps\.round183_browser\.outcome \}\}/);
});
