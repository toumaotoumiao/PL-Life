'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
test('Round186 PL runtime normalization and canonical projection preserve unknown data without masking known fields',()=>{
 assert.match(html,/function normalizeProfileWithSettings\(raw, st\)[\s\S]*?return pcPreserveUnknownJsonProps\(raw, \{/);
 assert.match(html,/function canonicalProfileFromRuntime\(p\)[\s\S]*?futureParts\.identity[\s\S]*?futureParts\.trpg[\s\S]*?futureParts\.rpLength[\s\S]*?PROFILE_RUNTIME_ONLY_KEYS|function canonicalProfileFromRuntime\(p\)[\s\S]*?new Set\(\["name","displayName"/);
 assert.match(html,/function runtimeProfileFromCanonical\(raw, st\)[\s\S]*?profileFutureCanonicalParts: futureParts[\s\S]*?pcPreserveUnknownJsonProps\(raw, mapped,/);
 assert.match(html,/function normalizeBlacklist\(raw\)[\s\S]*?pcPreserveUnknownJsonProps\(source,/);
 assert.match(html,/const removedKeys = new Set\(\[\.\.\.previousKeys\]\.filter\(k => !validKeys\.has\(k\)\)\)/);
});
test('Round186 preference and settings nested fields retain extensions and existing known validation',()=>{
 for(const label of ['normalizeSettings','normalizeField','normalizeUiSettings','normalizeModuleArchiveSettings','normalizeSelfIntro','normalizeIntroModulePrefs','normalizeWeeklyAvailability','normalizeIntroModuleRefs']){
  const idx=html.indexOf('function '+label+'(');assert.ok(idx>0,label+' present');assert.match(html.slice(idx,idx+2500),/pcPreserveUnknownJsonProps/,label+' retains new JSON fields');
 }
 assert.match(html,/function normalizeSettings\(raw\)[\s\S]*?sortMode\.includes\("rpAmount"\)/);
 assert.match(html,/function pcPreserveUnknownJsonProps[\s\S]{0,600}key==='__proto__'\|\|key==='constructor'\|\|key==='prototype'/);
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
});
test('Round186 real-app regression required by CI and final failure aggregate',()=>{
 assert.match(workflow,/round186-pl-settings-future-fields\.test\.cjs/);
 assert.match(workflow,/id: round186_browser/);
 assert.match(workflow,/round186-pl-settings-future-fields-browser\.py/);
 assert.match(workflow,/Round186:\$\{\{ steps\.round186_browser\.outcome \}\}/);
});
