'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('module dossier table history is independently optional and defaults off',()=>{
  assert.match(html,/function defaultMod\(\)\{return\{layoutVersion:3,[\s\S]*?showHistory:false/);
  assert(html.includes('id="entityModHistory"'));
  assert(html.includes('<span>显示桌次历史</span>'));
  assert.match(html,/if\(t\.id==='entityModHistory'\)s\.showHistory=t\.checked/);
});

test('history-dependent controls are disabled when table history is off',()=>{
  assert.match(html,/entity-module-history-details \$\{state\.showHistory\?'':'is-disabled'\}/);
  assert.match(html,/id="entityModRole" \$\{state\.showHistory\?'':'disabled'\}/);
  assert.match(html,/id="entityModPeople"[\s\S]*?\$\{state\.showHistory\?'':'disabled'\}/);
  assert.match(html,/id="entityModHo"[\s\S]*?\$\{state\.showHistory\?'':'disabled'\}/);
  assert.match(html,/id="entityModPlans"[\s\S]*?\$\{state\.showHistory\?'':'disabled'\}/);
  assert.match(html,/privacyMaskEnabled\|\|!state\.showHistory/);
});

test('complete module canvas omits history blocks and history header stats when disabled',()=>{
  assert.match(html,/rows=state\.showHistory\?moduleEntities\(m,state\):\[\]/);
  assert.match(html,/if\(state\.showHistory\)for\(let start=0;start<rows\.length/);
  assert.match(html,/const all=state\.showHistory\?moduleEntities\(m,state\):\[\]/);
  assert.match(html,/state\.showHistory\?\[\`\$\{all\.filter/);
});

test('legacy module export preferences only retain history when table-specific settings were customized',()=>{
  assert.match(html,/oldVersion<3\)\{modState\.showHistory=Boolean\(hadCustomHistoryPrefs\);modState\.layoutVersion=3;\}/);
  assert.match(html,/hadCustomHistoryPrefs=raw\.role==='kp'\|\|raw\.role==='pl'[\s\S]*?raw\.showHo===false/);
});
