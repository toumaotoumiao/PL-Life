'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('PC profile editor keeps core identity open and moves card time into an optional disclosure',()=>{
  assert.match(html,/const opened=pcProfileFoldOpenV72\.has\(key\)\?pcProfileFoldOpenV72\.get\(key\):\(key==='档案关联'\|\|key==='人物资料'\);/);
  assert.match(html,/class="editor-subdetails-v181 pc-character-time-v181"/);
  assert.match(html,/角色卡时间（可选）/);
  assert.match(html,/cardTimeHasValue\?\s*'open'\s*:\s*''/);
});

test('module editor keeps frequent fields on the first layer and groups low-frequency archive fields',()=>{
  assert.match(html,/class="native-module-primary-v181 wide"/);
  for(const field of ['name','author','location','era','players','duration']) assert(html.includes(`data-native-module-field="${field}"`),`${field} missing`);
  assert.match(html,/class="wide editor-subdetails-v181 native-module-more-v181"/);
  assert.match(html,/更多档案信息/);
  for(const field of ['source','nature','reKp','notes']) assert(html.includes(`data-native-module-field="${field}"`),`${field} missing from low-frequency group`);
});

test('plan and record editors fold explanation/history that should not permanently occupy the first screen',()=>{
  assert.match(html,/class="editor-inline-help-v181"><summary>KP \/ KPC 关联说明<\/summary>/);
  assert.match(html,/class="record-archive-details-v181"><summary><span>原计划安排<\/span><small>\$\{schedule\.length\} 次<\/small><\/summary>/);
  assert.doesNotMatch(html,/<div class="plan-editor-help">搜索不会改变关联。点击已有 PL/);
});

test('four editor families share the flat divider hierarchy instead of nested bordered cards',()=>{
  assert.match(html,/\.pc-editor-body \.pc-form-section,\.plan-editor-form>\.plan-editor-block,\.table-record\.is-editing \.record-section\{[\s\S]*?border:0!important;[\s\S]*?border-top:1px solid/);
  assert.match(html,/\.native-module-editor-grid-v181>\.native-module-more-v181,[\s\S]*?border-radius:0!important;[\s\S]*?background:transparent!important/);
  assert.match(html,/@media\(max-width:760px\)[\s\S]*?editor-subdetails-v181>summary,[\s\S]*?min-height:42px/);
});

test('Round119 is presentation-only and current schema stays 26',()=>{
  const guard=fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8');
  assert.match(guard,/MAX_SCHEMA\s*=\s*26/);
  assert(!/schema\s*=\s*27|MAX_SCHEMA\s*=\s*27/.test(html+guard));
});
