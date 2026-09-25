'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('Round122 module cards and compact rows open the archive directly',()=>{
  assert.match(html,/style id="formal-visual-acceptance-round2-v184"/);
  assert.match(html,/native-module-row[^`]*data-native-module-id[^`]*tabindex="0"[^`]*aria-label="打开模组档案/);
  assert.match(html,/native-module-card[^`]*data-native-module-id[^`]*tabindex="0"[^`]*aria-label="打开模组档案/);
  assert.match(html,/card && !moduleBatchMode && !e\.target\.closest\("button,a,input,select,textarea,summary,details,label"\)/);
  assert.match(html,/moduleNativeGrid\.addEventListener\("keydown"[\s\S]*?openNativeModuleEditor\(e\.target\.dataset\.nativeModuleId\)/);
});

test('module action rows no longer duplicate an Edit button and compact tags match the 3-item card rule',()=>{
  const cardFn=(html.match(/function nativeModuleCardHTML\([\s\S]*?\/\* v8\.1\.11\.82/)||[])[0]||'';
  assert.ok(cardFn,'module card function should exist');
  assert.doesNotMatch(cardFn,/data-native-module-edit=/);
  assert.match(cardFn,/native-module-row-tags">\$\{tags\.slice\(0, 3\)/);
  assert.match(cardFn,/native-module-card-head[\s\S]*?<h3 title="\$\{escapeHTML\(m\.name\)\}"/);
});

test('PL run-footprint summary has no nested button and exposes management inside expanded content',()=>{
  const cardFn=(html.match(/function cardHTML\(p\)[\s\S]*?function setBlacklistStateOnProfile/)||[])[0]||'';
  assert.ok(cardFn,'PL card function should exist');
  const summary=(cardFn.match(/<summary>[\s\S]*?<\/summary>/)||[])[0]||'';
  assert.doesNotMatch(summary,/<button/);
  assert.match(cardFn,/class="runs-expanded-tools"[\s\S]*?data-action="runs"[\s\S]*?>管理跑团记录</);
  assert.match(html,/#profilesView \.runs-expanded-tools/);
  assert.match(html,/@media\(max-width:760px\)[\s\S]*?#profilesView \.runs-expanded-tools \.link-btn\{min-height:40px!important/);
});

test('first-use empty states expose direct create actions',()=>{
  assert.match(html,/data-profile-empty-new>＋ 新建 PL/);
  assert.match(html,/data-empty-new-plan>＋ 新建开团计划/);
  assert.match(html,/e\.target\.closest\("\[data-profile-empty-new\]"\)[\s\S]*?openEditor\(\)/);
  assert.match(html,/e\.target\.closest\("\[data-empty-new-plan\]"\)[\s\S]*?createRunPlan\(\)/);
});

test('Round121 no longer pins the application to its historical release number',()=>{
  const round121=fs.readFileSync(path.join(root,'.github/pl-ci/round121-formal-visual-acceptance.test.cjs'),'utf8');
  const versionAssertion=round121.split('\n').find(line=>line.includes('APP_UI_VERSION'))||'';
  assert.ok(versionAssertion.includes('\\d+'),'Round121 should accept future patch releases');
  assert.ok(!versionAssertion.includes('183'),'Round121 must not pin the current release to v183');
});

test('Round122 changes presentation only and keeps schema 26',()=>{
  const guard=fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8');
  assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
  assert.match(guard,/MAX_SCHEMA\s*=\s*26/);
  assert.match(html,/version-log-version">v8\.1\.12\.184/);
  assert.match(html,/version-log-version">v8\.1\.12\.183/);
});
