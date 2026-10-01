'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');

function functionBody(name){
  const start=html.indexOf(`function ${name}(`);
  assert.ok(start>=0,`${name} must exist`);
  const open=html.indexOf('{',start);
  let depth=0;
  for(let i=open;i<html.length;i++){
    if(html[i]==='{')depth++;
    else if(html[i]==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw new Error(`cannot isolate ${name}`);
}

test('canonical module projection receives archive settings explicitly',()=>{
  const body=functionBody('canonicalModuleFromRuntime');
  assert.match(body,/function canonicalModuleFromRuntime\(raw, sourceSettings\)/);
  assert.match(body,/normalizeRichModule\(raw, sourceSettings\)/);
  assert.doesNotMatch(body,/\bsettings\s*\./,'startup-safe projection must not read the global settings binding');
});

test('hydrate path passes its normalized settings instead of the uninitialized global binding',()=>{
  const body=functionBody('hydrateCanonicalArchive');
  assert.match(body,/modules:\s*modules\.map\(m\s*=>\s*canonicalModuleFromRuntime\(m,\s*st\.moduleArchive\)\)/);
});

test('runtime save and history paths pass the initialized global settings explicitly',()=>{
  assert.match(html,/modules\.filter\(m\s*=>\s*m\.name\)\.map\(m\s*=>\s*canonicalModuleFromRuntime\(m,\s*settings\.moduleArchive\)\)/);
  assert.match(html,/canonicalModuleFromRuntime\(row,\s*settings\.moduleArchive\)/);
});
