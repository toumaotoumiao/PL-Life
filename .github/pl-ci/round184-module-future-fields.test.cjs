'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'), html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
const start=html.indexOf('function normalizeRichModule('),end=html.indexOf('function canonicalRunFromRuntime(',start);
assert.ok(start>0&&end>start);
const slice=html.slice(start,end);
test('Round184 normalizes known fields while preserving unknown module attributes',()=>{
 assert.match(slice,/const normalized = \{/);assert.match(slice,/return pcPreserveUnknownJsonProps\(raw,normalized\)/);
 for(const field of ['ruleMeta','rating','legacySideOffset'])assert.match(slice,new RegExp(field+': pcPreserveUnknownJsonProps'));
});
test('Round184 canonical serialize retains future module and recruitment attributes',()=>{
 assert.match(slice,/recruitment: pcPreserveUnknownJsonProps\(m\.recruitment,/);
 assert.match(slice,/return pcPreserveUnknownJsonProps\(m,canonical,new Set/);
 for(const key of ['rules','recommendedSkills','cardRequirements','recommendedOccupations','lostRate','background','recruitmentNotes'])assert.match(slice,new RegExp("'"+key+"'"));
});
test('Round184 rehydration evidence projects every module with canonical serializer',()=>{
 assert.match(html,/modules: modules\.map\(m => canonicalModuleFromRuntime\(m, st\.moduleArchive\)\)/);
 assert.match(html,/const modules = raw\.data\.modules\.map\(m => normalizeCanonicalModule\(m, st\.moduleArchive\)\)/);
 assert.match(html,/modules\.filter\(m => m\.name\)\.map\(m => canonicalModuleFromRuntime\(m, settings\.moduleArchive\)\)/);
});
test('Round184 prototype-safe cloning and prior PC normalization retained',()=>{
 assert.match(html,/key==='__proto__'\|\|key==='constructor'\|\|key==='prototype'/);
 assert.match(html,/return pcPreserveUnknownJsonProps\(raw,normalized\)/);
 assert.match(html,/ruleSheets: normalizePcRuleSheets\(raw\?\.ruleSheets\)/);
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
});
test('Round184 actual browser script included in mandatory CI summary',()=>{
 assert.match(workflow,/round184-module-future-fields\.test\.cjs/);
 assert.match(workflow,/id: round184_browser/);
 assert.match(workflow,/round184-module-future-fields-browser\.py/);
 assert.match(workflow,/Round184:\$\{\{ steps\.round184_browser\.outcome \}\}/);
});
