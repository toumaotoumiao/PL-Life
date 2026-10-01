'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const nativePath=path.join(root,'.github/workflows/pl-native-restore-gate.yml');
const browserPath=path.join(root,'.github/workflows/pl-browser-synthetic.yml');
const native=fs.readFileSync(nativePath,'utf8');
const browser=fs.readFileSync(browserPath,'utf8');

function referencedTests(text){return [...text.matchAll(/\.github\/pl-ci\/([A-Za-z0-9._-]+\.test\.cjs)/g)].map(m=>m[1]);}

test('all workflow-referenced Node test files exist',()=>{
  for(const [label,text] of [['native',native],['browser',browser]]){
    const refs=referencedTests(text);
    assert.ok(refs.length>0,label+' workflow should reference tests');
    for(const ref of refs) assert.ok(fs.existsSync(path.join(root,'.github/pl-ci',ref)),`${label} missing ${ref}`);
  }
});

test('native node --test multiline list keeps shell continuations until final file',()=>{
  const marker='      - name: Check full-app native gate contract and recovery guards';
  const start=native.indexOf(marker);assert.ok(start>=0,'native contract step');
  const end=native.indexOf('\n      - name:',start+marker.length);assert.ok(end>start,'next native step');
  const block=native.slice(start,end);
  const lines=block.split(/\r?\n/).filter(line=>line.includes('.github/pl-ci/')&&line.includes('.test.cjs'));
  assert.ok(lines.length>=40,'native gate should keep the full contract list');
  lines.forEach((line,i)=>{
    if(i<lines.length-1) assert.match(line,/\\\s*$/,`continuation missing before ${lines[i+1]?.trim()}`);
    else assert.doesNotMatch(line,/\\\s*$/,'last test line should end the command cleanly');
  });
});
